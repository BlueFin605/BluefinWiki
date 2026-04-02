/**
 * MCP Tool: list_pages
 *
 * Browse the wiki page hierarchy. Returns top-level pages or children of a specific page.
 * Only published pages are returned.
 */

import { S3Client, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3';

const s3 = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
const bucket = process.env.PAGES_BUCKET!;

interface PageEntry {
  title: string;
  s3Key: string;
  hasChildren: boolean;
}

/**
 * Extract title and status from YAML frontmatter in raw markdown.
 * Only reads the frontmatter block — no full YAML parser needed.
 */
function parseFrontmatter(content: string): { title: string; status: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return { title: 'Untitled', status: 'unknown' };

  const frontmatter = match[1];
  const titleMatch = frontmatter.match(/^title:\s*["']?(.+?)["']?\s*$/m);
  const statusMatch = frontmatter.match(/^status:\s*["']?(.+?)["']?\s*$/m);

  return {
    title: titleMatch ? titleMatch[1] : 'Untitled',
    status: statusMatch ? statusMatch[1].toLowerCase() : 'unknown',
  };
}

/**
 * Read just enough of a page file to extract frontmatter (first 2KB).
 */
async function getPageMeta(key: string): Promise<{ title: string; status: string } | null> {
  try {
    const result = await s3.send(new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      Range: 'bytes=0-2047',
    }));
    const content = await result.Body!.transformToString();
    return parseFrontmatter(content);
  } catch {
    return null;
  }
}

/**
 * List pages at a given level in the hierarchy.
 * @param prefix - S3 prefix to list under (empty string for root)
 */
export async function listPages(prefix?: string): Promise<PageEntry[]> {
  const listPrefix = prefix ? `${prefix}/` : '';

  const result = await s3.send(new ListObjectsV2Command({
    Bucket: bucket,
    Prefix: listPrefix,
    Delimiter: '/',
  }));

  const folders = (result.CommonPrefixes || [])
    .map(p => p.Prefix!)
    .filter(p => !p.endsWith('_attachments/'));

  // For each folder, derive the .md file key and read its metadata
  const entries = await Promise.all(
    folders.map(async (folderPrefix) => {
      // Folder is like "abc-123/" (root) or "parent/abc-123/" (child)
      // The .md file is "abc-123/abc-123.md" or "parent/abc-123/abc-123.md"
      const parts = folderPrefix.slice(0, -1).split('/');
      const guid = parts[parts.length - 1];
      const mdKey = `${folderPrefix}${guid}.md`;

      const meta = await getPageMeta(mdKey);
      if (!meta || meta.status !== 'published') return null;

      // Check if this page has children by listing one level deeper
      const childResult = await s3.send(new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: folderPrefix,
        Delimiter: '/',
        MaxKeys: 2, // Just need to know if there are subfolders
      }));

      const childFolders = (childResult.CommonPrefixes || [])
        .filter(p => !p.Prefix!.endsWith('_attachments/'));

      return {
        title: meta.title,
        s3Key: mdKey,
        hasChildren: childFolders.length > 0,
      } as PageEntry;
    })
  );

  return entries.filter((e): e is PageEntry => e !== null);
}
