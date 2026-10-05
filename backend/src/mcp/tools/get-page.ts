/**
 * MCP Tool: get_page
 *
 * Read the full content of a wiki page as raw markdown with YAML frontmatter.
 * Only published pages are returned.
 */

import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getPageKey } from '../../storage/PageIndexService.js';
import { isTicketKey, resolvePageRef } from '../../ticket-keys/ticket-keys-service.js';

const s3 = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
const bucket = process.env.PAGES_BUCKET!;

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** An S3 key as given, or the S3 key of a page named by GUID or ticket key. */
async function toS3Key(ref: string): Promise<string> {
  if (!isTicketKey(ref) && !UUID_REGEX.test(ref)) return ref;
  const guid = await resolvePageRef(ref);
  const s3Key = await getPageKey(guid);
  if (!s3Key) throw new Error(`Page not found: ${ref}`);
  return s3Key;
}

/**
 * Read a page by its S3 key (or its GUID / ticket key) and return the raw
 * markdown content. Returns an error message if the page doesn't exist or
 * isn't published.
 */
export async function getPage(ref: string): Promise<string> {
  const s3Key = await toS3Key(ref.trim());
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
