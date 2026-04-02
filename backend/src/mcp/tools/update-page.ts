/**
 * MCP Tool: update_page
 *
 * Update an existing wiki page's content and/or metadata.
 * Only published pages can be updated. Sets modifiedBy to "mcp-client".
 * Handles wiki link extraction when content is modified.
 */

import { getStoragePlugin } from '../../storage/StoragePluginRegistry.js';
import { extractWikiLinks, updatePageLinks } from '../../pages/link-extraction.js';
import { PageContent, PageProperty } from '../../types/index.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface UpdatePageInput {
  pageGuid: string;
  title?: string;
  content?: string;
  tags?: string[];
  status?: 'published' | 'archived';
  pageType?: string | null;
  properties?: Record<string, PageProperty>;
}

export interface UpdatePageResult {
  guid: string;
  title: string;
  modifiedAt: string;
  modifiedBy: string;
}

export async function updatePage(input: UpdatePageInput): Promise<UpdatePageResult> {
  const { pageGuid, title, content, tags, status, pageType, properties } = input;

  // Validate GUID format
  if (!pageGuid || !UUID_REGEX.test(pageGuid)) {
    throw new Error('Invalid page GUID format');
  }

  // Check at least one update field is provided
  const hasUpdates = title !== undefined || content !== undefined || tags !== undefined
    || status !== undefined || pageType !== undefined || properties !== undefined;
  if (!hasUpdates) {
    throw new Error('At least one field to update is required');
  }

  // Validate title length
  if (title !== undefined && title.length > 200) {
    throw new Error('Title must be 200 characters or less');
  }

  const storagePlugin = getStoragePlugin();

  // Load existing page
  let existingPage: PageContent;
  try {
    existingPage = await storagePlugin.loadPage(pageGuid);
  } catch (err: unknown) {
    const error = err as { code?: string };
    if (error.code === 'PAGE_NOT_FOUND') {
      throw new Error('Page not found');
    }
    throw err;
  }

  // Only published pages can be updated
  if (existingPage.status !== 'published') {
    throw new Error('Only published pages can be updated');
  }

  // Merge updates into existing page
  const now = new Date().toISOString();

  const mergedProperties = properties !== undefined
    ? (Object.keys(properties).length > 0 ? properties : undefined)
    : existingPage.properties;

  const mergedPageType = pageType === null
    ? undefined
    : (pageType ?? existingPage.pageType);

  const updatedPage: PageContent = {
    ...existingPage,
    ...(title !== undefined ? { title } : {}),
    ...(content !== undefined ? { content } : {}),
    ...(tags !== undefined ? { tags } : {}),
    ...(status !== undefined ? { status } : {}),
    ...(mergedProperties ? { properties: mergedProperties } : {}),
    ...(mergedPageType ? { pageType: mergedPageType } : {}),
    modifiedBy: 'mcp-client',
    modifiedAt: now,
    // Preserve immutable fields
    guid: existingPage.guid,
    folderId: existingPage.folderId,
    createdBy: existingPage.createdBy,
    createdAt: existingPage.createdAt,
  };

  // Remove pageType if explicitly set to null
  if (pageType === null) {
    delete updatedPage.pageType;
  }
  // Remove properties if now empty
  if (updatedPage.properties && Object.keys(updatedPage.properties).length === 0) {
    delete updatedPage.properties;
  }

  // Save
  const parentGuid = existingPage.folderId || null;
  await storagePlugin.savePage(pageGuid, parentGuid, updatedPage);

  // Update wiki links if content changed
  if (content !== undefined) {
    try {
      const wikiLinks = extractWikiLinks(updatedPage.content);
      await updatePageLinks(pageGuid, wikiLinks);
    } catch (err) {
      console.error('Failed to update page links after save:', err);
      // Save succeeded — don't fail the tool response
    }
  }

  return {
    guid: updatedPage.guid,
    title: updatedPage.title,
    modifiedAt: now,
    modifiedBy: 'mcp-client',
  };
}
