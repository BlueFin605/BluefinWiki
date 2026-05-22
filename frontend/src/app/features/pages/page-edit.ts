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
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSidenavModule } from '@angular/material/sidenav';
import { WikiCodemirror, type CursorContext, type ToolbarAction } from '../../shared/codemirror/wiki-codemirror';
import { MarkdownToolbar } from '../editor/markdown-toolbar';
import { LinkAutocomplete } from '../editor/link-autocomplete';
import { InspectorPanel } from '../editor/inspector-panel';
import { Breadcrumbs } from '../../shared/components/breadcrumbs';
import { Pages, type PageSearchResult } from './pages';
import { Drafts, type PageMetadata } from './drafts';
import { EditorErrorState } from '../../core/error/editor-error-state';

const DRAFT_DEBOUNCE_MS = 400;

@Component({
  selector: 'wiki-page-edit',
  standalone: true,
  imports: [
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatSidenavModule,
    WikiCodemirror,
    MarkdownToolbar,
    LinkAutocomplete,
    InspectorPanel,
    Breadcrumbs,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-edit">
      <header class="bar">
        <span class="title">{{ metadata()?.title ?? 'Untitled' }}</span>
        <span class="spacer"></span>
        @if (saveError()) {
          <span class="error">{{ saveError() }}</span>
        }
        @if (guid()) {
          <a mat-button [routerLink]="['/pages', guid()]">Cancel</a>
        }
        <button
          mat-icon-button
          type="button"
          aria-label="Toggle inspector"
          (click)="toggleInspector()"
        >
          <mat-icon>info</mat-icon>
        </button>
        <button mat-flat-button color="primary" (click)="save()" [disabled]="saving()">
          @if (saving()) { Saving... } @else { Save }
        </button>
      </header>

      @if (guid(); as g) {
        @if (metadata(); as m) {
          <wiki-breadcrumbs [guid]="g" [currentTitle]="m.title" />
        }
      }

      <mat-sidenav-container class="container">
        <mat-sidenav-content class="content-pane">
          <wiki-markdown-toolbar (action)="onAction($event)" />

          <section class="body">
            @if (resource.isLoading()) {
              <div class="state">Loading page...</div>
            } @else if (resource.error()) {
              <div class="state error">Failed to load page.</div>
            } @else if (editorError(); as err) {
              <div class="state error">
                <p>The editor crashed: {{ err.message }}</p>
                <button mat-flat-button color="primary" type="button" (click)="reloadEditor()">
                  Reload editor
                </button>
              </div>
            } @else if (metadata()) {
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
              (metadataChange)="metadata.set($event)"
              (insertMarkdown)="onInsertMarkdown($event)"
            />
          }
        </mat-sidenav>
      </mat-sidenav-container>
    </div>
  `,
  styles: [`
    .page-edit { display: flex; flex-direction: column; height: 100%; }
    .bar { display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1rem; border-bottom: 1px solid #e5e7eb; background: #f9fafb; }
    .title { font-weight: 600; }
    .spacer { flex: 1; }
    .error { color: #b91c1c; font-size: 0.875rem; }
    .container { flex: 1; min-height: 0; }
    .content-pane { display: flex; flex-direction: column; height: 100%; }
    .body { flex: 1; min-height: 0; padding: 0; position: relative; }
    .state { padding: 2rem; color: #6b7280; }
    .state.error { color: #b91c1c; }
    .inspector { width: 360px; }
  `],
})
export class PageEdit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly pages = inject(Pages);
  private readonly drafts = inject(Drafts);
  private readonly destroyRef = inject(DestroyRef);
  private readonly errorState = inject(EditorErrorState);

  protected readonly editor = viewChild<WikiCodemirror>('editor');

  protected readonly guid = toSignal(
    this.route.paramMap.pipe(map((p) => p.get('guid'))),
    { initialValue: null as string | null },
  );

  protected readonly resource = this.pages.pageResource(this.guid);

  /** The current edited content. Initialised when the resource resolves. */
  readonly content = signal('');
  readonly metadata = signal<PageMetadata | null>(null);

  protected readonly saveError = signal<string | null>(null);
  protected readonly saving = signal(false);

  protected readonly cursorContext = signal<CursorContext | null>(null);
  protected readonly inspectorOpen = signal(false);

  protected readonly editorError = computed(() => this.errorState.current());

  private syncedGuid: string | null = null;

  constructor() {
    // Initialise content + metadata once per guid as the resource resolves.
    effect(() => {
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
        createdBy: page.createdBy,
        modifiedBy: page.modifiedBy,
        createdAt: page.createdAt,
        modifiedAt: page.modifiedAt,
        guid: page.guid,
      };
      this.metadata.set(draft?.metadata ?? meta);
      this.content.set(draft?.content ?? (page.content ?? ''));
    });

    // Debounced draft autosave on every content change.
    let timer: ReturnType<typeof setTimeout> | null = null;
    effect(() => {
      const c = this.content();
      const g = this.guid();
      const m = this.metadata();
      if (!g || !m) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        this.drafts.set(g, { content: c, metadata: m });
      }, DRAFT_DEBOUNCE_MS);
    });

    // Final stash on destroy — covers the case where the debounce hasn't fired.
    this.destroyRef.onDestroy(() => {
      if (timer) clearTimeout(timer);
      const g = this.guid();
      const m = this.metadata();
      if (g && m) {
        this.drafts.set(g, { content: this.content(), metadata: m });
      }
    });
  }

  toggleInspector(): void {
    this.inspectorOpen.update((v) => !v);
  }

  onAction(action: ToolbarAction): void {
    this.editor()?.applyAction(action);
  }

  onPickPage(page: PageSearchResult, ctx: CursorContext): void {
    const replacement = `[[${page.title}]]`;
    this.editor()?.insertText(ctx.from, ctx.to, replacement);
    this.cursorContext.set(null);
  }

  onInsertMarkdown(text: string): void {
    const ed = this.editor();
    const view = ed?.getView();
    if (!view) return;
    const { from, to } = view.state.selection.main;
    ed?.insertText(from, to, text);
  }

  reloadEditor(): void {
    this.errorState.clear();
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
      });
      this.drafts.clear(g);
      // Reload happens via pagesService.bumpVersion() inside updatePage.
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
