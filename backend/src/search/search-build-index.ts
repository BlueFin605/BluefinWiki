/**
 * Lambda: search-build-index
 *
 * Builds the client-side search index JSON and uploads to S3.
 * Triggered by S3 events on page create/update/delete.
 *
 * Flow:
 * 1. Fetch all pages from storage plugin
 * 2. Strip markdown from content
 * 3. Build ClientSearchIndex JSON
 * 4. Upload search-index.json to S3 static assets bucket
 * 5. (Optional) Invalidate CloudFront cache
 */

import { S3Event } from 'aws-lambda';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getStoragePlugin } from '../storage/index.js';
import { PageSummary } from '../types/index.js';
import { ClientSearchIndex, CLIENT_SEARCH_INDEX_VERSION } from './SearchTypes.js';
import { stripMarkdown } from './markdown-stripper.js';

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  ...(process.env.AWS_ENDPOINT_URL ? {
    endpoint: process.env.AWS_ENDPOINT_URL,
    forcePathStyle: true,
  } : {}),
});

/**
 * Flatten page tree into a list of all pages
 */
function flattenPageTree(pages: (PageSummary & { children?: PageSummary[] })[]): PageSummary[] {
  const result: PageSummary[] = [];

  function traverse(items: (PageSummary & { children?: PageSummary[] })[]) {
    for (const item of items) {
      result.push(item);
      if (item.children && Array.isArray(item.children)) {
        traverse(item.children);
      }
    }
  }

  traverse(pages);
  return result;
}

/**
 * Build hierarchical path for a page
 */
async function buildPagePath(
  pageGuid: string,
  storagePlugin: ReturnType<typeof getStoragePlugin>
): Promise<string> {
  try {
    const ancestors = await storagePlugin.getAncestors(pageGuid);
    const page = await storagePlugin.loadPage(pageGuid);
    return [...ancestors.map(a => a.title), page.title].join(' > ');
  } catch {
    return 'Unknown';
  }
}

/**
 * Build the search index (in-memory only, no S3 upload)
 */
export async function buildSearchIndexData(): Promise<ClientSearchIndex> {
  const storagePlugin = getStoragePlugin();

  // Get all pages
  const pageTree = await storagePlugin.buildPageTree();
  const allPages = flattenPageTree(pageTree);

  // Filter to only published pages
  const publishedPages = allPages.filter(p => p.status === 'published');

  // Build index entries
  const entries = await Promise.all(
    publishedPages.map(async (page) => {
      try {
        const fullPage = await storagePlugin.loadPage(page.guid);
        const path = await buildPagePath(page.guid, storagePlugin);

        return {
          id: page.guid,
          title: fullPage.title,
          content: stripMarkdown(fullPage.content),
          tags: fullPage.tags || [],
          path,
          modifiedDate: fullPage.modifiedAt,
          author: fullPage.modifiedBy,
        };
      } catch (error) {
        console.warn(`Failed to index page ${page.guid}:`, error);
        return null;
      }
    })
  );

  // Filter out failed entries
  const validEntries = entries.filter((e): e is NonNullable<typeof e> => e !== null);

  return {
    version: CLIENT_SEARCH_INDEX_VERSION,
    builtAt: new Date().toISOString(),
    totalPages: validEntries.length,
    entries: validEntries,
  };
}

/**
 * Build and upload the search index to S3
 */
export async function buildSearchIndex(): Promise<ClientSearchIndex> {
  const assetsBucket = process.env.SEARCH_INDEX_BUCKET || process.env.PAGES_BUCKET || process.env.S3_PAGES_BUCKET;

  if (!assetsBucket) {
    throw new Error('No S3 bucket configured for search index (SEARCH_INDEX_BUCKET or PAGES_BUCKET)');
  }

  const searchIndex = await buildSearchIndexData();

  // Upload to S3
  const indexKey = process.env.SEARCH_INDEX_KEY || 'search-index.json';
  await s3Client.send(new PutObjectCommand({
    Bucket: assetsBucket,
    Key: indexKey,
    Body: JSON.stringify(searchIndex),
    ContentType: 'application/json',
    CacheControl: 'public, max-age=60',
  }));

  console.log(`Search index built: ${searchIndex.totalPages} pages, uploaded to s3://${assetsBucket}/${indexKey}`);

  return searchIndex;
}

/**
 * Lambda handler — triggered by S3 events
 */
export const handler = async (event: S3Event): Promise<void> => {
  console.log('Search index build triggered by S3 event:', JSON.stringify(event.Records?.map(r => r.s3?.object?.key)));

  try {
    await buildSearchIndex();
  } catch (error) {
    console.error('Failed to build search index:', error);
    throw error;
  }
};
