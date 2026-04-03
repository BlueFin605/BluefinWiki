/**
 * MCP Tool: update_page
 *
 * Update an existing wiki page's content and/or metadata.
 * Only published pages can be updated. Sets modifiedBy to "mcp-client".
 * Handles wiki link extraction when content is modified.
 *
 * Properties use merge semantics: omitted keys are preserved,
 * null values delete the property, provided values replace.
 * Page-type schema validation is blocking — rejects on violation.
 */

import { getStoragePlugin } from '../../storage/StoragePluginRegistry.js';
import { extractWikiLinks, updatePageLinks } from '../../pages/link-extraction.js';
import { PageContent, PageProperty } from '../../types/index.js';
import { validatePropertiesForUpdate } from './mcp-property-validation.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const KEBAB_CASE_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export interface UpdatePageInput {
  pageGuid: string;
  title?: string;
  content?: string;
  tags?: string[];
  status?: 'published' | 'archived';
  pageType?: string | null;
  properties?: Record<string, PageProperty | null>;
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

  // Validate property names and type/value consistency (input validation)
  if (properties) {
    for (const [key, prop] of Object.entries(properties)) {
      if (!KEBAB_CASE_REGEX.test(key)) {
        throw new Error(`Property name "${key}" must be kebab-case`);
      }
      // null means delete — skip type/value validation
      if (prop === null) continue;
      switch (prop.type) {
        case 'string':
          if (typeof prop.value !== 'string') throw new Error(`Property "${key}" value must be a string`);
          break;
        case 'number':
          if (typeof prop.value !== 'number') throw new Error(`Property "${key}" value must be a number`);
          break;
        case 'date':
          if (typeof prop.value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(prop.value))
            throw new Error(`Property "${key}" value must be a date string (YYYY-MM-DD)`);
          break;
        case 'tags':
          if (!Array.isArray(prop.value)) throw new Error(`Property "${key}" value must be an array`);
          break;
        default:
          throw new Error(`Property "${key}" has invalid type "${(prop as PageProperty).type}"`);
      }
    }
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

  // Merge properties: omitted keys preserved, null keys deleted, provided keys replaced
  let mergedProperties: Record<string, PageProperty> | undefined;
  if (properties !== undefined) {
    mergedProperties = { ...(existingPage.properties || {}) };
    for (const [key, value] of Object.entries(properties)) {
      if (value === null) {
        delete mergedProperties[key];
      } else {
        mergedProperties[key] = value;
      }
    }
    if (Object.keys(mergedProperties).length === 0) {
      mergedProperties = undefined;
    }
  } else {
    mergedProperties = existingPage.properties;
  }

  // Determine effective pageType after update
  const effectivePageType = pageType === null
    ? undefined
    : (pageType ?? existingPage.pageType);

  // Blocking page-type schema validation (MCP only)
  if (effectivePageType && mergedProperties) {
    await validatePropertiesForUpdate(effectivePageType, mergedProperties);
  }

  const now = new Date().toISOString();

  const updatedPage: PageContent = {
    ...existingPage,
    ...(title !== undefined ? { title } : {}),
    ...(content !== undefined ? { content } : {}),
    ...(tags !== undefined ? { tags } : {}),
    ...(status !== undefined ? { status } : {}),
    ...(mergedProperties ? { properties: mergedProperties } : {}),
    ...(effectivePageType ? { pageType: effectivePageType } : {}),
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
  if (!mergedProperties) {
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
