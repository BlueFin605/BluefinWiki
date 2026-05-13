/**
 * MCP Tool: move_page
 *
 * Move a wiki page under a new parent (or to root). Used for reparenting
 * and as the rename-equivalent for the hierarchy (titles are renamed via update_page).
 * Mirrors the HTTP PUT /pages/{guid}/move handler including circular-reference checks.
 */

import { getStoragePlugin } from '../../storage/StoragePluginRegistry.js';
import type { StoragePlugin } from '../../storage/StoragePlugin.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface MovePageInput {
  pageGuid: string;
  newParentGuid: string | null;
}

export interface MovePageResult {
  guid: string;
  newParentGuid: string | null;
  movedAt: string;
}

export async function movePage(input: MovePageInput): Promise<MovePageResult> {
  const { pageGuid, newParentGuid } = input;

  if (!pageGuid || !UUID_REGEX.test(pageGuid)) {
    throw new Error('Invalid page GUID format');
  }
  if (newParentGuid !== null && !UUID_REGEX.test(newParentGuid)) {
    throw new Error('Invalid new parent GUID format');
  }
  if (newParentGuid === pageGuid) {
    throw new Error('Cannot move page to itself');
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

  if (newParentGuid !== null) {
    try {
      await storagePlugin.loadPage(newParentGuid);
    } catch (err: unknown) {
      const error = err as { code?: string };
      if (error.code === 'PAGE_NOT_FOUND') {
        throw new Error('Target parent page not found');
      }
      throw err;
    }

    if (await isDescendant(storagePlugin, pageGuid, newParentGuid)) {
      throw new Error('Cannot move page under its own descendant (circular reference)');
    }
  }

  await storagePlugin.movePage(pageGuid, newParentGuid);

  return {
    guid: pageGuid,
    newParentGuid,
    movedAt: new Date().toISOString(),
  };
}

async function isDescendant(
  storagePlugin: StoragePlugin,
  ancestorGuid: string,
  targetGuid: string,
): Promise<boolean> {
  try {
    const target = await storagePlugin.loadPage(targetGuid);
    if (!target.folderId) return false;
    if (target.folderId === ancestorGuid) return true;
    return await isDescendant(storagePlugin, ancestorGuid, target.folderId);
  } catch (err: unknown) {
    const error = err as { code?: string };
    if (error.code === 'PAGE_NOT_FOUND') return false;
    throw err;
  }
}
