import { ChangeDetectionStrategy, Component, ElementRef, HostListener, computed, effect, inject, signal, viewChild } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, type MatDialogConfig } from '@angular/material/dialog';
import { MatMenuModule } from '@angular/material/menu';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import { ConfirmDialog, type ConfirmDialogData } from '../../shared/components/confirm-dialog';
import { Auth } from '../../core/auth/auth';
import { Layout } from '../../core/layout/layout';
import { Breakpoint } from '../../core/layout/breakpoint';
import { Pages } from './pages';
import { PageTypes } from '../page-types/page-types';
import { PageTree } from './page-tree';
import { PageContext } from './page-context';
import { InspectorPanel } from '../editor/inspector-panel';
import { ResizeDivider } from '../../shared/components/resize-divider';
import { PageRenameInline } from './page-rename-inline';
import { NewPageModal, type NewPageModalData } from './new-page-modal';
import type { PageTypeDefinition } from './page.types';
import { SearchDialog } from '../search/search-dialog';
import { AiButton } from '../ai/ai-button';
import { AiSidebar } from '../ai/ai-sidebar';

@Component({
  selector: 'wiki-pages-view',
  standalone: true,
  imports: [
    RouterOutlet,
    MatToolbarModule,
    MatButtonModule,
    MatTooltipModule,
    MatIconModule,
    MatMenuModule,
    MatSidenavModule,
    PageTree,
    ResizeDivider,
    PageRenameInline,
    AiButton,
    AiSidebar,
    InspectorPanel,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="pages-shell">
      <mat-toolbar color="primary" class="topbar">
        @if (!bp.isDesktop()) {
          <button
            mat-icon-button
            aria-label="Open navigation"
            (click)="onOpenTreeDrawer()"
          >
            <mat-icon>menu</mat-icon>
          </button>
        }
        <span class="title">BluefinWiki</span>
        <span class="spacer"></span>
        <button mat-button (click)="onNewPage()">
          New page
        </button>
        <wiki-ai-button (toggled)="onToggleAi()" />
        <button
          mat-icon-button
          [matMenuTriggerFor]="userMenu"
          aria-label="User menu"
        >
          <mat-icon>account_circle</mat-icon>
        </button>
        <mat-menu #userMenu="matMenu">
          @if (isAdmin()) {
            <button mat-menu-item (click)="onSettings()">
              <mat-icon>settings</mat-icon>
              <span>Settings</span>
            </button>
          }
          <button mat-menu-item (click)="onProfile()">
            <mat-icon>person</mat-icon>
            <span>Profile</span>
          </button>
          <button mat-menu-item (click)="onSignOut()">
            <mat-icon>logout</mat-icon>
            <span>Sign out</span>
          </button>
        </mat-menu>
      </mat-toolbar>
      <!--
        Step 1b.4 (DESIGN.md D3): a single hoisted mat-sidenav-container owns the
        tree drawer, the inspector and the backdrop/scroll-lock. It needs an
        explicit box in the column flex (flex: 1; min-height: 0) — it does not
        inherit a height inside .pages-shell.
      -->
      <mat-sidenav-container class="body" #body>
        <mat-sidenav
          position="start"
          class="sidebar"
          [mode]="bp.isDesktop() ? 'side' : 'over'"
          [opened]="bp.isDesktop() || treeDrawerOpen()"
          (closed)="treeDrawerOpen.set(false)"
          [style.width.px]="bp.isDesktop() ? treeWidth() : null"
        >
          <wiki-page-tree
            [activeGuid]="activeGuid()"
            [pageTypesMap]="pageTypesMap()"
            (pageSelect)="onPageSelect($event)"
            (renameRequested)="onRenameRequested($event)"
            (deleteRequested)="onDeleteRequested($event)"
            (newChildRequested)="onNewChildRequested($event)"
            (sortRequested)="onSortRequested($event)"
            (moveRequested)="onMoveRequested($event)"
          />
          <!-- Resize handle stays desktop-only (DESIGN.md D6). -->
          @if (bp.isDesktop()) {
            <div class="tree-divider">
              <wiki-resize-divider (resized)="onTreeResize($event)" />
            </div>
          }
        </mat-sidenav>

        <mat-sidenav-content class="content">
          <main class="main">
            <router-outlet />
          </main>
          @if (bp.isDesktop() && aiOpen()) {
            <div class="ai-pane">
              <wiki-ai-sidebar
                [currentPageGuid]="activeGuid()"
                (closed)="aiOpen.set(false)"
              />
            </div>
          }
        </mat-sidenav-content>

        <!--
          Hoisted inspector (step 1b.3), made responsive in step 1b.5
          (DESIGN.md D4 — one mount path, no MatBottomSheet):

          - desktop: mode="side", opened = Layout.inspectorVisible() (still
            gated on a page being loaded), width from Layout.inspectorWidth(),
            plus a desktop-only ResizeDivider on the panel's left edge;
          - below 1024: mode="over" + the .mobile-sheet class (full-width,
            <=75vh, pinned to the bottom edge - the CSS overrides Material's
            slide-from-the-right), opened = ctx.inspectorSheetOpen().

          (closed) clears whichever open-state applies; the breakpoint-flip
          cleanup that closes a stuck sheet lives in PageContext.

          Stale-metadata window: on a param-only /pages/g1 -> /pages/g2 nav,
          PageDetail is reused (no reset()), so ctx.guid() flips before
          ctx.metadata() rehydrates — the panel can briefly show g2 + g1's
          metadata until PageDetail's hydrate effect fires. Pre-existing (the
          same guard lived in page-detail).
        -->
        <mat-sidenav
          position="end"
          class="inspector"
          [class.mobile-sheet]="!bp.isDesktop()"
          [mode]="bp.isDesktop() ? 'side' : 'over'"
          role="complementary"
          aria-label="Inspector"
          [opened]="inspectorOpened()"
          (closed)="onInspectorClosed()"
          [style.width.px]="bp.isDesktop() ? inspectorWidth() : null"
        >
          <!--
            Gate on inspectorOpened(), not just guid + metadata (Phase 4 review
            I8). Material keeps a closed drawer's projected content in the DOM,
            so below 1024 the panel — and PagePropertiesPanel /
            CustomPropertiesEditor with their page-types / page-tags / tag-vocab
            rxResources — would construct and fetch on every page load while the
            bottom sheet is shut. inspectorOpened() already implies guid +
            metadata; on desktop it also carries the "open on mount when
            Layout.inspectorVisible() is already true" case.
          -->
          @if (inspectorOpened() && ctx.metadata(); as m) {
            <wiki-inspector-panel
              [pageGuid]="ctx.guid()!"
              [metadata]="m"
              [pageAuthorId]="m.createdBy"
              [canInsert]="ctx.canInsert()"
              (metadataChange)="ctx.metadata.set($event)"
              (insertMarkdown)="ctx.emitInsert($event)"
              (titleH1Sync)="ctx.emitTitleH1Sync($event)"
              (pageTypeChange)="ctx.emitPageTypeChange($event)"
            />
          }
          <!-- Desktop-only grab handle on the inspector's LEFT edge (the panel
               is right-anchored). Mirrors .tree-divider (DESIGN.md D6). -->
          @if (bp.isDesktop()) {
            <div class="inspector-divider">
              <wiki-resize-divider (resized)="onInspectorResize($event)" />
            </div>
          }
        </mat-sidenav>
      </mat-sidenav-container>

      <!--
        Below 1024 the AI sidebar is a full-width fixed overlay (DESIGN.md D7),
        never a side-by-side pane. It is hoisted OUT of mat-sidenav-content to a
        direct child of .pages-shell (step 1b whole-branch review C1): nested in
        the content it could never out-rank the app toolbar, so wiki-ai-sidebar's
        own header ("New chat" / "Close AI assistant") sat behind the opaque bar.
        As a sibling of .topbar it genuinely covers it. Three-way stacking, low
        to high: .topbar (z-index: 2) < .ai-overlay (z-index: 3) < the search
        CDK overlay (rendered outside .pages-shell entirely). Fixed positioning
        keeps .content / .main full width (no squeeze). Close is
        wiki-ai-sidebar's own header button, wired to aiOpen here.
      -->
      @if (!bp.isDesktop() && aiOpen()) {
        <div class="ai-overlay">
          <wiki-ai-sidebar
            [currentPageGuid]="activeGuid()"
            (closed)="aiOpen.set(false)"
          />
        </div>
      }

      @if (renameTarget(); as target) {
        <wiki-page-rename-inline
          [guid]="target.guid"
          [initialTitle]="target.title"
          (completed)="renameTarget.set(null)"
          (cancelled)="renameTarget.set(null)"
        />
      }
    </div>
  `,
  styles: [`
    .pages-shell { display: flex; flex-direction: column; height: 100vh; }
    .topbar { z-index: 2; }
    .title { font-weight: 600; }
    .spacer { flex: 1; }

    /*
      The hoisted sidenav container. It gets no height inside the column flex
      unless we give it one. The theme tokens keep the desktop look identical to
      the old static layout: square corners (no Material corner-large radius) and
      the same 1px #e5e7eb rule the old .sidebar / .inspector-pane borders used.
    */
    .body {
      flex: 1;
      min-height: 0;
      --mat-sidenav-container-shape: 0;
      --mat-sidenav-container-divider-color: #e5e7eb;
    }

    /* Ancestor-qualified so these beat Angular Material's own .mat-drawer rules
       regardless of stylesheet order (equal specificity otherwise). */
    .body .sidebar {
      background: #f9fafb;
      /* Desktop width comes from [style.width.px]; this is the mobile drawer. */
      width: min(85vw, 320px);
      /* Deterministic positioning context for .tree-divider (right: 0). */
      position: relative;
    }
    .body .inspector {
      background: #fff;
      /* Positioning context for .inspector-divider (left: 0). */
      position: relative;
    }

    /* Desktop-only grab handle pinned to the tree drawer's right edge. */
    .tree-divider {
      position: absolute;
      top: 0;
      right: 0;
      bottom: 0;
      width: 4px;
      z-index: 3;
    }

    /* Desktop-only grab handle pinned to the inspector's left edge. */
    .inspector-divider {
      position: absolute;
      top: 0;
      left: 0;
      bottom: 0;
      width: 4px;
      z-index: 3;
    }

    /*
      Below 1024 the inspector is a bottom sheet, not a right-hand side panel
      (DESIGN.md D4 - one mount path, no MatBottomSheet). Material's
      position="end" drawer is full-height and slides in from the right; this
      overrides it to a full-width panel pinned to the bottom edge, capped at
      75vh, that rises from below. Pure CSS - no dedicated cdkOverlay.

      Specificity: '.body .inspector.mobile-sheet' (0,3,0) beats Material's
      '.mat-drawer.mat-drawer-end' (0,2,0) for the box; the closed-state
      transform is guarded with :not(.mat-drawer-opened) so Material's own
      '.mat-drawer-opened.mat-drawer-opened { transform: none }' still wins when
      the sheet is open. The backdrop is Material's container-level
      '.mat-drawer-backdrop' and still covers the whole sidenav container.
    */
    .body .inspector.mobile-sheet {
      width: 100vw;
      max-width: 100vw;
      height: auto;
      max-height: 75vh;
      top: auto;
      bottom: 0;
      border-radius: 0;
    }
    .body .inspector.mobile-sheet.mat-drawer-end:not(.mat-drawer-opened) {
      transform: translateY(100%);
    }

    /* main + optional desktop .ai-pane sit side by side inside the content. */
    .body .content { display: flex; }
    .main { flex: 1; min-width: 0; overflow: auto; }

    .ai-pane {
      width: 400px;
      max-width: 100vw;
      border-left: 1px solid #e5e7eb;
      background: white;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    /*
      Below 1024 the AI sidebar is a full-width fixed overlay above the content
      (DESIGN.md D7). Fixed positioning + explicit 100vw takes it out of the
      content flow so mat-sidenav-content / .main keep full width (no squeeze).

      Stacking (review C1): the element is a direct child of .pages-shell, a
      sibling of .topbar, so z-index: 3 puts it just above the toolbar
      (z-index: 2) and its own header controls stay clickable. The search CDK
      overlay lives outside .pages-shell and still layers over everything.
      wiki-ai-sidebar brings its own header close button.
    */
    .ai-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100%;
      z-index: 3;
      background: white;
      display: flex;
      flex-direction: column;
    }
  `],
})
export class PagesView {
  private readonly router = inject(Router);
  private readonly pages = inject(Pages);
  private readonly layout = inject(Layout);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(MatSnackBar);
  private readonly auth = inject(Auth);
  private readonly pageTypes = inject(PageTypes);
  /** Shared channel to the routed page-detail; feeds the hoisted inspector. */
  protected readonly ctx = inject(PageContext);
  /** Single responsive switch (DESIGN.md D1); drives sidenav mode + the hamburger. */
  protected readonly bp = inject(Breakpoint);

  // `#body` now sits on <mat-sidenav-container>; read its host element so
  // onTreeResize keeps measuring from the shell's left edge.
  private readonly bodyEl = viewChild<unknown, ElementRef<HTMLElement>>('body', { read: ElementRef });

  protected readonly treeWidth = computed(() => this.layout.treeWidth());
  protected readonly inspectorWidth = computed(() => this.layout.inspectorWidth());

  /**
   * Combined open-state for the `end` inspector sidenav (step 1b.5). Always
   * gated on a page being loaded; on desktop it follows the persisted
   * `Layout.inspectorVisible` (step 4.1 binding), below 1024 the ephemeral
   * mobile bottom-sheet flag on `PageContext`.
   */
  protected readonly inspectorOpened = computed(() => {
    if (!this.ctx.guid() || !this.ctx.metadata()) return false;
    return this.bp.isDesktop()
      ? this.layout.inspectorVisible()
      : this.ctx.inspectorSheetOpen();
  });

  /**
   * Tree drawer open state below 1024px. Ephemeral, never persisted (DESIGN.md
   * D6) — on desktop the tree is always pinned so this is ignored there.
   */
  protected readonly treeDrawerOpen = signal(false);

  /**
   * The tree divider emits an absolute pointer X. Convert it to a width
   * relative to the shell's left edge; `Layout.update()` clamps to 200-600.
   */
  onTreeResize(pointerX: number): void {
    const host = this.bodyEl()?.nativeElement;
    if (!host) return;
    const width = pointerX - host.getBoundingClientRect().left;
    this.layout.update({ treeWidth: width });
  }

  /**
   * The inspector divider emits an absolute pointer X. The inspector is
   * right-anchored, so its width is measured from the shell's RIGHT edge;
   * `Layout.update()` clamps to 250-600. Desktop only (no divider on mobile).
   */
  onInspectorResize(pointerX: number): void {
    const host = this.bodyEl()?.nativeElement;
    if (!host) return;
    const width = host.getBoundingClientRect().right - pointerX;
    this.layout.update({ inspectorWidth: width });
  }

  /**
   * The `end` sidenav closed — from a mobile backdrop/Esc dismiss, or reactively
   * when `inspectorOpened()` drops.
   *
   * Desktop (review I2): `(closed)` is doubly deferred (async emitter, fired
   * from `transitionend`), so it can land *after* the desired state has flipped
   * back to "open" — e.g. a View<->Edit toggle nulls then re-publishes
   * guid/metadata while the drawer is mid-close. Reconcile against the desired
   * state, don't react to the event:
   *   - if the inspector should be open again, do nothing (idempotent);
   *   - if the page itself unloaded (guid/metadata cleared), do nothing so the
   *     persisted `inspectorVisible` is never wiped;
   *   - only write `inspectorVisible: false` when it is still true (drops the
   *     redundant localStorage write, roll-up 1b.5-a).
   *
   * Mobile: the sheet flag is ephemeral (not persisted), and this handler is
   * what syncs a backdrop/Esc dismiss back into `inspectorSheetOpen` so the
   * one-way `[opened]` binding agrees — always clear it on close. (The stale
   * early-return is desktop-only by design: applying it here would let a real
   * dismiss be ignored while the flag is still true, and the drawer would
   * spring back open.)
   */
  onInspectorClosed(): void {
    if (!this.ctx.guid() || !this.ctx.metadata()) return;
    if (this.bp.isDesktop()) {
      if (this.inspectorOpened()) return;
      if (this.layout.inspectorVisible()) this.layout.update({ inspectorVisible: false });
    } else {
      this.ctx.inspectorSheetOpen.set(false);
    }
  }

  /**
   * Hamburger handler. Below 1024 the tree drawer, inspector sheet and AI
   * overlay are mutually exclusive (DESIGN.md D9 / review I3), so opening the
   * tree drawer closes the other two. Desktop is unaffected — the tree is
   * always pinned and the AI pane is a legitimate side-by-side column there.
   */
  onOpenTreeDrawer(): void {
    this.treeDrawerOpen.set(true);
    if (!this.bp.isDesktop()) {
      this.ctx.inspectorSheetOpen.set(false);
      this.aiOpen.set(false);
    }
  }

  protected readonly isAdmin = computed(() => this.auth.user()?.role === 'Admin');

  // All page-type definitions, streamed from GET /api/page-types. Refreshes
  // when the PageTypes service bumps its version (step 1.2 replaces the
  // service-wide version with per-resource invalidation).
  private readonly pageTypesRes = this.pageTypes.pageTypesResource();

  // Page-type definitions keyed by type GUID. Feeds the tree's type emoji,
  // drag-drop constraint checks (check-type-constraints) and modal scoping.
  protected readonly pageTypesMap = computed<Record<string, PageTypeDefinition>>(() => {
    const map: Record<string, PageTypeDefinition> = {};
    for (const type of this.pageTypesRes.value() ?? []) {
      map[type.guid] = type;
    }
    return map;
  });

  // The active guid is parsed from the URL by the child route components in
  // Phase 3; here we expose it as a signal so the tree can highlight the
  // current page. The router emits navigation events synchronously enough
  // that reading from the URL on each tick is fine.
  protected readonly activeGuid = signal<string | null>(null);

  protected readonly renameTarget = signal<{ guid: string; title: string } | null>(null);

  protected readonly aiOpen = signal(false);

  /**
   * AI toggle (toolbar button). Below 1024 the three mobile surfaces are
   * mutually exclusive (DESIGN.md D9 / review I3): opening the AI overlay
   * closes the tree drawer and the inspector sheet. Closing it, and desktop,
   * touch nothing else.
   */
  onToggleAi(): void {
    const willOpen = !this.aiOpen();
    this.aiOpen.set(willOpen);
    if (willOpen && !this.bp.isDesktop()) {
      this.ctx.inspectorSheetOpen.set(false);
      this.treeDrawerOpen.set(false);
    }
  }

  constructor() {
    // Sync activeGuid from URL changes.
    this.router.events.subscribe(() => {
      const match = /^\/pages\/([0-9a-f-]+)/i.exec(this.router.url);
      this.activeGuid.set(match ? match[1] : null);
    });

    // Mutual exclusion, inspector-sheet side (DESIGN.md D9 / review I3). The
    // sheet is opened from PageContext (the editor-bar info button), which can't
    // reach treeDrawerOpen / aiOpen — so mirror the cross-clear here: when the
    // sheet goes up below 1024, drop the other two surfaces. Writes different
    // signals than it reads, so it converges in one pass.
    effect(() => {
      if (!this.bp.isDesktop() && this.ctx.inspectorSheetOpen()) {
        this.treeDrawerOpen.set(false);
        this.aiOpen.set(false);
      }
    });
  }

  onPageSelect(guid: string): void {
    void this.router.navigate(['/pages', guid]);
    // On mobile the tree is an `over` drawer — dismiss it once a page is picked.
    if (!this.bp.isDesktop()) this.treeDrawerOpen.set(false);
  }

  onRenameRequested(target: { guid: string; title: string }): void {
    // The tree row already holds the PageSummary it renders, so the real title
    // rides along in the (renameRequested) payload — no extra fetch needed.
    this.renameTarget.set(target);
  }

  /**
   * Delete a page after confirming through the app's `ConfirmDialog` (step 2.8).
   * `hasChildren` rides along on the tree-row payload: it drives both the confirm
   * copy (a child-aware message) and the `recursive` flag on the request — a
   * leaf never needs a recursive delete. On failure the *server* message is
   * surfaced in a snackbar (matching the other mutations in this area), not a
   * generic string. Per-resource cache invalidation is handled inside
   * `Pages.deletePage` (step 1.2 — `children:any` + `page:<guid>`).
   */
  async onDeleteRequested(req: { guid: string; hasChildren: boolean }): Promise<void> {
    const { guid, hasChildren } = req;

    const data: ConfirmDialogData = {
      title: 'Delete page',
      message: hasChildren
        ? 'Delete this page and all its child pages? This action cannot be undone.'
        : 'Delete this page?',
      confirmLabel: 'Delete',
      destructive: true,
    };
    const ref = this.dialog.open<ConfirmDialog, ConfirmDialogData, boolean>(ConfirmDialog, { data });
    if (!(await firstValueFrom(ref.afterClosed()))) return;

    try {
      await this.pages.deletePage(guid, { recursive: hasChildren });
      // If the deleted page was active, navigate back to /pages
      if (this.activeGuid() === guid) {
        await this.router.navigate(['/pages']);
      }
    } catch (err) {
      console.error('Failed to delete page', err);
      this.snack.open(this.deleteErrorMessage(err), 'Dismiss', { duration: 4000 });
    }
  }

  /** Server message from a failed request: `err.error?.message ?? err.message`. */
  private deleteErrorMessage(err: unknown): string {
    const e = err as { error?: { message?: unknown } | null; message?: unknown } | null;
    if (typeof e?.error?.message === 'string') return e.error.message;
    if (typeof e?.message === 'string') return e.message;
    return 'Failed to delete page.';
  }

  onNewPage(): void {
    void this.openNewPageModal(null);
  }

  onNewChildRequested(guid: string): void {
    void this.openNewPageModal(guid);
  }

  private async openNewPageModal(parentGuid: string | null): Promise<void> {
    const data: NewPageModalData = { parentGuid };
    if (parentGuid) {
      // Look up parent's pageType so the modal can scope the dropdown.
      try {
        const list = await this.pages.fetchChildren(parentGuid);
        // Best-effort: parent's own metadata isn't on the children list, but
        // fetchChildren confirms the parent exists. Skip pageType lookup
        // here; the modal still defaults to "all types".
        void list;
      } catch {
        // Non-fatal: open the modal anyway.
      }
    }
    const ref = this.dialog.open<NewPageModal, NewPageModalData, string | null>(
      NewPageModal,
      { data },
    );
    const created = await firstValueFrom(ref.afterClosed());
    if (created && typeof created === 'string') {
      await this.router.navigate(['/pages', created, 'edit']);
    }
  }

  async onSortRequested(req: { guid: string; direction: 'asc' | 'desc' }): Promise<void> {
    try {
      const children = await this.pages.fetchChildren(req.guid);
      const stripped = (t: string): string => t.replace(/^(the|a|an)\s+/i, '');
      const sorted = [...children].sort((a, b) => {
        const cmp = stripped(a.title).localeCompare(stripped(b.title), undefined, { sensitivity: 'base' });
        return req.direction === 'asc' ? cmp : -cmp;
      });
      await this.pages.reorderPages({
        parentGuid: req.guid,
        orderedGuids: sorted.map((p) => p.guid),
      });
    } catch (err) {
      console.error('Failed to sort children', err);
      window.alert('Failed to sort children.');
    }
  }

  onMoveRequested(_guid: string): void {
    window.alert('Move dialog coming in a later phase');
  }

  @HostListener('window:keydown', ['$event'])
  onWindowKeydown(event: KeyboardEvent): void {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      // The focused CodeMirror editor binds Mod-k to "insert link" and calls
      // preventDefault(); when that has happened the editor keymap wins and the
      // global Search shortcut must stay closed.
      if (event.defaultPrevented) return;
      if ((event.target as HTMLElement | null)?.closest?.('.cm-editor')) return;
      event.preventDefault();
      this.openSearch();
    }
  }

  private openSearch(): void {
    // Full-screen below 1024, 640px centered on desktop (step 1b.9, DESIGN.md
    // D7 sibling). The branch is decided at open time from the live breakpoint.
    // The `fullscreen-dialog` panel-class style is global (src/styles.scss) —
    // a component's scoped styles never reach the CDK overlay container.
    const config: MatDialogConfig<void> = this.bp.isDesktop()
      ? { width: '640px', panelClass: 'wiki-search-dialog-panel' }
      : {
          width: '100vw',
          maxWidth: '100vw',
          height: '100vh',
          panelClass: ['wiki-search-dialog-panel', 'fullscreen-dialog'],
        };
    this.dialog.open<SearchDialog, void, string | null>(SearchDialog, config);
  }

  onSettings(): void {
    void this.router.navigate(['/settings']);
  }

  onProfile(): void {
    void this.router.navigate(['/profile']);
  }

  onSignOut(): void {
    this.auth.signOut();
    void this.router.navigate(['/']);
  }
}
