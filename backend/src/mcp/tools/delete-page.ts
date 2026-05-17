/**
 * MCP Tool: delete_page
 *
 * Delete a wiki page, optionally with all its children.
 * Mirrors the HTTP DELETE /pages/{guid} handler but without role-based auth
 * (MCP access is gated by API key at API Gateway).
 */

import { getStoragePlugin } from '../../storage/StoragePluginRegistry.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface DeletePageInput {
  pageGuid: string;
  recursive?: boolean;
}

export interface DeletePageResult {
  guid: string;
  deleted: true;
  recursive: boolean;
  deletedCount: number;
}

export async function deletePage(input: DeletePageInput): Promise<DeletePageResult> {
  const { pageGuid, recursive = false } = input;

  if (!pageGuid || !UUID_REGEX.test(pageGuid)) {
    throw new Error('Invalid page GUID format');
  }

  const storagePlugin = getStoragePlugin();

  try {
    await storagePlugin.loadPage(pageGuid);
  } catch (err: unknown) {
    const error = err as { code?: string };
    if (error.code === 'PAGE_NOT_FOUND') {
      throw new Error('Page not found');
    }
    throw err;
  }

  let deletedCount = 1;
  if (recursive) {
    try {
      const children = await storagePlugin.listChildren(pageGuid);
      deletedCount += children.length;
    } catch (err) {
      console.warn('Could not count children before deletion:', err);
    }
  } else {
    const children = await storagePlugin.listChildren(pageGuid).catch(() => []);
    if (children.length > 0) {
      throw new Error('Page has children — pass recursive=true to delete them all');
    }
  }

  await storagePlugin.deletePage(pageGuid, recursive);

  return {
    guid: pageGuid,
    deleted: true,
    recursive,
    deletedCount,
  };
}
