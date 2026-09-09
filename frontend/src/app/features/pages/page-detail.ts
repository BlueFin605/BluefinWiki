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
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { filter, firstValueFrom, map, race, skipWhile, take, timer } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { WikiCodemirror, type CursorContext, type ToolbarAction } from '../../shared/codemirror/wiki-codemirror';
import { MarkdownToolbar } from '../editor/markdown-toolbar';
import { LinkAutocomplete } from '../editor/link-autocomplete';
import type { PageTypeChange } from '../editor/page-properties-panel';
import { rewriteFirstH1, firstH1Range } from '../editor/title-h1';
import { AttachmentUploader } from '../attachments/attachment-uploader';
import type { AttachmentUploadedEvent } from '../attachments/attachment.types';
import { MarkdownRenderer } from '../../shared/markdown/markdown-renderer';
import { WikiTableOfContents } from '../../shared/markdown/table-of-contents';
import { Breadcrumbs } from '../../shared/components/breadcrumbs';
import { ResizeDivider } from '../../shared/components/resize-divider';
import { Layout } from '../../core/layout/layout';
import type { WikiBrokenLinkEvent } from '../../shared/markdown/wiki-link';
import type { WikiTargetResolver } from '../../shared/markdown/plugins/remark-wiki-links';
import { parseWikiLinks } from '../../shared/markdown/wiki-link-parser';
import type { WikiImageResize } from '../../shared/markdown/wiki-image';
import { setImageWidth } from '../../shared/codemirror/set-image-width';
import { Pages, type PageSearchResult, type WikiLinkResolution } from './pages';
import { Drafts, type PageMetadata } from './drafts';
import { PageContext } from './page-context';
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
 * Ceiling on how long {@link PageDetail.reloadPageResource} waits for the page
 * resource to settle after `reload()`. Guards the `skipWhile` bridge below: if
 * the status stream ever coalesces the reload's `loading`/`reloading` away, the
 * promise would otherwise never resolve and `_isRefreshing` would latch `true`,
 * permanently disabling the Refresh button. Unreachable with a real HTTP
 * round-trip today; this makes it unreachable by construction.
 */
const RELOAD_SETTLE_TIMEOUT_MS = 10_000;

/** The four save-status pill states, in priority order. */
export type SaveStatus = 'read-only' | 'saving' | 'unsaved' | 'saved';

/** Pill label for each {@link SaveStatus}. */
export const SAVE_STATUS_LABEL: Record<SaveStatus, string> = {
  'read-only': 'Read-only',
  saving: 'Saving…',
  unsaved: '● Unsaved changes',
  saved: '✓ All changes saved',
};

/**
 * Pure resolver for the save-status pill. Priority order mirrors React:
 * read-only (not editing / no permission) beats an in-flight save, which beats
 * unsaved changes, which beats the settled "all saved" state.
 */
export function resolveSaveStatus(state: {
  canEdit: boolean;
  saving: boolean;
  dirty: boolean;
}): SaveStatus {
  if (!state.canEdit) return 'read-only';
  if (state.saving) return 'saving';
  if (state.dirty) return 'unsaved';
  return 'saved';
}

/**
 * Unified page screen. A single component backs both `/pages/:guid` (view) and
 * `/pages/:guid/edit` (edit) — the `:guid/edit` route carries `data.editMode`.
 * The Properties / Attachments / Linked inspector is mounted in both modes and
 * its properties stay editable in both (see the `saveStatus` note below and
 * `resetWorkingCopyToServer`'s autosave effect) — the "Read-only" save pill
 * reflects only the CodeMirror editor surface, not the inspector. Toggling
 * View/Edit navigates between the two routes (the component is recreated), so
 * unsaved work survives via the localStorage-backed `Drafts` store, exactly as
 * the standalone editor did.
 */
