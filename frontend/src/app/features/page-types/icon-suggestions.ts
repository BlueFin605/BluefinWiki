import { DOCUMENT_ICON, FOLDER_ICON } from '../pages/row-icon';

/** Clickable icon suggestions shown under the page-type admin's Icon field. */
export const ICON_SUGGESTIONS: readonly string[] = [
  '🎯', '🏔️', '📘', '✅', '🐞', '🗂️', '📺', '🎬',
  '🎞️', '📚', '🧪', '💡', '🛠️', '📌', '🗓️', '⭐',
];

/**
 * Icons a page type should not use: they are what an untyped page/folder
 * already shows in the tree (see row-icon.ts), so a typed page using one is
 * indistinguishable from a plain document.
 */
export const GENERIC_ICONS: readonly string[] = [DOCUMENT_ICON, FOLDER_ICON];

export function isGenericIcon(icon: string): boolean {
  return GENERIC_ICONS.includes(icon.trim());
}
