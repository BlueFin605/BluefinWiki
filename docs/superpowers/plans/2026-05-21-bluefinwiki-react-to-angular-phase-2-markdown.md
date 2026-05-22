# React → Angular Conversion — Phase 2: Markdown infrastructure

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** `docs/superpowers/specs/2026-05-21-bluefinwiki-react-to-angular-design.md`
**Roadmap:** `docs/superpowers/plans/2026-05-21-bluefinwiki-react-to-angular-roadmap.md`
**Branch:** `feat/angular-rewrite` in the BluefinWiki submodule (continues from tag `phase-1-foundation`, commit `b5a9f95`).
**Working directory for this phase:** `BluefinWiki/frontend-angular/`.

**Goal:** Stand up the markdown read pipeline (parse + render) and the markdown write pipeline (editor) so that Phase 3 can drop a `<wiki-markdown-renderer>` into the page view and a `<wiki-codemirror>` into the page editor and get the same behaviour as the React app. All units shipped with co-located tests; `npm run lint`, `npm test`, and `npm run build` stay green.

**Architecture:**
- **Read path:** `unified()` pipeline (`remark-parse` → `remark-gfm` → `remark-breaks` → `remarkWikiLinks` → `remarkImageSize` → `remark-rehype` → `rehype-highlight`) produces a HAST tree. `MarkdownRenderer` is a standalone Angular component that takes a markdown string `input()`, runs the pipeline in a `computed()` signal, and recursively walks the HAST emitting Angular templates. Wiki-link HAST elements (detected via `data-wiki-link="true"` properties set by the plugin) become `<wiki-link>` components; `<pre><code class="language-mermaid">` blocks become `<wiki-mermaid>` components; everything else renders through standard Angular templates per `tagName`.
- **Write path:** `WikiCodemirror` is a standalone Angular component that creates a CodeMirror 6 `EditorView` on init, exposes `value` as a `model()` signal for two-way binding, accepts an `onSave` `output()` for Ctrl/Cmd+S, applies the existing extension stack (`@codemirror/lang-markdown` + history + line numbers + default keymap), and destroys the view on `OnDestroy`. Toolbar action support, link autocomplete overlay, and attachment toolbar are all Phase 4 concerns — Phase 2 ships the wrapper with just the basics so the page editor has something to bind to in Phase 3.
- **DOM trust boundary:** The HAST walker emits Angular templates element-by-element — no `[innerHTML]` for app-controlled content. The single exception is `<wiki-mermaid>`, which inserts mermaid's rendered SVG via `DomSanitizer.bypassSecurityTrustHtml`. This is safe because mermaid is initialized with `securityLevel: 'strict'` which strips `<script>` and event handlers from the diagram source before rendering.

**Tech Stack additions:**
- `unified@11`, `remark-parse@11`, `remark-rehype@11`, `remark-gfm@4`, `remark-breaks@4`, `rehype-highlight@7`, `unist-util-visit@5`, `@types/mdast`, `@types/hast`
- `mermaid@11`
- `@codemirror/state@6`, `@codemirror/view@6`, `@codemirror/lang-markdown@6`, `@codemirror/commands@6`, `@codemirror/language@6`
- `highlight.js` (peer of `rehype-highlight` for syntax-highlighting CSS theme import)

**Spec → behaviour adjustments locked in here:**
- The roadmap lists `shared/markdown/markdown-renderer.component.ts`, `wiki-link.component.ts`, `wiki-mermaid.component.ts`. Phase 1 dropped the `.component` / `.service` / `.directive` suffixes (see Phase 1 file structure — `auth.ts`, `permission.ts`, `oauth-callback.ts`). Phase 2 matches: `markdown-renderer.ts`, `wiki-link.ts`, `wiki-mermaid.ts`, `wiki-codemirror.ts`. Selectors keep the `wiki-` prefix from the Phase 1 ESLint config.
- The React `MarkdownPreview` handles async image fetching for `/pages/*` URLs, image-resize drag handles, anchor-link scrolling, and broken-link "create page" callbacks. Phase 2 ports only what the spec assigns to this phase: rendering, wiki-link routing, mermaid routing, heading slug ids, and anchor-link scroll. The async-image, resize, and broken-link create modal are Phase 4 (editor extras / attachments).
- The React `MarkdownEditor` includes toolbar-action methods, full custom keymap (bold/italic/strikethrough/code/link/heading), and an inline `<LinkAutocomplete>` overlay component. Phase 2 ships only the bare wrapper (markdown lang + history + line numbers + Ctrl-S save, plus `value` as a two-way `model()` signal). Toolbar dispatch and link autocomplete are Phase 4.
- The React `wikiLinkParser` is plain TypeScript — it ports verbatim and stays at `shared/markdown/wiki-link-parser.ts` (not inside `plugins/`) because the same parser is needed by Phase 4's link autocomplete logic, not just by the remark plugin.

---

## Task 1: Install markdown + CodeMirror dependencies

**Files:**
- Modify: `BluefinWiki/frontend-angular/package.json`
- Modify: `BluefinWiki/frontend-angular/src/styles.scss`

- [ ] **Step 1: Install unified + remark + rehype**

Run from `BluefinWiki/frontend-angular/`:

```bash
npm install \
  unified@11 \
  remark-parse@11 \
  remark-rehype@11 \
  remark-gfm@4 \
  remark-breaks@4 \
  rehype-highlight@7 \
  unist-util-visit@5 \
  mermaid@11 \
  highlight.js@11
```

Then install the type packages as dev deps:

```bash
npm install --save-dev @types/mdast @types/hast
```

Per the home repo's `feedback_npm_install_zero_warnings` rule, both installs must complete with zero warning or error lines. If npm reports deprecated transitives, capture the names in the commit message body so we can chase them later.

- [ ] **Step 2: Install CodeMirror 6 modules**

```bash
npm install \
  @codemirror/state@6 \
  @codemirror/view@6 \
  @codemirror/lang-markdown@6 \
  @codemirror/commands@6 \
  @codemirror/language@6
```

Same zero-warning rule.

- [ ] **Step 3: Add highlight.js theme to global styles**

The React app imports `highlight.js/styles/github.css` for code-block syntax colour. Mirror that. Add at the top of `src/styles.scss`:

```scss
@import 'highlight.js/styles/github.css';
```

If Material 3 dark mode is later added, swap to `github-dark.css` conditionally via a `[data-theme="dark"]` rule — but for Phase 2 the static github.css matches the React app's default light theme.

- [ ] **Step 4: Verify build still passes**

```bash
npm run build
```

Expected: build succeeds. Bundle size will grow noticeably (mermaid + highlight.js are large) — that's expected for Phase 2; we'll evaluate lazy-loading after Phase 8 cutover if total bundle exceeds budget.

- [ ] **Step 5: Verify lint still passes**

```bash
npm run lint
```

Expected: 0 errors, 0 warnings.

- [ ] **Step 6: Commit**

```bash
git -C BluefinWiki add frontend-angular/
git -C BluefinWiki commit -m "chore(angular): install unified/remark/rehype + mermaid + CodeMirror 6"
```

---

## Task 2: Port `wikiLinkParser` utility

**Files:**
- Create: `BluefinWiki/frontend-angular/src/app/shared/markdown/wiki-link-parser.ts`
- Create: `BluefinWiki/frontend-angular/src/app/shared/markdown/wiki-link-parser.spec.ts`

