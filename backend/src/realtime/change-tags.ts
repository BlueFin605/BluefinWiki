/**
 * Invalidation tags published after writes. These mirror the tag vocabulary in
 * `frontend/src/app/core/api/invalidation.ts` exactly (the server pushes the
 * same strings the client bumps). Tags are deliberately coarse: the `*:any`
 * catch-alls cover cases where the affected guids are not known here.
 *
 * Signatures line up with the StoragePlugin methods they follow, so a storage
 * decorator can call them directly with the method's arguments.
 */

const childrenTag = (parentGuid: string | null | undefined): string => `children:${parentGuid || 'root'}`;

/** Follows `StoragePlugin.savePage(guid, parentGuid, content)`. */
export function tagsForSavePage(guid: string, parentGuid: string | null): string[] {
  return [`page:${guid}`, childrenTag(parentGuid), 'children:any', 'ancestors:any', 'backlinks:any'];
}

/** Follows `StoragePlugin.deletePage(guid, recursive?)`. */
export function tagsForDeletePage(guid: string): string[] {
  return [`page:${guid}`, 'children:any', 'ancestors:any', 'backlinks:any'];
}

/** Follows `StoragePlugin.movePage(guid, newParentGuid)`. */
export function tagsForMovePage(guid: string, newParentGuid: string | null): string[] {
  return [`page:${guid}`, childrenTag(newParentGuid), 'children:any', 'ancestors:any', 'backlinks:any'];
}

/** Follows `StoragePlugin.saveComments(pageGuid, ...)`. */
export function tagsForComments(pageGuid: string): string[] {
  return [`comments:${pageGuid}`];
}

/** Follows the attachment write methods (all take `pageGuid` first). */
export function tagsForAttachments(pageGuid: string): string[] {
  return [`attachments:${pageGuid}`];
}

export function tagsForPageType(guid: string): string[] {
  return ['page-types:list', `page-type:${guid}`];
}
