import { Component, ChangeDetectionStrategy, computed, input, output } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { buildMarkdownPipeline, type MarkdownPipelineOptions } from './unified-pipeline';
import { WikiLink, type WikiBrokenLinkEvent } from './wiki-link';
import { WikiMermaid } from './wiki-mermaid';
import { WikiImage, type WikiImageResize } from './wiki-image';

interface HastElement {
  type: 'element';
  tagName: string;
  properties?: Record<string, unknown>;
  children: HastNode[];
}
interface HastText { type: 'text'; value: string; }
interface HastRoot { type: 'root'; children: HastNode[]; }
type HastNode = HastElement | HastText | HastRoot | { type: 'comment' | 'doctype'; value?: string };

function slugify(text: string): string {
  return text.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
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

@Component({
  selector: 'wiki-markdown-renderer',
  standalone: true,
  imports: [NgTemplateOutlet, WikiLink, WikiMermaid, WikiImage],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="wiki-markdown" data-testid="markdown-renderer">
      @for (child of children(); track $index) {
        <ng-container *ngTemplateOutlet="nodeTpl; context: { $implicit: child }"></ng-container>
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
            [pageGuid]="pageGuid() ?? ''"
            [resizable]="editable()"
            (resized)="imageResize.emit($event)"
          ></wiki-image>
        }
        @case ('wiki-link') {
          <wiki-link
            [href]="hrefOf(node)"
            [target]="wikiTargetOf(node)"
            [displayText]="textOfNode(node)"
            [broken]="brokenOf(node)"
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
              <a [attr.href]="hrefOf(node)" target="_blank" rel="noopener noreferrer">@for (c of node.children; track $index) {<ng-container *ngTemplateOutlet="nodeTpl; context: { $implicit: c }"></ng-container>}</a>
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
    .wiki-markdown p { margin-bottom: 1rem; line-height: 1.625; }
    .wiki-markdown ul, .wiki-markdown ol { margin-bottom: 1rem; padding-left: 1.5rem; }
    .wiki-markdown pre { margin: 1rem 0; padding: 1rem; border-radius: 0.375rem; overflow-x: auto; background: #f8fafc; }
    .wiki-markdown code { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace; font-size: 0.875rem; }
    .wiki-markdown blockquote { border-left: 4px solid #cbd5e1; padding-left: 1rem; margin: 1rem 0; font-style: italic; color: #475569; }
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
  readonly brokenClick = output<WikiBrokenLinkEvent>();
  readonly imageResize = output<WikiImageResize>();

  private readonly pipeline = computed(() =>
    buildMarkdownPipeline({
      ...this.pipelineOptions(),
      attachments: { pageGuid: this.pageGuid() },
    }),
  );

  readonly children = computed<HastNode[]>(() => {
    const md = this.markdown() ?? '';
    if (!md) return [];
    const pipeline = this.pipeline();
    const mdast = pipeline.parse(md);
    const hast = pipeline.runSync(mdast);
    return (hast as HastRoot).children ?? [];
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

  wikiTargetOf(node: HastNode): string {
    if (node.type !== 'element') return '';
    const target = node.properties?.['dataWikiTarget'];
    return typeof target === 'string' ? target : '';
  }

  brokenOf(node: HastNode): boolean {
    if (node.type !== 'element') return false;
    return node.properties?.['dataBroken'] === 'true';
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
}
