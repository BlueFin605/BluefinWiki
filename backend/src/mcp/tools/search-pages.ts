/**
 * MCP Tool: search_pages
 *
 * Search for wiki pages by title or content using the pre-built Fuse.js search index.
 * The search index already excludes non-published pages.
 */

import { S3Client, GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import Fuse from 'fuse.js';

const s3 = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
const bucket = process.env.PAGES_BUCKET!;

interface SearchIndexEntry {
  id: string;
  title: string;
  content: string;
  path: string;
  tags: string[];
  modifiedDate: string;
  author: string;
}

interface SearchResult {
  title: string;
  guid: string;
  s3Key: string;
  displayPath: string;
  score: number;
}

// Module-level cache for warm Lambda invocations
let cachedFuse: Fuse<SearchIndexEntry> | null = null;

async function getSearchIndex(): Promise<Fuse<SearchIndexEntry>> {
  if (cachedFuse) return cachedFuse;

  const result = await s3.send(new GetObjectCommand({
    Bucket: bucket,
    Key: 'search-index.json',
  }));

  const entries: SearchIndexEntry[] = JSON.parse(await result.Body!.transformToString());
  cachedFuse = new Fuse(entries, {
    keys: ['title', 'content', 'tags'],
    threshold: 0.4,
    includeScore: true,
  });

  return cachedFuse;
}

/**
 * Find the S3 key for a page by its GUID.
 * Pages are stored as {guid}/{guid}.md (root) or {parent}/{guid}/{guid}.md (nested).
 * We search for files matching the GUID pattern.
 */
async function findS3KeyByGuid(guid: string): Promise<string | null> {
  // Try root-level first (most common)
  const rootKey = `${guid}/${guid}.md`;
  try {
    await s3.send(new GetObjectCommand({
      Bucket: bucket,
      Key: rootKey,
      Range: 'bytes=0-0', // HEAD-like check
    }));
    return rootKey;
  } catch {
    // Not at root, search deeper
  }

  // Scan for the file anywhere in the bucket
  const result = await s3.send(new ListObjectsV2Command({
    Bucket: bucket,
    Prefix: '',
  }));

  const match = (result.Contents || []).find(obj =>
    obj.Key?.endsWith(`${guid}/${guid}.md`)
  );

  return match?.Key || null;
}

/**
 * Search for pages matching a query string.
 */
export async function searchPages(query: string): Promise<SearchResult[]> {
  const fuse = await getSearchIndex();
  const results = fuse.search(query, { limit: 20 });

  // Resolve S3 keys for matches in parallel
  const resolved = await Promise.all(
    results.map(async (result) => {
      const s3Key = await findS3KeyByGuid(result.item.id);
      if (!s3Key) return null;

      return {
        title: result.item.title,
        guid: result.item.id,
        s3Key,
        displayPath: result.item.path,
        score: result.score ?? 0,
      } as SearchResult;
    })
  );

  return resolved.filter((r): r is SearchResult => r !== null);
}
