/**
 * Per-resource invalidation bus.
 *
 * ## Model
 *
 * Every reactive `rxResource` in the API services keys its `params` factory on
 * one or more *invalidation tags* — string identifiers for a slice of
 * server state (a page, a folder's child list, a page-type, …). A tag maps to
 * a monotonic counter (`WritableSignal<number>`, lazily created at `0`).
 *
 * - A resource calls `bus.version(tag)` inside its `params` factory. Because
 *   that reads the tag's signal, the resource re-runs whenever the counter
 *   changes.
 * - A mutation calls `bus.bump(tag)` (or `bumpMany([...])`) for **only** the
 *   tags whose data it actually changed. Unrelated resources are untouched.
 *
 * This replaces the old per-service single `_version` signal, where every
 * mutation refetched every live resource of that service.
 *
 * `version(tag)` for a tag never bumped is a stable `0`, so a resource that
 * mounts before any mutation still fetches exactly once (on its own params).
 *
 * ## Tag vocabulary
 *
 * Pages (`features/pages/pages.ts`):
 *   - `page:<guid>`              — a single page's content (`pageResource`)
 *   - `children:<parentGuid>`    — a folder's direct child list; `parentGuid`
 *                                  is the literal string `root` for the top
 *                                  level. A `null` OR empty-string parent both
 *                                  normalise to `root` (`childrenTag` uses
 *                                  `|| 'root'`), matching the backend's
 *                                  empty-string root convention
 *                                  (`PageContent.folderId` is `''` for a
 *                                  top-level page). Read by BOTH
 *                                  `childrenResource` and
 *                                  `childrenWithPropertiesResource` (the board
 *                                  must refresh when children change).
 *   - `children:any`             — coarse catch-all. EVERY children resource
 *                                  also reads this. Mutations whose affected
 *                                  parent guid is not known at the call site
 *                                  (move/delete — the old/owning parent is
 *                                  neither returned nor passed) bump this
 *                                  instead of a precise `children:<parent>`.
 *   - `ancestors:<guid>`         — a page's ancestor chain (`ancestorsResource`)
 *   - `ancestors:any`            — coarse catch-all. EVERY ancestors resource
 *                                  also reads this. A folder rename/move changes
 *                                  the ancestor chain shown in every
 *                                  *descendant's* breadcrumb, but precise
 *                                  per-descendant invalidation is not available
 *                                  at the mutation site (the descendant guids
 *                                  are neither returned nor passed). Bumped by
 *                                  `movePage` and by `updatePage` when `title`
 *                                  is in the body.
 *   - `backlinks:<guid>`         — pages linking to `<guid>` (`backlinksResource`)
 *   - `backlinks:any`            — coarse catch-all. EVERY backlinks resource
 *                                  also reads this. Editing page X's body adds
 *                                  or removes link-graph edges pointing at X's
 *                                  link *targets* — not at X itself — and the
 *                                  affected target guids are not resolvable at
 *                                  this layer. Rather than a precise
 *                                  `backlinks:<target>`, every mutation that
 *                                  changes page content or existence
 *                                  (`createPage`, `updatePage` with `content`,
 *                                  `deletePage`) bumps this.
 *
 *   `pageSearchResource` re-keys on the query string itself and depends on NO
 *   tag — no mutation needs to invalidate it.
 *
 * Page types (`features/page-types/page-types.ts`):
 *   - `page-types:list`                    — the full type set (`pageTypesResource`)
 *   - `page-type:<guid>`                   — one type (`pageTypeResource`)
 *   - `page-type:allowed-children:<guid>`  — a type's allowed-children set
 *                                            (`allowedChildTypesResource`, which
 *                                            also reads `page-types:list` since
 *                                            allowed children derive from the
 *                                            type set)
 *
 * Tags (`features/tags/page-tags.ts`):
 *   - `page-tags:list`           — the shared page-level tag vocabulary
 *                                  (`pageTagsResource`, `GET /tags?scope=_page`).
 *                                  Bumped by `Pages.createPage` and
 *                                  `Pages.updatePage` when the body carries
 *                                  `tags` — the backend auto-registers page
 *                                  tags on write, so the vocabulary grows.
 *
 * Attachments (`features/attachments/attachments.ts`):
 *   - `attachments:<pageGuid>`   — a page's attachment list (`listResource`)
 *
 * Admin:
 *   - `users:list`               — `features/admin/users.ts` `usersResource`
 *   - `invitations:list`         — `features/admin/invitations.ts` `invitationsResource`
 *
 * ## Coarse-tag decisions (pragmatic, per the step brief)
 *
 * - `Pages.movePage` / `Pages.deletePage`: the page's owning/previous parent
 *   guid is not returned by the API nor passed by callers. Rather than widen
 *   the mutation signatures, these bump `children:any` (covered by every
 *   children resource). `movePage` additionally bumps the precise
 *   `children:<newParentGuid>`, `ancestors:<guid>`, the coarse `ancestors:any`
 *   (the move re-parents the page, changing the ancestor chain of every
 *   descendant's breadcrumb), and the moved page's own `page:<guid>` (the move
 *   changes its `folderId`); `deletePage` additionally bumps `page:<guid>`.
 * - `Pages.createPage` / `Pages.reorderPages`: bump the precise
 *   `children:<body.parentGuid|root>` AND the coarse `children:any`, so a page
 *   created or reordered under a *descendant* parent still refreshes a live
 *   deep board that aggregates that descendant.
 * - `Pages.updatePage`: the request body carries only the changed fields, so
 *   invalidation is derived from which keys are present — `page:<guid>`
 *   always; `children:<result.folderId>` (`PageContent.folderId` is the owning
 *   parent guid, `''` for a top-level page → normalised to `children:root`)
 *   AND the coarse `children:any` when ANY tree- or board-visible field
 *   (`title` / `status` / `pageType` / `properties` / `boardOrder`) is in the
 *   body — a deep board aggregates descendants of some *other* parent and
 *   renders their titles/state, so it must refresh on a descendant card's
 *   title/status/pageType edit just as it does on a property/order edit;
 *   additionally `ancestors:any` when `title` is in the body (a folder rename
 *   changes the ancestor chain shown in every descendant's breadcrumb);
 *   additionally `backlinks:any` when `content` is in the body.
 *
 * (`content`-only edits invalidate `page:<guid>` plus `backlinks:any` — a body
 * edit changes the link-graph edges into the pages it links to, and precise
 * per-target `backlinks:<guid>` invalidation would need a link resolver that
 * this layer does not have.)
 */
