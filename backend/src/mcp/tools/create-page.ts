/**
 * MCP Tool: create_page
 *
 * Create a new wiki page with content and metadata.
 * Sets createdBy/modifiedBy to "mcp-client".
 * Handles wiki link extraction, sort order calculation, and page type validation.
 */

import { v4 as uuidv4 } from 'uuid';
import { getStoragePlugin } from '../../storage/StoragePluginRegistry.js';
import { extractWikiLinks, updatePageLinks } from '../../pages/link-extraction.js';
import { validatePageType, validateChildTypeConstraint } from '../../pages/page-type-validation.js';
import { PageContent, PageProperty } from '../../types/index.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const KEBAB_CASE_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export interface CreatePageInput {
  title: string;
  content?: string;
  parentGuid?: string | null;
  tags?: string[];
  status?: 'published' | 'archived';
  pageType?: string;
  properties?: Record<string, PageProperty>;
}

export interface CreatePageResult {
  guid: string;
  title: string;
  parentGuid: string | null;
  createdAt: string;
}

export async function createPage(input: CreatePageInput): Promise<CreatePageResult> {
  const {
    title,
    content = '',
    parentGuid = null,
    tags = [],
    status = 'published',
    pageType,
    properties,
  } = input;

  // Validate title
  if (!title || title.trim().length === 0) {
    throw new Error('Title is required');
  }
  if (title.length > 200) {
    throw new Error('Title must be 200 characters or less');
  }

  // Validate parentGuid format if provided
  if (parentGuid && !UUID_REGEX.test(parentGuid)) {
    throw new Error('Invalid parentGuid format');
  }

  // Validate pageType format if provided
  if (pageType && !UUID_REGEX.test(pageType)) {
    throw new Error('Invalid pageType format');
  }

  // Validate property names are kebab-case and values match declared types
  if (properties) {
    for (const [key, prop] of Object.entries(properties)) {
      if (!KEBAB_CASE_REGEX.test(key)) {
        throw new Error(`Property name "${key}" must be kebab-case`);
      }
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
          throw new Error(`Property "${key}" has invalid type "${prop.type}"`);
      }
    }
  }

  // Validate page type constraints (advisory)
  if (pageType) {
    const typeValidation = await validatePageType(pageType, properties || {});
    if (typeValidation.warnings.length > 0) {
      console.warn('Page type validation warnings:', typeValidation.warnings);
    }
  }

  if (parentGuid && pageType) {
    const childValidation = await validateChildTypeConstraint(parentGuid, pageType);
    if (childValidation.warnings.length > 0) {
      console.warn('Child type constraint warnings:', childValidation.warnings);
    }
  }

  const storagePlugin = getStoragePlugin();

  // Determine sortOrder — place new page at end of siblings
  const siblings = await storagePlugin.listChildren(parentGuid);
  const maxSortOrder = siblings.reduce((max, s) => {
    return s.sortOrder !== undefined && s.sortOrder > max ? s.sortOrder : max;
  }, -1000);
  const sortOrder = maxSortOrder + 1000;

  // Build PageContent
  const guid = uuidv4();
  const now = new Date().toISOString();

  const pageContent: PageContent = {
    guid,
    title,
    content,
    folderId: parentGuid || '',
    tags,
    status,
    sortOrder,
    ...(pageType ? { pageType } : {}),
    ...(properties ? { properties } : {}),
    createdBy: 'mcp-client',
    modifiedBy: 'mcp-client',
    createdAt: now,
    modifiedAt: now,
  };

  // Save page
  await storagePlugin.savePage(guid, parentGuid, pageContent);

  // Extract and save wiki links
  if (content) {
    try {
      const wikiLinks = extractWikiLinks(content);
      await updatePageLinks(guid, wikiLinks);
    } catch (err) {
      console.error('Failed to update page links after save:', err);
    }
  }

  console.log('Page created via MCP:', { guid, title, parentGuid, timestamp: now });

  return {
    guid,
    title,
    parentGuid,
    createdAt: now,
  };
}
