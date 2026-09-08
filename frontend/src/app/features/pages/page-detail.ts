import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { firstValueFrom, map } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { WikiCodemirror, type CursorContext, type ToolbarAction } from '../../shared/codemirror/wiki-codemirror';
import { MarkdownToolbar } from '../editor/markdown-toolbar';
import { LinkAutocomplete } from '../editor/link-autocomplete';
import { InspectorPanel } from '../editor/inspector-panel';
import { MarkdownRenderer } from '../../shared/markdown/markdown-renderer';
import { Breadcrumbs } from '../../shared/components/breadcrumbs';
import type { WikiBrokenLinkEvent } from '../../shared/markdown/wiki-link';
import { Pages, type PageSearchResult } from './pages';
import { Drafts, type PageMetadata } from './drafts';
import { PageTypes } from '../page-types/page-types';
import { BoardView } from '../board/board-view';
import { BoardSettingsPanel, type BoardSettingsPanelData } from '../board/board-settings-panel';
import { CreatePageFromLinkModal, type CreatePageFromLinkModalData } from './create-page-from-link-modal';
import { EditorErrorState } from '../../core/error/editor-error-state';
import type { BoardConfig } from './page.types';

type Mode = 'view' | 'edit';
type ViewMode = 'content' | 'board';

const DRAFT_DEBOUNCE_MS = 400;

/**
 * Unified page screen. A single component backs both `/pages/:guid` (view) and
 * `/pages/:guid/edit` (edit) — the `:guid/edit` route carries `data.editMode`.
 * The Properties / Attachments / Linked inspector is mounted in both modes;
 * in view mode it renders read-only. Toggling View/Edit navigates between the
 * two routes (the component is recreated), so unsaved work survives via the
 * localStorage-backed `Drafts` store, exactly as the standalone editor did.
 */
