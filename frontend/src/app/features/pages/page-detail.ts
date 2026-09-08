import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
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
import { ResizeDivider } from '../../shared/components/resize-divider';
import { Layout } from '../../core/layout/layout';
import type { WikiBrokenLinkEvent } from '../../shared/markdown/wiki-link';
import { Pages, type PageSearchResult } from './pages';
import { Drafts, type PageMetadata } from './drafts';
import { PageTypes } from '../page-types/page-types';
import { BoardView } from '../board/board-view';
import { BoardSettingsPanel, type BoardSettingsPanelData } from '../board/board-settings-panel';
import { CreatePageFromLinkModal, type CreatePageFromLinkModalData } from './create-page-from-link-modal';
import { ConfirmDialog, type ConfirmDialogData } from '../../shared/components/confirm-dialog';
import { EditorErrorState } from '../../core/error/editor-error-state';
import type { BoardConfig, PageContent } from './page.types';

type Mode = 'view' | 'edit';
type ViewMode = 'content' | 'board';
/** Editor-surface layout on the `/edit` route (client state, not a route param). */
type EditorMode = 'edit' | 'split' | 'preview';

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
    ResizeDivider,
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

        @if (mode() === 'edit') {
          <mat-button-toggle-group
            class="mode-toggle"
            [value]="editorMode()"
            (change)="onEditorModeToggle($event.value)"
            aria-label="Editor view mode"
          >
            <mat-button-toggle value="edit">Edit</mat-button-toggle>
            <mat-button-toggle value="split">Split</mat-button-toggle>
            <mat-button-toggle value="preview">Preview</mat-button-toggle>
          </mat-button-toggle-group>
        } @else {
          <mat-button-toggle-group
            class="mode-toggle"
            [value]="mode()"
            (change)="onModeToggle($event.value)"
            aria-label="Edit mode"
          >
            <mat-button-toggle value="view">View</mat-button-toggle>
            <mat-button-toggle value="edit">Edit</mat-button-toggle>
          </mat-button-toggle-group>
        }

        @if (resource.hasValue()) {
          <button
            mat-icon-button
            type="button"
            aria-label="Refresh"
            title="Discard local changes and reload from the server"
            (click)="refresh()"
          >
            <mat-icon>refresh</mat-icon>
          </button>
        }

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

      <mat-sidenav-container class="container" #sidenavContainer>
        <mat-sidenav-content class="content-pane">
          @if (mode() === 'edit' && editorMode() !== 'preview') {
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
                  <div
                    class="editor-surface"
                    [class.split]="editorMode() === 'split'"
                    #editorSurface
                  >
                    @if (editorMode() !== 'preview') {
                      <div
                        class="editor-pane"
                        [style.flex-basis.%]="editorMode() === 'split' ? editorSplitPosition() : null"
                      >
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
                      </div>
                    }
                    @if (editorMode() === 'split') {
                      <wiki-resize-divider (resized)="onSplitResize($event)" />
                    }
                    @if (editorMode() !== 'edit') {
                      <div class="preview-pane">
                        <wiki-markdown-renderer
                          [markdown]="content()"
                          (brokenClick)="onBrokenLink($event)"
                        />
                      </div>
                    }
                  </div>
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
          [style.width.px]="inspectorWidth()"
        >
          <div class="inspector-divider">
            <wiki-resize-divider (resized)="onInspectorResize($event)" />
          </div>
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
    .editor-surface { display: flex; flex-direction: column; height: 100%; min-height: 0; }
    .editor-surface .editor-pane { flex: 1 1 auto; min-height: 0; min-width: 0; display: flex; flex-direction: column; }
    .editor-surface .preview-pane { flex: 1 1 auto; min-height: 0; min-width: 0; overflow: auto; }
    .editor-surface.split { flex-direction: row; }
    .editor-surface.split .editor-pane { flex-grow: 0; flex-shrink: 0; }
    .editor-surface.split .preview-pane { border-left: 1px solid #e5e7eb; }
    .state { padding: 2rem; color: #6b7280; }
    .state.error { color: #b91c1c; }
    .inspector { position: relative; }
    .inspector-divider { position: absolute; left: 0; top: 0; bottom: 0; width: 6px; z-index: 5; }
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
  private readonly layout = inject(Layout);

  protected readonly editor = viewChild<WikiCodemirror>('editor');
  private readonly sidenavContainerEl = viewChild('sidenavContainer', { read: ElementRef });

  /** Inspector width, driven by the persisted layout store (replaces a
   * hardcoded 360px CSS constant). `Layout.update()` clamps to 250-600. */
  protected readonly inspectorWidth = computed(() => this.layout.inspectorWidth());

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

  private readonly editorSurfaceEl = viewChild('editorSurface', { read: ElementRef });

  /**
   * Editor-surface layout on the `/edit` route. Client state, not a route
   * param: the route only distinguishes read (`/pages/:guid`) from edit
   * (`/pages/:guid/edit`); the three-way Edit / Split / Preview choice lives
   * here. Initialised to `split` on load when a local draft diverges from the
   * server copy (see the hydrate effect).
   */
  private readonly _editorMode = signal<EditorMode>('edit');
  readonly editorMode = this._editorMode.asReadonly();

  /** Split left-pane width (%), from the persisted layout store. Clamp 20-80. */
  protected readonly editorSplitPosition = computed(() => this.layout.editorSplitPosition());

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

      // A new page identity starts clean: drop any editor-crash panel left over
      // from a previous page (EditorErrorState is root-scoped, so it otherwise
      // follows the user across navigations).
      this.errorState.clear();

      const draft = this.drafts.get(currentGuid);

      // Dirty-detection baseline = freshly fetched server content. Factored so
      // the Refresh action resets it exactly the same way (see `refresh()`).
      this.resetWorkingCopyToServer(page);

      if (draft) {
        this.metadata.set(draft.metadata);
        this.content.set(draft.content);

        // React parity: a local draft that diverges from the server copy opens
        // in Split so the user sees both surfaces. The route still governs
        // read-only vs edit; this only sets the editor-surface layout.
        if (draft.content !== (page.content ?? '')) {
          this._editorMode.set('split');
        }
      }
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
      this.stashDraft();
    });
  }

  /**
   * Synchronously persist the working copy to the Drafts store if it diverges
   * from the server. Used by the destroy hook and by `reloadPage()`, where the
   * 400 ms autosave debounce and the destroy hook would otherwise both be
   * skipped by a hard reload.
   */
  private stashDraft(): void {
    const g = this.guid();
    const m = this.metadata();
    if (g && m && this.dirty()) {
      this.drafts.set(g, { content: this.content(), metadata: m });
    }
  }

  /**
   * Reset the working copy — the `dirty()` baseline — to the given server page.
   * Called by the initial-load hydrate effect (before layering any local draft
   * on top) and by `refresh()` (via the effect, once the reloaded resource
   * re-resolves with no draft in the way).
   */
  private resetWorkingCopyToServer(page: PageContent): void {
    this.metadata.set({
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
    });
    this.content.set(page.content ?? '');
  }

  /**
   * Toolbar Refresh: discard the local draft, refetch the page, and reset the
   * dirty baseline to the fresh server content. Prompts first only when there
   * are unsaved changes. Clearing `syncedGuid` re-arms the hydrate effect, so
   * the reloaded resource flows back through `resetWorkingCopyToServer` — the
   * same path the initial load uses.
   */
  async refresh(): Promise<void> {
    const g = this.guid();
    if (!g) return;

    if (this.dirty()) {
      const data: ConfirmDialogData = {
        title: 'Discard unsaved changes?',
        message: 'Discard unsaved changes and reload this page from the server?',
        confirmLabel: 'Discard & reload',
        cancelLabel: 'Keep editing',
        destructive: true,
      };
      const ref = this.dialog.open<ConfirmDialog, ConfirmDialogData, boolean>(ConfirmDialog, { data });
      const confirmed = await firstValueFrom(ref.afterClosed());
      if (!confirmed) return;
    }

    // `Drafts.clear` drops both the in-memory Map entry and the localStorage row.
    this.drafts.clear(g);
    this.saveError.set(null);
    this.syncedGuid = null;
    this.resource.reload();
  }

  onModeToggle(next: Mode): void {
    const g = this.guid();
    if (!g || next === this.mode()) return;
    void this.router.navigate(next === 'edit' ? ['/pages', g, 'edit'] : ['/pages', g]);
  }

  onViewToggle(mode: ViewMode): void {
    this._viewMode.set(mode);
  }

  onEditorModeToggle(next: EditorMode): void {
    this._editorMode.set(next);
  }

  toggleInspector(): void {
    this.inspectorOpen.update((v) => !v);
  }

  /**
   * The inspector divider emits an absolute pointer X. The inspector is
   * right-anchored, so its width is the distance from the pointer to the
   * container's right edge; `Layout.update()` clamps to 250-600.
   */
  onInspectorResize(pointerX: number): void {
    const host = this.sidenavContainerEl()?.nativeElement as HTMLElement | undefined;
    if (!host) return;
    const width = host.getBoundingClientRect().right - pointerX;
    this.layout.update({ inspectorWidth: width });
  }

  /**
   * The Split divider emits an absolute pointer X. Convert it to the left
   * (editor) pane's share of the editor-surface width, as a percentage;
   * `Layout.update()` clamps to 20-80 and drops a non-finite value (e.g. from
   * a zero-width surface).
   */
  onSplitResize(pointerX: number): void {
    const host = this.editorSurfaceEl()?.nativeElement as HTMLElement | undefined;
    if (!host) return;
    const rect = host.getBoundingClientRect();
    const pct = ((pointerX - rect.left) / rect.width) * 100;
    this.layout.update({ editorSplitPosition: pct });
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
    // The destroy hook and the debounced autosave both miss a hard reload, so
    // stash synchronously first — otherwise the panel's "reloading is safe"
    // copy would be false inside the debounce window.
    this.stashDraft();
    this.hardReload();
  }

  /** Seam over `window.location.reload()` (non-configurable under jsdom). */
  protected hardReload(): void {
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
