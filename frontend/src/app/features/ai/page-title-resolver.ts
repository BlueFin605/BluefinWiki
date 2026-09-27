/**
 * PageTitleResolver — resolves a page GUID to its title for `ActionPreview`'s
 * proposed-action card (step 7.1), matching React's "resolves referenced
 * GUIDs → page titles". Injectable so it's trivially mockable in component
 * tests. Falls back to the raw GUID when the lookup fails (deleted page,
 * network error, …) so the card never shows a blank field.
 *
 * Resolved titles are cached for the service's (root-singleton) lifetime —
 * the same GUID recurring across turns or across the parent/pageGuid/
 * newParentGuid fields of one action should not re-fetch.
 */

import { Injectable, inject } from '@angular/core';
import { Pages } from '../pages/pages';

@Injectable({ providedIn: 'root' })
export class PageTitleResolver {
  private readonly pages = inject(Pages);
  private readonly cache = new Map<string, Promise<string>>();

  resolveTitle(guid: string): Promise<string> {
    let cached = this.cache.get(guid);
    if (!cached) {
      cached = this.pages
        .fetchPage(guid)
        .then((page) => page.title)
        .catch(() => guid);
      this.cache.set(guid, cached);
    }
    return cached;
  }
}
