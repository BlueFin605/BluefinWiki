/**
 * Rebuild Page Index
 *
 * Scans all pages in S3 and populates the DynamoDB page_index table.
 * Use as:
 * - One-time migration when the index is first deployed
 * - Admin recovery tool if the index becomes stale
 * - Can be invoked as a Lambda handler or run directly via local-server
 *
 * Uses the same buildPageTree + flattenPageTree pattern as search-build-index.
 */

import { getStoragePlugin } from './index.js';
import { PageSummary } from '../types/index.js';
import * as PageIndex from './PageIndexService.js';

/**
 * Flatten a nested page tree into a flat list
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

export interface RebuildResult {
  totalPages: number;
  indexed: number;
  failed: number;
  errors: string[];
  durationMs: number;
}

/**
 * Rebuild the entire page index from S3.
 *
 * For each page found via buildPageTree, we need the S3 key.
 * Since findPageFolder is private on the storage plugin, we use the
 * knowledge that pages are stored at {ancestorPath}/{guid}/{guid}.md
 * and reconstruct the key from the page hierarchy.
 */
export async function rebuildPageIndex(): Promise<RebuildResult> {
  const start = Date.now();
  const storagePlugin = getStoragePlugin();
  const errors: string[] = [];
  let indexed = 0;

  // Get all pages as a tree (uses listChildren recursively)
  const pageTree = await storagePlugin.buildPageTree();
  const allPages = flattenPageTree(pageTree);

  console.log(`[RebuildIndex] Found ${allPages.length} pages to index`);

  // For each page, load it to get metadata and build the S3 key
  for (const page of allPages) {
    try {
      const fullPage = await storagePlugin.loadPage(page.guid);

      // Reconstruct the S3 folder path by walking ancestors
      const s3Folder = await buildS3Folder(page.guid, fullPage.folderId || null, storagePlugin);

      await PageIndex.putPageKey({
        guid: page.guid,
        s3Key: s3Folder,
        parentGuid: fullPage.folderId || null,
        title: fullPage.title,
        updatedAt: fullPage.modifiedAt || new Date().toISOString(),
      });

      indexed++;

      if (indexed % 50 === 0) {
        console.log(`[RebuildIndex] Progress: ${indexed}/${allPages.length}`);
      }
    } catch (error) {
      const msg = `Failed to index page ${page.guid} (${page.title}): ${(error as Error).message}`;
      console.error(`[RebuildIndex] ${msg}`);
      errors.push(msg);
    }
  }

  const durationMs = Date.now() - start;
  console.log(`[RebuildIndex] Complete: ${indexed}/${allPages.length} indexed in ${durationMs}ms (${errors.length} errors)`);

  return {
    totalPages: allPages.length,
    indexed,
    failed: errors.length,
    errors,
    durationMs,
  };
}

/**
 * Build the S3 folder path for a page by walking its ancestor chain.
 * Returns the folder (e.g., "parent/child/"), not the .md file key.
 */
async function buildS3Folder(
  guid: string,
  parentGuid: string | null,
  storagePlugin: ReturnType<typeof getStoragePlugin>,
): Promise<string> {
  if (!parentGuid || parentGuid === '') {
    return `${guid}/`;
  }

  const ancestorPath = await buildAncestorPath(parentGuid, storagePlugin);
  return `${ancestorPath}${guid}/`;
}

async function buildAncestorPath(
  guid: string,
  storagePlugin: ReturnType<typeof getStoragePlugin>,
): Promise<string> {
  try {
    const page = await storagePlugin.loadPage(guid);

    if (!page.folderId || page.folderId === '') {
      return `${guid}/`;
    }

    const parentPath = await buildAncestorPath(page.folderId, storagePlugin);
    return `${parentPath}${guid}/`;
  } catch {
    return `${guid}/`;
  }
}

/**
 * Lambda handler for rebuild-page-index
 */
export async function handler(): Promise<{ statusCode: number; body: string }> {
  try {
    const result = await rebuildPageIndex();

    return {
      statusCode: 200,
      body: JSON.stringify(result),
    };
  } catch (error) {
    console.error('[RebuildIndex] Fatal error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: (error as Error).message }),
    };
  }
}
