import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { firstValueFrom, map } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MarkdownRenderer } from '../../shared/markdown/markdown-renderer';
import { Breadcrumbs } from '../../shared/components/breadcrumbs';
import type { WikiBrokenLinkEvent } from '../../shared/markdown/wiki-link';
import { Pages } from './pages';
import { PageTypes } from '../page-types/page-types';
import { BoardView } from '../board/board-view';
import { BoardSettingsPanel, type BoardSettingsPanelData } from '../board/board-settings-panel';
import { CreatePageFromLinkModal, type CreatePageFromLinkModalData } from './create-page-from-link-modal';
import type { BoardConfig } from './page.types';

type ViewMode = 'content' | 'board';

@Component({
  selector: 'wiki-page-view',
  standalone: true,
  imports: [
    RouterLink,
    MatButtonModule,
    MatButtonToggleModule,
    MatIconModule,
    MarkdownRenderer,
    Breadcrumbs,
    BoardView,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-view">
      <header class="actions">
        @if (boardConfig(); as cfg) {
          <mat-button-toggle-group
            class="view-toggle"
            [value]="viewMode()"
            (change)="onViewToggle($event.value)"
            aria-label="View mode"
          >
            <mat-button-toggle value="content">Content</mat-button-toggle>
            <mat-button-toggle value="board">Board</mat-button-toggle>
          </mat-button-toggle-group>
          @if (viewMode() === 'board') {
            <button
              mat-icon-button
              type="button"
              (click)="openBoardSettings()"
              aria-label="Board settings"
              title="Board settings"
            >
              <mat-icon>settings</mat-icon>
            </button>
          }
        }
        @if (guid()) {
          <a mat-button color="primary" [routerLink]="['/pages', guid(), 'edit']">Edit</a>
        }
      </header>
      @if (guid(); as g) {
        @if (resolvedTitle(); as t) {
          <wiki-breadcrumbs [guid]="g" [currentTitle]="t" />
        }
      }
      <section class="body">
        @if (resource.isLoading()) {
          <div class="state">Loading page...</div>
        } @else if (resource.error()) {
          <div class="state error">
            Failed to load page.
            <button type="button" (click)="resource.reload()">Retry</button>
          </div>
        } @else if (resource.value(); as content) {
          @if (viewMode() === 'board') {
            <wiki-board-view [parentGuid]="content.guid" [boardConfig]="content.boardConfig ?? null" />
          } @else {
            <wiki-markdown-renderer
              [markdown]="content.content"
              (brokenClick)="onBrokenLink($event)"
            />
          }
        }
      </section>
    </div>
  `,
  styles: [`
    .page-view { display: flex; flex-direction: column; height: 100%; }
    .actions { display: flex; align-items: center; gap: 0.5rem; justify-content: flex-end; padding: 0.5rem 1rem; border-bottom: 1px solid #e5e7eb; }
    .view-toggle { margin-right: auto; }
    .body { flex: 1; overflow: auto; }
    .state { padding: 2rem; color: #6b7280; }
    .state.error { color: #b91c1c; }
  `],
})
export class PageView {
  private readonly route = inject(ActivatedRoute);
  private readonly pages = inject(Pages);
  private readonly pageTypes = inject(PageTypes);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(MatSnackBar);

  protected readonly guid = toSignal(
    this.route.paramMap.pipe(map((p) => p.get('guid'))),
    { initialValue: null as string | null },
  );

  protected readonly resource = this.pages.pageResource(this.guid);

  protected readonly resolvedTitle = computed<string | null>(() => {
    if (this.resource.status() !== 'resolved') return null;
    return this.resource.value()?.title ?? null;
  });

  protected readonly boardConfig = computed<BoardConfig | null>(() => {
    if (this.resource.status() !== 'resolved') return null;
    return this.resource.value()?.boardConfig ?? null;
  });

  private readonly _viewMode = signal<ViewMode>('content');
  protected readonly viewMode = this._viewMode.asReadonly();

  constructor() {
    // Sync the default view from boardConfig when the page resolves.
    effect(() => {
      const cfg = this.boardConfig();
      if (cfg?.defaultView === 'board') {
        this._viewMode.set('board');
      } else if (!cfg) {
        this._viewMode.set('content');
      }
    });
  }

  onViewToggle(mode: ViewMode): void {
    this._viewMode.set(mode);
  }

  async onBrokenLink(event: WikiBrokenLinkEvent): Promise<void> {
    const data: CreatePageFromLinkModalData = {
      target: event.displayText || event.target,
      parentGuid: this.guid(),
    };
    const ref = this.dialog.open<CreatePageFromLinkModal, CreatePageFromLinkModalData, string | null>(
      CreatePageFromLinkModal,
      { data },
    );
    await firstValueFrom(ref.afterClosed());
  }

  async openBoardSettings(): Promise<void> {
    const page = this.resource.value();
    if (!page) return;
    const pageTypesList = this.pageTypes.pageTypesResource().value() ?? [];
    const data: BoardSettingsPanelData = {
      config: page.boardConfig ?? null,
      pageTypes: pageTypesList,
    };
    const ref = this.dialog.open<BoardSettingsPanel, BoardSettingsPanelData, BoardConfig | null>(
      BoardSettingsPanel,
      { data },
    );
    const result = await firstValueFrom(ref.afterClosed());
    if (!result) return;
    try {
      await this.pages.updatePage(page.guid, { boardConfig: result });
    } catch {
      this.snack.open('Failed to save board settings.', 'Dismiss', { duration: 4000 });
    }
  }
}
