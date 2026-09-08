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
 *                                  level. Read by BOTH `childrenResource` and
 *                                  `childrenWithPropertiesResource` (the board
 *                                  must refresh when children change).
 *   - `children:any`             — coarse catch-all. EVERY children resource
 *                                  also reads this. Mutations whose affected
 *                                  parent guid is not known at the call site
 *                                  (move/delete — the old/owning parent is
 *                                  neither returned nor passed) bump this
 *                                  instead of a precise `children:<parent>`.
 *   - `ancestors:<guid>`         — a page's ancestor chain (`ancestorsResource`)
 *   - `backlinks:<guid>`         — pages linking to `<guid>` (`backlinksResource`)
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
 *   `children:<newParentGuid>` and `ancestors:<guid>`; `deletePage`
 *   additionally bumps `page:<guid>`.
 * - `Pages.updatePage`: the request body carries only the changed fields, so
 *   invalidation is derived from which keys are present —
 *   `page:<guid>` always; `children:<result.folderId>` when a tree-visible
 *   field (`title` / `status` / `pageType`) is in the body; `backlinks:<guid>`
 *   when `content` is in the body (links live in the markdown).
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

export const childrenTag = (parentGuid: string | null): string =>
  `children:${parentGuid ?? 'root'}`;

/** Coarse catch-all every children resource also reads. */
export const childrenAnyTag = (): string => 'children:any';

export const ancestorsTag = (guid: string): string => `ancestors:${guid}`;

export const backlinksTag = (guid: string): string => `backlinks:${guid}`;

export const pageTypesListTag = (): string => 'page-types:list';

export const pageTypeTag = (guid: string): string => `page-type:${guid}`;

export const allowedChildrenTag = (guid: string): string =>
  `page-type:allowed-children:${guid}`;

export const attachmentsTag = (pageGuid: string): string => `attachments:${pageGuid}`;

export const usersListTag = (): string => 'users:list';

export const invitationsListTag = (): string => 'invitations:list';