The React file at `BluefinWiki/frontend/src/utils/wikiLinkParser.ts` is framework-agnostic TypeScript — it ports byte-for-byte. The matching tests at `BluefinWiki/frontend/src/utils/__tests__/wikiLinkParser.test.ts` port with only the import path change (`vitest` → `@jest/globals` is unnecessary because Jest's globals are picked up via `tsconfig.spec.json` `"types": ["jest"]`).

- [ ] **Step 1: Write the failing test file**

Create `src/app/shared/markdown/wiki-link-parser.spec.ts`:

```ts
import {
  parseWikiLinks,
  isGuid,
  isValidWikiLink,
  getDisplayText,
  hasExternalUrl,
  type WikiLink,
} from './wiki-link-parser';

describe('wikiLinkParser', () => {
  describe('parseWikiLinks', () => {
    it('parses basic wiki link with page title', () => {
      const links = parseWikiLinks('Check out [[Getting Started]] for more info.');
      expect(links).toHaveLength(1);
      expect(links[0]).toEqual({
        type: 'page-title',
        raw: '[[Getting Started]]',
        target: 'Getting Started',
        startIndex: 10,
        endIndex: 29,
      });
    });

    it('parses wiki link with GUID and display text', () => {
      const links = parseWikiLinks('See [[550e8400-e29b-41d4-a716-446655440000|Home Page]] here.');
      expect(links).toHaveLength(1);
      expect(links[0]).toEqual({
        type: 'page-guid',
        raw: '[[550e8400-e29b-41d4-a716-446655440000|Home Page]]',
        target: '550e8400-e29b-41d4-a716-446655440000',
        displayText: 'Home Page',
        startIndex: 4,
        endIndex: 54,
      });
    });

    it('parses multiple wiki links in text', () => {
      const links = parseWikiLinks('[[Page One]] and [[Page Two]] are linked.');
      expect(links).toHaveLength(2);
      expect(links[0].target).toBe('Page One');
      expect(links[1].target).toBe('Page Two');
    });

    it('handles links at start and end of text', () => {
      const links = parseWikiLinks('[[Start]] middle [[End]]');
      expect(links).toHaveLength(2);
      expect(links[0].startIndex).toBe(0);
      expect(links[1].endIndex).toBe(24);
    });

    it('handles empty content', () => {
      expect(parseWikiLinks('')).toHaveLength(0);
    });

    it('returns empty array when no wiki links present', () => {
      expect(parseWikiLinks('Plain text with [normal](url) link only.')).toHaveLength(0);
    });

    it('trims whitespace inside link content', () => {
      const links = parseWikiLinks('[[ Page Title  ]] and [[  guid  | Display  ]]');
      expect(links[0].target).toBe('Page Title');
      expect(links[1].target).toBe('guid');
      expect(links[1].displayText).toBe('Display');
    });

    it('handles special characters in page titles', () => {
      const links = parseWikiLinks('[[Page: Title & Subtopic (2024)]]');
      expect(links[0].target).toBe('Page: Title & Subtopic (2024)');
    });
  });

  describe('isGuid', () => {
    it('accepts valid GUIDs', () => {
      expect(isGuid('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
      expect(isGuid('6ba7b810-9dad-11d1-80b4-00c04fd430c8')).toBe(true);
      expect(isGuid('00000000-0000-0000-0000-000000000000')).toBe(true);
    });

    it('accepts GUIDs case-insensitively', () => {
      expect(isGuid('550E8400-E29B-41D4-A716-446655440000')).toBe(true);
      expect(isGuid('550e8400-E29b-41D4-a716-446655440000')).toBe(true);
    });

    it('rejects invalid GUIDs', () => {
      expect(isGuid('not-a-guid')).toBe(false);
      expect(isGuid('550e8400-e29b-41d4-a716')).toBe(false);
      expect(isGuid('550e8400-e29b-41d4-a716-446655440000-extra')).toBe(false);
      expect(isGuid('')).toBe(false);
      expect(isGuid('Page Title')).toBe(false);
    });
  });

  describe('isValidWikiLink', () => {
    it('validates page-title format', () => {
      expect(isValidWikiLink('Page Title')).toBe(true);
      expect(isValidWikiLink('Getting Started')).toBe(true);
    });

    it('validates GUID-with-display format', () => {
      expect(isValidWikiLink('550e8400-e29b-41d4-a716-446655440000|Display Text')).toBe(true);
    });

    it('rejects empty or whitespace-only links', () => {
      expect(isValidWikiLink('')).toBe(false);
      expect(isValidWikiLink('   ')).toBe(false);
    });

    it('rejects links with empty parts around the pipe', () => {
      expect(isValidWikiLink('|Display Text')).toBe(false);
      expect(isValidWikiLink('550e8400-e29b-41d4-a716-446655440000|')).toBe(false);
      expect(isValidWikiLink(' | ')).toBe(false);
    });

    it('rejects non-GUID target in pipe format', () => {
      expect(isValidWikiLink('not-a-guid|Display Text')).toBe(false);
      expect(isValidWikiLink('Page Title|Display Text')).toBe(false);
    });
  });

  describe('getDisplayText', () => {
    it('returns displayText when present', () => {
      const link: WikiLink = {
        type: 'page-guid',
        raw: '[[guid|Custom Text]]',
        target: '550e8400-e29b-41d4-a716-446655440000',
        displayText: 'Custom Text',
        startIndex: 0,
        endIndex: 20,
      };
      expect(getDisplayText(link)).toBe('Custom Text');
    });

    it('returns target when displayText absent', () => {
      const link: WikiLink = {
        type: 'page-title',
        raw: '[[Page Title]]',
        target: 'Page Title',
        startIndex: 0,
        endIndex: 14,
      };
      expect(getDisplayText(link)).toBe('Page Title');
    });
  });

  describe('hasExternalUrl', () => {
    it('detects HTTP and HTTPS', () => {
      expect(hasExternalUrl('http://example.com')).toBe(true);
      expect(hasExternalUrl('HTTPS://EXAMPLE.COM')).toBe(true);
    });

    it('detects FTP and mailto', () => {
      expect(hasExternalUrl('ftp://files.example.com')).toBe(true);
      expect(hasExternalUrl('mailto:user@example.com')).toBe(true);
    });

    it('does not match partial occurrences in mid-text', () => {
      expect(hasExternalUrl('not http://url')).toBe(false);
      expect(hasExternalUrl('see https://example later')).toBe(false);
    });

    it('does not match internal paths', () => {
      expect(hasExternalUrl('/wiki/page')).toBe(false);
      expect(hasExternalUrl('Page Title')).toBe(false);
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm test -- wiki-link-parser
```

Expected: FAIL with `Cannot find module './wiki-link-parser'` or equivalent.

- [ ] **Step 3: Port the parser**

Create `src/app/shared/markdown/wiki-link-parser.ts`:

```ts
export interface WikiLink {
  type: 'page-title' | 'page-guid';
  raw: string;
  target: string;
  displayText?: string;
  startIndex: number;
  endIndex: number;
}

const WIKI_LINK_REGEX = /\[\[([^\]]+?)\]\]/g;

export function parseWikiLinks(markdown: string): WikiLink[] {
  const links: WikiLink[] = [];
  let match: RegExpExecArray | null;
  WIKI_LINK_REGEX.lastIndex = 0;

  while ((match = WIKI_LINK_REGEX.exec(markdown)) !== null) {
    const raw = match[0];
    const content = match[1];
    const startIndex = match.index;
    const endIndex = match.index + raw.length;
    const pipeIndex = content.indexOf('|');

    if (pipeIndex !== -1) {
      links.push({
        type: 'page-guid',
        raw,
        target: content.substring(0, pipeIndex).trim(),
        displayText: content.substring(pipeIndex + 1).trim(),
        startIndex,
        endIndex,
      });
    } else {
      links.push({
        type: 'page-title',
        raw,
        target: content.trim(),
        startIndex,
        endIndex,
      });
    }
  }
  return links;
}

export function isGuid(target: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(target);
}

export function isValidWikiLink(link: string): boolean {
  if (!link || link.trim().length === 0) return false;
  const pipeIndex = link.indexOf('|');
  if (pipeIndex !== -1) {
    const target = link.substring(0, pipeIndex).trim();
    const displayText = link.substring(pipeIndex + 1).trim();
    if (!target || !displayText) return false;
    return isGuid(target);
  }
  return link.trim().length > 0;
}

export function getDisplayText(link: WikiLink): string {
  return link.displayText ?? link.target;
}

export function hasExternalUrl(text: string): boolean {
  return /^https?:\/\//i.test(text) || /^ftp:\/\//i.test(text) || /^mailto:/i.test(text);
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npm test -- wiki-link-parser
```

Expected: 22 tests pass (8 `parseWikiLinks` + 3 `isGuid` + 5 `isValidWikiLink` + 2 `getDisplayText` + 4 `hasExternalUrl`).

- [ ] **Step 5: Commit**

```bash
git -C BluefinWiki add frontend-angular/
git -C BluefinWiki commit -m "feat(angular): port wikiLinkParser utility for wiki-style link parsing"
```

---

## Task 3: Port `remark-wiki-links` plugin

**Files:**
- Create: `BluefinWiki/frontend-angular/src/app/shared/markdown/plugins/remark-wiki-links.ts`
- Create: `BluefinWiki/frontend-angular/src/app/shared/markdown/plugins/remark-wiki-links.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `src/app/shared/markdown/plugins/remark-wiki-links.spec.ts`:

```ts
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import remarkWikiLinks from './remark-wiki-links';
import type { Root } from 'mdast';

async function toHtml(markdown: string, options?: Parameters<typeof remarkWikiLinks>[0]): Promise<string> {
  const file = await unified()
    .use(remarkParse)
    .use(remarkWikiLinks, options)
    .use(remarkRehype)
    .use(await import('rehype-stringify').then((m) => m.default))
    .process(markdown);
  return String(file);
}

async function toMdast(markdown: string, options?: Parameters<typeof remarkWikiLinks>[0]): Promise<Root> {
  return unified().use(remarkParse).use(remarkWikiLinks, options).parse(markdown) as Root;
}

describe('remark-wiki-links', () => {
  it('converts [[Title]] to a link node with default slug url', async () => {
    const html = await toHtml('Read [[Getting Started]] now.');
    expect(html).toContain('href="/wiki/getting-started"');
    expect(html).toContain('class="wiki-link"');
    expect(html).toContain('data-wiki-link="true"');
    expect(html).toContain('data-wiki-type="page-title"');
    expect(html).toContain('data-wiki-target="Getting Started"');
    expect(html).toContain('>Getting Started</a>');
  });

  it('converts [[guid|alias]] to a link node with guid url and alias text', async () => {
    const html = await toHtml('See [[550e8400-e29b-41d4-a716-446655440000|Home]] here.');
    expect(html).toContain('href="/wiki/550e8400-e29b-41d4-a716-446655440000"');
    expect(html).toContain('data-wiki-type="page-guid"');
    expect(html).toContain('>Home</a>');
  });

  it('marks broken links via pageExists callback', async () => {
    const html = await toHtml('[[Missing Page]]', { pageExists: () => false });
    expect(html).toContain('class="wiki-link-broken"');
    expect(html).toContain('data-broken="true"');
  });

  it('uses custom resolveUrl when provided', async () => {
    const html = await toHtml('[[Custom]]', {
      resolveUrl: (target) => `/custom/${target.toUpperCase()}`,
    });
    expect(html).toContain('href="/custom/CUSTOM"');
  });

  it('respects custom baseUrl', async () => {
    const html = await toHtml('[[Hello World]]', { baseUrl: '/pages' });
    expect(html).toContain('href="/pages/hello-world"');
  });

  it('does not process wiki links inside code blocks', async () => {
    const html = await toHtml('```\n[[Not A Link]]\n```');
    expect(html).not.toContain('data-wiki-link');
    expect(html).toContain('[[Not A Link]]');
  });

  it('does not process wiki links inside inline code', async () => {
    const html = await toHtml('Use `[[syntax]]` to make links.');
    expect(html).not.toContain('data-wiki-link');
    expect(html).toContain('<code>[[syntax]]</code>');
  });

  it('handles multiple wiki links in one paragraph', async () => {
    const tree = await toMdast('[[A]] and [[B]] and [[C]].');
    // Walk paragraph children — should contain 3 link nodes interleaved with text
    const para = tree.children[0];
    expect(para.type).toBe('paragraph');
    const linkCount = (para as { children: { type: string }[] }).children.filter((c) => c.type === 'link').length;
    expect(linkCount).toBe(3);
  });
});
```

`rehype-stringify` is loaded dynamically inside the test only. The Phase 2 pipeline itself does not depend on rehype-stringify because the renderer walks HAST directly — we only need it here to assert serialized HTML for readability.

- [ ] **Step 2: Install `rehype-stringify` as a dev dep**

```bash
npm install --save-dev rehype-stringify@10
```

Zero-warnings rule applies.

- [ ] **Step 3: Run the test to verify it fails**

```bash
npm test -- remark-wiki-links
```

Expected: FAIL with `Cannot find module './remark-wiki-links'`.

- [ ] **Step 4: Port the plugin**

Create `src/app/shared/markdown/plugins/remark-wiki-links.ts`:

```ts
import { visit } from 'unist-util-visit';
import type { Plugin } from 'unified';
import type { Root, Text, Link, Code, InlineCode } from 'mdast';
import { parseWikiLinks, getDisplayText, type WikiLink } from '../wiki-link-parser';

export interface WikiLinksOptions {
  baseUrl?: string;
  resolveUrl?: (target: string, type: 'page-title' | 'page-guid') => string;
  pageExists?: (target: string, type: 'page-title' | 'page-guid') => boolean;
  linkClassName?: string;
  brokenLinkClassName?: string;
}

const remarkWikiLinks: Plugin<[WikiLinksOptions?], Root> = (options = {}) => {
  const {
    baseUrl = '/wiki',
    resolveUrl,
    pageExists,
    linkClassName = 'wiki-link',
    brokenLinkClassName = 'wiki-link-broken',
  } = options;

  function generateUrl(target: string, type: 'page-title' | 'page-guid'): string {
    if (resolveUrl) return resolveUrl(target, type);
    if (type === 'page-guid') return `${baseUrl}/${target}`;
    const slug = target.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return `${baseUrl}/${slug}`;
  }

  function isBroken(target: string, type: 'page-title' | 'page-guid'): boolean {
    return pageExists ? !pageExists(target, type) : false;
  }

  function wikiLinkToMdastLink(wikiLink: WikiLink): Link {
    const url = generateUrl(wikiLink.target, wikiLink.type);
    const displayText = getDisplayText(wikiLink);
    const broken = isBroken(wikiLink.target, wikiLink.type);
    return {
      type: 'link',
      url,
      title: broken ? `Page not found: ${wikiLink.target}` : wikiLink.target,
      children: [{ type: 'text', value: displayText }],
      data: {
        hProperties: {
          className: broken ? brokenLinkClassName : linkClassName,
          'data-wiki-link': 'true',
          'data-wiki-type': wikiLink.type,
          'data-wiki-target': wikiLink.target,
          'data-broken': broken ? 'true' : 'false',
        },
      },
    };
  }

  function processTextNode(node: Text): (Text | Link)[] {
    const text = node.value;
    const wikiLinks = parseWikiLinks(text);
    if (wikiLinks.length === 0) return [node];

    const nodes: (Text | Link)[] = [];
    let lastIndex = 0;
    for (const link of wikiLinks) {
      if (link.startIndex > lastIndex) {
        nodes.push({ type: 'text', value: text.substring(lastIndex, link.startIndex) });
      }
      nodes.push(wikiLinkToMdastLink(link));
      lastIndex = link.endIndex;
    }
    if (lastIndex < text.length) {
      nodes.push({ type: 'text', value: text.substring(lastIndex) });
    }
    return nodes;
  }

  return (tree: Root) => {
    // `visit` will not descend into `code` / `inlineCode` because they're leaf
    // nodes (no `children: Text[]` — they carry `value` directly). That's how
    // the existing React plugin gets fenced-code/backtick-code exclusion for
    // free.
    visit(tree, 'text', (node: Text, index, parent) => {
      if (!parent || index === undefined) return;
      // Defensive: never rewrite text inside `code` or `inlineCode` parents (in
      // case a custom remark plugin elsewhere emits `text` children of them).
      const parentType = (parent as { type: string }).type;
      if (parentType === ('code' satisfies Code['type']) || parentType === ('inlineCode' satisfies InlineCode['type'])) {
        return;
      }
      const processed = processTextNode(node);
      if (processed.length > 1) {
        parent.children.splice(index, 1, ...processed);
        return index;
      }
    });
  };
};

export default remarkWikiLinks;
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
npm test -- remark-wiki-links
```

Expected: 8 tests pass.

- [ ] **Step 6: Commit**

```bash
git -C BluefinWiki add frontend-angular/
git -C BluefinWiki commit -m "feat(angular): port remark-wiki-links plugin"
```

---

## Task 4: Port `remark-image-size` plugin

**Files:**
- Create: `BluefinWiki/frontend-angular/src/app/shared/markdown/plugins/remark-image-size.ts`
- Create: `BluefinWiki/frontend-angular/src/app/shared/markdown/plugins/remark-image-size.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `src/app/shared/markdown/plugins/remark-image-size.spec.ts`:

```ts
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import remarkImageSize from './remark-image-size';

async function toHtml(markdown: string): Promise<string> {
  const file = await unified()
    .use(remarkParse)
    .use(remarkImageSize)
    .use(remarkRehype)
    .use(rehypeStringify)
    .process(markdown);
  return String(file);
}

describe('remark-image-size', () => {
  it('parses width-only with px', async () => {
    const html = await toHtml('![alt|300](image.png)');
    expect(html).toContain('width="300px"');
    expect(html).toContain('alt="alt"');
    expect(html).not.toContain('height=');
  });

  it('parses width-only with percent', async () => {
    const html = await toHtml('![alt|50%](image.png)');
    expect(html).toContain('width="50%"');
    expect(html).not.toContain('height=');
  });

  it('parses width-and-height with px', async () => {
    const html = await toHtml('![alt|300x200](image.png)');
    expect(html).toContain('width="300px"');
    expect(html).toContain('height="200px"');
  });

  it('parses width-and-height with percent', async () => {
    const html = await toHtml('![alt|50%x40%](image.png)');
    expect(html).toContain('width="50%"');
    expect(html).toContain('height="40%"');
  });

  it('strips the |SIZE suffix from alt text', async () => {
    const html = await toHtml('![My Image|300](image.png)');
    expect(html).toContain('alt="My Image"');
    expect(html).not.toContain('|300');
  });

  it('leaves images without |SIZE alone', async () => {
    const html = await toHtml('![just alt](image.png)');
    expect(html).toContain('alt="just alt"');
    expect(html).not.toContain('width=');
    expect(html).not.toContain('height=');
  });

  it('ignores non-numeric trailing data after the pipe', async () => {
    // `|notasize` does not match the SIZE_PATTERN, so the alt text stays as-is.
    const html = await toHtml('![Image|notasize](image.png)');
    expect(html).toContain('alt="Image|notasize"');
    expect(html).not.toContain('width=');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm test -- remark-image-size
```

Expected: FAIL with `Cannot find module './remark-image-size'`.

- [ ] **Step 3: Port the plugin**

Create `src/app/shared/markdown/plugins/remark-image-size.ts`:

```ts
import { visit } from 'unist-util-visit';
import type { Plugin } from 'unified';
import type { Root, Image } from 'mdast';

// Matches "alt text|SIZE" where SIZE is digits optionally followed by %, or WIDTHxHEIGHT.
const SIZE_PATTERN = /^(.*?)\|(\d+%?(?:x\d+%?)?)$/;

const remarkImageSize: Plugin<[], Root> = () => {
  return (tree: Root) => {
    visit(tree, 'image', (node: Image) => {
      if (!node.alt) return;
      const match = node.alt.match(SIZE_PATTERN);
      if (!match) return;

      const [, cleanAlt, sizeStr] = match;
      node.alt = cleanAlt.trim();

      let width: string;
      let height: string | undefined;

      if (sizeStr.includes('x')) {
        const [w, h] = sizeStr.split('x');
        width = w.includes('%') ? w : `${w}px`;
        height = h ? (h.includes('%') ? h : `${h}px`) : undefined;
      } else {
        width = sizeStr.includes('%') ? sizeStr : `${sizeStr}px`;
      }

      const existing = (node.data?.hProperties as Record<string, unknown>) ?? {};
      node.data = node.data ?? {};
      node.data.hProperties = { ...existing, width, ...(height ? { height } : {}) };
    });
  };
};

export default remarkImageSize;
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npm test -- remark-image-size
```

Expected: 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git -C BluefinWiki add frontend-angular/
git -C BluefinWiki commit -m "feat(angular): port remark-image-size plugin"
```

---

## Task 5: Unified pipeline factory

**Files:**
- Create: `BluefinWiki/frontend-angular/src/app/shared/markdown/unified-pipeline.ts`
- Create: `BluefinWiki/frontend-angular/src/app/shared/markdown/unified-pipeline.spec.ts`

A single factory function that builds a configured `unified()` processor matching the React app's plugin chain. Phase 3 consumes this from `MarkdownRenderer`. Phase 4 may add `resolveUrl`/`pageExists` callbacks for the in-app variant where wiki links resolve through `PagesService.searchPages()`.

- [ ] **Step 1: Write the failing test**

Create `src/app/shared/markdown/unified-pipeline.spec.ts`:

```ts
import { buildMarkdownPipeline } from './unified-pipeline';

describe('buildMarkdownPipeline', () => {
  it('parses plain markdown to a HAST root', () => {
    const pipeline = buildMarkdownPipeline();
    const mdast = pipeline.parse('# Hello');
    const hast = pipeline.runSync(mdast);
    expect(hast.type).toBe('root');
    const root = hast as { children: { type: string; tagName?: string }[] };
    expect(root.children[0].tagName).toBe('h1');
  });

  it('renders GFM tables (proves remark-gfm wired)', () => {
    const pipeline = buildMarkdownPipeline();
    const mdast = pipeline.parse('| a | b |\n|---|---|\n| 1 | 2 |');
    const hast = pipeline.runSync(mdast);
    const root = hast as { children: { type: string; tagName?: string }[] };
    expect(root.children.some((c) => c.tagName === 'table')).toBe(true);
  });

  it('converts soft breaks to <br> (proves remark-breaks wired)', () => {
    const pipeline = buildMarkdownPipeline();
    const mdast = pipeline.parse('line one\nline two');
    const hast = pipeline.runSync(mdast) as {
      children: { tagName?: string; children?: { tagName?: string }[] }[];
    };
    const para = hast.children.find((c) => c.tagName === 'p');
    expect(para?.children?.some((c) => c.tagName === 'br')).toBe(true);
  });

  it('marks wiki links via the plugin (proves remark-wiki-links wired)', () => {
    const pipeline = buildMarkdownPipeline();
    const mdast = pipeline.parse('See [[Home]] now.');
    const hast = pipeline.runSync(mdast) as {
      children: { tagName?: string; children?: { tagName?: string; properties?: Record<string, unknown> }[] }[];
    };
    const para = hast.children.find((c) => c.tagName === 'p');
    const link = para?.children?.find((c) => c.tagName === 'a');
    expect(link?.properties?.['dataWikiLink']).toBe('true');
  });

  it('applies image sizing via the plugin (proves remark-image-size wired)', () => {
    const pipeline = buildMarkdownPipeline();
    const mdast = pipeline.parse('![alt|123](image.png)');
    const hast = pipeline.runSync(mdast) as {
      children: { tagName?: string; children?: { tagName?: string; properties?: Record<string, unknown> }[] }[];
    };
    const para = hast.children.find((c) => c.tagName === 'p');
    const img = para?.children?.find((c) => c.tagName === 'img');
    expect(img?.properties?.['width']).toBe('123px');
  });

  it('applies syntax highlighting class to fenced code (proves rehype-highlight wired)', () => {
    const pipeline = buildMarkdownPipeline();
    const mdast = pipeline.parse('```ts\nconst x = 1;\n```');
    const hast = pipeline.runSync(mdast);
    // Stringify-walk just to assert the hljs class is somewhere in the tree.
    const json = JSON.stringify(hast);
    expect(json).toMatch(/hljs/);
  });

  it('passes options through to remark-wiki-links', () => {
    const pipeline = buildMarkdownPipeline({
      wikiLinks: { pageExists: () => false },
    });
    const mdast = pipeline.parse('[[Missing]]');
    const hast = pipeline.runSync(mdast) as {
      children: { children?: { properties?: Record<string, unknown> }[] }[];
    };
    const link = hast.children[0].children?.[0];
    expect(link?.properties?.['dataBroken']).toBe('true');
  });
});
```

(`remark-rehype` lowercases `data-*` attribute names from the plugin and exposes them on `properties` as camelCase — that's why the assertion is `dataWikiLink` / `dataBroken` here even though the plugin sets `data-wiki-link` / `data-broken`.)

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm test -- unified-pipeline
```

Expected: FAIL with `Cannot find module './unified-pipeline'`.

- [ ] **Step 3: Implement the factory**

Create `src/app/shared/markdown/unified-pipeline.ts`:

```ts
import { unified } from 'unified';
import type { Processor } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import remarkRehype from 'remark-rehype';
import rehypeHighlight from 'rehype-highlight';
import remarkWikiLinks, { type WikiLinksOptions } from './plugins/remark-wiki-links';
import remarkImageSize from './plugins/remark-image-size';

export interface MarkdownPipelineOptions {
  wikiLinks?: WikiLinksOptions;
}

/**
 * Build the unified processor used by `<wiki-markdown-renderer>`.
 *
 * The order matches the React app's `MarkdownPreview`:
 *  1. remark-parse  — markdown → mdast
 *  2. remark-gfm    — tables, task lists, strikethrough, autolinks
 *  3. remark-breaks — soft \n → <br>
 *  4. remark-wiki-links — [[Title]] / [[guid|alias]] → <a data-wiki-link>
 *  5. remark-image-size — ![alt|SIZE](url) → <img width/height>
 *  6. remark-rehype  — mdast → hast
 *  7. rehype-highlight — code-block class → hljs token spans
 *
 * The returned processor is configured for parse + runSync (sync mdast → hast).
 * Callers that need an async pipeline (e.g. with future rehype plugins that
 * require I/O) can replace `runSync` with `run`.
 */
export function buildMarkdownPipeline(
  options: MarkdownPipelineOptions = {},
): Processor {
  return unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkBreaks)
    .use(remarkWikiLinks, options.wikiLinks)
    .use(remarkImageSize)
    .use(remarkRehype, { allowDangerousHtml: false })
    .use(rehypeHighlight, { detect: true, ignoreMissing: true });
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npm test -- unified-pipeline
```

Expected: 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git -C BluefinWiki add frontend-angular/
git -C BluefinWiki commit -m "feat(angular): unified pipeline factory for markdown → HAST"
```

---

## Task 6: `WikiMermaid` component

**Files:**
- Create: `BluefinWiki/frontend-angular/src/app/shared/markdown/wiki-mermaid.ts`
- Create: `BluefinWiki/frontend-angular/src/app/shared/markdown/wiki-mermaid.spec.ts`

Renders a mermaid diagram from `chart` text input. Uses `DomSanitizer.bypassSecurityTrustHtml` to inject mermaid's rendered SVG. Safe because `mermaid.initialize({ securityLevel: 'strict' })` strips scripts and event handlers from the diagram source before rendering.

- [ ] **Step 1: Write the failing test**

Create `src/app/shared/markdown/wiki-mermaid.spec.ts`:

```ts
import { render, screen } from '@testing-library/angular';
import { WikiMermaid } from './wiki-mermaid';

jest.mock('mermaid', () => ({
  __esModule: true,
  default: {
    initialize: jest.fn(),
    render: jest.fn().mockResolvedValue({ svg: '<svg data-testid="rendered-svg"></svg>' }),
  },
}));

async function flush(): Promise<void> {
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

describe('WikiMermaid', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows the placeholder while mermaid is rendering', async () => {
    await render(WikiMermaid, { inputs: { chart: 'flowchart TD; A-->B' } });
    expect(screen.getByText(/Rendering diagram/i)).toBeInTheDocument();
  });

  it('replaces the placeholder with the rendered SVG', async () => {
    await render(WikiMermaid, { inputs: { chart: 'flowchart TD; A-->B' } });
    await flush();
    expect(await screen.findByTestId('rendered-svg')).toBeInTheDocument();
  });

  it('invokes mermaid.render with the chart input', async () => {
    const mermaid = (await import('mermaid')).default as { render: jest.Mock };
    await render(WikiMermaid, { inputs: { chart: 'graph LR; A-->B' } });
    await flush();
    expect(mermaid.render).toHaveBeenCalledWith(
      expect.stringMatching(/^mermaid-/),
      'graph LR; A-->B',
    );
  });

  it('shows an error block when mermaid.render rejects', async () => {
    const mermaid = (await import('mermaid')).default as { render: jest.Mock };
    mermaid.render.mockRejectedValueOnce(new Error('Parse error on line 3'));
    await render(WikiMermaid, { inputs: { chart: 'not a diagram' } });
    await flush();
    expect(await screen.findByText(/Mermaid error: Parse error on line 3/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm test -- wiki-mermaid
```

Expected: FAIL with `Cannot find module './wiki-mermaid'`.

- [ ] **Step 3: Implement the component**

Create `src/app/shared/markdown/wiki-mermaid.ts`:

```ts
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
    effect(
      (onCleanup) => {
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
      },
      { allowSignalWrites: true },
    );
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npm test -- wiki-mermaid
```

Expected: 4 tests pass.

- [ ] **Step 5: Lint check (no `any`, no unused imports)**

```bash
npm run lint -- --quiet
```

Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git -C BluefinWiki add frontend-angular/
git -C BluefinWiki commit -m "feat(angular): WikiMermaid renders mermaid diagrams via DomSanitizer"
```

---

## Task 7: `WikiLink` component

**Files:**
- Create: `BluefinWiki/frontend-angular/src/app/shared/markdown/wiki-link.ts`
- Create: `BluefinWiki/frontend-angular/src/app/shared/markdown/wiki-link.spec.ts`

A standalone component that renders a wiki-style link. Two visual states: `live` (normal styled link, navigates to the resolved URL) and `broken` (red with `?` suffix, click emits `brokenClick` for the parent to handle — Phase 4 will show the "create page from link" modal).

- [ ] **Step 1: Write the failing test**

Create `src/app/shared/markdown/wiki-link.spec.ts`:

```ts
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { WikiLink } from './wiki-link';

describe('WikiLink', () => {
  it('renders a live link with display text', async () => {
    await render(WikiLink, {
      inputs: { href: '/wiki/getting-started', target: 'Getting Started', broken: false, displayText: 'Getting Started' },
    });
    const link = screen.getByRole('link', { name: 'Getting Started' });
    expect(link).toHaveAttribute('href', '/wiki/getting-started');
    expect(link).not.toHaveClass('wiki-link-broken');
  });

  it('renders a broken link with the broken class and a ? marker', async () => {
    await render(WikiLink, {
      inputs: { href: '/wiki/missing', target: 'Missing', broken: true, displayText: 'Missing' },
    });
    const link = screen.getByRole('link', { name: /Missing/ });
    expect(link).toHaveClass('wiki-link-broken');
    expect(link.textContent).toContain('?');
  });

  it('emits brokenClick (and not navigate) when a broken link is clicked', async () => {
    const user = userEvent.setup();
    const events: { target: string; displayText: string }[] = [];
    const { fixture } = await render(WikiLink, {
      inputs: { href: '/wiki/missing', target: 'Missing', broken: true, displayText: 'Missing' },
    });
    fixture.componentInstance.brokenClick.subscribe((e) => events.push(e));
    await user.click(screen.getByRole('link'));
    expect(events).toEqual([{ target: 'Missing', displayText: 'Missing' }]);
  });

  it('does not emit brokenClick on a live link click', async () => {
    const user = userEvent.setup();
    let fired = false;
    const { fixture } = await render(WikiLink, {
      inputs: { href: '/wiki/home', target: 'Home', broken: false, displayText: 'Home' },
    });
    fixture.componentInstance.brokenClick.subscribe(() => { fired = true; });
    await user.click(screen.getByRole('link'));
    expect(fired).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm test -- wiki-link
```

Expected: FAIL with `Cannot find module './wiki-link'`.

- [ ] **Step 3: Implement the component**

Create `src/app/shared/markdown/wiki-link.ts`:

```ts
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
    <a
      [attr.href]="href()"
      [routerLink]="broken() ? null : href()"
      [class.wiki-link]="!broken()"
      [class.wiki-link-broken]="broken()"
      [attr.title]="broken() ? 'Page not found: ' + target() + '. Click to create.' : target()"
      (click)="onClick($event)"
    >{{ displayText() }}@if (broken()) {<span class="wiki-link-broken-marker"> ?</span>}</a>
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
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npm test -- wiki-link
```

Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git -C BluefinWiki add frontend-angular/
git -C BluefinWiki commit -m "feat(angular): WikiLink component with broken-link click event"
```

---

## Task 8: `MarkdownRenderer` HAST walker

**Files:**
- Create: `BluefinWiki/frontend-angular/src/app/shared/markdown/markdown-renderer.ts`
- Create: `BluefinWiki/frontend-angular/src/app/shared/markdown/markdown-renderer.spec.ts`

The component that ties everything together. Takes a markdown string, runs it through `buildMarkdownPipeline()`, walks the produced HAST recursively, and emits Angular templates per node type. Wiki-link HAST elements route to `<wiki-link>`; `<pre><code class="language-mermaid">` blocks route to `<wiki-mermaid>`; headings get `id="<slug>"`; everything else uses standard tags.

Because the HAST walker recurses through arbitrary tag structures, the template uses an inline `@switch` on `node.tagName` covering the common GFM-produced tags (`p`, `h1`–`h6`, `a`, `ul`, `ol`, `li`, `pre`, `code`, `blockquote`, `table`, `thead`, `tbody`, `tr`, `th`, `td`, `hr`, `img`, `br`, `strong`, `em`, `del`, `input`). Unrecognised tags fall through to a `<span>` wrapper with the children rendered recursively — sufficient for the markdown the React app produces.

- [ ] **Step 1: Write the failing test**

Create `src/app/shared/markdown/markdown-renderer.spec.ts`:

```ts
import { render, screen } from '@testing-library/angular';
import { provideRouter } from '@angular/router';
import { MarkdownRenderer } from './markdown-renderer';

async function renderMd(markdown: string): Promise<HTMLElement> {
  const result = await render(MarkdownRenderer, {
    inputs: { markdown },
    providers: [provideRouter([])],
  });
  return result.fixture.nativeElement as HTMLElement;
}

describe('MarkdownRenderer', () => {
  it('renders a paragraph', async () => {
    const el = await renderMd('Hello world.');
    expect(el.querySelector('p')?.textContent).toBe('Hello world.');
  });

  it('renders headings with slug ids', async () => {
    const el = await renderMd('# Hello World\n\n## Sub Section');
    const h1 = el.querySelector('h1');
    const h2 = el.querySelector('h2');
    expect(h1?.id).toBe('hello-world');
    expect(h2?.id).toBe('sub-section');
  });

  it('renders bullet lists', async () => {
    const el = await renderMd('- one\n- two\n- three');
    const items = el.querySelectorAll('ul li');
    expect(items).toHaveLength(3);
    expect(items[0].textContent?.trim()).toBe('one');
  });

  it('renders GFM tables (proves remark-gfm reachable)', async () => {
    const el = await renderMd('| h |\n|---|\n| c |');
    expect(el.querySelector('table th')?.textContent?.trim()).toBe('h');
    expect(el.querySelector('table td')?.textContent?.trim()).toBe('c');
  });

  it('renders inline code', async () => {
    const el = await renderMd('Use `x` here.');
    expect(el.querySelector('code')?.textContent).toBe('x');
  });

  it('renders fenced code with the hljs class (proves rehype-highlight reachable)', async () => {
    const el = await renderMd('```ts\nconst x = 1;\n```');
    const code = el.querySelector('pre code');
    expect(code?.className).toMatch(/hljs/);
  });

  it('routes [[Title]] through <wiki-link>', async () => {
    const el = await renderMd('See [[Home Page]] now.');
    expect(el.querySelector('wiki-link')).not.toBeNull();
    // The inner anchor carries the wiki-link class
    expect(el.querySelector('wiki-link a.wiki-link')).not.toBeNull();
  });

  it('routes mermaid code blocks through <wiki-mermaid>', async () => {
    const el = await renderMd('```mermaid\nflowchart TD; A-->B\n```');
    expect(el.querySelector('wiki-mermaid')).not.toBeNull();
    // The wiki-mermaid component owns the rendering; no raw <pre><code class="language-mermaid"> should leak through
    expect(el.querySelector('pre code.language-mermaid')).toBeNull();
  });

  it('renders <img> with width attribute from remark-image-size', async () => {
    const el = await renderMd('![alt|200](pic.png)');
    const img = el.querySelector('img');
    expect(img?.getAttribute('width')).toBe('200px');
    expect(img?.getAttribute('alt')).toBe('alt');
  });

  it('renders task list checkboxes', async () => {
    const el = await renderMd('- [x] done\n- [ ] todo');
    const inputs = el.querySelectorAll('input[type="checkbox"]');
    expect(inputs).toHaveLength(2);
    expect((inputs[0] as HTMLInputElement).checked).toBe(true);
    expect((inputs[1] as HTMLInputElement).checked).toBe(false);
  });

  it('updates rendered output when the markdown input changes', async () => {
    const { fixture } = await render(MarkdownRenderer, {
      inputs: { markdown: '# First' },
      providers: [provideRouter([])],
    });
    expect(screen.getByRole('heading', { name: 'First' })).toBeInTheDocument();

    fixture.componentRef.setInput('markdown', '# Second');
    fixture.detectChanges();
    expect(screen.getByRole('heading', { name: 'Second' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm test -- markdown-renderer
```

Expected: FAIL with `Cannot find module './markdown-renderer'`.

- [ ] **Step 3: Implement the renderer**

Create `src/app/shared/markdown/markdown-renderer.ts`:

```ts
import { Component, ChangeDetectionStrategy, computed, input, output } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { buildMarkdownPipeline, type MarkdownPipelineOptions } from './unified-pipeline';
import { WikiLink, type WikiBrokenLinkEvent } from './wiki-link';
import { WikiMermaid } from './wiki-mermaid';

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
  imports: [NgTemplateOutlet, WikiLink, WikiMermaid],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="wiki-markdown" data-testid="markdown-renderer">
      @for (child of children(); track $index) {
        <ng-container *ngTemplateOutlet="nodeTpl; context: { $implicit: child }"></ng-container>
      }
    </div>

    <ng-template #nodeTpl let-node>
      @switch (nodeKind(node)) {
        @case ('text') { {{ node.value }} }
        @case ('mermaid') { <wiki-mermaid [chart]="mermaidChart(node)" /> }
        @case ('wiki-link') {
          <wiki-link
            [href]="hrefOf(node)"
            [target]="wikiTargetOf(node)"
            [displayText]="textOfNode(node)"
            [broken]="brokenOf(node)"
            (brokenClick)="brokenClick.emit($event)"
          />
        }
        @case ('element') {
          @switch (elementTag(node)) {
            @case ('p') { <p>@for (c of node.children; track $index) {<ng-container *ngTemplateOutlet="nodeTpl; context: { $implicit: c }" />}</p> }
            @case ('h1') { <h1 [id]="headingId(node)">@for (c of node.children; track $index) {<ng-container *ngTemplateOutlet="nodeTpl; context: { $implicit: c }" />}</h1> }
            @case ('h2') { <h2 [id]="headingId(node)">@for (c of node.children; track $index) {<ng-container *ngTemplateOutlet="nodeTpl; context: { $implicit: c }" />}</h2> }
            @case ('h3') { <h3 [id]="headingId(node)">@for (c of node.children; track $index) {<ng-container *ngTemplateOutlet="nodeTpl; context: { $implicit: c }" />}</h3> }
            @case ('h4') { <h4 [id]="headingId(node)">@for (c of node.children; track $index) {<ng-container *ngTemplateOutlet="nodeTpl; context: { $implicit: c }" />}</h4> }
            @case ('h5') { <h5 [id]="headingId(node)">@for (c of node.children; track $index) {<ng-container *ngTemplateOutlet="nodeTpl; context: { $implicit: c }" />}</h5> }
            @case ('h6') { <h6 [id]="headingId(node)">@for (c of node.children; track $index) {<ng-container *ngTemplateOutlet="nodeTpl; context: { $implicit: c }" />}</h6> }
            @case ('ul') { <ul [class]="classOf(node)">@for (c of node.children; track $index) {<ng-container *ngTemplateOutlet="nodeTpl; context: { $implicit: c }" />}</ul> }
            @case ('ol') { <ol>@for (c of node.children; track $index) {<ng-container *ngTemplateOutlet="nodeTpl; context: { $implicit: c }" />}</ol> }
            @case ('li') { <li [class]="classOf(node)">@for (c of node.children; track $index) {<ng-container *ngTemplateOutlet="nodeTpl; context: { $implicit: c }" />}</li> }
            @case ('a') { <a [attr.href]="hrefOf(node)" target="_blank" rel="noopener noreferrer">@for (c of node.children; track $index) {<ng-container *ngTemplateOutlet="nodeTpl; context: { $implicit: c }" />}</a> }
            @case ('strong') { <strong>@for (c of node.children; track $index) {<ng-container *ngTemplateOutlet="nodeTpl; context: { $implicit: c }" />}</strong> }
            @case ('em') { <em>@for (c of node.children; track $index) {<ng-container *ngTemplateOutlet="nodeTpl; context: { $implicit: c }" />}</em> }
            @case ('del') { <del>@for (c of node.children; track $index) {<ng-container *ngTemplateOutlet="nodeTpl; context: { $implicit: c }" />}</del> }
            @case ('blockquote') { <blockquote>@for (c of node.children; track $index) {<ng-container *ngTemplateOutlet="nodeTpl; context: { $implicit: c }" />}</blockquote> }
            @case ('hr') { <hr /> }
            @case ('br') { <br /> }
            @case ('img') { <img [attr.src]="stringProp(node, 'src')" [attr.alt]="stringProp(node, 'alt')" [attr.width]="stringProp(node, 'width')" [attr.height]="stringProp(node, 'height')" /> }
            @case ('input') { <input type="checkbox" [attr.checked]="boolProp(node, 'checked') ? 'checked' : null" [disabled]="true" /> }
            @case ('pre') { <pre>@for (c of node.children; track $index) {<ng-container *ngTemplateOutlet="nodeTpl; context: { $implicit: c }" />}</pre> }
            @case ('code') { <code [class]="classOf(node)">@for (c of node.children; track $index) {<ng-container *ngTemplateOutlet="nodeTpl; context: { $implicit: c }" />}</code> }
            @case ('table') { <table>@for (c of node.children; track $index) {<ng-container *ngTemplateOutlet="nodeTpl; context: { $implicit: c }" />}</table> }
            @case ('thead') { <thead>@for (c of node.children; track $index) {<ng-container *ngTemplateOutlet="nodeTpl; context: { $implicit: c }" />}</thead> }
            @case ('tbody') { <tbody>@for (c of node.children; track $index) {<ng-container *ngTemplateOutlet="nodeTpl; context: { $implicit: c }" />}</tbody> }
            @case ('tr') { <tr>@for (c of node.children; track $index) {<ng-container *ngTemplateOutlet="nodeTpl; context: { $implicit: c }" />}</tr> }
            @case ('th') { <th>@for (c of node.children; track $index) {<ng-container *ngTemplateOutlet="nodeTpl; context: { $implicit: c }" />}</th> }
            @case ('td') { <td>@for (c of node.children; track $index) {<ng-container *ngTemplateOutlet="nodeTpl; context: { $implicit: c }" />}</td> }
            @case ('span') { <span [class]="classOf(node)">@for (c of node.children; track $index) {<ng-container *ngTemplateOutlet="nodeTpl; context: { $implicit: c }" />}</span> }
            @default { <span>@for (c of node.children; track $index) {<ng-container *ngTemplateOutlet="nodeTpl; context: { $implicit: c }" />}</span> }
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
  readonly brokenClick = output<WikiBrokenLinkEvent>();

  private readonly pipeline = computed(() => buildMarkdownPipeline(this.pipelineOptions()));

  readonly children = computed<HastNode[]>(() => {
    const md = this.markdown() ?? '';
    if (!md) return [];
    const pipeline = this.pipeline();
    const mdast = pipeline.parse(md);
    const hast = pipeline.runSync(mdast) as HastRoot;
    return hast.children ?? [];
  });

  /** Classifies a node into a switch case in the template. */
  nodeKind(node: HastNode): 'text' | 'mermaid' | 'wiki-link' | 'element' | 'skip' {
    if (node.type === 'text') return 'text';
    if (node.type !== 'element') return 'skip';
    // <pre><code class="language-mermaid">…</code></pre> — route the entire <pre>
    // through <wiki-mermaid>. Detect by inspecting the <pre>'s first <code> child.
    if (node.tagName === 'pre') {
      const codeChild = node.children.find((c): c is HastElement => c.type === 'element' && c.tagName === 'code');
      if (codeChild && isMermaidCode(codeChild)) return 'mermaid';
    }
    if (isWikiLink(node)) return 'wiki-link';
    return 'element';
  }

  elementTag(node: HastNode): string {
    return node.type === 'element' ? node.tagName : '';
  }

  mermaidChart(node: HastNode): string {
    // node is the <pre>; chart text is the textual content of its <code> child.
    if (node.type !== 'element') return '';
    const code = node.children.find((c): c is HastElement => c.type === 'element' && c.tagName === 'code');
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
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npm test -- markdown-renderer
```

Expected: 11 tests pass.

- [ ] **Step 5: Lint check**

```bash
npm run lint
```

Expected: 0 errors, 0 warnings.

- [ ] **Step 6: Commit**

```bash
git -C BluefinWiki add frontend-angular/
git -C BluefinWiki commit -m "feat(angular): MarkdownRenderer HAST walker with wiki-link + mermaid routing"
```

---

## Task 9: `WikiCodemirror` editor wrapper

**Files:**
- Create: `BluefinWiki/frontend-angular/src/app/shared/codemirror/wiki-codemirror.ts`
- Create: `BluefinWiki/frontend-angular/src/app/shared/codemirror/wiki-codemirror.spec.ts`

A minimal CodeMirror 6 wrapper for Phase 3 page-editor consumption. Exposes `value` as a `model()` signal for two-way binding and `save` as an `output()` for Ctrl/Cmd+S. Phase 4 will add toolbar dispatch and link autocomplete.

- [ ] **Step 1: Write the failing test**

Create `src/app/shared/codemirror/wiki-codemirror.spec.ts`:

```ts
import { render } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { WikiCodemirror } from './wiki-codemirror';

describe('WikiCodemirror', () => {
  it('renders an editable CodeMirror surface with the initial value', async () => {
    const { fixture } = await render(WikiCodemirror, {
      inputs: { value: 'Hello **world**' },
    });
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    const cmRoot = host.querySelector('.cm-editor');
    expect(cmRoot).not.toBeNull();
    expect(host.textContent).toContain('Hello');
  });

  it('emits valueChange when the user types', async () => {
    const user = userEvent.setup();
    const events: string[] = [];
    const { fixture } = await render(WikiCodemirror, {
      inputs: { value: 'start' },
    });
    fixture.componentInstance.valueChange.subscribe((v: string) => events.push(v));
    const editable = fixture.nativeElement.querySelector('.cm-content');
    await user.click(editable as HTMLElement);
    await user.keyboard(' x');
    expect(events.length).toBeGreaterThan(0);
    expect(events[events.length - 1]).toContain('start x');
  });

  it('replaces the doc when value() changes externally', async () => {
    const { fixture } = await render(WikiCodemirror, {
      inputs: { value: 'one' },
    });
    fixture.componentRef.setInput('value', 'two');
    fixture.detectChanges();
    await Promise.resolve();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent).toContain('two');
    expect(host.textContent).not.toContain('one');
  });

  it('emits save when Ctrl+S is pressed', async () => {
    const user = userEvent.setup();
    let saved = 0;
    const { fixture } = await render(WikiCodemirror, {
      inputs: { value: 'hello' },
    });
    fixture.componentInstance.save.subscribe(() => { saved += 1; });
    const editable = fixture.nativeElement.querySelector('.cm-content');
    await user.click(editable as HTMLElement);
    await user.keyboard('{Control>}s{/Control}');
    expect(saved).toBe(1);
  });

  it('destroys the EditorView on component destroy', async () => {
    const { fixture } = await render(WikiCodemirror, {
      inputs: { value: 'a' },
    });
    const view = fixture.componentInstance.getView();
    expect(view).not.toBeNull();
    fixture.destroy();
    // After destroy, accessing the dom should be safe — verify via a clean removal.
    expect(fixture.nativeElement.querySelector('.cm-editor')).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm test -- wiki-codemirror
```

Expected: FAIL with `Cannot find module './wiki-codemirror'`.

- [ ] **Step 3: Implement the wrapper**

Create `src/app/shared/codemirror/wiki-codemirror.ts`:

```ts
import {
  AfterViewInit,
  Component,
  ChangeDetectionStrategy,
  ElementRef,
  OnDestroy,
  effect,
  inject,
  input,
  model,
  output,
  viewChild,
} from '@angular/core';
import { EditorState, type Extension } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter } from '@codemirror/view';
import { markdown } from '@codemirror/lang-markdown';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language';

@Component({
  selector: 'wiki-codemirror',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div #host class="wiki-codemirror"></div>`,
  styles: [`
    :host { display: block; height: 100%; }
    .wiki-codemirror { height: 100%; overflow: auto; border: 1px solid #cbd5e1; border-radius: 0.375rem; background: #ffffff; }
    :host ::ng-deep .cm-editor { height: 100%; font-size: 14px; }
    :host ::ng-deep .cm-scroller { font-family: 'JetBrains Mono', 'Fira Code', Consolas, monospace; line-height: 1.6; }
    :host ::ng-deep .cm-content { padding: 16px; }
    :host ::ng-deep .cm-line { padding: 0 8px; }
    :host ::ng-deep .cm-focused { outline: none; }
  `],
})
export class WikiCodemirror implements AfterViewInit, OnDestroy {
  private readonly hostRef = viewChild.required<ElementRef<HTMLDivElement>>('host');

  readonly value = model<string>('');
  readonly editable = input<boolean>(true);
  readonly save = output<void>();

  private view: EditorView | null = null;
  private suppressEmit = false;

  ngAfterViewInit(): void {
    this.view = new EditorView({
      state: this.makeState(this.value()),
      parent: this.hostRef().nativeElement,
    });
  }

  constructor() {
    effect(() => {
      const incoming = this.value();
      const view = this.view;
      if (!view) return;
      const current = view.state.doc.toString();
      if (current === incoming) return;
      this.suppressEmit = true;
      view.dispatch({ changes: { from: 0, to: current.length, insert: incoming } });
      this.suppressEmit = false;
    });
  }

  ngOnDestroy(): void {
    this.view?.destroy();
    this.view = null;
  }

  getView(): EditorView | null {
    return this.view;
  }

  private makeState(doc: string): EditorState {
    const onSave = this.save;
    const valueModel = this.value;
    const isSuppressed = (): boolean => this.suppressEmit;
    const extensions: Extension[] = [
      lineNumbers(),
      highlightActiveLine(),
      highlightActiveLineGutter(),
      history(),
      markdown(),
      syntaxHighlighting(defaultHighlightStyle),
      keymap.of([
        ...defaultKeymap,
        ...historyKeymap,
        {
          key: 'Mod-s',
          preventDefault: true,
          run: () => {
            onSave.emit();
            return true;
          },
        },
      ]),
      EditorView.updateListener.of((u) => {
        if (!u.docChanged) return;
        if (isSuppressed()) return;
        valueModel.set(u.state.doc.toString());
      }),
      EditorView.editable.of(this.editable()),
    ];
    return EditorState.create({ doc, extensions });
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npm test -- wiki-codemirror
```

Expected: 5 tests pass.

If the `Ctrl+S` test fails on Windows because jsdom doesn't dispatch the chord through CodeMirror's keymap, fall back to dispatching a synthetic `KeyboardEvent` on the `.cm-content` element:

```ts
const editable = fixture.nativeElement.querySelector('.cm-content') as HTMLElement;
editable.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true }));
```

If neither approach fires the binding under jsdom, mark this assertion as a known gap (`xit`) and add an integration TODO comment — the binding is exercised via the dev server in Step 6 of Task 10. CodeMirror's keymap goes through `EditorView.domEventHandlers`, which jsdom can flake on.

- [ ] **Step 5: Lint check**

```bash
npm run lint
```

Expected: 0 errors, 0 warnings.

- [ ] **Step 6: Commit**

```bash
git -C BluefinWiki add frontend-angular/
git -C BluefinWiki commit -m "feat(angular): WikiCodemirror standalone CodeMirror 6 wrapper"
```

---

## Task 10: Markdown demo route + phase exit checklist

**Files:**
- Create: `BluefinWiki/frontend-angular/src/app/features/placeholder/markdown-demo-placeholder.ts`
- Modify: `BluefinWiki/frontend-angular/src/app/app.routes.ts`

A temporary `/markdown-demo` route that exercises `MarkdownRenderer` + `WikiCodemirror` end-to-end against a hand-picked sample. Lets us visually verify the renderer + editor work before Phase 3 wires them into `PagesView`. Phase 3's first task should delete the route and component.

- [ ] **Step 1: Write the demo component**

Create `src/app/features/placeholder/markdown-demo-placeholder.ts`:

```ts
import { Component, signal } from '@angular/core';
import { MarkdownRenderer } from '../../shared/markdown/markdown-renderer';
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
        <wiki-markdown-renderer [markdown]="markdown()" (brokenClick)="onBroken($event)" />
        @if (lastEvent()) { <p><strong>Last event:</strong> {{ lastEvent() }}</p> }
      </section>
    </main>
  `,
})
export class MarkdownDemoPlaceholder {
  readonly markdown = signal(SAMPLE);
  readonly lastEvent = signal<string | null>(null);

  onSave(): void {
    this.lastEvent.set(`save at ${new Date().toLocaleTimeString()}`);
  }
  onBroken(e: { target: string; displayText: string }): void {
    this.lastEvent.set(`broken link click: ${e.target} ("${e.displayText}")`);
  }
}
```

- [ ] **Step 2: Add the route**

Edit `src/app/app.routes.ts` to add a `/markdown-demo` route ahead of the wildcard route. The route is **not** behind `authGuard` so it can be hit while logged out:

```ts
// inside the routes array, after the existing /admin/* routes and before the `**` route
{
  path: 'markdown-demo',
  loadComponent: () =>
    import('./features/placeholder/markdown-demo-placeholder').then((m) => m.MarkdownDemoPlaceholder),
},
```

- [ ] **Step 3: Visual smoke test in the dev server**

```bash
npm start
```

Visit `http://localhost:5173/markdown-demo`. Verify:

- [ ] The editor shows the sample markdown and is editable.
- [ ] The right pane shows the rendered output with headings, lists, table, task list, image with `width="200px"`, syntax-highlighted code, and a mermaid diagram.
- [ ] Typing in the editor updates the renderer live.
- [ ] Ctrl+S in the editor shows "save at HH:MM:SS" in the right pane.
- [ ] Click the `[[Getting Started]]` wiki link — it's `<wiki-link>` rendering as a `routerLink`-driven anchor. (No `pageExists` callback is wired, so it renders as a live link, not broken. That's the expected Phase 2 behaviour.)
- [ ] Open DevTools Console — no errors.

Stop the server.

- [ ] **Step 4: Full local gate**

```bash
rm -rf node_modules dist
npm ci
npm run lint && npm test && npm run build
```

Expected: all green. Build time longer than Phase 1 due to mermaid + highlight.js — under ~3 minutes total is still the target.

- [ ] **Step 5: Phase 2 exit checklist**

All boxes must be true before declaring Phase 2 complete:

- [ ] `npm run lint` — 0 errors, 0 warnings.
- [ ] `npm test` — all tests pass, 0 skipped (except the documented CodeMirror Ctrl+S test if it landed as `xit`).
- [ ] `npm run build` — succeeds.
- [ ] `npm run build:prod` — succeeds with stub `NG_APP_*` env vars (same set Phase 1 used).
- [ ] The demo route at `/markdown-demo` renders correctly end-to-end as in Step 3.
- [ ] `home/.github/workflows/deploy-bluefinwiki.yml` `build-frontend-angular` job is green on the latest push.
- [ ] No new memory entries needed beyond Phase 1's; if any new surprise hit during the phase (a deprecated transitive, a CodeMirror SSR-time gotcha, a sanitizer escape worth remembering) save it to memory.

- [ ] **Step 6: Tag the phase**

```bash
git -C BluefinWiki tag phase-2-markdown
git -C BluefinWiki push origin phase-2-markdown
```

- [ ] **Step 7: Commit the demo route**

```bash
git -C BluefinWiki add frontend-angular/
git -C BluefinWiki commit -m "feat(angular): temporary /markdown-demo route exercising Phase 2 components"
```

(The demo route is deliberately a separate commit so Phase 3's first task — "delete the demo" — has a clean diff to revert.)

---

## What's next

Phase 2 leaves you with:
- A working unified pipeline factory consumable by any component that needs to render markdown.
- A `<wiki-markdown-renderer>` component that handles wiki-link routing and mermaid diagrams.
- A `<wiki-codemirror>` component ready for two-way binding into the page editor.
- All the ported plugins and the wiki-link parser, with critical-path tests.

Hand back to the writing-plans skill to draft **Phase 3: Pages MVP** — `PagesService` with `rxResource` readers + mutations, `PagesView`, `PageTree` + `PageTreeItem` + `PageRenameInline`, `PageEditor` reading/saving content using Phase 2's renderer + editor, `DraftsService`, `LayoutService`, drag-drop reparenting with `cdkDropListEnterPredicate`. The first task in that plan should delete `/markdown-demo` and its placeholder component.