@Component({
  selector: 'wiki-page-detail',
  standalone: true,
  imports: [
    MatButtonModule,
    MatButtonToggleModule,
    MatIconModule,
    WikiCodemirror,
    MarkdownToolbar,
    LinkAutocomplete,
    AttachmentUploader,
    MarkdownRenderer,
    WikiTableOfContents,
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
            [disabled]="isRefreshing()"
            (click)="refresh()"
          >
            <mat-icon>refresh</mat-icon>
          </button>
        }

        <button
          mat-icon-button
          type="button"
          aria-label="Toggle inspector"
          (click)="pageContext.toggleInspector()"
        >
          <mat-icon>info</mat-icon>
        </button>

        @if (resource.hasValue()) {
          <span class="save-status" [attr.data-status]="saveStatus()" aria-live="polite">
            {{ saveStatusLabel() }}
          </span>
        }

        @if (mode() === 'edit' || dirty()) {
          <button mat-flat-button color="primary" (click)="save()" [disabled]="saving()">
            Save
          </button>
        }
      </header>

      @if (saveError(); as err) {
        @if (!saveErrorDismissed()) {
          <div class="save-failed" role="alert">
            <span class="save-failed-msg">
              Save failed: {{ err }}. Your changes are still here — click Save again to retry.
            </span>
            <button
              mat-icon-button
              type="button"
              aria-label="Dismiss save error"
              (click)="dismissSaveError()"
            >
              <mat-icon>close</mat-icon>
            </button>
          </div>
        }
      }

      @if (guid(); as g) {
        @if (resolvedTitle(); as t) {
          <wiki-breadcrumbs [guid]="g" [currentTitle]="t" />
        }
      }

      <div class="container">
        <div class="content-pane">
          @if (mode() === 'edit' && editorMode() !== 'preview') {
            <wiki-markdown-toolbar (action)="onAction($event)" />
            @if (attachmentGuardMessage(); as msg) {
              <div class="attachment-guard" role="alert">{{ msg }}</div>
            }
            @if (attachmentUploaderOpen() && guid(); as g) {
              <div class="attachment-uploader-panel">
                <wiki-attachment-uploader
                  [pageGuid]="g"
                  (uploaded)="onAttachmentUploaded($event)"
                />
                <button mat-button type="button" (click)="closeAttachmentUploader()">
                  Done
                </button>
              </div>
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
                          [pageGuid]="guid() ?? undefined"
                          [editable]="true"
                          [resolveWikiTarget]="resolveWikiTarget()"
                          (brokenClick)="onBrokenLink($event)"
                          (imageResize)="onImageResize($event)"
                        />
                        <wiki-toc [markdown]="content()" />
                      </div>
                    }
                  </div>
                }
              } @else if (viewMode() === 'board') {
                <wiki-board-view [parentGuid]="page.guid" [boardConfig]="page.boardConfig ?? null" />
              } @else {
                <div class="view-with-toc">
                  <wiki-markdown-renderer
                    [markdown]="content()"
                    [pageGuid]="guid() ?? undefined"
                    [resolveWikiTarget]="resolveWikiTarget()"
                    (brokenClick)="onBrokenLink($event)"
                  />
                  <wiki-toc [markdown]="content()" />
                </div>
              }
            }
          </section>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .page-detail { display: flex; flex-direction: column; height: 100%; }
    .bar { display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1rem; border-bottom: 1px solid #e5e7eb; background: #f9fafb; }
    .title { font-weight: 600; }
    .view-toggle { margin-left: 0.5rem; }
    .spacer { flex: 1; }
    .save-status { font-size: 0.8125rem; color: #6b7280; white-space: nowrap; }
    .save-status[data-status='unsaved'] { color: #b45309; }
    .save-status[data-status='saved'] { color: #15803d; }
    .save-failed {
      display: flex; align-items: center; gap: 0.5rem;
      margin: 0.5rem 1rem; padding: 0.25rem 0.25rem 0.25rem 0.75rem;
      border: 1px solid #fca5a5; border-radius: 4px;
      background: #fef2f2; color: #b91c1c; font-size: 0.875rem;
    }
    .save-failed-msg { flex: 1; }
    .attachment-guard {
      margin: 0.5rem 1rem; padding: 0.25rem 0.75rem;
      border: 1px solid #fca5a5; border-radius: 4px;
      background: #fef2f2; color: #b91c1c; font-size: 0.875rem;
    }
    .attachment-uploader-panel {
      display: flex; flex-direction: column; align-items: flex-end; gap: 0.5rem;
      margin: 0.5rem 1rem; padding: 0.75rem;
      border: 1px solid #e5e7eb; border-radius: 4px; background: #ffffff;
    }
    .attachment-uploader-panel wiki-attachment-uploader { align-self: stretch; }
    .container { flex: 1; min-height: 0; }
    .content-pane { display: flex; flex-direction: column; height: 100%; }
    .body { flex: 1; min-height: 0; padding: 0; position: relative; overflow: auto; }
    .editor-surface { display: flex; flex-direction: column; height: 100%; min-height: 0; }
    .editor-surface .editor-pane { flex: 1 1 auto; min-height: 0; min-width: 0; display: flex; flex-direction: column; }
    .editor-surface .preview-pane { flex: 1 1 auto; min-height: 0; min-width: 0; overflow: auto; display: flex; align-items: flex-start; }
    .editor-surface .preview-pane wiki-markdown-renderer { flex: 1 1 auto; min-width: 0; }
    .editor-surface .preview-pane wiki-toc { flex: 0 0 auto; padding: 1.5rem 1rem; }
    /* Read-mode content + its table-of-contents rail (scrolls inside .body). */
    .view-with-toc { display: flex; align-items: flex-start; }
    .view-with-toc wiki-markdown-renderer { flex: 1 1 auto; min-width: 0; }
    .view-with-toc wiki-toc { flex: 0 0 auto; padding: 1.5rem 1rem; }
    .editor-surface.split { flex-direction: row; }
    .editor-surface.split .editor-pane { flex-grow: 0; flex-shrink: 0; }
    .editor-surface.split .preview-pane { border-left: 1px solid #e5e7eb; }
    .state { padding: 2rem; color: #6b7280; }
    .state.error { color: #b91c1c; }
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
  /**
   * Cross-component channel to the hoisted inspector (rendered by `pages-view`).
   * `page-detail` publishes `guid` / `mode` here, shares its `metadata` working
   * copy through `pageContext.metadata`, subscribes to the inspector's
   * editor-affecting outputs, and drives the editor-bar toggle button.
   */
  protected readonly pageContext = inject(PageContext);

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
  /**
   * The page-metadata working copy. Ownership moved to {@link PageContext} when
   * the inspector was hoisted (step 1b.3): this is the very same
   * `WritableSignal` the hoisted `wiki-inspector-panel` writes through its
   * `metadataChange` output. `page-detail` still reads it for dirty-detection,
   * the resolved title and the save payload, and still `.set()`s it during
   * hydration / refresh / page-type change.
   */
  readonly metadata = this.pageContext.metadata;

  /**
   * Resolved `[[wiki link]]` targets for the current buffer, keyed by the raw
   * target string. Populated lazily by {@link resolveWikiTargets} as the
   * content changes; consulted synchronously by {@link resolveWikiTarget}
   * during preview rendering.
   */
  private readonly wikiResolutions = signal<ReadonlyMap<string, WikiLinkResolution>>(new Map());
  /** Targets with a `/pages/links/resolve` request in flight — dedupes fetches. */
  private readonly wikiResolveInFlight = new Set<string>();

  /**
   * Synchronous resolver handed to `<wiki-markdown-renderer>`. Reads the
   * {@link wikiResolutions} map (so its identity changes when a resolution
   * lands, re-rendering the preview). An unresolved target returns
   * `{ guid: null, exists: true }` — the pending state: the link renders with
   * normal (non-broken) styling but is **not navigable**, so a `[[…]]` never
   * dead-ends on a bare title while a lookup is pending, and stays
   * non-navigable-to-a-title permanently if the resolve request fails (the
   * target is never added to the map). Links only flip to the broken state on a
   * definitive miss.
   */
  protected readonly resolveWikiTarget = computed<WikiTargetResolver>(() => {
    const resolved = this.wikiResolutions();
    return (target) => resolved.get(target) ?? { guid: null, exists: true };
  });

  /** Raw server message from the last failed save (null when the last save
   * succeeded or none has run). The reassurance banner composes the full copy. */
  protected readonly saveError = signal<string | null>(null);
  /** Set when the user closes the failure banner; reset on the next save attempt. */
  protected readonly saveErrorDismissed = signal(false);
  protected readonly saving = signal(false);

  protected readonly cursorContext = signal<CursorContext | null>(null);

  /**
   * Markdown queued for insertion once CodeMirror (re)mounts. Set when an insert
   * is requested while the editor is unmounted — i.e. the Preview sub-mode
   * (`editorMode() === 'preview'`). {@link insertMarkdownAtCursor} flips the
   * surface back to Split and stashes the text here; a constructor effect
   * performs the insert on the next render, once `editor()` resolves.
   */
  private readonly pendingInsertText = signal<string | null>(null);

  /** Toolbar Attachment button: whether the inline uploader panel is showing. */
  protected readonly attachmentUploaderOpen = signal(false);
  /**
   * Defensive "Save the page before uploading attachments." message. Angular
   * creates pages server-side first, so a guid always exists and this never
   * really fires — but the guard mirrors React's toolbar behaviour.
   */
  protected readonly attachmentGuardMessage = signal<string | null>(null);

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

  /**
   * Single save-status pill. A pure projection of `mode` / `saving` / `dirty`
   * (see {@link resolveSaveStatus}) — "Read-only" in view mode, otherwise
   * Saving… / Unsaved / All saved. Replaces the old "Saving..." label and the
   * generic `saveError` span.
   *
   * NOTE: "Read-only" here means the CodeMirror editor buffer only. The
   * inspector's Properties panel persists edits in BOTH view and edit mode —
   * including {@link onPageTypeChange}, which fires an immediate `updatePage` —
   * and this is deliberate (React parity). Do not read the pill as gating the
   * inspector.
   */
  protected readonly saveStatus = computed<SaveStatus>(() =>
    resolveSaveStatus({
      canEdit: this.mode() === 'edit',
      saving: this.saving(),
      dirty: this.dirty(),
    }),
  );
  protected readonly saveStatusLabel = computed(() => SAVE_STATUS_LABEL[this.saveStatus()]);

  private syncedGuid: string | null = null;

  /** Guards against a second Refresh (and a second confirm dialog) while one
   * refresh is already in flight — see `refresh()`. */
  private readonly _isRefreshing = signal(false);
  protected readonly isRefreshing = this._isRefreshing.asReadonly();

  /** Page-resource status as a stream, for the `refresh()` reload bridge. */
  private readonly resourceStatus$ = toObservable(this.resource.status);

  constructor() {
    // Publish route identity + mode to the shared PageContext so the hoisted
    // inspector (rendered by `pages-view`) knows which page it is bound to and
    // whether attachment inserts are allowed. `metadata` is not pushed here —
    // it IS `pageContext.metadata`, kept current by the hydrate / refresh /
    // page-type paths.
    effect(() => {
      this.pageContext.guid.set(this.guid());
      this.pageContext.mode.set(this.mode());
    });

    // Route the hoisted inspector's editor-affecting outputs back into the
    // handlers that still live here. The channel replaces the direct template
    // bindings the inspector had while it was mounted inside this component.
    this.pageContext.insert$
      .pipe(takeUntilDestroyed())
      .subscribe((md) => this.insertMarkdownAtCursor(md));
    this.pageContext.titleH1Sync$
      .pipe(takeUntilDestroyed())
      .subscribe((title) => this.setFirstH1(title));
    this.pageContext.pageTypeChange$
      .pipe(takeUntilDestroyed())
      .subscribe((change) => void this.onPageTypeChange(change));

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
        // Defensive: fall back to the server-derived metadata (just set by
        // resetWorkingCopyToServer) if a persisted draft row is missing it.
        this.metadata.set(draft.metadata ?? this.metadata());
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

    // The `[[wiki link]]` resolution cache is per-page. PageDetail is reused
    // across `/pages/:guid` -> `/pages/:guid2` navigations (the page resource is
    // a signal-param resource), so drop every resolved / in-flight entry
    // whenever the route guid changes. Otherwise a return visit serves stale
    // existence results (a page created elsewhere still renders as a broken
    // `[[link]]`) and the map grows for the whole session. Registered before the
    // resolve effect below so the clear always lands first on a guid change.
    let wikiCacheGuid: string | null = null;
    effect(() => {
      const g = this.guid();
      if (g === wikiCacheGuid) return;
      wikiCacheGuid = g;
      this.wikiResolutions.set(new Map());
      this.wikiResolveInFlight.clear();
    });

    // Resolve every distinct `[[target]]` in the buffer to a guid + existence
    // so the preview can render GUID hrefs and broken-link state. Fires as the
    // content changes; each distinct target is fetched at most once.
    effect(() => {
      this.resolveWikiTargets(this.content());
    });

    // Drain a queued inspector/toolbar insert once CodeMirror mounts. Requested
    // from the Preview sub-mode, `insertMarkdownAtCursor` cannot reach a view
    // synchronously (the editor is unmounted there), so it flips to Split and
    // parks the text; this runs it on the render where `editor()` resolves.
    effect(() => {
      const md = this.pendingInsertText();
      if (md == null) return;
      const ed = this.editor();
      const view = ed?.getView();
      if (!view) return;
      this.pendingInsertText.set(null);
      try {
        const { from, to } = view.state.selection.main;
        ed?.insertText(from, to, md);
      } catch (err) {
        this.errorState.setError(this.editorErrMessage(err));
      }
    });

    // Final stash on destroy — covers navigation before the debounce fires
    // (including the View/Edit toggle, which recreates this component).
    this.destroyRef.onDestroy(() => {
      if (timer) clearTimeout(timer);
      this.stashDraft();
      // Clear the shared channel last — after the draft is stashed, since
      // stashDraft() reads pageContext.metadata — so the hoisted inspector
      // unmounts when this screen goes away.
      this.pageContext.reset();
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
   * on top) and directly by `refresh()` once its reload round-trip settles.
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
   * are unsaved changes. The baseline reset is a *direct* call to
   * `resetWorkingCopyToServer` here — the same method the initial-load hydrate
   * effect uses — so it can't be silently broken by a future change to that
   * effect. An `isRefreshing` guard drops a second click (and a second confirm
   * dialog) while one refresh is still in flight.
   */
  async refresh(): Promise<void> {
    const g = this.guid();
    if (!g || this.isRefreshing()) return;

    this._isRefreshing.set(true);
    try {
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
      this.errorState.clear();

      const page = await this.reloadPageResource();
      if (page) this.resetWorkingCopyToServer(page);
    } finally {
      this._isRefreshing.set(false);
    }
  }

  /**
   * Promise bridge over `rxResource.reload()` (otherwise fire-and-forget):
   * kicks a reload and resolves once the resource settles again, with the
   * freshly fetched server page (`undefined` if the reload errored). The status
   * stream replays its current `resolved` on subscribe, so `skipWhile` waits
   * for the reload to actually start (`loading`/`reloading`) before watching
   * for the *next* settle — otherwise we'd resolve against the stale
   * pre-reload value. A {@link RELOAD_SETTLE_TIMEOUT_MS} race caps the wait so a
   * coalesced status stream can never wedge `_isRefreshing` on permanently.
   */
  private reloadPageResource(): Promise<PageContent | undefined> {
    const settled = this.resourceStatus$.pipe(
      skipWhile((s) => s !== 'loading' && s !== 'reloading'),
      filter((s) => s === 'resolved' || s === 'error'),
      take(1),
    );
    // Bounded wait: whichever of the settle signal or the timeout fires first
    // ends the wait, so a coalesced status stream can never leave this promise
    // (and `_isRefreshing`) pending forever.
    const done = firstValueFrom(race(settled, timer(RELOAD_SETTLE_TIMEOUT_MS)));
    this.resource.reload();
    return done.then(() => (this.resource.hasValue() ? this.resource.value() : undefined));
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
    // Attachment is host-driven: it opens the uploader rather than inserting a
    // skeleton. Everything else (including `image`) goes to CodeMirror.
    if (action === 'attachment') {
      this.openAttachmentUploader();
      return;
    }
    try {
      this.editor()?.applyAction(action);
    } catch (err) {
      this.errorState.setError(this.editorErrMessage(err));
    }
  }

  /**
   * Toolbar Attachment button. Opens the inline uploader for the current page.
   * Guard: with no persisted guid there's nowhere to upload — surface React's
   * "Save the page before uploading attachments." message instead. In practice
   * Angular pages are created server-side first, so this rarely fires.
   */
  private openAttachmentUploader(): void {
    if (!this.guid()) {
      this.attachmentGuardMessage.set('Save the page before uploading attachments.');
      return;
    }
    this.attachmentGuardMessage.set(null);
    this.attachmentUploaderOpen.set(true);
  }

  closeAttachmentUploader(): void {
    this.attachmentUploaderOpen.set(false);
  }

  /**
   * A file finished uploading from the toolbar's inline uploader: drop its
   * markdown in at the cursor (React parity — the returned markdown is
   * auto-inserted; step 4.9). The uploader already built the markdown via the
   * shared {@link buildAttachmentMarkdown}, so this forwards it verbatim through
   * the same {@link insertMarkdownAtCursor} route the inspector's uploader and
   * the attachment manager Insert action use — one insert path, identical text.
   * The uploader panel stays open so several files can be added in a row.
   */
  onAttachmentUploaded(event: AttachmentUploadedEvent): void {
    this.insertMarkdownAtCursor(event.markdown);
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

  /**
   * The single shared "insert markdown at the CodeMirror cursor" entry point.
   * Replaces the current selection (if any) with `md` and moves the cursor to
   * the end of the inserted text. Used by the inspector's attachment "Insert"
   * action, the toolbar Attachment upload flow, and (steps 4.8 / 4.9) the
   * attachment manager's Insert action and upload auto-insert — do not
   * duplicate this cursor logic.
   */
  insertMarkdownAtCursor(md: string): void {
    try {
      const ed = this.editor();
      const view = ed?.getView();
      if (!view) {
        // Preview sub-mode unmounts CodeMirror, so there is no view to insert
        // into. Rather than silently drop the action (I1), flip the surface back
        // to Split and let the mount effect perform the insert once the editor
        // is live. Only meaningful on the edit route.
        if (this.mode() !== 'edit') return;
        this._editorMode.set('split');
        this.pendingInsertText.set(md);
        return;
      }
      const { from, to } = view.state.selection.main;
      ed?.insertText(from, to, md);
    } catch (err) {
      this.errorState.setError(this.editorErrMessage(err));
    }
  }

  /** Inspector `insertMarkdown` output → shared cursor insert. */
  onInsertMarkdown(text: string): void {
    this.insertMarkdownAtCursor(text);
  }

  /**
   * Inspector Page Type change (step 4.4). Unlike every other metadata edit —
   * which only flows into the working copy and reaches the server on an
   * explicit Save — a page-type change is persisted **immediately**: the merged
   * property set (new schema defaults + retained compatible values, built by
   * `mergeSchema` in the properties panel) is written together with the type in
   * one `updatePage` call, so the schema's fields are seeded and stick without
   * the user touching a field. `updatePage` always bumps `page:<guid>` (and,
   * because `pageType`/`properties` are tree/board-visible, the children tags),
   * so the page reloads with the merge applied.
   *
   * The working copy is updated first so the inspector re-renders the new
   * schema at once; a pending title/tag/body edit is left untouched (it stays
   * dirty and persists on the next Save, exactly as before).
   */
  async onPageTypeChange(change: PageTypeChange): Promise<void> {
    const g = this.guid();
    const m = this.metadata();
    if (!g || !m) return;

    const nextMeta: PageMetadata = { ...m };
    if (change.pageType) {
      nextMeta.pageType = change.pageType;
      if (change.properties) nextMeta.properties = change.properties;
    } else {
      // "(none)": clear the type only; leave the stored properties as they are.
      delete nextMeta.pageType;
    }
    this.metadata.set(nextMeta);

    // Send `properties` only when a real type supplied a merged set — the
    // "(none)" branch persists just `{ pageType: null }`.
    const body = change.pageType
      ? { pageType: change.pageType, ...(change.properties ? { properties: change.properties } : {}) }
      : { pageType: null };

    try {
      await this.pages.updatePage(g, body);
      // Keep a live draft in step with what was just persisted so a reload
      // can't resurrect the previous type from localStorage.
      if (this.drafts.hasDraft(g)) {
        this.drafts.set(g, { content: this.content(), metadata: nextMeta });
      }
    } catch {
      this.snack.open('Failed to change page type.', 'Dismiss', { duration: 4000 });
    }
  }

  /**
   * Inspector Title -> H1 sync (step 4.3). When the user edits the Title and the
   * buffer's first non-empty line is a Markdown `# H1`, rewrite that line to
   * `# <title>` so the heading and the Title stay coherent. A non-H1 first line
   * is left untouched.
   *
   * Feedback-loop guard (two parts): the panel only emits `titleH1Sync` for a
   * genuine, non-empty *user* Title edit — never for programmatic metadata
   * hydration; and here the rewrite is skipped whenever it would be a no-op
   * ({@link rewriteFirstH1} returns the buffer by reference). So a keystroke
   * that leaves the H1 already-correct dispatches nothing, and even if a
   * future change derived the Title back from the buffer's H1 it could not
   * ping-pong.
   *
   * With CodeMirror mounted the edit goes through a `view.dispatch` transaction
   * ({@link WikiCodemirror.replaceRange}) so it shares the undo history with
   * typing and does not steal focus from the Title input. In the Preview
   * sub-mode CodeMirror is unmounted — there is no view and no undo stack to
   * join — so the buffer signal is rewritten directly, mirroring
   * {@link onImageResize}; the next CodeMirror mount hydrates from that signal.
   * Unlike {@link insertMarkdownAtCursor}, a passive Title edit does **not**
   * flip the surface out of Preview.
   */
  setFirstH1(title: string): void {
    const current = this.content();
    const next = rewriteFirstH1(current, title);
    if (next === current) return;
    try {
      const ed = this.editor();
      const view = ed?.getView();
      const range = firstH1Range(current);
      if (ed && view && range) {
        ed.replaceRange(range.from, range.to, `# ${title.trim()}`);
      } else {
        // No CodeMirror view (Preview sub-mode). Rewrite the buffer signal
        // directly, mirroring onImageResize. Unlike the replaceRange path this
        // does NOT enter CodeMirror's undo history — a title-driven H1 change
        // made in Preview is not Ctrl-Z-revertable after returning to Edit.
        this.content.set(next);
      }
    } catch (err) {
      this.errorState.setError(this.editorErrMessage(err));
    }
  }

  /**
   * A rendered preview image was drag-resized (split / preview edit mode).
   * Rewrite the `![alt|WIDTH]` token at the reported document-order index in the
   * working buffer; the CodeMirror `[(value)]` binding and the debounced
   * autosave carry it from there. Pure string edit — no direct CodeMirror
   * dispatch needed. Indexing (not alt matching) is deliberate: most images are
   * authored as `![](x.png)` with no alt, so an alt match would resize them all.
   */
  onImageResize(event: WikiImageResize): void {
    const next = setImageWidth(this.content(), event.index, event.width);
    if (next !== this.content()) this.content.set(next);
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

  /**
   * Resolve every distinct `[[target]]` in `markdown` that has not been
   * resolved (or started) yet. Results land in {@link wikiResolutions}, which
   * re-renders the preview.
   *
   * The whole batch is applied with a **single** `wikiResolutions.update` once
   * all lookups settle (I4). Writing per target flipped the `resolveWikiTarget`
   * computed's identity once per link, so a page with N distinct `[[links]]`
   * triggered N full markdown re-parses on load. A rejected lookup is simply
   * omitted — its target stays unresolved and renders as a pending
   * (non-navigable) link, never a title href.
   */
  private resolveWikiTargets(markdown: string): void {
    const known = this.wikiResolutions();
    // `parseWikiLinks` already trims each target (both the `page-title` and the
    // `[[guid|alias]]` branches), so these keys match the plugin's
    // `wikiLink.target` lookups and the `resolveWikiTarget` computed's
    // `resolved.get(target)` exactly — no extra `.trim()` needed here.
    const targets = [
      ...new Set(
        parseWikiLinks(markdown)
          .map((l) => l.target)
          .filter((t) => t.length > 0),
      ),
    ];
    const pending = targets.filter(
      (t) => !known.has(t) && !this.wikiResolveInFlight.has(t),
    );
    if (pending.length === 0) return;

    for (const target of pending) this.wikiResolveInFlight.add(target);

    void Promise.allSettled(pending.map((t) => this.pages.resolveLink(t))).then(
      (results) => {
        const resolved: [string, WikiLinkResolution][] = [];
        results.forEach((r, i) => {
          this.wikiResolveInFlight.delete(pending[i]);
          if (r.status === 'fulfilled') resolved.push([pending[i], r.value]);
        });
        if (resolved.length === 0) return;
        this.wikiResolutions.update((m) => {
          const next = new Map(m);
          for (const [target, resolution] of resolved) next.set(target, resolution);
          return next;
        });
      },
    );
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
    // TODO(2.7): the modal resolves with the created page's guid on success —
    // rewrite the [[target]] token to [[<newGuid>]] in the buffer after
    // successful create (the source-markdown rewrite is step 2.7's job).
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
    this.saveErrorDismissed.set(false);
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
      // Store the raw server message — the banner template composes the
      // "Save failed: … Your changes are still here" reassurance copy.
      this.saveError.set(message);
    } finally {
      this.saving.set(false);
    }
  }

  /** Close the save-failure banner until the next save attempt. */
  dismissSaveError(): void {
    this.saveErrorDismissed.set(true);
  }
}