import { Injectable, type WritableSignal, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class InvalidationBus {
  private readonly counters = new Map<string, WritableSignal<number>>();

  private counter(tag: string): WritableSignal<number> {
    let c = this.counters.get(tag);
    if (c === undefined) {
      c = signal(0);
      this.counters.set(tag, c);
    }
    return c;
  }

  /**
   * Read a tag's invalidation counter (lazily created at `0`). Call this
   * INSIDE an `rxResource` `params` factory so the resource re-runs when the
   * tag is bumped.
   */
  version(tag: string): number {
    return this.counter(tag)();
  }

  /** Increment a tag's counter (lazily created), invalidating its resources. */
  bump(tag: string): void {
    this.counter(tag).update((v) => v + 1);
  }

  /** `bump` each tag once. Convenience for multi-tag mutations. */
  bumpMany(tags: readonly string[]): void {
    for (const tag of tags) this.bump(tag);
  }
}

// ---- Tag helpers ------------------------------------------------------------
// Small pure functions so call sites read well and typos surface at compile
// time rather than as silently-missed invalidations.

export const pageTag = (guid: string): string => `page:${guid}`;

export const childrenTag = (parentGuid: string | null | undefined): string =>
  `children:${parentGuid || 'root'}`;

/** Coarse catch-all every children resource also reads. */
export const childrenAnyTag = (): string => 'children:any';

export const ancestorsTag = (guid: string): string => `ancestors:${guid}`;

/** Coarse catch-all every ancestors resource also reads. */
export const ancestorsAnyTag = (): string => 'ancestors:any';

export const backlinksTag = (guid: string): string => `backlinks:${guid}`;

/** Coarse catch-all every backlinks resource also reads. */
export const backlinksAnyTag = (): string => 'backlinks:any';

export const pageTypesListTag = (): string => 'page-types:list';

export const pageTypeTag = (guid: string): string => `page-type:${guid}`;

export const allowedChildrenTag = (guid: string): string =>
  `page-type:allowed-children:${guid}`;

/** The shared page-level tag vocabulary (`features/tags/page-tags.ts`). */
export const pageTagsListTag = (): string => 'page-tags:list';

export const attachmentsTag = (pageGuid: string): string => `attachments:${pageGuid}`;

export const usersListTag = (): string => 'users:list';

export const invitationsListTag = (): string => 'invitations:list';
