import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Pages } from '../../features/pages/pages';

@Component({
  selector: 'wiki-breadcrumbs',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="breadcrumbs" aria-label="Breadcrumb">
      <ol>
        @for (a of ancestors(); track a.guid) {
          <li>
            <a [routerLink]="['/pages', a.guid]">{{ a.title }}</a>
            <span class="sep">/</span>
          </li>
        }
        <li class="current">{{ currentTitle() }}</li>
      </ol>
    </nav>
  `,
  styles: [`
    :host { display: block; }
    .breadcrumbs { padding: 0.5rem 1rem; font-size: 0.875rem; color: #6b7280; }
    ol { list-style: none; padding: 0; margin: 0; display: flex; flex-wrap: wrap; gap: 0.25rem; align-items: center; }
    a { color: #2563eb; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .sep { color: #cbd5e1; padding: 0 0.25rem; }
    .current { font-weight: 500; color: #111827; }
  `],
})
export class Breadcrumbs {
  private readonly pages = inject(Pages);

  readonly guid = input.required<string>();
  readonly currentTitle = input.required<string>();

  private readonly guidSignal = computed(() => this.guid());
  private readonly resource = this.pages.ancestorsResource(this.guidSignal);

  protected readonly ancestors = computed(() => {
    if (this.resource.status() !== 'resolved') return [];
    return this.resource.value() ?? [];
  });
}
