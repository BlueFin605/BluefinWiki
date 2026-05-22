import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { Pages } from './pages';

@Component({
  selector: 'wiki-linked-pages-panel',
  standalone: true,
  imports: [RouterLink, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="panel">
      @if (resource.isLoading()) {
        <p class="state">Loading backlinks...</p>
      } @else if (resource.error()) {
        <p class="state error">Failed to load backlinks.</p>
      } @else if (count() === 0) {
        <p class="state empty">No backlinks yet.</p>
      } @else {
        <ul>
          @for (b of backlinks(); track b.guid) {
            <li>
              <a [routerLink]="['/pages', b.guid]">
                <mat-icon>arrow_back</mat-icon>
                <span>{{ b.title }}</span>
              </a>
              @if (b.excerpt) {
                <p class="excerpt">{{ b.excerpt }}</p>
              }
            </li>
          }
        </ul>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }
    .panel { padding: 1rem; }
    .state { color: #6b7280; font-size: 0.875rem; margin: 0; }
    .state.error { color: #b91c1c; }
    ul { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.5rem; }
    a { display: inline-flex; align-items: center; gap: 0.5rem; color: #2563eb; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .excerpt { color: #6b7280; font-size: 0.75rem; margin: 0.125rem 0 0 1.75rem; }
  `],
})
export class LinkedPagesPanel {
  private readonly pages = inject(Pages);

  readonly pageGuid = input.required<string>();

  private readonly guidSignal = computed(() => this.pageGuid());
  protected readonly resource = this.pages.backlinksResource(this.guidSignal);

  readonly backlinks = computed(() => {
    if (this.resource.status() !== 'resolved') return [];
    return this.resource.value()?.backlinks ?? [];
  });

  readonly count = computed(() => this.backlinks().length);
}
