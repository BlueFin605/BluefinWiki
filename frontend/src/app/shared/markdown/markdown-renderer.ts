import { Component, ChangeDetectionStrategy, computed, input, output } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { buildMarkdownPipeline, type MarkdownPipelineOptions } from './unified-pipeline';
import { WikiLink, type WikiBrokenLinkEvent } from './wiki-link';
import type { WikiTargetResolver } from './plugins/remark-wiki-links';
import { WikiMermaid } from './wiki-mermaid';
import { WikiImage, type WikiImageResize } from './wiki-image';
import { slugify } from './slugify';
import { scrollToSlug } from './scroll-to-slug';

interface HastElement {
  type: 'element';
  tagName: string;
  properties?: Record<string, unknown>;
  children: HastNode[];
}
interface HastText { type: 'text'; value: string; }
interface HastRoot { type: 'root'; children: HastNode[]; }
type HastNode = HastElement | HastText | HastRoot | { type: 'comment' | 'doctype'; value?: string };

/**
 * `decodeURIComponent` throws a `URIError` on a malformed escape (e.g. a lone
 * `%`). By the time an `#anchor` click reaches the decode it has already run
 * `preventDefault()`, so an uncaught throw here is a dead click — fall back to
 * the raw (still-encoded) slug instead.
 */
