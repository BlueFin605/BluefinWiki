import { ChangeDetectionStrategy, Component, ElementRef, HostListener, computed, inject, signal, viewChild } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { MatMenuModule } from '@angular/material/menu';
import { MatSidenavModule } from '@angular/material/sidenav';
import { firstValueFrom } from 'rxjs';
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
            class="hamburger"
            aria-label="Open navigation"
            (click)="treeDrawerOpen.set(true)"
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
          <!--
            Below 1024 the AI sidebar is a full-width fixed overlay, never a
            side-by-side pane (DESIGN.md D7). Final overlay styling is step 1b.9;
            here it only has to stop the desktop ai-pane from squashing the
            mobile content.
          -->
          @if (!bp.isDesktop() && aiOpen()) {
            <div class="ai-overlay">
              <wiki-ai-sidebar
                [currentPageGuid]="activeGuid()"
                (closed)="aiOpen.set(false)"
              />
            </div>
          }
        </mat-sidenav-content>

        <!--
          Hoisted inspector (step 1b.3). Fed entirely by PageContext — the routed
          page-detail publishes guid/metadata/mode and consumes the outputs
          routed back through the service.

          TODO(1b.5): step 1b.5 owns this sidenav's "opened" binding (wire to
          PageContext.toggleInspector() / Layout.inspectorVisible), its
          responsive side/bottom-sheet "mode", and the desktop open/close
          toggle. Step 1b.4 is PLACEMENT ONLY: it moves the panel out of the old
          static .inspector-pane div into this "end" sidenav and keeps the
          1b.3 behaviour of "visible whenever a page is loaded" via a plain
          "opened" expression.
        -->
        <!--
          Stale-metadata window: on a param-only /pages/g1 -> /pages/g2 nav,
          PageDetail is reused (no reset()), so ctx.guid() flips before
          ctx.metadata() rehydrates — this always-visible interim pane can
          briefly show g2 + g1's metadata until PageDetail's hydrate effect
          fires. Pre-existing (the same guard lived in page-detail); 1b.5's
          responsive gating will mask it.
        -->
        <mat-sidenav
          position="end"
          class="inspector"
          mode="side"
          [opened]="!!ctx.guid() && !!ctx.metadata()"
          [style.width.px]="bp.isDesktop() ? inspectorWidth() : null"
        >
          @if (ctx.guid() && ctx.metadata(); as m) {
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
        </mat-sidenav>
      </mat-sidenav-container>

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
    }
    .body .inspector { background: #fff; }

    /* Desktop-only grab handle pinned to the tree drawer's right edge. */
    .tree-divider {
      position: absolute;
      top: 0;
      right: 0;
      bottom: 0;
      width: 4px;
      z-index: 3;
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
      Below 1024 the AI sidebar is a full-width fixed overlay (DESIGN.md D7).
      Final styling is step 1b.9 — this is just enough to float it above the
      content instead of letting a pane squash it.
    */
    .ai-overlay {
      position: fixed;
      inset: 0;
      z-index: 20;
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
  private readonly auth = inject(Auth);
  private readonly pageTypes = inject(PageTypes);
  /** Shared channel to the routed page-detail; feeds the hoisted inspector. */
  protected readonly ctx = inject(PageContext);
  /** Single responsive switch (DESIGN.md D1); drives sidenav mode + the hamburger. */
  protected readonly bp = inject(Breakpoint);

  // `#body` now sits on <mat-sidenav-container>; read its host element so
  // onTreeResize keeps measuring from the shell's left edge.
  private readonly bodyEl = viewChild('body', { read: ElementRef });

  protected readonly treeWidth = computed(() => this.layout.treeWidth());
  protected readonly inspectorWidth = computed(() => this.layout.inspectorWidth());

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
    const host = this.bodyEl()?.nativeElement as HTMLElement | undefined;
    if (!host) return;
    const width = pointerX - host.getBoundingClientRect().left;
    this.layout.update({ treeWidth: width });
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

  onToggleAi(): void {
    this.aiOpen.update((open) => !open);
  }

  constructor() {
    // Sync activeGuid from URL changes.
    this.router.events.subscribe(() => {
      const match = /^\/pages\/([0-9a-f-]+)/i.exec(this.router.url);
      this.activeGuid.set(match ? match[1] : null);
    });
  }

  onPageSelect(guid: string): void {
    void this.router.navigate(['/pages', guid]);
    // On mobile the tree is an `over` drawer — dismiss it once a page is picked.
    if (!this.bp.isDesktop()) this.treeDrawerOpen.set(false);
  }

  onRenameRequested(guid: string): void {
    // Pull the current title off the children resource cached by the tree —
    // for Phase 3 we fall back to "Page" if not in cache. Phase 4's context
    // menu will pass the full PageSummary through so this is unnecessary.
    this.renameTarget.set({ guid, title: 'Page' });
  }

  async onDeleteRequested(guid: string): Promise<void> {
    if (!window.confirm('Delete this page and all its children?')) return;
    try {
      await this.pages.deletePage(guid, { recursive: true });
      // If the deleted page was active, navigate back to /pages
      if (this.activeGuid() === guid) {
        await this.router.navigate(['/pages']);
      }
    } catch (err) {
      console.error('Failed to delete page', err);
      window.alert('Failed to delete page.');
    }
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
    this.dialog.open<SearchDialog, void, string | null>(SearchDialog, {
      width: '640px',
      panelClass: 'wiki-search-dialog-panel',
    });
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