@Component({
  selector: 'wiki-page-detail',
  standalone: true,
  imports: [
    MatButtonModule,
    MatButtonToggleModule,
    MatIconModule,
    MatSidenavModule,
    WikiCodemirror,
    MarkdownToolbar,
    LinkAutocomplete,
    InspectorPanel,
    MarkdownRenderer,
    Breadcrumbs,
    BoardView,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-detail">
      <header class="bar">
        <span class="title">{{ resolvedTitle() ?? 'Untitled' }}</span>

        @if (mode() === 'view' && boardConfig()) {
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

        <span class="spacer"></span>

        @if (saveError()) {
          <span class="error">{{ saveError() }}</span>
        }

        <mat-button-toggle-group
          class="mode-toggle"
          [value]="mode()"
          (change)="onModeToggle($event.value)"
          aria-label="Edit mode"
        >
          <mat-button-toggle value="view">View</mat-button-toggle>
          <mat-button-toggle value="edit">Edit</mat-button-toggle>
        </mat-button-toggle-group>

        <button
          mat-icon-button
          type="button"
          aria-label="Toggle inspector"
          (click)="toggleInspector()"
        >
          <mat-icon>info</mat-icon>
        </button>

        @if (mode() === 'edit' || dirty()) {
          <button mat-flat-button color="primary" (click)="save()" [disabled]="saving()">
            @if (saving()) { Saving... } @else { Save }
          </button>
        }
      </header>

      @if (guid(); as g) {
        @if (resolvedTitle(); as t) {
          <wiki-breadcrumbs [guid]="g" [currentTitle]="t" />
        }
      }

      <mat-sidenav-container class="container">
        <mat-sidenav-content class="content-pane">
          @if (mode() === 'edit') {
            <wiki-markdown-toolbar (action)="onAction($event)" />
          }

          <section class="body">
            @if (resource.isLoading()) {
              <div class="state">Loading page...</div>
            } @else if (resource.error()) {
              <div class="state error">
                Failed to load page.
                <button type="button" (click)="resource.reload()">Retry</button>
              </div>
            } @else if (mode() === 'edit' && editorError(); as err) {
              <div class="state error">
                <p>The editor crashed: {{ err.message }}</p>
                <p>Your recent changes were saved to this browser automatically — reloading is safe.</p>
                <button mat-flat-button color="primary" type="button" (click)="reloadEditor()">
                  Try Again
                </button>
                <button mat-stroked-button type="button" (click)="reloadPage()">
                  Reload Page
                </button>
              </div>
            } @else if (resource.value(); as page) {
              @if (mode() === 'edit') {
                @if (metadata()) {
                  <wiki-codemirror
                    #editor
                    [(value)]="content"
                    (save)="save()"
                    (cursorContext)="cursorContext.set($event)"
                    style="height: 100%; display:block;"
                  />
                  @if (cursorContext(); as ctx) {
                    @if (ctx.coords) {
                      <wiki-link-autocomplete
                        [query]="ctx.query"
                        [position]="{ top: ctx.coords.bottom, left: ctx.coords.left }"
                        [visible]="true"
                        (pick)="onPickPage($event, ctx)"
                        (dismiss)="cursorContext.set(null)"
                      />
                    }
                  }
                }
              } @else if (viewMode() === 'board') {
                <wiki-board-view [parentGuid]="page.guid" [boardConfig]="page.boardConfig ?? null" />
              } @else {
                <wiki-markdown-renderer
                  [markdown]="content()"
                  (brokenClick)="onBrokenLink($event)"
                />
              }
            }
          </section>
        </mat-sidenav-content>

        <mat-sidenav
          #inspector
          position="end"
          mode="side"
          [opened]="inspectorOpen()"
          class="inspector"
        >
          @if (guid() && metadata(); as m) {
            <wiki-inspector-panel
              [pageGuid]="guid()!"
              [metadata]="m"
              [pageAuthorId]="m.createdBy"
              [canInsert]="mode() === 'edit'"
              (metadataChange)="metadata.set($event)"
              (insertMarkdown)="onInsertMarkdown($event)"
            />
          }
        </mat-sidenav>
      </mat-sidenav-container>
    </div>
  `,
  styles: [`
    .page-detail { display: flex; flex-direction: column; height: 100%; }
    .bar { display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1rem; border-bottom: 1px solid #e5e7eb; background: #f9fafb; }
    .title { font-weight: 600; }
    .view-toggle { margin-left: 0.5rem; }
    .spacer { flex: 1; }
    .error { color: #b91c1c; font-size: 0.875rem; }
    .container { flex: 1; min-height: 0; }
    .content-pane { display: flex; flex-direction: column; height: 100%; }
    .body { flex: 1; min-height: 0; padding: 0; position: relative; overflow: auto; }
    .state { padding: 2rem; color: #6b7280; }
    .state.error { color: #b91c1c; }
    .inspector { width: 360px; }
  `],
})
export class PageDetail {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly pages = inject(Pages);
  private readonly pageTypes = inject(PageTypes);
  private readonly drafts = inject(Drafts);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  private readonly errorState = inject(EditorErrorState);

  protected readonly editor = viewChild<WikiCodemirror>('editor');

  protected readonly guid = toSignal(
    this.route.paramMap.pipe(map((p) => p.get('guid'))),
    { initialValue: null as string | null },
  );

  private readonly editModeFromRoute = toSignal(
    this.route.data.pipe(map((d) => d['editMode'] === true)),
    { initialValue: false },
  );
  protected readonly mode = computed<Mode>(() => (this.editModeFromRoute() ? 'edit' : 'view'));

  protected readonly resource = this.pages.pageResource(this.guid);

  /** Working copy — hydrated from draft-or-server once the resource resolves. */
  readonly content = signal('');
  readonly metadata = signal<PageMetadata | null>(null);

  protected readonly saveError = signal<string | null>(null);
  protected readonly saving = signal(false);

  protected readonly cursorContext = signal<CursorContext | null>(null);
  protected readonly inspectorOpen = signal(false);

  private readonly _viewMode = signal<ViewMode>('content');
  protected readonly viewMode = this._viewMode.asReadonly();

  protected readonly editorError = computed(() => this.errorState.current());

  protected readonly resolvedTitle = computed<string | null>(() => {
    const m = this.metadata();
    if (m?.title) return m.title;
    if (this.resource.status() !== 'resolved') return null;
    return this.resource.value()?.title ?? null;
  });

  protected readonly boardConfig = computed<BoardConfig | null>(() => {
    if (this.resource.status() !== 'resolved') return null;
    return this.resource.value()?.boardConfig ?? null;
  });

  /** Whether the working copy diverges from the persisted server page. */
  protected readonly dirty = computed<boolean>(() => {
    if (this.resource.status() !== 'resolved') return false;
    const page = this.resource.value();
    const m = this.metadata();
    if (!page || !m) return false;
    if (this.content() !== (page.content ?? '')) return true;
    if (m.title !== page.title) return true;
    if (m.status !== page.status) return true;
    if ((m.pageType ?? null) !== (page.pageType ?? null)) return true;
    if (JSON.stringify(m.tags ?? []) !== JSON.stringify(page.tags ?? [])) return true;
    return JSON.stringify(m.properties ?? {}) !== JSON.stringify(page.properties ?? {});
  });

  private syncedGuid: string | null = null;

  constructor() {
    // Sync the board default view from boardConfig once the page resolves.
    effect(() => {
      const cfg = this.boardConfig();
      if (cfg?.defaultView === 'board') {
        this._viewMode.set('board');
      } else if (!cfg) {
        this._viewMode.set('content');
      }
    });

    // Hydrate the working copy once per guid — draft takes priority over server.
    effect(() => {
      if (this.resource.status() !== 'resolved') return;
      const page = this.resource.value();
      const currentGuid = this.guid();
      if (!page || !currentGuid) return;
      if (this.syncedGuid === currentGuid) return;
      this.syncedGuid = currentGuid;

      const draft = this.drafts.get(currentGuid);
      const meta: PageMetadata = {
        title: page.title,
        tags: page.tags ?? [],
        status: page.status,
        ...(page.pageType ? { pageType: page.pageType } : {}),
        ...(page.properties ? { properties: page.properties } : {}),
        createdBy: page.createdBy,
        modifiedBy: page.modifiedBy,
        createdAt: page.createdAt,
        modifiedAt: page.modifiedAt,
        guid: page.guid,
      };
      this.metadata.set(draft?.metadata ?? meta);
      this.content.set(draft?.content ?? (page.content ?? ''));
    });

    // Debounced draft autosave whenever the working copy diverges from the
    // server. Properties are editable in both view and edit mode, so this is
    // not gated on mode — only on there being real unsaved changes.
    let timer: ReturnType<typeof setTimeout> | null = null;
    effect(() => {
      const c = this.content();
      const g = this.guid();
      const m = this.metadata();
      if (!g || !m) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        if (this.dirty()) this.drafts.set(g, { content: c, metadata: m });
      }, DRAFT_DEBOUNCE_MS);
    });

    // Final stash on destroy — covers navigation before the debounce fires
    // (including the View/Edit toggle, which recreates this component).
    this.destroyRef.onDestroy(() => {
      if (timer) clearTimeout(timer);
      const g = this.guid();
      const m = this.metadata();
      if (g && m && this.dirty()) {
        this.drafts.set(g, { content: this.content(), metadata: m });
      }
    });
  }

  onModeToggle(next: Mode): void {
    const g = this.guid();
    if (!g || next === this.mode()) return;
    void this.router.navigate(next === 'edit' ? ['/pages', g, 'edit'] : ['/pages', g]);
  }

  onViewToggle(mode: ViewMode): void {
    this._viewMode.set(mode);
  }

  toggleInspector(): void {
    this.inspectorOpen.update((v) => !v);
  }

  onAction(action: ToolbarAction): void {
    try {
      this.editor()?.applyAction(action);
    } catch (err) {
      this.errorState.setError(this.editorErrMessage(err));
    }
  }

  onPickPage(page: PageSearchResult, ctx: CursorContext): void {
    try {
      const replacement = `[[${page.title}]]`;
      this.editor()?.insertText(ctx.from, ctx.to, replacement);
      this.cursorContext.set(null);
    } catch (err) {
      this.errorState.setError(this.editorErrMessage(err));
    }
  }

  onInsertMarkdown(text: string): void {
    try {
      const ed = this.editor();
      const view = ed?.getView();
      if (!view) return;
      const { from, to } = view.state.selection.main;
      ed?.insertText(from, to, text);
    } catch (err) {
      this.errorState.setError(this.editorErrMessage(err));
    }
  }

  reloadEditor(): void {
    this.errorState.clear();
  }

  reloadPage(): void {
    window.location.reload();
  }

  private editorErrMessage(err: unknown): string {
    return err instanceof Error ? err.message : 'The editor hit an unexpected error.';
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

  async save(): Promise<void> {
    const g = this.guid();
    const m = this.metadata();
    if (!g || !m) return;

    const content = this.content();
    // Persist a draft before the API call so a thrown request can't lose work.
    this.drafts.set(g, { content, metadata: m });

    this.saving.set(true);
    this.saveError.set(null);
    try {
      await this.pages.updatePage(g, {
        content,
        title: m.title,
        tags: m.tags,
        status: m.status,
        ...(m.pageType !== undefined ? { pageType: m.pageType || null } : {}),
        ...(m.properties ? { properties: m.properties } : {}),
      });
      this.drafts.clear(g);
      // updatePage bumps the pages version, so the view reload picks up the save.
      await this.router.navigate(['/pages', g]);
    } catch (err) {
      const message =
        (err as { message?: string })?.message ?? 'Save failed. Try again.';
      this.saveError.set(`Save failed: ${message}`);
    } finally {
      this.saving.set(false);
    }
  }
}
