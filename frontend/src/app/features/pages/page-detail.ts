import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  linkedSignal,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import {
  catchError,
  concat,
  filter,
  firstValueFrom,
  from,
  map,
  of,
  race,
  skipWhile,
  switchMap,
  take,
  timer,
  type Observable,
} from 'rxjs';
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
import { Breakpoint } from '../../core/layout/breakpoint';
import type { WikiBrokenLinkEvent } from '../../shared/markdown/wiki-link';
import type { WikiTargetResolver } from '../../shared/markdown/plugins/remark-wiki-links';
import { parseWikiLinks } from '../../shared/markdown/wiki-link-parser';
import type { WikiImageResize } from '../../shared/markdown/wiki-image';
import { setImageWidth } from '../../shared/codemirror/set-image-width';
import {
  Pages,
  type ChildrenWithPropertiesOptions,
  type PageSearchResult,
  type WikiLinkResolution,
} from './pages';
import { Drafts, type PageMetadata } from './drafts';
import { PageContext } from './page-context';
import { PageTypes } from '../page-types/page-types';
import { BoardView } from '../board/board-view';
import { BoardSettingsPanel, type BoardSettingsPanelData, type BoardSettingsResult } from '../board/board-settings-panel';
import { isBoardEligible } from '../board/is-board-eligible';
import {
  CreatePageFromLinkModal,
  type CreatePageFromLinkModalData,
  type CreatePageFromLinkResult,
} from './create-page-from-link-modal';
import { rewriteWikiLink } from '../../shared/markdown/rewrite-wiki-link';
import { ConfirmDialog, type ConfirmDialogData } from '../../shared/components/confirm-dialog';
import { hasCardTypeSelection } from '../board/card-types';
import {
  boardOverrides,
  effectiveBoardConfig,
  overriddenGroups,
  withoutPageOnly,
  withPageOnly,
} from '../board/board-defaults';
import { Auth } from '../../core/auth/auth';
import { TicketKeys, isTicketKey } from '../ticket-keys/ticket-keys';
import { EditorErrorState } from '../../core/error/editor-error-state';
import type {
  BoardConfig,
  PageChildDetail,
  PageContent,
  PageTypeDefinition,
} from './page.types';

type Mode = 'view' | 'edit';
type ViewMode = 'content' | 'board';
/** The route segment (`ref`), the GUID it resolved to, and how a ticket-key lookup went. */
interface RouteTarget {
  ref: string | null;
  guid: string | null;
  keyLookup: 'pending' | 'missing' | 'failed' | null;
}
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
 * The Board settings panel hides depth / showParentTitle / swapTitles in
 * Direct-children mode, so a result there may leave them out: that means
 * "not applicable", not "off". Before diffing against type defaults, fill any
 * missing ones from the config that was in force, so they don't turn into
 * overrides (e.g. a type `depth: 5` being pinned to 10 on this page).
 * Defence in depth: the panel already carries these through from
 * `data.config` when the type has defaults (its hasDefaults passthrough).
 * This also covers results that arrive without them.
 */
function withHiddenFields(result: BoardConfig, effective: BoardConfig | null): BoardConfig {
  if (hasCardTypeSelection(result) || !effective) return result;
  const out: BoardConfig = { ...result };
  for (const k of ['depth', 'showParentTitle', 'swapTitles'] as const) {
    if (out[k] === undefined && effective[k] !== undefined) (out as Record<string, unknown>)[k] = effective[k];
  }
  return out;
}

