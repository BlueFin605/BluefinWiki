/**
 * MCP Tool: get_page
 *
 * Read the full content of a wiki page as raw markdown with YAML frontmatter.
 * Only published pages are returned.
 */

import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

const s3 = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
const bucket = process.env.PAGES_BUCKET!;

/**
 * Read a page by its S3 key and return the raw markdown content.
 * Returns an error message if the page doesn't exist or isn't published.
 */
export async function getPage(s3Key: string): Promise<string> {
  try {
    const result = await s3.send(new GetObjectCommand({
      Bucket: bucket,
      Key: s3Key,
    }));

    const content = await result.Body!.transformToString();

    // Check published status from frontmatter
    const statusMatch = content.match(/^---\n[\s\S]*?^status:\s*["']?(.+?)["']?\s*$/m);
    const status = statusMatch ? statusMatch[1].toLowerCase() : 'unknown';

    if (status !== 'published') {
      throw new Error('Page is not available');
    }

    return content;
  } catch (err: unknown) {
    const error = err as { name?: string; message?: string };
    if (error.name === 'NoSuchKey') {
      throw new Error(`Page not found at ${s3Key}`);
    }
    throw err;
  }
}
