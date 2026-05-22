import { Component, signal } from '@angular/core';
import { MarkdownRenderer } from '../../shared/markdown/markdown-renderer';
import type { MarkdownPipelineOptions } from '../../shared/markdown/unified-pipeline';
import { WikiCodemirror } from '../../shared/codemirror/wiki-codemirror';

const SAMPLE = `# Phase 2 markdown sanity check

This is a paragraph with **bold**, *italic*, ~~strikethrough~~, and \`inline code\`.

## Wiki link cases

A live one: [[Getting Started]] and one with an alias: [[550e8400-e29b-41d4-a716-446655440000|My Home]].

## Table

| h1 | h2 |
|---|---|
| a  | b  |

## Task list

- [x] Render markdown
- [ ] Wire into pages

## Image with size

![Sample|200](https://placehold.co/600x400)

## Fenced code with highlight

\`\`\`ts
const greet = (name: string): string => \`Hello, \${name}!\`;
\`\`\`

## Mermaid diagram

\`\`\`mermaid
flowchart TD
  A[Start] --> B{Decision}
  B -->|Yes| C[Done]
  B -->|No| D[Retry]
\`\`\`
`;

@Component({
  selector: 'wiki-markdown-demo-placeholder',
  standalone: true,
  imports: [MarkdownRenderer, WikiCodemirror],
  template: `
    <main style="padding: 1.5rem; display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; height: calc(100vh - 64px);">
      <section>
        <h2 style="margin-top: 0;">Editor (CodeMirror)</h2>
        <wiki-codemirror [(value)]="markdown" (save)="onSave()" style="height: calc(100% - 3rem); display: block;" />
      </section>
      <section style="overflow: auto;">
        <h2 style="margin-top: 0;">Renderer (HAST walker)</h2>
        <wiki-markdown-renderer
          [markdown]="markdown()"
          [pipelineOptions]="pipelineOptions"
          (brokenClick)="onBroken($event)"
        />
        @if (lastEvent()) { <p><strong>Last event:</strong> {{ lastEvent() }}</p> }
      </section>
    </main>
  `,
})
export class MarkdownDemoPlaceholder {
  readonly markdown = signal(SAMPLE);
  readonly lastEvent = signal<string | null>(null);

  // Force every wiki link to render as broken so the demo exercises the
  // brokenClick handler. Phase 3 will wire a real `pageExists` against the
  // pages service; until then there's no /wiki/* route to navigate to.
  readonly pipelineOptions: MarkdownPipelineOptions = {
    wikiLinks: { pageExists: () => false },
  };

  onSave(): void {
    this.lastEvent.set(`save at ${new Date().toLocaleTimeString()}`);
  }
  onBroken(e: { target: string; displayText: string }): void {
    this.lastEvent.set(`broken link click: ${e.target} ("${e.displayText}")`);
  }
}
