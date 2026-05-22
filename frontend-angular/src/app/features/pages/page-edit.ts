import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { WikiCodemirror } from '../../shared/codemirror/wiki-codemirror';
import { Pages } from './pages';
import { Drafts, type PageMetadata } from './drafts';

const DRAFT_DEBOUNCE_MS = 400;

@Component({
  selector: 'wiki-page-edit',
  standalone: true,
  imports: [RouterLink, MatButtonModule, WikiCodemirror],
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
        <button mat-flat-button color="primary" (click)="save()" [disabled]="saving()">
          @if (saving()) { Saving... } @else { Save }
        </button>
      </header>
      <section class="body">
        @if (resource.isLoading()) {
          <div class="state">Loading page...</div>
        } @else if (resource.error()) {
          <div class="state error">Failed to load page.</div>
        } @else if (metadata()) {
          <wiki-codemirror
            [(value)]="content"
            (save)="save()"
            style="height: 100%; display:block;"
          />
        }
      </section>
    </div>
  `,
  styles: [`
    .page-edit { display: flex; flex-direction: column; height: 100%; }
    .bar { display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1rem; border-bottom: 1px solid #e5e7eb; background: #f9fafb; }
    .title { font-weight: 600; }
    .spacer { flex: 1; }
    .error { color: #b91c1c; font-size: 0.875rem; }
    .body { flex: 1; min-height: 0; padding: 0; }
    .state { padding: 2rem; color: #6b7280; }
    .state.error { color: #b91c1c; }
  `],
})
export class PageEdit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly pages = inject(Pages);
  private readonly drafts = inject(Drafts);
  private readonly destroyRef = inject(DestroyRef);

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
