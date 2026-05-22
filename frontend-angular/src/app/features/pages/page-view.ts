import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { firstValueFrom, map } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { MarkdownRenderer } from '../../shared/markdown/markdown-renderer';
import type { WikiBrokenLinkEvent } from '../../shared/markdown/wiki-link';
import { Pages } from './pages';
import { CreatePageFromLinkModal, type CreatePageFromLinkModalData } from './create-page-from-link-modal';

@Component({
  selector: 'wiki-page-view',
  standalone: true,
  imports: [RouterLink, MatButtonModule, MatIconModule, MarkdownRenderer],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-view">
      <header class="actions">
        @if (guid()) {
          <a mat-button color="primary" [routerLink]="['/pages', guid(), 'edit']">Edit</a>
        }
      </header>
      <section class="body">
        @if (resource.isLoading()) {
          <div class="state">Loading page...</div>
        } @else if (resource.error()) {
          <div class="state error">
            Failed to load page.
            <button type="button" (click)="resource.reload()">Retry</button>
          </div>
        } @else if (resource.value(); as content) {
          <wiki-markdown-renderer
            [markdown]="content.content"
            (brokenClick)="onBrokenLink($event)"
          />
        }
      </section>
    </div>
  `,
  styles: [`
    .page-view { display: flex; flex-direction: column; height: 100%; }
    .actions { display: flex; justify-content: flex-end; padding: 0.5rem 1rem; border-bottom: 1px solid #e5e7eb; }
    .body { flex: 1; overflow: auto; }
    .state { padding: 2rem; color: #6b7280; }
    .state.error { color: #b91c1c; }
  `],
})
export class PageView {
  private readonly route = inject(ActivatedRoute);
  private readonly pages = inject(Pages);
  private readonly dialog = inject(MatDialog);

  protected readonly guid = toSignal(
    this.route.paramMap.pipe(map((p) => p.get('guid'))),
    { initialValue: null as string | null },
  );

  protected readonly resource = this.pages.pageResource(this.guid);

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
}
