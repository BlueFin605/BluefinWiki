import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { Layout } from '../../core/layout/layout';
import { Pages } from './pages';
import { PageTree } from './page-tree';
import { PageRenameInline } from './page-rename-inline';
import { NewPageModal, type NewPageModalData } from './new-page-modal';

@Component({
  selector: 'wiki-pages-view',
  standalone: true,
  imports: [
    RouterOutlet,
    MatToolbarModule,
    MatButtonModule,
    MatTooltipModule,
    MatIconModule,
    PageTree,
    PageRenameInline,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="pages-shell">
      <mat-toolbar color="primary" class="topbar">
        <span class="title">BluefinWiki</span>
        <span class="spacer"></span>
        <button mat-button (click)="onNewPage()">
          New page
        </button>
      </mat-toolbar>
      <div class="body">
        <aside class="sidebar" [style.width.px]="treeWidth()">
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
        </aside>
        <main class="main">
          <router-outlet />
        </main>
      </div>

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
    .body { display: flex; flex: 1; min-height: 0; }
    .sidebar { border-right: 1px solid #e5e7eb; overflow-y: auto; background: #f9fafb; }
    .main { flex: 1; overflow: auto; }
  `],
})
export class PagesView {
  private readonly router = inject(Router);
  private readonly pages = inject(Pages);
  private readonly layout = inject(Layout);
  private readonly dialog = inject(MatDialog);

  protected readonly treeWidth = computed(() => this.layout.treeWidth());

  // Phase 6 will inject PageTypesService and bind this to its resource.
  // Phase 3 ships an empty map — the tree still works, drag-drop has no
  // type constraints to enforce.
  protected readonly pageTypesMap = signal<Record<string, never>>({});

  // The active guid is parsed from the URL by the child route components in
  // Phase 3; here we expose it as a signal so the tree can highlight the
  // current page. The router emits navigation events synchronously enough
  // that reading from the URL on each tick is fine.
  protected readonly activeGuid = signal<string | null>(null);

  protected readonly renameTarget = signal<{ guid: string; title: string } | null>(null);

  constructor() {
    // Sync activeGuid from URL changes.
    this.router.events.subscribe(() => {
      const match = /^\/pages\/([0-9a-f-]+)/i.exec(this.router.url);
      this.activeGuid.set(match ? match[1] : null);
    });
  }

  onPageSelect(guid: string): void {
    void this.router.navigate(['/pages', guid]);
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
}
