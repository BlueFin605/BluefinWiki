import { Component, ChangeDetectionStrategy, computed, effect, inject, input, signal } from '@angular/core';
import { DomSanitizer, type SafeHtml } from '@angular/platform-browser';
import mermaid from 'mermaid';

let mermaidInitialized = false;
function ensureMermaidInitialized(): void {
  if (mermaidInitialized) return;
  mermaid.initialize({ startOnLoad: false, securityLevel: 'strict' });
  mermaidInitialized = true;
}

let idCounter = 0;
function nextId(): string {
  idCounter += 1;
  return `mermaid-${idCounter}`;
}

@Component({
  selector: 'wiki-mermaid',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (error()) {
      <pre class="wiki-mermaid-error">
        <code>{{ chart() }}</code>
        <div>Mermaid error: {{ error() }}</div>
      </pre>
    } @else if (svg(); as renderedSvg) {
      <div class="wiki-mermaid" [innerHTML]="renderedSvg"></div>
    } @else {
      <div class="wiki-mermaid-loading">Rendering diagram...</div>
    }
  `,
  styles: [`
    :host { display: block; margin: 1rem 0; }
    .wiki-mermaid { display: flex; justify-content: center; overflow-x: auto; }
    .wiki-mermaid-loading { padding: 1rem; color: rgba(0, 0, 0, 0.6); font-size: 0.875rem; }
    .wiki-mermaid-error { padding: 1rem; border-radius: 0.375rem; background: #fef2f2; border: 1px solid #fca5a5; color: #b91c1c; font-size: 0.875rem; overflow-x: auto; }
  `],
})
export class WikiMermaid {
  private sanitizer = inject(DomSanitizer);
  readonly chart = input.required<string>();
  readonly id = nextId();

  private readonly _rawSvg = signal<string | null>(null);
  private readonly _error = signal<string | null>(null);

  readonly svg = computed<SafeHtml | null>(() => {
    const raw = this._rawSvg();
    return raw ? this.sanitizer.bypassSecurityTrustHtml(raw) : null;
  });
  readonly error = this._error.asReadonly();

  constructor() {
    effect((onCleanup) => {
      const source = this.chart();
      let cancelled = false;
      onCleanup(() => { cancelled = true; });

      ensureMermaidInitialized();
      this._rawSvg.set(null);
      this._error.set(null);

      void mermaid.render(this.id, source).then(
        ({ svg }) => { if (!cancelled) this._rawSvg.set(svg); },
        (err: unknown) => {
          if (cancelled) return;
          this._error.set(err instanceof Error ? err.message : 'Failed to render diagram');
        },
      );
    });
  }
}
