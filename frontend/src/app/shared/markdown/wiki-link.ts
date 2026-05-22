import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';

export interface WikiBrokenLinkEvent {
  target: string;
  displayText: string;
}

@Component({
  selector: 'wiki-link',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (broken()) {
      <a
        [attr.href]="href()"
        class="wiki-link-broken"
        [attr.title]="'Page not found: ' + target() + '. Click to create.'"
        (click)="onClick($event)"
      >{{ displayText() }}<span class="wiki-link-broken-marker"> ?</span></a>
    } @else {
      <a
        [routerLink]="href()"
        class="wiki-link"
        [attr.title]="target()"
        (click)="onClick($event)"
      >{{ displayText() }}</a>
    }
  `,
  styles: [`
    a.wiki-link { color: #2563eb; text-decoration: underline; cursor: pointer; }
    a.wiki-link:hover { color: #1e40af; }
    a.wiki-link-broken { color: #dc2626; text-decoration: underline; cursor: pointer; }
    a.wiki-link-broken:hover { color: #991b1b; }
    .wiki-link-broken-marker { font-size: 0.75rem; margin-left: 0.125rem; }
  `],
})
export class WikiLink {
  readonly href = input.required<string>();
  readonly target = input.required<string>();
  readonly displayText = input.required<string>();
  readonly broken = input.required<boolean>();

  readonly brokenClick = output<WikiBrokenLinkEvent>();

  onClick(event: MouseEvent): void {
    if (this.broken()) {
      event.preventDefault();
      this.brokenClick.emit({ target: this.target(), displayText: this.displayText() });
    }
  }
}