function safeDecodeHash(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function textOf(node: HastNode): string {
  if (node.type === 'text') return node.value;
  if (node.type === 'element' || node.type === 'root') {
    return (node.children ?? []).map(textOf).join('');
  }
  return '';
}

function classListOf(node: HastElement): string[] {
  const cn = node.properties?.['className'];
  if (Array.isArray(cn)) return cn.map(String);
  if (typeof cn === 'string') return cn.split(/\s+/);
  return [];
}

function isMermaidCode(node: HastElement): boolean {
  return node.tagName === 'code' && classListOf(node).some((c) => c === 'language-mermaid');
}

function isWikiLink(node: HastElement): boolean {
  return node.tagName === 'a' && node.properties?.['dataWikiLink'] === 'true';
}

/**
 * Stamp every `<img>` with its zero-based document-order index (`dataWikiImageIndex`).
 * The drag-to-resize handler rewrites the source token by this index — matching
 * by alt text rewrites *every* image that shares an alt, and the common
 * `![](x.png)` form gives them all the same empty alt. Images inside fenced /
 * inline code never reach the HAST (they stay literal text), so this ordering
 * lines up with `setImageWidth`'s own code-masked token count.
 */
function stampImageIndices(nodes: HastNode[]): void {
  let next = 0;
  const walk = (list: HastNode[]): void => {
    for (const node of list) {
      if (node.type !== 'element') continue;
      if (node.tagName === 'img') {
        node.properties = node.properties ?? {};
        node.properties['dataWikiImageIndex'] = next++;
      }
      walk(node.children);
    }
  };
  walk(nodes);
}

@Component({
  selector: 'wiki-markdown-renderer',
  standalone: true,
  imports: [NgTemplateOutlet, RouterLink, WikiLink, WikiMermaid, WikiImage],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="wiki-markdown" data-testid="markdown-renderer">
      @if (isEmpty()) {
        <p class="wiki-markdown-empty"><em>No content yet. Start writing…</em></p>
      } @else {
        @for (child of children(); track $index) {
          <ng-container *ngTemplateOutlet="nodeTpl; context: { $implicit: child }"></ng-container>
        }
      }
    </div>

    <ng-template #nodeTpl let-node>
      @switch (nodeKind(node)) {
        @case ('text') {{{ node.value }}}
        @case ('mermaid') { <wiki-mermaid [chart]="mermaidChart(node)"></wiki-mermaid> }
        @case ('wiki-image') {
          <wiki-image
            [src]="stringProp(node, 'src') ?? ''"
            [alt]="stringProp(node, 'alt') ?? ''"
            [width]="stringProp(node, 'width')"
            [height]="stringProp(node, 'height')"
            [pageGuid]="pageGuid() ?? ''"
            [resizable]="editable()"
            [imageIndex]="imageIndexOf(node)"
            (resized)="imageResize.emit($event)"
          ></wiki-image>
        }
        @case ('wiki-link') {
          <wiki-link
            [href]="hrefOf(node)"
            [target]="wikiTargetOf(node)"
            [displayText]="textOfNode(node)"
            [broken]="brokenOf(node)"
            [pending]="pendingOf(node)"
            (brokenClick)="brokenClick.emit($event)"
          ></wiki-link>
        }
        @case ('element') {
          @switch (elementTag(node)) {
            @case ('p') {
              <p>@for (c of node.children; track $index) {<ng-container *ngTemplateOutlet="nodeTpl; context: { $implicit: c }"></ng-container>}</p>
            }
            @case ('h1') {
              <h1 [id]="headingId(node)">@for (c of node.children; track $index) {<ng-container *ngTemplateOutlet="nodeTpl; context: { $implicit: c }"></ng-container>}</h1>
            }
            @case ('h2') {
              <h2 [id]="headingId(node)">@for (c of node.children; track $index) {<ng-container *ngTemplateOutlet="nodeTpl; context: { $implicit: c }"></ng-container>}</h2>
            }
            @case ('h3') {
              <h3 [id]="headingId(node)">@for (c of node.children; track $index) {<ng-container *ngTemplateOutlet="nodeTpl; context: { $implicit: c }"></ng-container>}</h3>
            }
            @case ('h4') {
              <h4 [id]="headingId(node)">@for (c of node.children; track $index) {<ng-container *ngTemplateOutlet="nodeTpl; context: { $implicit: c }"></ng-container>}</h4>
            }
            @case ('h5') {
              <h5 [id]="headingId(node)">@for (c of node.children; track $index) {<ng-container *ngTemplateOutlet="nodeTpl; context: { $implicit: c }"></ng-container>}</h5>
            }
            @case ('h6') {
              <h6 [id]="headingId(node)">@for (c of node.children; track $index) {<ng-container *ngTemplateOutlet="nodeTpl; context: { $implicit: c }"></ng-container>}</h6>
            }
            @case ('ul') {
              <ul [class]="classOf(node)">@for (c of node.children; track $index) {<ng-container *ngTemplateOutlet="nodeTpl; context: { $implicit: c }"></ng-container>}</ul>
            }
            @case ('ol') {
              <ol>@for (c of node.children; track $index) {<ng-container *ngTemplateOutlet="nodeTpl; context: { $implicit: c }"></ng-container>}</ol>
            }
            @case ('li') {
              <li [class]="classOf(node)">@for (c of node.children; track $index) {<ng-container *ngTemplateOutlet="nodeTpl; context: { $implicit: c }"></ng-container>}</li>
            }
            @case ('a') {
              @switch (linkKind(node)) {
                @case ('hash') {
                  <a [attr.href]="hrefOf(node)" (click)="onAnchorClick($event, hrefOf(node))">@for (c of node.children; track $index) {<ng-container *ngTemplateOutlet="nodeTpl; context: { $implicit: c }"></ng-container>}</a>
                }
                @case ('internal') {
                  <a [routerLink]="hrefOf(node)">@for (c of node.children; track $index) {<ng-container *ngTemplateOutlet="nodeTpl; context: { $implicit: c }"></ng-container>}</a>
                }
                @default {
                  <a [attr.href]="hrefOf(node)" target="_blank" rel="noopener noreferrer">@for (c of node.children; track $index) {<ng-container *ngTemplateOutlet="nodeTpl; context: { $implicit: c }"></ng-container>}</a>
                }
              }
            }
            @case ('strong') {
              <strong>@for (c of node.children; track $index) {<ng-container *ngTemplateOutlet="nodeTpl; context: { $implicit: c }"></ng-container>}</strong>
            }
            @case ('em') {
              <em>@for (c of node.children; track $index) {<ng-container *ngTemplateOutlet="nodeTpl; context: { $implicit: c }"></ng-container>}</em>
            }
            @case ('del') {
              <del>@for (c of node.children; track $index) {<ng-container *ngTemplateOutlet="nodeTpl; context: { $implicit: c }"></ng-container>}</del>
            }
            @case ('blockquote') {
              <blockquote>@for (c of node.children; track $index) {<ng-container *ngTemplateOutlet="nodeTpl; context: { $implicit: c }"></ng-container>}</blockquote>
            }
            @case ('hr') { <hr /> }
            @case ('br') { <br /> }
            @case ('input') {
              <input type="checkbox" [checked]="boolProp(node, 'checked')" [attr.disabled]="''" />
            }
            @case ('pre') {
              <pre>@for (c of node.children; track $index) {<ng-container *ngTemplateOutlet="nodeTpl; context: { $implicit: c }"></ng-container>}</pre>
            }
            @case ('code') {
              <code [class]="classOf(node)">@for (c of node.children; track $index) {<ng-container *ngTemplateOutlet="nodeTpl; context: { $implicit: c }"></ng-container>}</code>
            }
            @case ('table') {
              <table>@for (c of node.children; track $index) {<ng-container *ngTemplateOutlet="nodeTpl; context: { $implicit: c }"></ng-container>}</table>
            }
            @case ('thead') {
              <thead>@for (c of node.children; track $index) {<ng-container *ngTemplateOutlet="nodeTpl; context: { $implicit: c }"></ng-container>}</thead>
            }
            @case ('tbody') {
              <tbody>@for (c of node.children; track $index) {<ng-container *ngTemplateOutlet="nodeTpl; context: { $implicit: c }"></ng-container>}</tbody>
            }
            @case ('tr') {
              <tr>@for (c of node.children; track $index) {<ng-container *ngTemplateOutlet="nodeTpl; context: { $implicit: c }"></ng-container>}</tr>
            }
            @case ('th') {
              <th>@for (c of node.children; track $index) {<ng-container *ngTemplateOutlet="nodeTpl; context: { $implicit: c }"></ng-container>}</th>
            }
            @case ('td') {
              <td>@for (c of node.children; track $index) {<ng-container *ngTemplateOutlet="nodeTpl; context: { $implicit: c }"></ng-container>}</td>
            }
            @case ('span') {
              <span [class]="classOf(node)">@for (c of node.children; track $index) {<ng-container *ngTemplateOutlet="nodeTpl; context: { $implicit: c }"></ng-container>}</span>
            }
            @case ('div') {
              <div
                [class]="classOf(node)"
                [attr.tabindex]="stringProp(node, 'tabIndex')"
                [attr.role]="stringProp(node, 'role')"
                [attr.aria-label]="stringProp(node, 'aria-label')"
              >@for (c of node.children; track $index) {<ng-container *ngTemplateOutlet="nodeTpl; context: { $implicit: c }"></ng-container>}</div>
            }
            @default {
              <span>@for (c of node.children; track $index) {<ng-container *ngTemplateOutlet="nodeTpl; context: { $implicit: c }"></ng-container>}</span>
            }
          }
        }
      }
    </ng-template>
  `,
  styles: [`
    :host { display: block; }
    .wiki-markdown { padding: 1.5rem; }
    .wiki-markdown h1 { font-size: 1.875rem; font-weight: 700; margin: 1.5rem 0 1rem; }
    .wiki-markdown h2 { font-size: 1.5rem; font-weight: 700; margin: 1.25rem 0 0.75rem; }
    .wiki-markdown h3 { font-size: 1.25rem; font-weight: 700; margin: 1rem 0 0.5rem; }
    .wiki-markdown h4 { font-size: 1.125rem; font-weight: 600; margin: 1rem 0 0.5rem; }
    .wiki-markdown h5 { font-size: 1rem; font-weight: 600; margin: 0.75rem 0 0.5rem; }
    .wiki-markdown h6 { font-size: 0.875rem; font-weight: 600; margin: 0.75rem 0 0.5rem; color: #475569; }
    .wiki-markdown p { margin-bottom: 1rem; line-height: 1.625; }
    .wiki-markdown .wiki-markdown-empty { color: #64748b; font-style: italic; }
    .wiki-markdown ul, .wiki-markdown ol { margin-bottom: 1rem; padding-left: 1.5rem; }
    .wiki-markdown pre { margin: 1rem 0; padding: 1rem; border-radius: 0.375rem; overflow-x: auto; background: #f8fafc; }
    .wiki-markdown code { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace; font-size: 0.875rem; }
    .wiki-markdown blockquote { border-left: 4px solid #cbd5e1; padding-left: 1rem; margin: 1rem 0; font-style: italic; color: #475569; }
    .wiki-markdown .table-scroll { overflow-x: auto; max-width: 100%; margin-bottom: 1rem; }
    .wiki-markdown .table-scroll > table { margin-bottom: 0; }
    .wiki-markdown table { width: 100%; border-collapse: collapse; margin-bottom: 1rem; }
    .wiki-markdown th, .wiki-markdown td { border: 1px solid #cbd5e1; padding: 0.5rem 1rem; text-align: left; }
    .wiki-markdown thead { background: #f1f5f9; }
    .wiki-markdown img { max-width: 100%; height: auto; border-radius: 0.375rem; }
    .wiki-markdown hr { border: 0; border-top: 2px solid #cbd5e1; margin: 1.5rem 0; }
  `],
})
export class MarkdownRenderer {
  readonly markdown = input.required<string>();
  readonly pipelineOptions = input<MarkdownPipelineOptions | undefined>(undefined);
  /**
   * The page the preview belongs to. Threaded into the pipeline so
   * `remark-attachment-urls` can rewrite bare-filename image URLs to the authed
   * `/api/pages/:guid/attachments/:file` endpoint. Omit it and relative image
   * URLs are left untouched (no rewrite, no crash).
   */
  readonly pageGuid = input<string | undefined>(undefined);
  /** Edit / split preview: show the drag-to-resize handle on rendered images. */
  readonly editable = input<boolean>(false);
  /**
   * Step 3.8: resolves every `[[target]]` to `{ guid, exists }`. When provided,
   * wiki links always render `routerLink="/pages/<guid>"` and a missing target
   * (`exists: false`) renders the broken state. Omit it and wiki links fall
   * back to the legacy slug href with no broken-link detection.
   */
  readonly resolveWikiTarget = input<WikiTargetResolver | undefined>(undefined);
  readonly brokenClick = output<WikiBrokenLinkEvent>();
  readonly imageResize = output<WikiImageResize>();

  private readonly pipeline = computed(() => {
    const opts = this.pipelineOptions();
    const resolveWikiTarget = this.resolveWikiTarget();
    return buildMarkdownPipeline({
      ...opts,
      attachments: { pageGuid: this.pageGuid() },
      wikiLinks: {
        ...opts?.wikiLinks,
        ...(resolveWikiTarget ? { resolveWikiTarget } : {}),
      },
    });
  });

  /**
   * Empty (or whitespace-only) markdown renders the italic
   * "No content yet. Start writing…" placeholder instead of the pipeline
   * output — parity with React's `MarkdownPreview`.
   */
  readonly isEmpty = computed(() => !(this.markdown() ?? '').trim());

  readonly children = computed<HastNode[]>(() => {
    const md = this.markdown() ?? '';
    if (!md.trim()) return [];
    const pipeline = this.pipeline();
    const mdast = pipeline.parse(md);
    const hast = pipeline.runSync(mdast);
    const children = (hast as HastRoot).children ?? [];
    stampImageIndices(children);
    return children;
  });

  /** Classifies a node into a switch case in the template. */
  nodeKind(node: HastNode): 'text' | 'mermaid' | 'wiki-link' | 'wiki-image' | 'element' | 'skip' {
    if (node.type === 'text') return 'text';
    if (node.type !== 'element') return 'skip';
    if (node.tagName === 'pre') {
      const codeChild = node.children.find(
        (c): c is HastElement => c.type === 'element' && c.tagName === 'code',
      );
      if (codeChild && isMermaidCode(codeChild)) return 'mermaid';
    }
    if (isWikiLink(node)) return 'wiki-link';
    if (node.tagName === 'img') return 'wiki-image';
    return 'element';
  }

  elementTag(node: HastNode): string {
    return node.type === 'element' ? node.tagName : '';
  }

  mermaidChart(node: HastNode): string {
    if (node.type !== 'element') return '';
    const code = node.children.find(
      (c): c is HastElement => c.type === 'element' && c.tagName === 'code',
    );
    if (!code) return '';
    return textOf(code).replace(/\n$/, '');
  }

  textOfNode(node: HastNode): string {
    return textOf(node);
  }

  hrefOf(node: HastNode): string {
    if (node.type !== 'element') return '';
    const href = node.properties?.['href'];
    return typeof href === 'string' ? href : '';
  }

  /**
   * Classifies a plain markdown `<a>` (wiki links are handled separately):
   *  - `hash`     — `#slug` in-page link: smooth-scroll, no new tab.
   *  - `internal` — same-origin `/path`: Angular `routerLink`, no new tab.
   *  - `external` — everything else: keeps `target="_blank" rel="noopener"`.
   */
  linkKind(node: HastNode): 'hash' | 'internal' | 'external' {
    const href = this.hrefOf(node);
    if (href.startsWith('#')) return 'hash';
    if (href.startsWith('/')) return 'internal';
    return 'external';
  }

  /**
   * In-page `#anchor` click: cancel the default jump, smooth-scroll to the
   * element whose `id` matches the slug (heading ids are already slugified),
   * and reflect the anchor in `location.hash` without a history entry.
   */
  onAnchorClick(event: Event, href: string): void {
    if (!href.startsWith('#')) return;
    event.preventDefault();
    // Shared with the table-of-contents rail: smooth-scroll + reflect the slug
    // in the URL fragment without pushing a history entry.
    scrollToSlug(safeDecodeHash(href.slice(1)));
  }

  wikiTargetOf(node: HastNode): string {
    if (node.type !== 'element') return '';
    const target = node.properties?.['dataWikiTarget'];
    return typeof target === 'string' ? target : '';
  }

  brokenOf(node: HastNode): boolean {
    if (node.type !== 'element') return false;
    return node.properties?.['dataBroken'] === 'true';
  }

  /**
   * The `[[target]]` resolution is still pending (or failed): the plugin emitted
   * a non-navigable anchor so the link never dead-ends on a bare title.
   */
  pendingOf(node: HastNode): boolean {
    if (node.type !== 'element') return false;
    return node.properties?.['dataWikiPending'] === 'true';
  }

  headingId(node: HastNode): string {
    return slugify(textOf(node));
  }

  classOf(node: HastNode): string {
    if (node.type !== 'element') return '';
    return classListOf(node).join(' ');
  }

  stringProp(node: HastNode, name: string): string | null {
    if (node.type !== 'element') return null;
    const v = node.properties?.[name];
    return typeof v === 'string' ? v : typeof v === 'number' ? String(v) : null;
  }

  boolProp(node: HastNode, name: string): boolean {
    if (node.type !== 'element') return false;
    return Boolean(node.properties?.[name]);
  }

  /** Document-order index stamped onto an `<img>` by {@link stampImageIndices}. */
  imageIndexOf(node: HastNode): number {
    if (node.type !== 'element') return 0;
    const v = node.properties?.['dataWikiImageIndex'];
    return typeof v === 'number' ? v : 0;
  }
}