/** Whether a working copy (body + metadata) differs from a server page. */
function workingCopyDiverges(content: string, m: PageMetadata, page: PageContent): boolean {
  if (content !== (page.content ?? '')) return true;
  if (m.title !== page.title) return true;
  if (m.status !== page.status) return true;
  if ((m.pageType ?? null) !== (page.pageType ?? null)) return true;
  if (JSON.stringify(m.tags ?? []) !== JSON.stringify(page.tags ?? [])) return true;
  return JSON.stringify(m.properties ?? {}) !== JSON.stringify(page.properties ?? {});
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
        @if (ticketKey(); as key) {
          <button type="button" class="ticket-key" data-testid="page-ticket-key" (click)="copyTicketKey(key)" [attr.aria-label]="'Copy ticket key ' + key" title="Copy ticket key">{{ key }}</button>
        }

        @if (mode() === 'view' && boardEligible()) {
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
              class="board-refresh"
              [class.spinning]="boardRefreshing()"
              [disabled]="boardRefreshing()"
              (click)="boardView()?.refresh()"
              aria-label="Refresh board"
              title="Refresh board"
            >
              <mat-icon>refresh</mat-icon>
            </button>
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

        <!--
          These controls (View/Edit, Refresh, the info/inspector button, save
          status, Save) all act on this page's own content — meaningless while
          the Board view is showing a Kanban of its children instead, so they
          disappear together whenever viewMode() is 'board'.
        -->
        @if (viewMode() !== 'board') {
          @if (mode() === 'edit') {
            <mat-button-toggle-group
              class="mode-toggle"
              [value]="editorMode()"
              (change)="onEditorModeToggle($event.value)"
              aria-label="Editor view mode"
            >
              <mat-button-toggle value="edit">Edit</mat-button-toggle>
              @if (bp.isDesktop()) {
                <mat-button-toggle value="split">Split</mat-button-toggle>
              }
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

          @if (settledPage()) {
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

          <!--
            Editor-bar inspector control (step 1b.5). Same info icon and the same
            toggleInspector() action in both breakpoints; only the label adapts —
            desktop is the persisted side-panel "Toggle inspector"; below 1024 it
            opens the bottom sheet, so it reads as a plain "Page info" button.
          -->
          <button
            mat-icon-button
            type="button"
            [attr.aria-label]="bp.isDesktop() ? 'Toggle inspector' : 'Page info'"
            (click)="pageContext.toggleInspector()"
          >
            <mat-icon>info</mat-icon>
          </button>

          @if (settledPage()) {
            <span class="save-status" [attr.data-status]="saveStatus()" aria-live="polite">
              {{ saveStatusLabel() }}
            </span>
          }

          @if (mode() === 'edit' || dirty()) {
            <button mat-flat-button class="save-btn" (click)="save()" [disabled]="saving()">
              Save
            </button>
          }
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

      @if (pageContext.remoteChange()) {
        <div class="banner remote-change" role="status">
          <span class="banner-msg">This page was changed elsewhere.</span>
          <button mat-button type="button" (click)="onRemoteReload()">Reload</button>
          <button mat-button type="button" (click)="pageContext.remoteChange.set(false)">Dismiss</button>
        </div>
      }

      @if (backgroundLoadError(); as kind) {
        <div class="banner remote-change" role="alert">
          @if (kind === 'deleted') {
            <span class="banner-msg">
              This page was deleted elsewhere. Your unsaved changes are kept in this tab — copy them before leaving.
            </span>
          } @else {
            <span class="banner-msg">Couldn't refresh this page.</span>
            <button mat-button type="button" (click)="resource.reload()">Retry</button>
          }
        </div>
      }

      @if (guid(); as g) {
        @if (resolvedTitle(); as t) {
          <wiki-breadcrumbs [guid]="g" [currentTitle]="t" />
        }
      }

      <div class="container">
        <div class="content-pane">
          @if (mode() === 'edit' && editorMode() !== 'preview') {
            <wiki-markdown-toolbar [compact]="!bp.isDesktop()" (action)="onAction($event)" />
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

          <section class="body" [class.toolbar-pinned]="toolbarPinned()">
            @if (keyLookup() === 'pending' || (resource.isLoading() && !settledPage())) {
              <div class="state">Loading page...</div>
            } @else if (keyLookup() === 'missing') {
              <div class="state error" data-testid="page-key-not-found">No page has the key {{ routeRef()?.toUpperCase() }}.</div>
            } @else if (keyLookup() === 'failed') {
              <div class="state error">Couldn't look up {{ routeRef()?.toUpperCase() }}.</div>
            } @else if (resource.error() && !settledPage()) {
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
            } @else if (settledPage(); as page) {
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
                        <wiki-toc [markdown]="content()" [compact]="!bp.isDesktop()" />
                      </div>
                    }
                  </div>
                }
              } @else if (viewMode() === 'board' && boardEligible()) {
                <!--
                  Gated on boardEligible() as well as viewMode(), matching the
                  Content|Board toggle's own gate above. Without it a page that
                  was eligible when its boardConfig was saved but has since lost
                  eligibility (its state-bearing children edited or deleted)
                  opens straight into an empty board with the toggle hidden and
                  no route back to its content. Falling through to the content
                  branch keeps the page readable either way.
                -->
                <wiki-board-view [parentGuid]="page.guid" [boardConfig]="boardConfig()" />
              } @else {
                <div class="view-with-toc">
                  <wiki-markdown-renderer
                    [markdown]="content()"
                    [pageGuid]="guid() ?? undefined"
                    [resolveWikiTarget]="resolveWikiTarget()"
                    (brokenClick)="onBrokenLink($event)"
                  />
                  <wiki-toc [markdown]="content()" [compact]="!bp.isDesktop()" />
                </div>
              }
            }
          </section>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .board-refresh.spinning mat-icon { animation: board-spin 0.8s linear infinite; }
    @keyframes board-spin { to { transform: rotate(360deg); } }
    @media (prefers-reduced-motion: reduce) { .board-refresh.spinning mat-icon { animation: none; } }
    .page-detail { display: flex; flex-direction: column; height: 100%; }
    /*
      flex-wrap: wrap (Playwright suite finding, item 16/21 in
      editor-toolbar.spec.ts): at phone widths the row's non-title content
      alone (mode-toggle + refresh + inspector-toggle + save-status pill +
      Save button) already exceeds the viewport, even with a zero-width
      title. .mode-toggle's own overflow: hidden (Material's default) strips
      its flexbox automatic minimum size, so it was the only item with no
      content-protected flex minimum -- unlike its siblings, which all have
      one (fixed-size icon buttons, a nowrap pill, a min-width Save button) --
      and the flex algorithm crushed it to invisible/unclickable instead of
      shrinking anything else. Wrapping instead of crushing keeps every
      control reachable; it costs a second line on narrow viewports rather
      than a hidden one.
    */
    .bar { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; padding: 0.5rem 1rem; border-bottom: 1px solid #e5e7eb; background: #f9fafb; }
    .mode-toggle { flex-shrink: 0; }
    .title { font-weight: 600; }
    .ticket-key { font: inherit; font-size: 0.75rem; color: #374151; background: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 999px; padding: 0.0625rem 0.5rem; margin-left: 0.5rem; cursor: pointer; }
    .view-toggle { margin-left: 0.5rem; }
    .spacer { flex: 1; }
    /*
      Old-site visual parity (2026-09-26 design doc): the previous React app
      rendered this as a colored pill (padding/radius/border), not plain
      colored text.
    */
    .save-status {
      font-size: 0.875rem; white-space: nowrap;
      padding: 0.375rem 0.75rem; border-radius: 4px; border: 1.5px solid transparent;
      color: #6a7282; background: #f3f4f6; border-color: #e5e7eb;
    }
    .save-status[data-status='unsaved'] { color: #b45309; background: #fef3c7; border-color: #f59e0b; }
    .save-status[data-status='saved'] { color: #008235; background: #dbfce7; border-color: #22c55e; }
    .save-btn {
      --mdc-filled-button-container-color: #155dfc;
      --mdc-filled-button-label-text-color: #ffffff;
      --mdc-filled-button-container-shape: 4px;
      --mat-filled-button-disabled-container-color: rgba(0, 0, 0, 0.08);
    }
    .save-failed {
      display: flex; align-items: center; gap: 0.5rem;
      margin: 0.5rem 1rem; padding: 0.25rem 0.25rem 0.25rem 0.75rem;
      border: 1px solid #fca5a5; border-radius: 4px;
      background: #fef2f2; color: #b91c1c; font-size: 0.875rem;
    }
    .save-failed-msg { flex: 1; }
    /* Same shape as .save-failed, in a neutral info blue. */
    .remote-change {
      display: flex; align-items: center; gap: 0.5rem;
      margin: 0.5rem 1rem; padding: 0.25rem 0.25rem 0.25rem 0.75rem;
      border: 1px solid #93c5fd; border-radius: 4px;
      background: #eff6ff; color: #1e40af; font-size: 0.875rem;
    }
    .remote-change .banner-msg { flex: 1; }
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
    /* Mobile (step 1b.6): the markdown toolbar is position:fixed to the bottom
       of the screen, so reserve space here or it covers the last editor lines
       (padding is the scroll limit — un-reserved content can't be scrolled
       clear). Must stay >= markdown-toolbar.ts's :host.bottom-pinned rendered
       height: ~56px (one Material icon-button row + slack) PLUS the same
       env(safe-area-inset-bottom) that rule adds to the bar. If a future
       toolbar-density change alters that height, bump this to match. */
    .body.toolbar-pinned { padding-bottom: calc(56px + env(safe-area-inset-bottom)); }
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
    /* Mobile (step 1b.8): the TOC is a full-width collapsible bar, not a rail —
       stack it above the content / preview instead of beside it. Matches the
       Breakpoint service's 1024px desktop threshold (\`!bp.isDesktop()\`). */
    @media (max-width: 1023.98px) {
      .view-with-toc,
      .editor-surface .preview-pane {
        flex-direction: column;
        align-items: stretch;
      }
      .view-with-toc wiki-toc,
      .editor-surface .preview-pane wiki-toc {
        order: -1;
        flex: 0 0 auto;
        padding: 0.75rem 1rem 0;
      }
    }
    .state { padding: 2rem; color: #6b7280; }
    .state.error { color: #b91c1c; }
  `],
})
export class PageDetail {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly pages = inject(Pages);
  private readonly pageTypes = inject(PageTypes);
  private readonly auth = inject(Auth);
  private readonly drafts = inject(Drafts);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  private readonly errorState = inject(EditorErrorState);
  private readonly layout = inject(Layout);
  private readonly ticketKeys = inject(TicketKeys);
  /** Single responsive switch (DESIGN.md D1); flips the editor-bar inspector control. */
  protected readonly bp = inject(Breakpoint);
  /**
   * Cross-component channel to the hoisted inspector (rendered by `pages-view`).
   * `page-detail` publishes `guid` / `mode` here, shares its `metadata` working
   * copy through `pageContext.metadata`, subscribes to the inspector's
   * editor-affecting outputs, and drives the editor-bar toggle button.
   */
  protected readonly pageContext = inject(PageContext);

  protected readonly editor = viewChild<WikiCodemirror>('editor');

  /** The mounted Board view (only while viewMode() is 'board'). */
  protected readonly boardView = viewChild(BoardView);
  protected readonly boardRefreshing = computed(() => this.boardView()?.refreshing() ?? false);

  /**
   * The `:guid` route segment resolved to a page GUID. The segment may be a
   * ticket key (`/pages/BGT-12`), which resolves through {@link TicketKeys};
   * a GUID passes straight through (synchronously). `keyLookup` tracks a key
   * that is still resolving or did not resolve.
   */
  private readonly routeTarget = toSignal(
    this.route.paramMap.pipe(
      map((p) => p.get('guid')),
      switchMap((ref): Observable<RouteTarget> => {
        if (!ref || !isTicketKey(ref)) return of({ ref, guid: ref, keyLookup: null });
        return concat(
          of<RouteTarget>({ ref, guid: null, keyLookup: 'pending' }),
          from(this.ticketKeys.toGuid(ref)).pipe(
            map((guid): RouteTarget => ({ ref, guid, keyLookup: guid ? null : 'missing' })),
            catchError(() => of<RouteTarget>({ ref, guid: null, keyLookup: 'failed' })),
          ),
        );
      }),
    ),
    { initialValue: { ref: null, guid: null, keyLookup: null } as RouteTarget },
  );
  /** The page reference as it appears in the URL — a ticket key or a GUID. */
  protected readonly routeRef = computed(() => this.routeTarget().ref);
  protected readonly guid = computed(() => this.routeTarget().guid);
  protected readonly keyLookup = computed(() => this.routeTarget().keyLookup);

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

  /**
   * True when the markdown toolbar is bottom-pinned (step 1b.6): mobile, on the
   * edit route, and not in the Preview sub-mode (where the toolbar is not
   * rendered). Drives `.body`'s reserved bottom padding so the `position: fixed`
   * toolbar never covers the last lines of the editor / preview.
   */
  protected readonly toolbarPinned = computed(
    () => !this.bp.isDesktop() && this.mode() === 'edit' && this.editorMode() !== 'preview',
  );

  protected readonly editorError = computed(() => this.errorState.current());

  protected readonly resolvedTitle = computed<string | null>(() => {
    const m = this.metadata();
    if (m?.title) return m.title;
    if (this.resource.status() !== 'resolved') return null;
    return this.resource.value()?.title ?? null;
  });

  protected readonly ticketKey = computed(() => this.settledPage()?.ticketKey ?? null);

  protected async copyTicketKey(key: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(key);
      this.snack.open(`Copied ${key}`, undefined, { duration: 2000 });
    } catch {
      this.snack.open(`Couldn't copy ${key}`, undefined, { duration: 2000 });
    }
  }

  /**
   * All defined page types, keyed by guid — feeds {@link boardEligible}'s
   * child-state check, which only matters for the Content|Board toggle
   * (`mode() === 'view'`). Gated on view mode so mounting `/pages/:guid/edit`
   * doesn't fire a `GET /api/page-types` this component has no use for there
   * (the inspector's Properties panel fetches its own copy independently
   * whenever a type-picker is actually shown).
   */
  private readonly pageTypesEnabled = computed<boolean>(() => this.mode() === 'view');
  private readonly pageTypesResource = this.pageTypes.pageTypesResource(this.pageTypesEnabled);
  /**
   * The page-type list, RETAINED across reloads — the same rule as
   * {@link eligibilityChildren}. The board's manual Refresh (and any
   * page-type edit) bumps `page-types:list`, putting `pageTypesResource` back
   * into `'loading'` with its value cleared. Reading that as "no types" makes
   * {@link boardEligible} flip `false` on a direct-children board (one with no
   * card-type selection, see `hasCardTypeSelection`), whose eligibility needs the child's type, which unmounts
   * the board and lets the `defaultView` effect move the user to Content.
   * Only a fully resolved reload replaces the list. The type set is global,
   * not per page, so unlike the probe there is no key to scope it by.
   */
  private readonly pageTypesList = linkedSignal<
    readonly PageTypeDefinition[] | null,
    readonly PageTypeDefinition[]
  >({
    // `value()` throws on an errored resource — only read it when resolved.
    source: () =>
      this.pageTypesResource.status() === 'resolved' ? (this.pageTypesResource.value() ?? []) : null,
    computation: (resolved, previous) => resolved ?? previous?.value ?? [],
  });
  private readonly pageTypesMap = computed<Record<string, PageTypeDefinition>>(() =>
    Object.fromEntries(this.pageTypesList().map((t) => [t.guid, t])),
  );

  /**
   * The last resolved page for the CURRENT guid, RETAINED while that same page
   * reloads (a realtime `page:<guid>` bump, a save, Refresh). `null` until the
   * first resolve and again from the moment the guid changes. Board-side
   * derivations read this rather than the resource, so a reload of a board
   * parent doesn't read as "no board config" and drop the viewer to Content.
   * The template renders the page body from it too, so the editor (with its
   * undo history, cursor and focus) and the board stay mounted through such
   * a reload; only a guid change shows "Loading page..." again.
   */
  protected readonly settledPage = linkedSignal<
    { guid: string | null; page: PageContent | null | undefined },
    PageContent | null
  >({
    source: () => ({
      guid: this.guid(),
      // `value()` throws on an errored resource — only read it when resolved.
      page: this.resource.status() === 'resolved' ? (this.resource.value() ?? null) : undefined,
    }),
    computation: (source, previous) => {
      if (source.page !== undefined) return source.page;
      if (previous && previous.source.guid === source.guid) return previous.value;
      return null;
    },
  });

  /**
   * A failed background refetch of a page that is already on screen (realtime
   * bump, catch-up, Reload). The body keeps rendering from {@link settledPage},
   * so the editor, its undo history and the unsaved working copy survive, and
   * an inline banner reports the failure instead of the full error panel.
   * `'deleted'` for a 404 (removed elsewhere), `'failed'` for anything else,
   * `null` when there's no error or nothing settled to keep on screen.
   */
  protected readonly backgroundLoadError = computed<'deleted' | 'failed' | null>(() => {
    const err = this.resource.error();
    if (!err || !this.settledPage()) return null;
    return err instanceof HttpErrorResponse && err.status === 404 ? 'deleted' : 'failed';
  });

  /**
   * This page's type definition, when the client knows it. Resolved from the
   * kept {@link pageTypesList}, so it stays put while the type list reloads.
   */
  protected readonly pageTypeDef = computed<PageTypeDefinition | null>(() => {
    const t = this.settledPage()?.pageType;
    return t ? (this.pageTypesMap()[t] ?? null) : null;
  });

  /**
   * The board settings in force: the type's `boardDefaults` overlaid, group by
   * group, with this page's own `boardConfig` (see board-defaults.ts). Feeds
   * eligibility, the default-view effect, the board view and Board settings.
   * Kept through a reload of the same page (see {@link settledPage}).
   */
  protected readonly boardConfig = computed<BoardConfig | null>(
    () => {
      const page = this.settledPage();
      if (!page) return null;
      return effectiveBoardConfig(page.boardConfig, this.pageTypeDef()?.boardDefaults);
    },
    // Structural: every page-type reload builds a fresh (equal) object, which
    // would otherwise re-run the defaultView effect and pull a user who chose
    // Content back to Board. effectiveBoardConfig emits keys in a fixed order.
    { equal: (a, b) => JSON.stringify(a) === JSON.stringify(b) },
  );

  /**
   * Direct-children probe purely for {@link boardEligible} (step 5.1): a page
   * with no card-type selection (see `hasCardTypeSelection`) can still be board-eligible when a
   * direct child's page type carries a `state` property with a non-empty
   * value. Disabled (`null` parentGuid, so `childrenWithPropertiesResource`
   * fetches nothing) outside view mode, before the page resource has
   * resolved, and once a card-type selection is known — that alone makes
   * the page eligible, so the extra request would be wasted.
   */
  private readonly eligibilityParentGuid = computed<string | null>(() => {
    if (this.mode() !== 'view') return null;
    if (!this.settledPage()) return null;
    if (hasCardTypeSelection(this.boardConfig())) return null;
    return this.guid();
  });
  private readonly eligibilityOptions = computed<ChildrenWithPropertiesOptions | null>(
    () => ({ limit: 50 }),
  );
  private readonly eligibilityChildrenResource = this.pages.childrenWithPropertiesResource(
    this.eligibilityParentGuid,
    this.eligibilityOptions,
  );

  /**
   * The probe's children, RETAINED across reloads.
   *
   * `eligibilityChildrenResource` keys on the invalidation bus's
   * `children:any`, so EVERY successful board drop and Card Summary save
   * re-fetches it (their PUT bodies carry `properties`/`boardOrder`). A
   * params change puts an Angular `resource()` back into `'loading'` with its
   * value cleared — reading `status() === 'resolved' ? children : []`
   * directly therefore made {@link boardEligible} flicker `false` for the
   * duration of every such refetch, which destroyed the mounted `BoardView`
   * (erasing the in-flight optimistic patch) AND let the `defaultView` effect
   * below permanently move the user to Content. Holding the last fully
   * resolved answer until a new one lands is the same "keep painting the
   * last-good data through a reload" rule `BoardView.showInitialLoading`
   * already applies to the cards themselves.
   *
   * Retention is scoped to the parent guid the answer was fetched for, so
   * navigating to another page never inherits the previous page's children,
   * and only a fully resolved probe can ever shrink this back to empty.
   */
  private readonly eligibilityChildren = linkedSignal<
    { parentGuid: string | null; resolved: readonly PageChildDetail[] | null },
    readonly PageChildDetail[]
  >({
    source: () => {
      const parentGuid = this.eligibilityParentGuid();
      // `value()` throws on an errored resource — only read it when resolved.
      const resolved =
        this.eligibilityChildrenResource.status() === 'resolved'
          ? (this.eligibilityChildrenResource.value()?.children ?? [])
          : null;
      return { parentGuid, resolved };
    },
    computation: (source, previous) => {
      // Probe disabled (edit mode, page not yet resolved, or an explicit
      // card-type selection that makes it redundant) — nothing to retain.
      if (!source.parentGuid) return [];
      if (source.resolved !== null) return source.resolved;
      // Loading / reloading / error: keep the last resolved answer for THIS
      // parent rather than momentarily reporting "no state-bearing children".
      if (previous && previous.source.parentGuid === source.parentGuid) return previous.value;
      return [];
    },
  });

  /**
   * Board-eligibility gate (step 5.1): true when a card-type selection
   * (`hasCardTypeSelection`) is set, or a direct child of a state-bearing page type has a non-empty
   * value for it. Drives the Content | Board toggle; `defaultView` (see the
   * constructor effect below) still decides which view opens first once
   * eligible — this only controls whether the toggle appears at all.
   *
   * Reads the retained {@link eligibilityChildren} rather than the resource
   * directly, so this only goes `true` → `false` when a fully resolved probe
   * genuinely reports no eligibility — never mid-reload.
   */
  protected readonly boardEligible = computed<boolean>(() =>
    isBoardEligible(
      { boardConfig: this.boardConfig() },
      this.eligibilityChildren(),
      this.pageTypesMap(),
    ),
  );

  /**
   * True exactly when the template renders the Board view (the non-edit
   * branch's `viewMode() === 'board' && boardEligible()`). Published to
   * PageContext so the shell can hide the inspector while the board shows.
   */
  protected readonly showingBoard = computed<boolean>(
    () => this.mode() !== 'edit' && this.viewMode() === 'board' && this.boardEligible(),
  );

  /**
   * The server page the working copy was last synced to — the `dirty()`
   * baseline — tagged with the guid it belongs to. Set only by
   * {@link resetWorkingCopyToServer}, by the re-resolve path of the hydrate
   * effect and by a successful {@link save}. It does NOT follow the page
   * resource, so `dirty()` stays stable while the page reloads: Realtime keeps
   * holding back live messages through that window, and the hydrate effect
   * can still tell whether the copy was dirty BEFORE the reload.
   */
  private readonly base = signal<{ guid: string; page: PageContent } | null>(null);

  /**
   * `modifiedAt` values produced by this component's own writes (Save, page
   * type change, Board settings). A re-resolve landing on one of these is
   * this tab's own change, not a change made elsewhere.
   */
  private readonly ownModifiedAts = new Set<string>();

  /** Whether the working copy diverges from the server page it was synced to. */
  protected readonly dirty = computed<boolean>(() => {
    const base = this.base();
    const m = this.metadata();
    if (!base || !m || base.guid !== this.guid()) return false;
    return workingCopyDiverges(this.content(), m, base.page);
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

  /** The pending debounced draft autosave (see the constructor). */
  private autosaveTimer: ReturnType<typeof setTimeout> | null = null;

  private cancelAutosave(): void {
    if (this.autosaveTimer !== null) {
      clearTimeout(this.autosaveTimer);
      this.autosaveTimer = null;
    }
  }

  /** Guards against a second Refresh (and a second confirm dialog) while one
   * refresh is already in flight — see `refresh()`. */
  private readonly _isRefreshing = signal(false);
  protected readonly isRefreshing = this._isRefreshing.asReadonly();

  /** Page-resource status as a stream, for the `refresh()` reload bridge. */
  private readonly resourceStatus$ = toObservable(this.resource.status);

  constructor() {
    // Publish route identity, mode and whether the board is showing to the shared PageContext so the hoisted
    // inspector (rendered by `pages-view`) knows which page it is bound to and
    // whether attachment inserts are allowed. `metadata` is not pushed here —
    // it IS `pageContext.metadata`, kept current by the hydrate / refresh /
    // page-type paths.
    // `dirty` is published for the realtime client's hold-back; it is
    // base-relative, so it stays put while the page reloads.
    effect(() => {
      this.pageContext.guid.set(this.guid());
      this.pageContext.mode.set(this.mode());
      this.pageContext.boardView.set(this.showingBoard());
      this.pageContext.dirty.set(this.dirty());
    });

    // A loaded keyed page seeds the key cache, so the tree and links resolve it without a lookup.
    effect(() => {
      const page = this.settledPage();
      if (page?.ticketKey) this.ticketKeys.remember(page.ticketKey, page.guid);
    });

    // The "changed elsewhere" banner belongs to one page: clear it only when
    // the guid really changes. Not in the publish effect above, which also
    // re-runs on mode / board / dirty changes (e.g. after a Save).
    let bannerGuid: string | null = null;
    effect(() => {
      const g = this.guid();
      if (g === bannerGuid) return;
      bannerGuid = g;
      untracked(() => this.pageContext.remoteChange.set(false));
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
    // Eligibility is part of the condition so the effect never parks the page
    // in a mode the template will refuse to render: `defaultView: 'board'` on
    // a page that has since lost eligibility falls back to content instead.
    // (Eligibility resolves asynchronously — this re-runs and switches to the
    // board once the child-state probe confirms it.)
    effect(() => {
      const cfg = this.boardConfig();
      const eligible = this.boardEligible();
      if (cfg?.defaultView === 'board' && eligible) {
        this._viewMode.set('board');
      } else if (!cfg || !eligible) {
        this._viewMode.set('content');
      }
    });

    // Hydrate the working copy once per guid — draft takes priority over server.
    // A later re-resolve of the SAME guid (realtime bump, catch-up, own write)
    // goes through onPageReResolved instead.
    effect(() => {
      if (this.resource.status() !== 'resolved') return;
      const page = this.resource.value();
      const currentGuid = this.guid();
      if (!page || !currentGuid) return;
      untracked(() => this.hydrate(page, currentGuid));
    });

    // Responsive fallback (step 1b.6): Split is a desktop-only editor sub-mode.
    // The Split toggle option is removed from the bar by `@if (bp.isDesktop())`;
    // this catches a live `split` surface when the viewport drops below 1024
    // (including right after the hydrate effect above opens a diverged draft in
    // Split on a mobile load) and snaps it back to Edit.
    effect(() => {
      if (!this.bp.isDesktop() && this._editorMode() === 'split') {
        this._editorMode.set('edit');
      }
    });

    // Debounced draft autosave whenever the working copy diverges from the
    // server. Properties are editable in both view and edit mode, so this is
    // not gated on mode — only on there being real unsaved changes.
    effect(() => {
      const c = this.content();
      const g = this.guid();
      const m = this.metadata();
      if (!g || !m) return;
      this.cancelAutosave();
      this.autosaveTimer = setTimeout(() => {
        this.autosaveTimer = null;
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
      this.cancelAutosave();
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
   * The hydrate effect's body (run untracked). The first resolve for a guid
   * fills the working copy, a local draft taking priority over the server;
   * every later resolve of the same guid goes to {@link onPageReResolved}.
   */
  private hydrate(page: PageContent, currentGuid: string): void {
    if (this.syncedGuid === currentGuid) {
      this.onPageReResolved(page, currentGuid);
      return;
    }
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
  }

  /**
   * The page resource re-resolved for the guid already on screen (a realtime
   * `page:<guid>` bump, the reconnect catch-up, a Save / page-type / board
   * write, Refresh). `dirty()` is still measured against the PREVIOUS server
   * page here, so it answers "was the copy dirty before this reload":
   *
   * - clean, or already equal to the new page → adopt the new page, so a live
   *   change shows and no stale draft is stashed later;
   * - dirty → keep the working copy untouched and move the baseline to the new
   *   page. If the server `modifiedAt` moved and that isn't one of this tab's
   *   own writes, the page changed elsewhere: raise the banner.
   */
  private onPageReResolved(page: PageContent, currentGuid: string): void {
    const base = this.base();
    if (base?.guid === currentGuid && base.page === page) return;
    const m = this.metadata();
    if (!base || base.guid !== currentGuid || !m || !this.dirty()
        || !workingCopyDiverges(this.content(), m, page)) {
      this.resetWorkingCopyToServer(page);
      return;
    }
    if (page.modifiedAt !== base.page.modifiedAt && !this.ownModifiedAts.has(page.modifiedAt)) {
      this.pageContext.remoteChange.set(true);
    }
    this.base.set({ guid: currentGuid, page });
  }

  /** Remember the `modifiedAt` of a write this component made itself. */
  private recordOwnWrite(result: PageContent | null | undefined): void {
    if (result?.modifiedAt) this.ownModifiedAts.add(result.modifiedAt);
  }

  /**
   * Reset the working copy — the `dirty()` baseline — to the given server page.
   * Called by the initial-load hydrate effect (before layering any local draft
   * on top), by a clean re-resolve, and directly by `refresh()` once its
   * reload round-trip settles.
   */
  private resetWorkingCopyToServer(page: PageContent): void {
    const g = this.guid();
    if (g) this.base.set({ guid: g, page });
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
    await this.discardAndReload(true);
  }

  /**
   * Banner Reload: the same discard-and-refetch as {@link refresh}, minus the
   * "Discard unsaved changes?" prompt — the user already chose Reload.
   */
  async onRemoteReload(): Promise<void> {
    // A click dropped by the in-flight guard must not hide the banner.
    if (this.isRefreshing()) return;
    this.pageContext.remoteChange.set(false);
    await this.discardAndReload(false);
  }

  private async discardAndReload(confirmIfDirty: boolean): Promise<void> {
    const g = this.guid();
    if (!g || this.isRefreshing()) return;

    this._isRefreshing.set(true);
    try {
      if (confirmIfDirty && this.dirty()) {
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

      // A still-pending autosave would write the discarded copy back mid-reload.
      this.cancelAutosave();
      this.saveError.set(null);
      this.errorState.clear();

      const page = await this.reloadPageResource();
      if (page) {
        this.resetWorkingCopyToServer(page);
        // Only now, with the server page in hand, drop the draft (`Drafts.clear`
        // removes the in-memory entry and the localStorage row), including
        // anything stashed while the GET was in flight. A failed GET (e.g. a
        // 404 after a delete elsewhere) keeps both the draft and the copy.
        this.drafts.clear(g);
        // The copy now IS the server page, so a "changed elsewhere" raised by
        // this very reload's re-resolve is moot.
        this.pageContext.remoteChange.set(false);
      }
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
    const ref = this.routeRef();
    if (!this.guid() || !ref || next === this.mode()) return;
    void this.router.navigate(next === 'edit' ? ['/pages', ref, 'edit'] : ['/pages', ref]);
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
    this.attachmentGuardMessage.set(null);
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
      this.recordOwnWrite(await this.pages.updatePage(g, body));
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

  /**
   * A broken `[[target]]` was clicked: offer to create the target page, then
   * (on success) rewrite every `[[originalTarget]]` / `[[originalTarget|text]]`
   * occurrence in the working buffer to `[[newGuid|text]]` — see
   * {@link rewriteWikiLink}. `originalTarget` is `event.target` (the wiki-
   * link's raw target), never `event.displayText` — the two differ whenever
   * the clicked link carried explicit display text (`[[target|text]]`), and
   * matching against the displayed text would miss the actual link token.
   *
   * No auto-save (React parity): only the in-memory buffer changes here; the
   * user saves manually, same as {@link setFirstH1} / {@link onImageResize}.
   */
  async onBrokenLink(event: WikiBrokenLinkEvent): Promise<void> {
    const data: CreatePageFromLinkModalData = {
      target: event.displayText || event.target,
      parentGuid: this.guid(),
      originalTarget: event.target,
    };
    const ref = this.dialog.open<CreatePageFromLinkModal, CreatePageFromLinkModalData, CreatePageFromLinkResult | null>(
      CreatePageFromLinkModal,
      { data },
    );
    const result = await firstValueFrom(ref.afterClosed());
    if (!result) return;

    const current = this.content();
    const next = rewriteWikiLink(current, result.originalTarget, result.newGuid);
    if (next === current) return;

    try {
      const ed = this.editor();
      const view = ed?.getView();
      if (ed && view) {
        // A link rewrite can touch multiple, non-contiguous occurrences —
        // unlike setFirstH1's single-heading range, that can't be expressed
        // as one `[from, to)` span. Swapping the whole document still lands
        // as a single `view.dispatch` (one coherent undo step), mirroring the
        // external-content sync in WikiCodemirror's own `value` effect.
        ed.replaceRange(0, current.length, next);
      } else {
        // No CodeMirror view (Preview sub-mode) — rewrite the buffer signal
        // directly, mirroring onImageResize/setFirstH1's fallback. Does NOT
        // enter CodeMirror's undo history.
        this.content.set(next);
      }
    } catch (err) {
      this.errorState.setError(this.editorErrMessage(err));
      return;
    }

    this.snack.open('Link updated — save the page to keep the change.', 'Dismiss', { duration: 4000 });
  }

  async openBoardSettings(): Promise<void> {
    // The settled page, not `resource.value()`: the button stays mounted
    // while the resource is errored, and `value()` throws then.
    const page = this.settledPage();
    if (!page) return;
    // Reuse the field-level resource (constructed in an injection context at
    // class-init time), not `this.pageTypes.pageTypesResource()` called fresh
    // here -- `rxResource()` calls `inject()` internally, and invoking the
    // factory again from this click-handler method (outside any injection
    // context) threw NG0203 and silently swallowed the dialog open (Task 6
    // investigation, e2e/tests/board-settings-types.spec.ts).
    // Read the kept list (`pageTypesList`), not the resource: mid-reload the
    // resource is empty, and `value()` throws once it has errored.
    const type = this.pageTypeDef();
    const defaults = type?.boardDefaults ?? null;
    const effective = this.boardConfig();
    const me = this.auth.user();
    // `config` is the EFFECTIVE config: in Direct-children mode the panel
    // re-emits the hidden depth / title fields from it, so the override diff
    // below sees them unchanged. `canEdit` mirrors the backend's page-type
    // update rule (creator or Admin).
    const data: BoardSettingsPanelData = {
      config: effective,
      pageTypes: [...this.pageTypesList()],
      type: type
        ? {
            name: type.name,
            icon: type.icon,
            hasDefaults: !!defaults,
            canEdit: me?.role === 'Admin' || (!!me && type.createdBy === me.userId),
          }
        : null,
      overridden: defaults ? overriddenGroups(page.boardConfig) : [],
      // Initiatives own a ticket key prefix (page-only); backfill is Admin-only.
      ticketKeys: type?.name === 'Initiative'
        ? { pageGuid: page.guid, canBackfill: me?.role === 'Admin' }
        : null,
    };
    const ref = this.dialog.open<BoardSettingsPanel, BoardSettingsPanelData, BoardSettingsResult | null>(
      BoardSettingsPanel,
      { data },
    );
    const result = await firstValueFrom(ref.afterClosed());
    if (!result) return;
    // `keyPrefix` is page-only: strip it from anything diffed against or
    // written to the type defaults, then re-apply it to the page's config.
    try {
      if (result.action === 'saveAsDefault' && type) {
        await this.pageTypes.updatePageType(type.guid, { boardDefaults: withoutPageOnly(result.config) });
        try {
          this.recordOwnWrite(
            await this.pages.updatePage(page.guid, { boardConfig: withPageOnly(null, result.config) }),
          );
        } catch {
          this.snack.open(
            `Saved the ${type.name} defaults, but couldn't clear this page's overrides.`,
            'Dismiss',
            { duration: 4000 },
          );
        }
      } else if (result.action === 'reset') {
        this.recordOwnWrite(
          await this.pages.updatePage(page.guid, { boardConfig: withPageOnly(null, result.config) }),
        );
      } else {
        // Without type defaults the result (prefix included) is stored as-is.
        const boardConfig = defaults
          ? withPageOnly(
              boardOverrides(withHiddenFields(withoutPageOnly(result.config), effective), defaults),
              result.config,
            )
          : result.config;
        this.recordOwnWrite(await this.pages.updatePage(page.guid, { boardConfig }));
      }
    } catch {
      this.snack.open('Failed to save board settings.', 'Dismiss', { duration: 4000 });
    }
  }

  async save(): Promise<void> {
    const g = this.guid();
    const ref = this.routeRef() ?? g;
    const m = this.metadata();
    if (!g || !m) return;

    const content = this.content();
    // Persist a draft before the API call so a thrown request can't lose work.
    this.drafts.set(g, { content, metadata: m });

    this.saving.set(true);
    this.saveError.set(null);
    this.saveErrorDismissed.set(false);
    try {
      const saved = await this.pages.updatePage(g, {
        content,
        title: m.title,
        tags: m.tags,
        status: m.status,
        ...(m.pageType !== undefined ? { pageType: m.pageType || null } : {}),
        ...(m.properties ? { properties: m.properties } : {}),
      });
      this.recordOwnWrite(saved);
      // What was sent is now the server state: re-baseline at once, so the
      // working copy reads clean through the reload that updatePage kicked
      // off (the destroy-time stash would otherwise re-save it as a draft).
      const base = this.base();
      if (base?.guid === g) {
        this.base.set({
          guid: g,
          page: {
            ...base.page,
            content,
            title: m.title,
            tags: m.tags ?? [],
            status: m.status,
            pageType: m.pageType,
            properties: m.properties,
            ...(saved?.modifiedAt ? { modifiedAt: saved.modifiedAt } : {}),
          },
        });
      }
      this.drafts.clear(g);
      // updatePage bumps the pages version, so the view reload picks up the save.
      await this.router.navigate(['/pages', ref]);
    } catch (err) {
      // Prefer the server-supplied body message; fall back to a real
      // Error.message, then a generic sentence. Never surface the raw
      // HttpErrorResponse.message ("Http failure response for /api/… 500 …"),
      // which leaks the internal request path into user-facing copy.
      const serverMessage = (err as { error?: { message?: string } })?.error?.message;
      const message =
        serverMessage || (err instanceof Error ? err.message : '') || 'Save failed. Try again.';
      // Store the resolved message — the banner template composes the
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
