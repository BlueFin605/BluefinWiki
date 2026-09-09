import { Injectable, computed, effect, inject, signal, type WritableSignal } from '@angular/core';
import { Subject, type Observable } from 'rxjs';

import { Layout } from '../../core/layout/layout';
import { Breakpoint } from '../../core/layout/breakpoint';
import type { PageMetadata } from './drafts';
import type { PageTypeChange } from '../editor/page-properties-panel';

/**
 * Cross-component channel for the page screen (DESIGN.md §"PageContext service").
 *
 * The inspector (`wiki-inspector-panel`) is rendered by the shell (`pages-view`)
 * so the hoisted `mat-sidenav-container` (step 1b.4) can own it, but the editing
 * component (`page-detail`, in `<router-outlet>`) still owns the working copy,
 * dirty-detection, save and the CodeMirror surface. This root service is the
 * seam between them:
 *
 * - `guid` / `metadata` / `mode` — published by `page-detail` on load / mode
 *   change; `metadata` is the shared working copy (the inspector's
 *   `metadataChange` writes straight back to it, `page-detail` reads it for
 *   dirty-detection / title / save).
 * - `insert$` / `titleH1Sync$` / `pageTypeChange$` — carry the inspector's three
 *   editor-affecting outputs back to `page-detail`, which subscribes with
 *   `takeUntilDestroyed` and routes each into its existing handler.
 * - `toggleInspector()` — the editor-bar info button; desktop delegates to the
 *   persisted `Layout.inspectorVisible`, mobile flips the ephemeral
 *   `inspectorSheetOpen` (the bottom sheet is wired up in step 1b.5).
 */
@Injectable({ providedIn: 'root' })
export class PageContext {
  private readonly layout = inject(Layout);
  private readonly bp = inject(Breakpoint);

  /** Current page guid, or `null` when no page screen is mounted. */
  readonly guid: WritableSignal<string | null> = signal<string | null>(null);
  /** Shared working copy of the page metadata (owned here, edited by both sides). */
  readonly metadata: WritableSignal<PageMetadata | null> = signal<PageMetadata | null>(null);
  /** `'edit'` on the `/edit` route, `'view'` otherwise. */
  readonly mode: WritableSignal<'view' | 'edit'> = signal<'view' | 'edit'>('view');
  /** Attachments can be inserted into a live editor only in edit mode. */
  readonly canInsert = computed(() => this.mode() === 'edit');
  /**
   * Mobile bottom-sheet open state (ephemeral, D6). Unused until step 1b.5
   * mounts the responsive sidenav; `toggleInspector` already drives it so 1b.5
   * lands without touching this service.
   */
  readonly inspectorSheetOpen: WritableSignal<boolean> = signal(false);

  constructor() {
    // Breakpoint-flip cleanup (step 1b.5): crossing to desktop drops any open
    // mobile bottom sheet so it can never leave an orphaned `over` backdrop.
    // Desktop visibility falls back to the persisted `Layout.inspectorVisible`;
    // the mobile flag stays ephemeral (D6).
    effect(() => {
      if (this.bp.isDesktop()) this.inspectorSheetOpen.set(false);
    });
  }

  private readonly _insert = new Subject<string>();
  /** Markdown to drop in at the CodeMirror cursor (inspector `insertMarkdown`). */
  readonly insert$: Observable<string> = this._insert.asObservable();

  private readonly _titleH1Sync = new Subject<string>();
  /** New Title text to sync into a leading `# H1` (inspector `titleH1Sync`). */
  readonly titleH1Sync$: Observable<string> = this._titleH1Sync.asObservable();

  private readonly _pageTypeChange = new Subject<PageTypeChange>();
  /** Page-type change to persist immediately (inspector `pageTypeChange`). */
  readonly pageTypeChange$: Observable<PageTypeChange> = this._pageTypeChange.asObservable();

  emitInsert(md: string): void {
    this._insert.next(md);
  }

  emitTitleH1Sync(title: string): void {
    this._titleH1Sync.next(title);
  }

  emitPageTypeChange(change: PageTypeChange): void {
    this._pageTypeChange.next(change);
  }

  /**
   * Editor-bar inspector toggle. Desktop → persisted `Layout.inspectorVisible`
   * (step 4.1's binding); mobile → the ephemeral bottom-sheet flag (step 1b.5).
   */
  toggleInspector(): void {
    if (this.bp.isDesktop()) {
      this.layout.update({ inspectorVisible: !this.layout.inspectorVisible() });
    } else {
      this.inspectorSheetOpen.update((v) => !v);
    }
  }

  /** Called from `page-detail`'s destroy path once its draft has been stashed. */
  reset(): void {
    this.guid.set(null);
    this.metadata.set(null);
    this.inspectorSheetOpen.set(false);
  }
}
