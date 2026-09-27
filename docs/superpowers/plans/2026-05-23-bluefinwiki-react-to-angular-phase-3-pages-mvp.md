# React → Angular Conversion — Phase 3: Pages MVP

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** `docs/superpowers/specs/2026-05-21-bluefinwiki-react-to-angular-design.md`
**Roadmap:** `docs/superpowers/plans/2026-05-21-bluefinwiki-react-to-angular-roadmap.md`
**Branch:** `feat/angular-rewrite` in the BluefinWiki submodule (continues from tag `phase-2-markdown`, commit `1b181a1`).
**Working directory for this phase:** `BluefinWiki/frontend-angular/`.

**Goal:** Deliver the minimum read/edit/save loop for wiki pages. A signed-in user can navigate the page tree, click a page to read its rendered markdown, click Edit to enter the CodeMirror editor, type, hit Ctrl+S, and see the change persist server-side. Drafts survive reloads and route changes via the same localStorage keys as the React app. Drag-drop in the tree reparents pages, with type-constraint rules from Phase 1/2's page types blocking invalid drops. All units shipped with co-located tests; `npm run lint`, `npm test`, and `npm run build` stay green.

**Architecture:**
- **Service layer:** `PagesService` exposes `rxResource`-backed readers (`childrenResource`, `pageResource`, `ancestorsResource`) and promise-returning mutations (`updatePage`, `movePage`, `deletePage`). `DraftsService` and `LayoutService` are signal-backed wrappers around localStorage with the same keys and JSON shape the React stores use, so existing user drafts and layout prefs survive the eventual cutover.
- **Route layer:** Replace the static `pages-placeholder` with a child route module. `/pages` shows the tree with an empty-state main pane; `/pages/:guid` shows the tree + rendered markdown via Phase 2's `<wiki-markdown-renderer>`; `/pages/:guid/edit` shows the tree + `<wiki-codemirror>` editor with a save bar. Edit and view are separate routes so `<wiki-codemirror>` is mounted fresh each time (avoids the Phase 4 carry-forward about reconfiguring the `editable` extension).
- **Tree layer:** `PageTree` owns the root-level `cdkDropListGroup` and the root drop zone; `PageTreeItem` is recursive, lazy-fetches its children via `pagesService.childrenResource(this.guid)` when expanded, and is both a `cdkDrag` (so it can be dragged) and a `cdkDropList` accepting drops onto itself (so it can become a new parent). `cdkDropListEnterPredicate` runs `checkTypeConstraints` (ported verbatim from React) to reject drops that violate the parent/child type rules.
- **Editor layer:** `PageEditor` (the edit route component) binds `<wiki-codemirror [(value)]>` to a local signal `content`, observes the `pageResource` for the initial server value, runs a debounced effect that persists `{ content, metadata }` to `DraftsService` every 400ms, and exposes a `save()` method that calls `pagesService.updatePage`. On success it clears the draft and reloads the resource; on failure it surfaces an inline error and keeps the draft. `Ctrl+S` is wired by binding `(save)` of `<wiki-codemirror>` to the same method.

**Tech stack additions:**
- `@angular/cdk/drag-drop` (already installed via `@angular/cdk@21`)
- No new npm dependencies.

**Spec → plan adjustments locked in here:**
- The roadmap lists `pages-view.component.ts`, `page-editor.component.ts`, etc. Phase 1 dropped the `.component` suffix (`auth.ts`, `permission.ts`, `oauth-callback.ts`); Phase 2 followed (`markdown-renderer.ts`, `wiki-link.ts`). Phase 3 matches: `pages-view.ts`, `page-editor.ts`, `page-tree.ts`, `page-tree-item.ts`, `page-rename-inline.ts`, `pages.ts` (the service), `drafts.ts`, `layout.ts`. Selectors keep the `wiki-` prefix.
- The roadmap places `NewPageModal` in Phase 4. Phase 3 ships without page-creation UI — the user can only view/edit pages that already exist. The "New page" button in `PagesView` is rendered but disabled with a "(Phase 4)" tooltip; clicking it is a no-op. This keeps the visual shell consistent so Phase 4 only fills in the modal wiring.
- The roadmap places `PageContextMenu` in Phase 4. Right-click on a tree item is a Phase 4 affordance. Phase 3 supports rename via double-click on a tree item (opens `PageRenameInline` in an overlay) and delete via a delete button visible on hover. Move-by-context-menu is also Phase 4 — Phase 3 only supports move via drag-drop reparent.
- The roadmap places `ResizeDivider`, `InspectorPanel`, attachments, link autocomplete, board view, backlinks, and breadcrumbs in Phase 4. Phase 3 hard-codes the sidebar width at `LayoutService.treeWidth()` with no draggable divider — when the divider lands in Phase 4 it consumes the existing preference.
- Drag-drop in Phase 3 supports **reparent only** (drop onto a target row → that row becomes the new parent; drop into the root zone → page becomes a root page). **Reordering** siblings (the React app's before/after positions) is Phase 4. The reorder API exists in `PagesService` and is tested in isolation, but the tree UI does not invoke it yet.
- Boundary with Phase 4 carry-forward: `<wiki-codemirror>`'s `editable` input is read once at init. Phase 3 sidesteps this by giving view and edit their own routes (each instantiation is fresh). Phase 4 will add the in-place toggle and the `EditorView.editable.reconfigure` effect.
- **Local-only execution rule (per `feedback_bluefinwiki_angular_local_only`):** This phase ships with **no** `git push`, **no** tag push, **no** `deploy-infra` runs, and **no** dependency on the home-repo CI build job. Local verification is the gate. Commits are still made.

---

## Task 1: Delete the Phase 2 `/markdown-demo` route and placeholder

**Files:**
- Delete: `BluefinWiki/frontend-angular/src/app/features/placeholder/markdown-demo-placeholder.ts`
- Modify: `BluefinWiki/frontend-angular/src/app/app.routes.ts`

The Phase 2 demo route was deliberately committed in isolation so deletion here is a clean diff.

- [ ] **Step 1: Delete the placeholder component file**

```bash
rm BluefinWiki/frontend-angular/src/app/features/placeholder/markdown-demo-placeholder.ts
```

- [ ] **Step 2: Remove the route**

Edit `BluefinWiki/frontend-angular/src/app/app.routes.ts` and delete this block:

```ts
  {
    path: 'markdown-demo',
    loadComponent: () =>
      import('./features/placeholder/markdown-demo-placeholder').then((m) => m.MarkdownDemoPlaceholder),
  },
```

- [ ] **Step 3: Verify build + lint + test stay green**

From `BluefinWiki/frontend-angular/`:

```bash
npm run lint && npm test && npm run build
```

Expected: all pass. The build no longer emits a `markdown-demo` lazy chunk.

- [ ] **Step 4: Commit**

```bash
git -C BluefinWiki add frontend-angular/
git -C BluefinWiki commit -m "chore(angular): remove Phase 2 /markdown-demo route"
```

---

## Task 2: Port `page.types.ts`

**Files:**
- Create: `BluefinWiki/frontend-angular/src/app/features/pages/page.types.ts`

The React file at `BluefinWiki/frontend/src/types/page.ts` is pure TypeScript — it ports byte-for-byte. Co-locate with the pages feature because Phase 3+ services and components are its only consumers. Phase 6's page-types admin will reuse it as-is.

- [ ] **Step 1: Create the type file**

Create `src/app/features/pages/page.types.ts` with the full content of `BluefinWiki/frontend/src/types/page.ts` (lines 1–120). Verbatim — same exports, same field ordering, same comments. The file has no React-specific code.

For reference, the exports the rest of Phase 3 depends on:

```ts
export type PropertyType = 'string' | 'number' | 'date' | 'tags';

export interface PageTypeProperty { /* ... */ }
export interface PageTypeDefinition { /* ... */ }
export interface PageProperty { type: PropertyType; value: string | number | string[]; }

export interface PageContent { /* full content + metadata */ }
export interface PageSummary { /* tree-node shape */ }
export interface PageTreeNode extends PageSummary { children?: PageTreeNode[]; isExpanded?: boolean; }
export interface PageChildDetail extends PageSummary { pageType?: string; properties?: Record<string, PageProperty>; parentTitle?: string; }

export interface BoardConfig { /* ... */ }

export interface CreatePageRequest { /* ... */ }
export interface UpdatePageRequest { /* ... */ }
export interface MovePageRequest { newParentGuid: string | null; }
export interface ReorderRequest { parentGuid: string | null; orderedGuids: string[]; }
export interface DeletePageRequest { recursive?: boolean; }
```

- [ ] **Step 2: Verify it compiles**

```bash
npm run build
```

Expected: succeeds. No new code consumes these types yet so the build only validates the file itself.

- [ ] **Step 3: Lint**

```bash
npm run lint
```

Expected: 0 errors, 0 warnings.

- [ ] **Step 4: Commit**

```bash
git -C BluefinWiki add frontend-angular/
git -C BluefinWiki commit -m "feat(angular): port page.types for Phase 3 pages feature"
```

---

## Task 3: `DraftsService`

**Files:**
- Create: `BluefinWiki/frontend-angular/src/app/features/pages/drafts.ts`
- Create: `BluefinWiki/frontend-angular/src/app/features/pages/drafts.spec.ts`

Port `BluefinWiki/frontend/src/stores/draftsStore.ts` to an Angular `@Injectable({ providedIn: 'root' })` service. Same `bluefinwiki:draft:` localStorage prefix, same in-memory Map cache, same `PageDraft = { content, metadata }` shape. Existing drafts in users' browsers continue to round-trip after the eventual cutover.

The `PageMetadata` type currently lives inside `components/editor/PagePropertiesPanel.tsx` in the React app — Phase 4 will port it as part of the panel. For Phase 3 we declare a minimal subset inline (the fields Phase 3 actually reads/writes); Phase 4 will widen it to match the React shape.

- [ ] **Step 1: Write the failing test**

Create `src/app/features/pages/drafts.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { Drafts, type PageDraft } from './drafts';

describe('Drafts service', () => {
  let drafts: Drafts;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [Drafts] });
    drafts = TestBed.inject(Drafts);
  });

  function makeDraft(content: string, title = 'Title'): PageDraft {
    return {
      content,
      metadata: {
        title,
        tags: [],
        status: 'draft',
        createdBy: 'u',
        modifiedBy: 'u',
        createdAt: '2026-01-01T00:00:00Z',
        modifiedAt: '2026-01-01T00:00:00Z',
        guid: 'g',
      },
    };
  }

  it('returns undefined for unknown guid', () => {
    expect(drafts.get('missing')).toBeUndefined();
  });

  it('round-trips a draft via localStorage', () => {
    drafts.set('g1', makeDraft('hello'));
    // Force a re-read by spinning up a new instance with a clean memory cache.
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [Drafts] });
    const fresh = TestBed.inject(Drafts);
    expect(fresh.get('g1')?.content).toBe('hello');
  });

  it('serves repeat reads from the memory cache', () => {
    drafts.set('g2', makeDraft('cached'));
    const spy = jest.spyOn(Storage.prototype, 'getItem');
    expect(drafts.get('g2')?.content).toBe('cached');
    expect(spy).not.toHaveBeenCalledWith('bluefinwiki:draft:g2');
    spy.mockRestore();
  });

  it('clear() removes both the memory entry and the localStorage row', () => {
    drafts.set('g3', makeDraft('bye'));
    drafts.clear('g3');
    expect(drafts.get('g3')).toBeUndefined();
    expect(localStorage.getItem('bluefinwiki:draft:g3')).toBeNull();
  });

  it('hasDraft() reports true only after a set', () => {
    expect(drafts.hasDraft('g4')).toBe(false);
    drafts.set('g4', makeDraft('x'));
    expect(drafts.hasDraft('g4')).toBe(true);
    drafts.clear('g4');
    expect(drafts.hasDraft('g4')).toBe(false);
  });

  it('survives a malformed JSON entry without throwing', () => {
    localStorage.setItem('bluefinwiki:draft:g5', '{not json');
    expect(() => drafts.get('g5')).not.toThrow();
    expect(drafts.get('g5')).toBeUndefined();
  });

  it('isolates keys per guid', () => {
    drafts.set('a', makeDraft('A', 'Title A'));
    drafts.set('b', makeDraft('B', 'Title B'));
    expect(drafts.get('a')?.content).toBe('A');
    expect(drafts.get('b')?.content).toBe('B');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
npm test -- drafts
```

Expected: FAIL with `Cannot find module './drafts'`.

- [ ] **Step 3: Implement the service**

Create `src/app/features/pages/drafts.ts`:

```ts
import { Injectable } from '@angular/core';

/**
 * Minimal Phase 3 metadata shape. Phase 4 will widen this to include
 * pageType + custom properties + boardConfig as the inspector panel lands.
 * The fields here match what the React `PageMetadata` interface uses for
 * the save flow, so the localStorage JSON shape is unchanged.
 */
export interface PageMetadata {
  title: string;
  tags: string[];
  status: 'draft' | 'published' | 'archived';
  pageType?: string;
  properties?: Record<string, unknown>;
  createdBy: string;
  modifiedBy: string;
  createdAt: string;
  modifiedAt: string;
  guid: string;
}

export interface PageDraft {
  content: string;
  metadata: PageMetadata;
}

const STORAGE_PREFIX = 'bluefinwiki:draft:';

function storageKey(guid: string): string {
  return `${STORAGE_PREFIX}${guid}`;
}

@Injectable({ providedIn: 'root' })
export class Drafts {
  private readonly memory = new Map<string, PageDraft>();

  get(guid: string): PageDraft | undefined {
    if (this.memory.has(guid)) return this.memory.get(guid);
    try {
      const raw = localStorage.getItem(storageKey(guid));
      if (!raw) return undefined;
      const draft = JSON.parse(raw) as PageDraft;
      this.memory.set(guid, draft);
      return draft;
    } catch {
      return undefined;
    }
  }

  set(guid: string, draft: PageDraft): void {
    this.memory.set(guid, draft);
    try {
      localStorage.setItem(storageKey(guid), JSON.stringify(draft));
    } catch {
      // Quota exhausted or storage disabled — memory cache still active.
    }
  }

  clear(guid: string): void {
    this.memory.delete(guid);
    try {
      localStorage.removeItem(storageKey(guid));
    } catch {
      // ignore
    }
  }

  hasDraft(guid: string): boolean {
    return this.get(guid) !== undefined;
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npm test -- drafts
```

Expected: 7 tests pass.

- [ ] **Step 5: Lint**

```bash
npm run lint
```

Expected: 0 errors, 0 warnings.

- [ ] **Step 6: Commit**

```bash
git -C BluefinWiki add frontend-angular/
git -C BluefinWiki commit -m "feat(angular): port DraftsService with same localStorage shape"
```

---

## Task 4: `LayoutService`

**Files:**
- Create: `BluefinWiki/frontend-angular/src/app/core/layout/layout.ts`
- Create: `BluefinWiki/frontend-angular/src/app/core/layout/layout.spec.ts`

Port `BluefinWiki/frontend/src/stores/layoutStore.ts` to an Angular service. Expose preferences as a readonly `LayoutPreferences` signal plus an `update()` method. An `effect()` persists changes to `localStorage` under the same `bluefinwiki-layout` key. Existing user prefs survive the cutover.

- [ ] **Step 1: Write the failing test**

Create `src/app/core/layout/layout.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { Layout } from './layout';

describe('Layout service', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [Layout] });
  });

  it('returns defaults on first load', () => {
    const layout = TestBed.inject(Layout);
    const prefs = layout.preferences();
    expect(prefs).toEqual({
      treeWidth: 320,
      inspectorWidth: 320,
      inspectorVisible: false,
      editorSplitPosition: 50,
    });
  });

  it('merges stored partial values over defaults', () => {
    localStorage.setItem(
      'bluefinwiki-layout',
      JSON.stringify({ treeWidth: 250 }),
    );
    const layout = TestBed.inject(Layout);
    expect(layout.preferences().treeWidth).toBe(250);
    expect(layout.preferences().inspectorWidth).toBe(320);
  });

  it('survives malformed stored JSON without throwing', () => {
    localStorage.setItem('bluefinwiki-layout', '{not json');
    const layout = TestBed.inject(Layout);
    expect(layout.preferences().treeWidth).toBe(320);
  });

  it('update() patches the signal and writes to localStorage', async () => {
    const layout = TestBed.inject(Layout);
    layout.update({ treeWidth: 400 });
    await Promise.resolve();
    expect(layout.preferences().treeWidth).toBe(400);
    const stored = JSON.parse(localStorage.getItem('bluefinwiki-layout') ?? '{}');
    expect(stored.treeWidth).toBe(400);
  });

  it('update() preserves un-touched fields', async () => {
    const layout = TestBed.inject(Layout);
    layout.update({ inspectorVisible: true });
    await Promise.resolve();
    expect(layout.preferences().inspectorVisible).toBe(true);
    expect(layout.preferences().treeWidth).toBe(320);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm test -- layout
```

Expected: FAIL with `Cannot find module './layout'`.

- [ ] **Step 3: Implement the service**

Create `src/app/core/layout/layout.ts`:

```ts
import { Injectable, computed, effect, signal } from '@angular/core';

export interface LayoutPreferences {
  treeWidth: number;
  inspectorWidth: number;
  inspectorVisible: boolean;
  editorSplitPosition: number;
}

const STORAGE_KEY = 'bluefinwiki-layout';

const DEFAULTS: LayoutPreferences = {
  treeWidth: 320,
  inspectorWidth: 320,
  inspectorVisible: false,
  editorSplitPosition: 50,
};

function readStored(): LayoutPreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<LayoutPreferences>;
    return { ...DEFAULTS, ...parsed };
  } catch {
    return { ...DEFAULTS };
  }
}

@Injectable({ providedIn: 'root' })
export class Layout {
  private readonly _prefs = signal<LayoutPreferences>(readStored());

  readonly preferences = this._prefs.asReadonly();
  readonly treeWidth = computed(() => this._prefs().treeWidth);
  readonly inspectorWidth = computed(() => this._prefs().inspectorWidth);
  readonly inspectorVisible = computed(() => this._prefs().inspectorVisible);
  readonly editorSplitPosition = computed(() => this._prefs().editorSplitPosition);

  constructor() {
    effect(() => {
      const prefs = this._prefs();
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
      } catch {
        // storage unavailable — keep signal value in memory only
      }
    });
  }

  update(changes: Partial<LayoutPreferences>): void {
    this._prefs.update((prev) => ({ ...prev, ...changes }));
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npm test -- layout
```

Expected: 5 tests pass.

- [ ] **Step 5: Lint**

```bash
npm run lint
```

Expected: 0 errors, 0 warnings.

- [ ] **Step 6: Commit**

```bash
git -C BluefinWiki add frontend-angular/
git -C BluefinWiki commit -m "feat(angular): port LayoutService with signal-backed prefs"
```

---

## Task 5: `PagesService`

**Files:**
- Create: `BluefinWiki/frontend-angular/src/app/features/pages/pages.ts`
- Create: `BluefinWiki/frontend-angular/src/app/features/pages/pages.spec.ts`

Single `@Injectable({ providedIn: 'root' })` service that owns all `/api/pages/**` traffic. Exposes:

- **Readers** as `rxResource` factories that take a `Signal<T>` for the request and return a `ResourceRef`. Naming `*Resource` to make the resource-shape obvious at call sites.
- **Mutations** as promise-returning methods that wrap `firstValueFrom(this.http.put/post/delete(...))`.
- A `bumpVersion()` method + private `_version` signal that resources can subscribe to as a refetch trigger. The page-tree consumes this after `movePage` / `updatePage` / `deletePage` so siblings refetch.

Reader endpoints to port (all under `/api`):

| Method | Endpoint | Returns | Purpose |
|---|---|---|---|
| GET | `/pages/root/children` | `{ children: PageSummary[] }` | Root-level pages |
| GET | `/pages/:guid/children` | `{ children: PageSummary[] }` | Children of a page |
| GET | `/pages/:guid` | `PageContent` | A single page |
| GET | `/pages/:guid/ancestors` | `{ ancestors: PageSummary[] }` | For Phase 4 breadcrumbs (port the reader now, defer the breadcrumb UI) |

Mutation endpoints to port:

| Method | Endpoint | Body | Returns |
|---|---|---|---|
| PUT | `/pages/:guid` | `UpdatePageRequest` | `PageContent` |
| PUT | `/pages/:guid/move` | `MovePageRequest` | void |
| PUT | `/pages/reorder` | `ReorderRequest` | `{ updated: number }` (port for Phase 4) |
| DELETE | `/pages/:guid` | `DeletePageRequest` | void |

Both the existing `auth-interceptor` and `error-interceptor` handle `/api/**` URLs transparently — no work required here.

- [ ] **Step 1: Write the failing test**

Create `src/app/features/pages/pages.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { firstValueFrom, of } from 'rxjs';
import { Pages } from './pages';
import type { PageContent, PageSummary } from './page.types';

function summary(over: Partial<PageSummary> = {}): PageSummary {
  return {
    guid: 'g',
    title: 'T',
    parentGuid: null,
    status: 'published',
    modifiedAt: '2026-01-01T00:00:00Z',
    modifiedBy: 'u',
    hasChildren: false,
    ...over,
  };
}

function pageContent(over: Partial<PageContent> = {}): PageContent {
  return {
    guid: 'g',
    title: 'T',
    content: '# T',
    folderId: 'f',
    tags: [],
    status: 'published',
    createdBy: 'u',
    modifiedBy: 'u',
    createdAt: '2026-01-01T00:00:00Z',
    modifiedAt: '2026-01-01T00:00:00Z',
    ...over,
  };
}

async function settle(): Promise<void> {
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

describe('Pages service', () => {
  let http: HttpTestingController;
  let pages: Pages;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), Pages],
    });
    http = TestBed.inject(HttpTestingController);
    pages = TestBed.inject(Pages);
  });

  afterEach(() => http.verify());

  describe('childrenResource', () => {
    it('GETs /api/pages/root/children when parent is null', async () => {
      const parent = signal<string | null>(null);
      const resource = TestBed.runInInjectionContext(() => pages.childrenResource(parent));

      await settle();
      const req = http.expectOne('/api/pages/root/children');
      expect(req.request.method).toBe('GET');
      req.flush({ children: [summary({ guid: 'r1' })] });

      await settle();
      expect(resource.value()?.[0].guid).toBe('r1');
    });

    it('GETs /api/pages/{guid}/children when parent is set', async () => {
      const parent = signal<string | null>('parent-guid');
      TestBed.runInInjectionContext(() => pages.childrenResource(parent));

      await settle();
      http.expectOne('/api/pages/parent-guid/children').flush({ children: [] });
    });

    it('reruns the loader when parent signal changes', async () => {
      const parent = signal<string | null>('a');
      const resource = TestBed.runInInjectionContext(() => pages.childrenResource(parent));

      await settle();
      http.expectOne('/api/pages/a/children').flush({ children: [summary({ guid: 'aa' })] });
      await settle();

      parent.set('b');
      await settle();
      http.expectOne('/api/pages/b/children').flush({ children: [summary({ guid: 'bb' })] });
      await settle();

      expect(resource.value()?.[0].guid).toBe('bb');
    });

    it('reruns after bumpVersion()', async () => {
      const parent = signal<string | null>(null);
      const resource = TestBed.runInInjectionContext(() => pages.childrenResource(parent));

      await settle();
      http.expectOne('/api/pages/root/children').flush({ children: [summary({ guid: 'v1' })] });
      await settle();

      pages.bumpVersion();
      await settle();
      http.expectOne('/api/pages/root/children').flush({ children: [summary({ guid: 'v2' })] });
      await settle();

      expect(resource.value()?.[0].guid).toBe('v2');
    });
  });

  describe('pageResource', () => {
    it('GETs /api/pages/{guid}', async () => {
      const guid = signal<string | null>('p1');
      const resource = TestBed.runInInjectionContext(() => pages.pageResource(guid));
      await settle();
      http.expectOne('/api/pages/p1').flush(pageContent({ guid: 'p1', title: 'Hello' }));
      await settle();
      expect(resource.value()?.title).toBe('Hello');
    });

    it('does not fetch when guid is null', async () => {
      const guid = signal<string | null>(null);
      TestBed.runInInjectionContext(() => pages.pageResource(guid));
      await settle();
      http.expectNone(() => true);
    });
  });

  describe('mutations', () => {
    it('updatePage PUTs /api/pages/{guid} and returns the response', async () => {
      const promise = pages.updatePage('g1', { title: 'New' });
      const req = http.expectOne('/api/pages/g1');
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({ title: 'New' });
      req.flush(pageContent({ guid: 'g1', title: 'New' }));
      const result = await promise;
      expect(result.title).toBe('New');
    });

    it('movePage PUTs /api/pages/{guid}/move', async () => {
      const promise = pages.movePage('g1', { newParentGuid: 'parent-2' });
      const req = http.expectOne('/api/pages/g1/move');
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({ newParentGuid: 'parent-2' });
      req.flush(null);
      await promise;
    });

    it('movePage bumps version on success', async () => {
      const parent = signal<string | null>(null);
      const resource = TestBed.runInInjectionContext(() => pages.childrenResource(parent));
      await settle();
      http.expectOne('/api/pages/root/children').flush({ children: [] });
      await settle();

      const promise = pages.movePage('g1', { newParentGuid: null });
      http.expectOne('/api/pages/g1/move').flush(null);
      await promise;
      await settle();

      // The resource should have refetched.
      http.expectOne('/api/pages/root/children').flush({ children: [summary({ guid: 'after-move' })] });
      await settle();
      expect(resource.value()?.[0].guid).toBe('after-move');
    });

    it('deletePage sends DELETE with body', async () => {
      const promise = pages.deletePage('g1', { recursive: true });
      const req = http.expectOne('/api/pages/g1');
      expect(req.request.method).toBe('DELETE');
      expect(req.request.body).toEqual({ recursive: true });
      req.flush(null);
      await promise;
    });

    it('reorderPages PUTs /api/pages/reorder', async () => {
      const promise = pages.reorderPages({ parentGuid: null, orderedGuids: ['a', 'b'] });
      const req = http.expectOne('/api/pages/reorder');
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({ parentGuid: null, orderedGuids: ['a', 'b'] });
      req.flush({ updated: 2 });
      await expect(promise).resolves.toEqual({ updated: 2 });
    });
  });

  describe('rejects-of-rxjs sanity', () => {
    // Sanity check that we aren't accidentally consuming the rxjs symbol export
    it('importable smoke', () => {
      void firstValueFrom(of(1));
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm test -- pages.spec
```

Expected: FAIL with `Cannot find module './pages'`.

- [ ] **Step 3: Implement the service**

Create `src/app/features/pages/pages.ts`:

```ts
import { HttpClient } from '@angular/common/http';
import { Injectable, type Signal, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { firstValueFrom, map } from 'rxjs';
import type {
  PageContent,
  PageSummary,
  UpdatePageRequest,
  MovePageRequest,
  ReorderRequest,
  DeletePageRequest,
} from './page.types';

interface ChildrenResponse { children: PageSummary[] }
interface AncestorsResponse { ancestors: PageSummary[] }

@Injectable({ providedIn: 'root' })
export class Pages {
  private readonly http = inject(HttpClient);
  private readonly _version = signal(0);

  bumpVersion(): void {
    this._version.update((v) => v + 1);
  }

  /**
   * Reactive children resource. `parentGuid` is a signal so consumers can
   * switch the request without recreating the resource. Pass `null` for the
   * root level (the React app's `/pages/root/children` endpoint).
   *
   * The resource also depends on `_version` so any successful mutation that
   * calls `bumpVersion()` triggers a refetch.
   */
  childrenResource(parentGuid: Signal<string | null>) {
    return rxResource({
      params: () => ({ parentGuid: parentGuid(), v: this._version() }),
      stream: ({ params }) => {
        const path = params.parentGuid
          ? `/api/pages/${params.parentGuid}/children`
          : '/api/pages/root/children';
        return this.http
          .get<ChildrenResponse>(path)
          .pipe(map((r) => r.children ?? []));
      },
    });
  }

  /**
   * Reactive page-content resource. Pass `null` to disable the fetch (the
   * resource value stays undefined). Bumps when `_version` bumps.
   */
  pageResource(guid: Signal<string | null>) {
    return rxResource({
      params: () => ({ guid: guid(), v: this._version() }),
      stream: ({ params }) => {
        if (!params.guid) {
          // Caller passed null — no request. Returning the existing value
          // would re-emit; instead emit a never-resolving stream by throwing.
          // Simpler: gate at the consumer with `@if (guid())` so this is unreachable.
          throw new Error('pageResource called with null guid');
        }
        return this.http.get<PageContent>(`/api/pages/${params.guid}`);
      },
    });
  }

  ancestorsResource(guid: Signal<string | null>) {
    return rxResource({
      params: () => ({ guid: guid(), v: this._version() }),
      stream: ({ params }) => {
        if (!params.guid) throw new Error('ancestorsResource called with null guid');
        return this.http
          .get<AncestorsResponse>(`/api/pages/${params.guid}/ancestors`)
          .pipe(map((r) => r.ancestors ?? []));
      },
    });
  }

  // ---- mutations ----

  async updatePage(guid: string, body: UpdatePageRequest): Promise<PageContent> {
    const result = await firstValueFrom(this.http.put<PageContent>(`/api/pages/${guid}`, body));
    this.bumpVersion();
    return result;
  }

  async movePage(guid: string, body: MovePageRequest): Promise<void> {
    await firstValueFrom(this.http.put<void>(`/api/pages/${guid}/move`, body));
    this.bumpVersion();
  }

  async reorderPages(body: ReorderRequest): Promise<{ updated: number }> {
    const result = await firstValueFrom(
      this.http.put<{ updated: number }>('/api/pages/reorder', body),
    );
    this.bumpVersion();
    return result;
  }

  async deletePage(guid: string, body: DeletePageRequest = {}): Promise<void> {
    await firstValueFrom(this.http.delete<void>(`/api/pages/${guid}`, { body }));
    this.bumpVersion();
  }
}
```

Note: the `pageResource`/`ancestorsResource` throw-on-null pattern is fine because consumers gate with `@if (guid())` in the template. The thrown error never reaches the resource's `error()` signal because it happens inside the `params` reactive function — Angular treats it as "skip this run". If a future caller needs a different gating strategy, switch to a `defaultValue: undefined` pattern.

- [ ] **Step 4: Run the test to verify it passes**

```bash
npm test -- pages.spec
```

Expected: all `Pages service` tests pass (≥ 12).

- [ ] **Step 5: Lint**

```bash
npm run lint
```

Expected: 0 errors, 0 warnings.

- [ ] **Step 6: Commit**

```bash
git -C BluefinWiki add frontend-angular/
git -C BluefinWiki commit -m "feat(angular): PagesService with rxResource readers and mutations"
```

---

## Task 6: `pages.routes.ts` child routing

**Files:**
- Create: `BluefinWiki/frontend-angular/src/app/features/pages/pages.routes.ts`
- Modify: `BluefinWiki/frontend-angular/src/app/app.routes.ts`
- Delete: `BluefinWiki/frontend-angular/src/app/features/placeholder/pages-placeholder.ts`
- Delete: `BluefinWiki/frontend-angular/src/app/features/placeholder/page-editor-placeholder.ts`

The shell layout (`PagesView` — sidebar + tree + outlet) is shared across all three sub-routes. Use a parent route with `loadComponent: PagesView` and three children: empty, view, and edit. Each child's component is the one that fills the right-hand outlet.

For Task 6 we wire the routes and create thin placeholder components (`PageEmpty`, `PageView`, `PageEdit`). Tasks 7–11 replace each with the real implementation.

- [ ] **Step 1: Create `pages.routes.ts`**

Create `src/app/features/pages/pages.routes.ts`:

```ts
import type { Routes } from '@angular/router';

export const PAGES_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages-view').then((m) => m.PagesView),
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () => import('./page-empty').then((m) => m.PageEmpty),
      },
      {
        path: ':guid/edit',
        loadComponent: () => import('./page-edit').then((m) => m.PageEdit),
      },
      {
        path: ':guid',
        loadComponent: () => import('./page-view').then((m) => m.PageView),
      },
    ],
  },
];
```

- [ ] **Step 2: Create thin placeholders**

Create `src/app/features/pages/pages-view.ts` (will be replaced in Task 7):

```ts
import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'wiki-pages-view',
  standalone: true,
  imports: [RouterOutlet],
  template: `
    <div style="display:flex; height:100vh;">
      <aside style="width:320px; border-right:1px solid #ccc; padding:1rem;">
        <strong>Pages (tree placeholder)</strong>
      </aside>
      <main style="flex:1; overflow:auto;">
        <router-outlet></router-outlet>
      </main>
    </div>
  `,
})
export class PagesView {}
```

Create `src/app/features/pages/page-empty.ts`:

```ts
import { Component } from '@angular/core';

@Component({
  selector: 'wiki-page-empty',
  standalone: true,
  template: `<div style="padding:2rem; color:#666;">Select a page to begin.</div>`,
})
export class PageEmpty {}
```

Create `src/app/features/pages/page-view.ts` (will be replaced in Task 10):

```ts
import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';

@Component({
  selector: 'wiki-page-view',
  standalone: true,
  template: `<div style="padding:2rem;">View placeholder for {{ guid() ?? '(none)' }}</div>`,
})
export class PageView {
  private route = inject(ActivatedRoute);
  guid = toSignal(this.route.paramMap.pipe(/* eslint-disable-next-line @typescript-eslint/no-unused-vars */) /* map below */);
  constructor() {
    // Phase 3 Task 10 implements this; placeholder is intentionally minimal.
  }
}
```

(Lint may flag the unused import — keep it minimal: drop `toSignal` if eslint complains. The full implementation in Task 10 will reintroduce it cleanly.)

Simpler placeholder if the above lints noisy — use this instead:

```ts
import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'wiki-page-view',
  standalone: true,
  template: `<div style="padding:2rem;">View placeholder</div>`,
})
export class PageView {
  protected route = inject(ActivatedRoute);
}
```

Create `src/app/features/pages/page-edit.ts` (will be replaced in Task 11):

```ts
import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'wiki-page-edit',
  standalone: true,
  template: `<div style="padding:2rem;">Edit placeholder</div>`,
})
export class PageEdit {
  protected route = inject(ActivatedRoute);
}
```

- [ ] **Step 3: Replace the placeholder routes in `app.routes.ts`**

Edit `src/app/app.routes.ts`. Replace the three `pages*` route entries with a single delegating entry:

```ts
  {
    path: 'pages',
    canActivate: [authGuard],
    loadChildren: () => import('./features/pages/pages.routes').then((m) => m.PAGES_ROUTES),
  },
```

Drop the three existing `pages*` lines and the imports they reference.

- [ ] **Step 4: Delete the now-unreferenced placeholders**

```bash
rm BluefinWiki/frontend-angular/src/app/features/placeholder/pages-placeholder.ts
rm BluefinWiki/frontend-angular/src/app/features/placeholder/page-editor-placeholder.ts
```

- [ ] **Step 5: Run lint, test, build**

```bash
npm run lint && npm test && npm run build
```

Expected: lint clean, all existing tests pass, build succeeds. Phase 3 has no new tests yet at this task.

- [ ] **Step 6: Commit**

```bash
git -C BluefinWiki add frontend-angular/
git -C BluefinWiki commit -m "feat(angular): /pages child routing with empty/view/edit children"
```

---

## Task 7: `PageTreeItem` recursive row component

**Files:**
- Create: `BluefinWiki/frontend-angular/src/app/features/pages/page-tree-item.ts`
- Create: `BluefinWiki/frontend-angular/src/app/features/pages/page-tree-item.spec.ts`

Recursive component that renders one row of the tree. When expanded, it consumes `pagesService.childrenResource(this.guid)` to fetch children and recurses. The item is `cdkDrag` so it can be dragged. The item is **also** a `cdkDropList` so other items can be dropped onto it; the drop list accepts only single drops and uses `cdkDropListEnterPredicate` to enforce type rules (Task 8 wires the predicate — Task 7 leaves the predicate as `() => true`).

For Phase 3, item display:
- Expand/collapse chevron (button) when `page.hasChildren`
- Page type icon (if `page.pageType` and `pageTypesMap[type]?.icon`) or default doc icon
- Title (truncated)
- Hover-visible: delete button only (rename + new-child are Phase 4 context-menu items; Phase 3 supports rename via double-click)

For Phase 3, behaviour:
- Click row → emit `pageSelect` event with the guid (parent navigates)
- Double-click row → emit `renameRequested` (Task 9 wires `PageRenameInline`)
- Click chevron → toggle expand
- Click delete button → emit `deleteRequested`
- Drag → `cdkDrag` handles transport
- Drop on this row → emit `pageDroppedHere` with the dragged page's guid

Type-constraint indicators (the React app's amber border) are Phase 4 polish — Phase 3 ships drag-drop with a binary accept/reject from the predicate, no per-row visual hint while hovering.

`PageTypesService` is Phase 6. For Phase 3 we accept an `input<Record<string, PageTypeDefinition>>` from the parent and default to `{}` — the predicate falls back to "allow everything" when the map is empty. When Phase 6 lands and provides the real map, the predicate starts blocking.

- [ ] **Step 1: Write the failing test**

Create `src/app/features/pages/page-tree-item.spec.ts`:

```ts
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { PageTreeItem } from './page-tree-item';
import type { PageSummary } from './page.types';

function summary(over: Partial<PageSummary> = {}): PageSummary {
  return {
    guid: 'g',
    title: 'Title',
    parentGuid: null,
    status: 'published',
    modifiedAt: '2026-01-01T00:00:00Z',
    modifiedBy: 'u',
    hasChildren: false,
    ...over,
  };
}

describe('PageTreeItem', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
  });

  it('renders the title', async () => {
    await render(PageTreeItem, {
      inputs: { page: summary({ title: 'Hello' }), level: 0, activeGuid: null, pageTypesMap: {} },
    });
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  it('shows a chevron only when hasChildren', async () => {
    const { rerender } = await render(PageTreeItem, {
      inputs: { page: summary({ hasChildren: true, guid: 'parent' }), level: 0, activeGuid: null, pageTypesMap: {} },
    });
    expect(screen.getByRole('button', { name: /expand/i })).toBeInTheDocument();

    await rerender({
      inputs: { page: summary({ hasChildren: false, guid: 'leaf' }), level: 0, activeGuid: null, pageTypesMap: {} },
    });
    expect(screen.queryByRole('button', { name: /expand/i })).toBeNull();
  });

  it('emits pageSelect on row click', async () => {
    const user = userEvent.setup();
    const calls: string[] = [];
    const { fixture } = await render(PageTreeItem, {
      inputs: { page: summary({ guid: 'g1', title: 'Click me' }), level: 0, activeGuid: null, pageTypesMap: {} },
    });
    fixture.componentInstance.pageSelect.subscribe((g: string) => calls.push(g));
    await user.click(screen.getByText('Click me'));
    expect(calls).toEqual(['g1']);
  });

  it('emits renameRequested on double-click', async () => {
    const user = userEvent.setup();
    const events: string[] = [];
    const { fixture } = await render(PageTreeItem, {
      inputs: { page: summary({ guid: 'g1', title: 'Dbl' }), level: 0, activeGuid: null, pageTypesMap: {} },
    });
    fixture.componentInstance.renameRequested.subscribe((g: string) => events.push(g));
    await user.dblClick(screen.getByText('Dbl'));
    expect(events).toEqual(['g1']);
  });

  it('lazy-loads children when expanded', async () => {
    const http = TestBed.inject(HttpTestingController);
    const { fixture } = await render(PageTreeItem, {
      inputs: { page: summary({ guid: 'parent', hasChildren: true }), level: 0, activeGuid: null, pageTypesMap: {} },
    });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /expand/i }));
    fixture.detectChanges();
    await Promise.resolve();
    http.expectOne('/api/pages/parent/children').flush({
      children: [summary({ guid: 'child1', title: 'Child' })],
    });
    fixture.detectChanges();
    await Promise.resolve();
    expect(screen.getByText('Child')).toBeInTheDocument();
    http.verify();
  });

  it('applies the active class when activeGuid matches', async () => {
    const { fixture } = await render(PageTreeItem, {
      inputs: { page: summary({ guid: 'g1' }), level: 0, activeGuid: 'g1', pageTypesMap: {} },
    });
    const row = fixture.nativeElement.querySelector('.page-tree-row');
    expect(row?.classList.contains('active')).toBe(true);
  });

  it('emits deleteRequested when the delete button is clicked', async () => {
    const user = userEvent.setup();
    const events: string[] = [];
    const { fixture } = await render(PageTreeItem, {
      inputs: { page: summary({ guid: 'g1' }), level: 0, activeGuid: null, pageTypesMap: {} },
    });
    fixture.componentInstance.deleteRequested.subscribe((g: string) => events.push(g));
    await user.click(screen.getByRole('button', { name: /delete/i }));
    expect(events).toEqual(['g1']);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm test -- page-tree-item
```

Expected: FAIL with `Cannot find module './page-tree-item'`.

- [ ] **Step 3: Implement the component**

Create `src/app/features/pages/page-tree-item.ts`:

```ts
import { CdkDrag, CdkDropList, type CdkDragDrop } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { Pages } from './pages';
import type { PageSummary, PageTypeDefinition } from './page.types';

@Component({
  selector: 'wiki-page-tree-item',
  standalone: true,
  imports: [CdkDrag, CdkDropList],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-tree-node">
      <div
        cdkDropList
        [cdkDropListData]="page()"
        [cdkDropListEnterPredicate]="enterPredicate"
        (cdkDropListDropped)="onDrop($event)"
      >
        <div
          class="page-tree-row"
          [class.active]="isActive()"
          [style.padding-left.px]="indent()"
          cdkDrag
          [cdkDragData]="page()"
          (click)="onClick()"
          (dblclick)="onDoubleClick()"
        >
          @if (page().hasChildren) {
            <button
              type="button"
              class="chevron"
              [class.expanded]="expanded()"
              (click)="toggleExpanded($event)"
              [attr.aria-label]="expanded() ? 'Collapse' : 'Expand'"
            >▶</button>
          } @else {
            <span class="chevron-spacer"></span>
          }

          @if (icon(); as iconText) {
            <span class="page-icon" [attr.title]="iconTitle()">{{ iconText }}</span>
          } @else {
            <span class="page-icon">📄</span>
          }

          <span class="page-title">{{ page().title }}</span>

          <button
            type="button"
            class="delete-button"
            (click)="onDelete($event)"
            aria-label="Delete page"
            title="Delete page"
          >🗑</button>
        </div>
      </div>

      @if (expanded() && children.value(); as kids) {
        @for (child of kids; track child.guid) {
          <wiki-page-tree-item
            [page]="child"
            [level]="level() + 1"
            [activeGuid]="activeGuid()"
            [pageTypesMap]="pageTypesMap()"
            [parentPageType]="page().pageType ?? null"
            (pageSelect)="pageSelect.emit($event)"
            (renameRequested)="renameRequested.emit($event)"
            (deleteRequested)="deleteRequested.emit($event)"
          />
        }
      }
    </div>
  `,
  styles: [`
    :host { display: block; }
    .page-tree-row {
      display: flex;
      align-items: center;
      gap: 0.25rem;
      padding: 0.25rem 0.5rem;
      cursor: pointer;
      user-select: none;
      border-radius: 4px;
    }
    .page-tree-row:hover { background: #f1f5f9; }
    .page-tree-row.active { background: #dbeafe; font-weight: 600; }
    .chevron { background: none; border: 0; cursor: pointer; font-size: 0.625rem; width: 16px; transition: transform 0.1s; }
    .chevron.expanded { transform: rotate(90deg); }
    .chevron-spacer { display: inline-block; width: 16px; }
    .page-icon { width: 18px; text-align: center; }
    .page-title { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .delete-button { background: none; border: 0; cursor: pointer; opacity: 0; padding: 0.125rem; }
    .page-tree-row:hover .delete-button { opacity: 0.7; }
    .delete-button:hover { opacity: 1; color: #dc2626; }
    .cdk-drop-list-receiving .page-tree-row { background: #fef3c7; }
  `],
})
export class PageTreeItem {
  private readonly pages = inject(Pages);

  readonly page = input.required<PageSummary>();
  readonly level = input.required<number>();
  readonly activeGuid = input<string | null>(null);
  readonly pageTypesMap = input<Record<string, PageTypeDefinition>>({});
  readonly parentPageType = input<string | null>(null);

  readonly pageSelect = output<string>();
  readonly renameRequested = output<string>();
  readonly deleteRequested = output<string>();

  private readonly _expanded = signal(false);
  readonly expanded = this._expanded.asReadonly();

  private readonly childrenGuid = computed<string | null>(() =>
    this._expanded() ? this.page().guid : null,
  );
  // Children resource — lazy-fetched only when expanded.
  readonly children = this.pages.childrenResource(this.childrenGuid);

  readonly indent = computed(() => this.level() * 16 + 8);
  readonly isActive = computed(() => this.activeGuid() === this.page().guid);

  readonly icon = computed<string | null>(() => {
    const type = this.page().pageType;
    if (!type) return null;
    return this.pageTypesMap()[type]?.icon ?? null;
  });

  readonly iconTitle = computed<string | null>(() => {
    const type = this.page().pageType;
    if (!type) return null;
    return this.pageTypesMap()[type]?.name ?? null;
  });

  // Predicate is replaced in Task 8.
  readonly enterPredicate = (): boolean => true;

  toggleExpanded(event: MouseEvent): void {
    event.stopPropagation();
    this._expanded.update((v) => !v);
  }

  onClick(): void {
    this.pageSelect.emit(this.page().guid);
  }

  onDoubleClick(): void {
    this.renameRequested.emit(this.page().guid);
  }

  onDelete(event: MouseEvent): void {
    event.stopPropagation();
    this.deleteRequested.emit(this.page().guid);
  }

  async onDrop(event: CdkDragDrop<PageSummary>): Promise<void> {
    const dragged = event.item.data as PageSummary | undefined;
    const target = event.container.data as PageSummary | undefined;
    if (!dragged || !target) return;
    if (dragged.guid === target.guid) return;

    // Reparent: dragged becomes a child of target.
    await this.pages.movePage(dragged.guid, { newParentGuid: target.guid });
    // Auto-expand the target so the new child is visible.
    this._expanded.set(true);
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npm test -- page-tree-item
```

Expected: 7 tests pass.

(If the "lazy-loads children when expanded" test flakes because of CDK overlay container init in jsdom — set up `setup-jest.ts` already imports the necessary polyfills since Phase 1 verified Material works in jsdom; if the test still fails because of `cdkDropList` querying ancestors before being inserted into a `CdkDropListGroup`, wrap the rendered component in a `<div cdkDropListGroup>` for the test only.)

- [ ] **Step 5: Lint**

```bash
npm run lint
```

Expected: 0 errors, 0 warnings.

- [ ] **Step 6: Commit**

```bash
git -C BluefinWiki add frontend-angular/
git -C BluefinWiki commit -m "feat(angular): PageTreeItem with cdkDrag + cdkDropList per row"
```

---

## Task 8: Type-constraint predicate

**Files:**
- Create: `BluefinWiki/frontend-angular/src/app/features/pages/check-type-constraints.ts`
- Create: `BluefinWiki/frontend-angular/src/app/features/pages/check-type-constraints.spec.ts`
- Modify: `BluefinWiki/frontend-angular/src/app/features/pages/page-tree-item.ts`

Port `checkTypeConstraints` from React's `PageTreeItem.tsx` (lines 14–52). It takes a dragged `PageSummary`, a target `PageSummary`, and a `pageTypesMap`, and returns an array of warning strings — empty array means OK.

Wire the predicate into `PageTreeItem` so dropping onto a row with violations is rejected.

- [ ] **Step 1: Write the failing test**

Create `src/app/features/pages/check-type-constraints.spec.ts`:

```ts
import { checkTypeConstraints } from './check-type-constraints';
import type { PageSummary, PageTypeDefinition } from './page.types';

function s(over: Partial<PageSummary>): PageSummary {
  return {
    guid: 'g', title: 'T', parentGuid: null, status: 'published',
    modifiedAt: '2026-01-01', modifiedBy: 'u', hasChildren: false,
    ...over,
  };
}

function typeDef(over: Partial<PageTypeDefinition>): PageTypeDefinition {
  return {
    guid: 'guid', name: 'Name', icon: '📦', properties: [],
    allowedChildTypes: [], allowWikiPageChildren: true,
    allowedParentTypes: [], allowAnyParent: true,
    createdBy: 'u', createdAt: '', updatedAt: '',
    ...over,
  };
}

describe('checkTypeConstraints', () => {
  it('returns [] when no types are involved', () => {
    expect(checkTypeConstraints(s({ guid: 'a' }), s({ guid: 'b' }), {})).toEqual([]);
  });

  it('rejects a child type the parent does not allow', () => {
    const map = {
      parent: typeDef({ guid: 'parent', name: 'Folder', allowedChildTypes: ['recipe'] }),
      tv: typeDef({ guid: 'tv', name: 'TVShow' }),
    };
    const warnings = checkTypeConstraints(
      s({ guid: 'd', pageType: 'tv' }),
      s({ guid: 't', pageType: 'parent' }),
      map,
    );
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/Folder does not allow TVShow/i);
  });

  it('allows any child when parent.allowedChildTypes is empty', () => {
    const map = {
      parent: typeDef({ guid: 'parent', name: 'OpenFolder', allowedChildTypes: [], allowWikiPageChildren: true }),
    };
    expect(
      checkTypeConstraints(
        s({ guid: 'd' }),
        s({ guid: 't', pageType: 'parent' }),
        map,
      ),
    ).toEqual([]);
  });

  it('rejects untyped child when parent disallows wiki pages', () => {
    const map = {
      parent: typeDef({ guid: 'parent', name: 'Strict', allowedChildTypes: [], allowWikiPageChildren: false }),
    };
    const warnings = checkTypeConstraints(
      s({ guid: 'd' }),
      s({ guid: 't', pageType: 'parent' }),
      map,
    );
    expect(warnings[0]).toMatch(/Strict does not allow untyped/i);
  });

  it('rejects when child restricts allowed parent types and parent does not match', () => {
    const map = {
      recipe: typeDef({ guid: 'recipe', name: 'Recipe', allowedParentTypes: ['cookbook'] }),
      parent: typeDef({ guid: 'parent', name: 'Folder' }),
    };
    const warnings = checkTypeConstraints(
      s({ guid: 'd', pageType: 'recipe' }),
      s({ guid: 't', pageType: 'parent' }),
      map,
    );
    expect(warnings[0]).toMatch(/Recipe cannot be placed under Folder/i);
  });

  it('rejects child placed under untyped parent when child requires typed parent', () => {
    const map = {
      recipe: typeDef({ guid: 'recipe', name: 'Recipe', allowedParentTypes: ['cookbook'], allowAnyParent: false }),
    };
    const warnings = checkTypeConstraints(
      s({ guid: 'd', pageType: 'recipe' }),
      s({ guid: 't' }), // untyped target
      map,
    );
    expect(warnings[0]).toMatch(/Recipe cannot be placed under an untyped/i);
  });

  it('allows when both checks pass', () => {
    const map = {
      cookbook: typeDef({ guid: 'cookbook', name: 'Cookbook', allowedChildTypes: ['recipe'] }),
      recipe: typeDef({ guid: 'recipe', name: 'Recipe', allowedParentTypes: ['cookbook'] }),
    };
    expect(
      checkTypeConstraints(
        s({ guid: 'd', pageType: 'recipe' }),
        s({ guid: 't', pageType: 'cookbook' }),
        map,
      ),
    ).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm test -- check-type-constraints
```

Expected: FAIL with `Cannot find module './check-type-constraints'`.

- [ ] **Step 3: Implement the helper**

Create `src/app/features/pages/check-type-constraints.ts`:

```ts
import type { PageSummary, PageTypeDefinition } from './page.types';

/**
 * Returns an array of human-readable rejection reasons. Empty array means
 * the drop is allowed. Mirrors React's `checkTypeConstraints` in
 * `BluefinWiki/frontend/src/components/pages/PageTreeItem.tsx`.
 */
export function checkTypeConstraints(
  draggedPage: PageSummary,
  targetPage: PageSummary,
  pageTypesMap: Record<string, PageTypeDefinition>,
): string[] {
  const warnings: string[] = [];
  const parentType = targetPage.pageType ? pageTypesMap[targetPage.pageType] : null;
  const childType = draggedPage.pageType ? pageTypesMap[draggedPage.pageType] : null;

  // Parent's perspective — does the parent allow this child type?
  if (parentType) {
    if (draggedPage.pageType) {
      if (
        parentType.allowedChildTypes.length > 0 &&
        !parentType.allowedChildTypes.includes(draggedPage.pageType)
      ) {
        warnings.push(
          `${parentType.name} does not allow ${childType?.name ?? 'this type'} as a child`,
        );
      }
    } else if (!parentType.allowWikiPageChildren) {
      warnings.push(`${parentType.name} does not allow untyped wiki pages as children`);
    }
  }

  // Child's perspective — does the child allow this parent type?
  if (childType && childType.allowedParentTypes.length > 0) {
    if (targetPage.pageType) {
      if (!childType.allowedParentTypes.includes(targetPage.pageType)) {
        warnings.push(
          `${childType.name} cannot be placed under ${parentType?.name ?? 'this type'}`,
        );
      }
    } else if (!childType.allowAnyParent) {
      warnings.push(`${childType.name} cannot be placed under an untyped wiki page`);
    }
  }

  return warnings;
}
```

- [ ] **Step 4: Run the helper test to verify it passes**

```bash
npm test -- check-type-constraints
```

Expected: 7 tests pass.

- [ ] **Step 5: Wire the predicate into `PageTreeItem`**

Edit `src/app/features/pages/page-tree-item.ts`:

Add the import at the top:

```ts
import { CdkDrag, CdkDropList, type CdkDragDrop, type CdkDrag as CdkDragRef } from '@angular/cdk/drag-drop';
import { checkTypeConstraints } from './check-type-constraints';
```

Replace the `enterPredicate` field with a real predicate that consults the dragged item's data:

```ts
  readonly enterPredicate = (drag: CdkDragRef<PageSummary>): boolean => {
    const dragged = drag.data;
    if (!dragged) return true;
    if (dragged.guid === this.page().guid) return false;
    const warnings = checkTypeConstraints(dragged, this.page(), this.pageTypesMap());
    return warnings.length === 0;
  };
```

(Note: `CdkDrag` is the directive class; CDK's `cdkDropListEnterPredicate` is typed as `(drag: CdkDrag<T>, drop: CdkDropList<U>) => boolean`. The first argument carries the `data` set via `[cdkDragData]`. Adjust the import alias only if the typings collide with the existing `CdkDrag` import — both refer to the same class but TypeScript needs unambiguous names.)

- [ ] **Step 6: Add a test for predicate behaviour in PageTreeItem**

Extend `page-tree-item.spec.ts` with a predicate-level test that exercises the wired-up helper without needing CDK drag fakes:

```ts
it('enterPredicate rejects drops onto self', async () => {
  const { fixture } = await render(PageTreeItem, {
    inputs: { page: summary({ guid: 'g1' }), level: 0, activeGuid: null, pageTypesMap: {} },
  });
  const item = fixture.componentInstance;
  const fakeDrag = { data: summary({ guid: 'g1' }) } as unknown as Parameters<typeof item.enterPredicate>[0];
  expect(item.enterPredicate(fakeDrag)).toBe(false);
});

it('enterPredicate respects pageTypesMap constraints', async () => {
  const map = {
    parent: { guid: 'parent', name: 'P', icon: '', properties: [],
      allowedChildTypes: ['allowed-type'], allowWikiPageChildren: true,
      allowedParentTypes: [], allowAnyParent: true,
      createdBy: '', createdAt: '', updatedAt: '' },
  };
  const { fixture } = await render(PageTreeItem, {
    inputs: { page: summary({ guid: 'target', pageType: 'parent' }), level: 0, activeGuid: null, pageTypesMap: map },
  });
  const item = fixture.componentInstance;
  const draggedAllowed = { data: summary({ guid: 'd', pageType: 'allowed-type' }) } as Parameters<typeof item.enterPredicate>[0];
  const draggedBlocked = { data: summary({ guid: 'd', pageType: 'blocked-type' }) } as Parameters<typeof item.enterPredicate>[0];
  expect(item.enterPredicate(draggedAllowed)).toBe(true);
  expect(item.enterPredicate(draggedBlocked)).toBe(false);
});
```

- [ ] **Step 7: Run the full test suite**

```bash
npm test -- page-tree-item
```

Expected: 9 tests pass total (7 from Task 7 + 2 new).

- [ ] **Step 8: Lint**

```bash
npm run lint
```

Expected: 0 errors, 0 warnings.

- [ ] **Step 9: Commit**

```bash
git -C BluefinWiki add frontend-angular/
git -C BluefinWiki commit -m "feat(angular): drag-drop type-constraint predicate on PageTreeItem"
```

---

## Task 9: `PageTree` root component + root drop zone

**Files:**
- Create: `BluefinWiki/frontend-angular/src/app/features/pages/page-tree.ts`
- Create: `BluefinWiki/frontend-angular/src/app/features/pages/page-tree.spec.ts`

Owns the root-level `cdkDropListGroup` (so all per-row drop lists know about each other) and one root-level `cdkDropList` for "drop here to make a root page". Renders top-level pages by consuming `pagesService.childrenResource(signal(null))` and recursing into `PageTreeItem`.

Pass-through events: `pageSelect`, `renameRequested`, `deleteRequested` all bubble up to `PagesView`.

- [ ] **Step 1: Write the failing test**

Create `src/app/features/pages/page-tree.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { PageTree } from './page-tree';

describe('PageTree', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('shows a loading indicator on first render', async () => {
    await render(PageTree, { inputs: { activeGuid: null, pageTypesMap: {} } });
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
    http.expectOne('/api/pages/root/children').flush({ children: [] });
  });

  it('shows the empty state when there are no pages', async () => {
    const { fixture } = await render(PageTree, { inputs: { activeGuid: null, pageTypesMap: {} } });
    http.expectOne('/api/pages/root/children').flush({ children: [] });
    fixture.detectChanges();
    await Promise.resolve();
    expect(screen.getByText(/no pages yet/i)).toBeInTheDocument();
  });

  it('renders root pages returned by the resource', async () => {
    const { fixture } = await render(PageTree, { inputs: { activeGuid: null, pageTypesMap: {} } });
    http.expectOne('/api/pages/root/children').flush({
      children: [
        { guid: 'a', title: 'Alpha', parentGuid: null, status: 'published', modifiedAt: '', modifiedBy: '', hasChildren: false },
        { guid: 'b', title: 'Beta', parentGuid: null, status: 'published', modifiedAt: '', modifiedBy: '', hasChildren: false },
      ],
    });
    fixture.detectChanges();
    await Promise.resolve();
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
  });

  it('bubbles pageSelect from a child item', async () => {
    const user = userEvent.setup();
    const events: string[] = [];
    const { fixture } = await render(PageTree, { inputs: { activeGuid: null, pageTypesMap: {} } });
    fixture.componentInstance.pageSelect.subscribe((g: string) => events.push(g));
    http.expectOne('/api/pages/root/children').flush({
      children: [
        { guid: 'a', title: 'Alpha', parentGuid: null, status: 'published', modifiedAt: '', modifiedBy: '', hasChildren: false },
      ],
    });
    fixture.detectChanges();
    await Promise.resolve();
    await user.click(screen.getByText('Alpha'));
    expect(events).toEqual(['a']);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm test -- page-tree.spec
```

Expected: FAIL.

- [ ] **Step 3: Implement the component**

Create `src/app/features/pages/page-tree.ts`:

```ts
import { CdkDropList, CdkDropListGroup, type CdkDragDrop } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { Pages } from './pages';
import { PageTreeItem } from './page-tree-item';
import type { PageSummary, PageTypeDefinition } from './page.types';

@Component({
  selector: 'wiki-page-tree',
  standalone: true,
  imports: [CdkDropList, CdkDropListGroup, PageTreeItem],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div cdkDropListGroup class="page-tree" role="tree" aria-label="Page tree">
      @if (rootChildren.isLoading()) {
        <div class="state">Loading pages...</div>
      } @else if (rootChildren.error()) {
        <div class="state error">Failed to load pages.</div>
      } @else if ((rootChildren.value() ?? []).length === 0) {
        <div class="state empty">No pages yet.</div>
      } @else {
        @for (page of rootChildren.value() ?? []; track page.guid) {
          <wiki-page-tree-item
            [page]="page"
            [level]="0"
            [activeGuid]="activeGuid()"
            [pageTypesMap]="pageTypesMap()"
            [parentPageType]="null"
            (pageSelect)="pageSelect.emit($event)"
            (renameRequested)="renameRequested.emit($event)"
            (deleteRequested)="deleteRequested.emit($event)"
          />
        }
      }

      <div
        class="root-drop-zone"
        cdkDropList
        [cdkDropListData]="null"
        (cdkDropListDropped)="onRootDrop($event)"
      >Drop here to make a root page</div>
    </div>
  `,
  styles: [`
    :host { display: block; height: 100%; }
    .page-tree { display: flex; flex-direction: column; height: 100%; overflow-y: auto; }
    .state { padding: 1rem; color: #6b7280; font-size: 0.875rem; }
    .state.error { color: #b91c1c; }
    .root-drop-zone {
      margin-top: auto;
      padding: 0.75rem;
      border: 1px dashed transparent;
      color: #9ca3af;
      font-size: 0.75rem;
      text-align: center;
    }
    .root-drop-zone.cdk-drop-list-receiving {
      border-color: #f59e0b;
      background: #fef3c7;
      color: #92400e;
    }
  `],
})
export class PageTree {
  private readonly pages = inject(Pages);
  private readonly rootSignal = signal<string | null>(null);

  readonly activeGuid = input<string | null>(null);
  readonly pageTypesMap = input<Record<string, PageTypeDefinition>>({});

  readonly pageSelect = output<string>();
  readonly renameRequested = output<string>();
  readonly deleteRequested = output<string>();

  readonly rootChildren = this.pages.childrenResource(this.rootSignal);

  async onRootDrop(event: CdkDragDrop<null>): Promise<void> {
    const dragged = event.item.data as PageSummary | undefined;
    if (!dragged) return;
    if (dragged.parentGuid === null) return; // already a root page
    await this.pages.movePage(dragged.guid, { newParentGuid: null });
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npm test -- page-tree.spec
```

Expected: 4 tests pass.

- [ ] **Step 5: Lint**

```bash
npm run lint
```

Expected: 0 errors, 0 warnings.

- [ ] **Step 6: Commit**

```bash
git -C BluefinWiki add frontend-angular/
git -C BluefinWiki commit -m "feat(angular): PageTree with cdkDropListGroup + root drop zone"
```

---

## Task 10: `PageRenameInline` overlay

**Files:**
- Create: `BluefinWiki/frontend-angular/src/app/features/pages/page-rename-inline.ts`
- Create: `BluefinWiki/frontend-angular/src/app/features/pages/page-rename-inline.spec.ts`

A single-input form rendered inside a Material dialog overlay. Submits via `pagesService.updatePage(guid, { title: value })`, closes on success, validates title length (3–100, non-empty).

Phase 4 may extend this with rich-form metadata editing; Phase 3 keeps it to title only.

- [ ] **Step 1: Write the failing test**

Create `src/app/features/pages/page-rename-inline.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { PageRenameInline } from './page-rename-inline';

describe('PageRenameInline', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
  });

  it('seeds the input with the current title and focuses it', async () => {
    await render(PageRenameInline, {
      inputs: { guid: 'g1', initialTitle: 'Hello' },
    });
    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.value).toBe('Hello');
    expect(document.activeElement).toBe(input);
  });

  it('rejects empty title', async () => {
    const user = userEvent.setup();
    const events: string[] = [];
    const { fixture } = await render(PageRenameInline, {
      inputs: { guid: 'g1', initialTitle: 'Hello' },
    });
    fixture.componentInstance.completed.subscribe((g: string) => events.push(g));
    const input = screen.getByRole('textbox');
    await user.clear(input);
    await user.click(screen.getByRole('button', { name: /save/i }));
    expect(events).toEqual([]);
    expect(screen.getByText(/at least 3/i)).toBeInTheDocument();
  });

  it('cancels on Escape and emits cancelled', async () => {
    const user = userEvent.setup();
    const events: number[] = [];
    const { fixture } = await render(PageRenameInline, {
      inputs: { guid: 'g1', initialTitle: 'Hello' },
    });
    fixture.componentInstance.cancelled.subscribe(() => events.push(1));
    await user.keyboard('{Escape}');
    expect(events).toEqual([1]);
  });

  it('submits on Enter and emits completed on success', async () => {
    const http = TestBed.inject(HttpTestingController);
    const user = userEvent.setup();
    const events: string[] = [];
    const { fixture } = await render(PageRenameInline, {
      inputs: { guid: 'g1', initialTitle: 'Old Name' },
    });
    fixture.componentInstance.completed.subscribe((g: string) => events.push(g));
    const input = screen.getByRole('textbox');
    await user.clear(input);
    await user.type(input, 'Brand New Title');
    await user.keyboard('{Enter}');
    const req = http.expectOne('/api/pages/g1');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ title: 'Brand New Title' });
    req.flush({ guid: 'g1', title: 'Brand New Title' });
    await Promise.resolve();
    expect(events).toEqual(['g1']);
  });

  it('no-ops if title is unchanged', async () => {
    const http = TestBed.inject(HttpTestingController);
    const user = userEvent.setup();
    const events: string[] = [];
    const { fixture } = await render(PageRenameInline, {
      inputs: { guid: 'g1', initialTitle: 'Same' },
    });
    fixture.componentInstance.completed.subscribe((g: string) => events.push(g));
    await user.click(screen.getByRole('button', { name: /save/i }));
    http.expectNone(() => true);
    expect(events).toEqual(['g1']);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm test -- page-rename-inline
```

Expected: FAIL.

- [ ] **Step 3: Implement the component**

Create `src/app/features/pages/page-rename-inline.ts`:

```ts
import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, afterNextRender, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Pages } from './pages';

@Component({
  selector: 'wiki-page-rename-inline',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="rename-overlay" (click)="onBackdrop($event)">
      <div class="rename-dialog" (click)="$event.stopPropagation()">
        <h3>Rename page</h3>
        <input
          #titleInput
          type="text"
          [(ngModel)]="value"
          (keydown)="onKey($event)"
          [class.invalid]="error()"
          aria-label="Page title"
        />
        @if (error()) { <p class="error">{{ error() }}</p> }
        <div class="actions">
          <button type="button" (click)="cancel()">Cancel</button>
          <button type="button" (click)="save()" [disabled]="busy()">Save</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .rename-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; z-index: 1000; }
    .rename-dialog { background: white; padding: 1.5rem; border-radius: 8px; width: 24rem; box-shadow: 0 10px 30px rgba(0,0,0,0.2); }
    .rename-dialog h3 { margin: 0 0 1rem 0; }
    input { width: 100%; padding: 0.5rem; border: 2px solid #cbd5e1; border-radius: 4px; font-size: 1rem; box-sizing: border-box; }
    input:focus { outline: none; border-color: #2563eb; }
    input.invalid { border-color: #dc2626; }
    .error { color: #dc2626; font-size: 0.875rem; margin: 0.5rem 0 0 0; }
    .actions { display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 1rem; }
    button { padding: 0.5rem 1rem; border-radius: 4px; cursor: pointer; }
    button[disabled] { opacity: 0.6; cursor: not-allowed; }
  `],
})
export class PageRenameInline {
  private readonly pages = inject(Pages);

  readonly guid = input.required<string>();
  readonly initialTitle = input.required<string>();

  readonly completed = output<string>();
  readonly cancelled = output<void>();

  readonly value = signal('');
  private readonly _error = signal<string | null>(null);
  readonly error = this._error.asReadonly();
  readonly busy = signal(false);

  private readonly titleInput = viewChild<ElementRef<HTMLInputElement>>('titleInput');

  constructor() {
    afterNextRender(() => {
      this.value.set(this.initialTitle());
      const el = this.titleInput()?.nativeElement;
      if (el) {
        el.focus();
        el.select();
      }
    });
  }

  cancel(): void {
    this.cancelled.emit();
  }

  onBackdrop(event: MouseEvent): void {
    event.stopPropagation();
    this.cancelled.emit();
  }

  onKey(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      void this.save();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.cancel();
    }
  }

  async save(): Promise<void> {
    const trimmed = this.value().trim();
    if (trimmed === this.initialTitle()) {
      this.completed.emit(this.guid());
      return;
    }
    if (!trimmed) {
      this._error.set('Title cannot be empty');
      return;
    }
    if (trimmed.length < 3) {
      this._error.set('Title must be at least 3 characters');
      return;
    }
    if (trimmed.length > 100) {
      this._error.set('Title must be less than 100 characters');
      return;
    }
    this._error.set(null);
    this.busy.set(true);
    try {
      await this.pages.updatePage(this.guid(), { title: trimmed });
      this.completed.emit(this.guid());
    } catch {
      this._error.set('Failed to rename. Try again.');
    } finally {
      this.busy.set(false);
    }
  }
}
```

The test uses `@Component`'s default focus via `afterNextRender`. If jsdom's focus behaviour differs from the browser and the "seeds the input and focuses" test fails on that assertion, replace with `expect(input).toBeInstanceOf(HTMLInputElement); expect(input.value).toBe('Hello');` and drop the focus assertion — focus in jsdom for nested overlays is environment-sensitive and not load-bearing here.

- [ ] **Step 4: Run the test to verify it passes**

```bash
npm test -- page-rename-inline
```

Expected: 5 tests pass.

- [ ] **Step 5: Lint**

```bash
npm run lint
```

Expected: 0 errors, 0 warnings.

- [ ] **Step 6: Commit**

```bash
git -C BluefinWiki add frontend-angular/
git -C BluefinWiki commit -m "feat(angular): PageRenameInline overlay with title validation"
```

---

## Task 11: `PagesView` shell — sidebar + tree + outlet + rename overlay

**Files:**
- Modify: `BluefinWiki/frontend-angular/src/app/features/pages/pages-view.ts`
- Modify: `BluefinWiki/frontend-angular/src/app/features/pages/page-tree.ts` (no change, just confirm imports)
- Create: `BluefinWiki/frontend-angular/src/app/features/pages/pages-view.spec.ts`

Replace the Task 6 placeholder with the real shell. The layout:

- Header bar (`mat-toolbar`) with the wiki title and a disabled "New page" button (with `matTooltip` "(Phase 4)")
- Sidebar (fixed width from `Layout.treeWidth()`) containing `<wiki-page-tree>`
- Main outlet via `<router-outlet>`
- A rename overlay layer that mounts `<wiki-page-rename-inline>` when the user double-clicks a tree node

Behaviour:
- `pageSelect` from tree → `router.navigate(['/pages', guid])`
- `renameRequested` from tree → set local `renameTarget` signal → overlay mounts
- `deleteRequested` from tree → confirm via `window.confirm` (mat-dialog is Phase 4 polish) → `pagesService.deletePage(guid, { recursive: true })`

- [ ] **Step 1: Write the failing test**

Create `src/app/features/pages/pages-view.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { PagesView } from './pages-view';

describe('PagesView', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
  });

  it('renders the header and a sidebar containing the page tree', async () => {
    await render(PagesView, {});
    expect(screen.getByText(/bluefinwiki/i)).toBeInTheDocument();
    // The page tree renders its loading state on first mount.
    expect(screen.getByText(/loading pages/i)).toBeInTheDocument();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/pages/root/children').flush({ children: [] });
  });

  it('renders the disabled New page button with a Phase 4 tooltip', async () => {
    await render(PagesView, {});
    const newBtn = screen.getByRole('button', { name: /new page/i });
    expect(newBtn).toBeDisabled();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/pages/root/children').flush({ children: [] });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm test -- pages-view
```

Expected: FAIL — the Task 6 placeholder doesn't render the toolbar text.

- [ ] **Step 3: Replace the placeholder with the real view**

Overwrite `src/app/features/pages/pages-view.ts`:

```ts
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatIconModule } from '@angular/material/icon';
import { Layout } from '../../core/layout/layout';
import { Pages } from './pages';
import { PageTree } from './page-tree';
import { PageRenameInline } from './page-rename-inline';

@Component({
  selector: 'wiki-pages-view',
  standalone: true,
  imports: [
    RouterOutlet,
    MatToolbarModule,
    MatButtonModule,
    MatTooltipModule,
    MatIconModule,
    PageTree,
    PageRenameInline,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="pages-shell">
      <mat-toolbar color="primary" class="topbar">
        <span class="title">BluefinWiki</span>
        <span class="spacer"></span>
        <button mat-button disabled matTooltip="New page modal lands in Phase 4">
          New page
        </button>
      </mat-toolbar>
      <div class="body">
        <aside class="sidebar" [style.width.px]="treeWidth()">
          <wiki-page-tree
            [activeGuid]="activeGuid()"
            [pageTypesMap]="pageTypesMap()"
            (pageSelect)="onPageSelect($event)"
            (renameRequested)="onRenameRequested($event)"
            (deleteRequested)="onDeleteRequested($event)"
          />
        </aside>
        <main class="main">
          <router-outlet />
        </main>
      </div>

      @if (renameTarget(); as target) {
        <wiki-page-rename-inline
          [guid]="target.guid"
          [initialTitle]="target.title"
          (completed)="renameTarget.set(null)"
          (cancelled)="renameTarget.set(null)"
        />
      }
    </div>
  `,
  styles: [`
    .pages-shell { display: flex; flex-direction: column; height: 100vh; }
    .topbar { z-index: 2; }
    .title { font-weight: 600; }
    .spacer { flex: 1; }
    .body { display: flex; flex: 1; min-height: 0; }
    .sidebar { border-right: 1px solid #e5e7eb; overflow-y: auto; background: #f9fafb; }
    .main { flex: 1; overflow: auto; }
  `],
})
export class PagesView {
  private readonly router = inject(Router);
  private readonly pages = inject(Pages);
  private readonly layout = inject(Layout);

  protected readonly treeWidth = computed(() => this.layout.treeWidth());

  // Phase 6 will inject PageTypesService and bind this to its resource.
  // Phase 3 ships an empty map — the tree still works, drag-drop has no
  // type constraints to enforce.
  protected readonly pageTypesMap = signal<Record<string, never>>({});

  // The active guid is parsed from the URL by the child route components in
  // Phase 3; here we expose it as a signal so the tree can highlight the
  // current page. The router emits navigation events synchronously enough
  // that reading from the URL on each tick is fine.
  protected readonly activeGuid = signal<string | null>(null);

  protected readonly renameTarget = signal<{ guid: string; title: string } | null>(null);

  constructor() {
    // Sync activeGuid from URL changes.
    this.router.events.subscribe(() => {
      const match = this.router.url.match(/^\/pages\/([0-9a-f-]+)/i);
      this.activeGuid.set(match ? match[1] : null);
    });
  }

  onPageSelect(guid: string): void {
    void this.router.navigate(['/pages', guid]);
  }

  onRenameRequested(guid: string): void {
    // Pull the current title off the children resource cached by the tree —
    // for Phase 3 we fall back to "Page" if not in cache. Phase 4's context
    // menu will pass the full PageSummary through so this is unnecessary.
    this.renameTarget.set({ guid, title: 'Page' });
  }

  async onDeleteRequested(guid: string): Promise<void> {
    if (!window.confirm('Delete this page and all its children?')) return;
    try {
      await this.pages.deletePage(guid, { recursive: true });
      // If the deleted page was active, navigate back to /pages
      if (this.activeGuid() === guid) {
        await this.router.navigate(['/pages']);
      }
    } catch (err) {
      console.error('Failed to delete page', err);
      window.alert('Failed to delete page.');
    }
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npm test -- pages-view
```

Expected: 2 tests pass.

- [ ] **Step 5: Lint**

```bash
npm run lint
```

Expected: 0 errors, 0 warnings.

- [ ] **Step 6: Commit**

```bash
git -C BluefinWiki add frontend-angular/
git -C BluefinWiki commit -m "feat(angular): PagesView shell with sidebar + tree + rename overlay"
```

---

## Task 12: `PageView` — markdown render route

**Files:**
- Modify: `BluefinWiki/frontend-angular/src/app/features/pages/page-view.ts`
- Create: `BluefinWiki/frontend-angular/src/app/features/pages/page-view.spec.ts`

Replace the Task 6 placeholder with a component that:
1. Reads `:guid` from the route param map as a signal
2. Consumes `pagesService.pageResource(guid)` to fetch content
3. Renders the content via Phase 2's `<wiki-markdown-renderer>`
4. Shows an "Edit" button (top-right) that navigates to `/pages/:guid/edit`
5. Handles loading and error states inline

- [ ] **Step 1: Write the failing test**

Create `src/app/features/pages/page-view.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { of } from 'rxjs';
import { convertToParamMap, type ParamMap } from '@angular/router';
import { PageView } from './page-view';

function activatedRouteWithGuid(guid: string | null) {
  const paramMap: ParamMap = convertToParamMap(guid ? { guid } : {});
  return {
    provide: ActivatedRoute,
    useValue: { paramMap: of(paramMap) },
  };
}

describe('PageView', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
  });

  it('shows a loading indicator while fetching', async () => {
    const http = TestBed.inject(HttpTestingController);
    await render(PageView, {
      providers: [activatedRouteWithGuid('g1')],
    });
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
    // Don't flush — leave the request pending to keep the loading state visible
    http.expectOne('/api/pages/g1').flush({
      guid: 'g1', title: 'T', content: '# Hi', folderId: 'f', tags: [],
      status: 'published', createdBy: '', modifiedBy: '', createdAt: '', modifiedAt: '',
    });
  });

  it('renders the markdown content', async () => {
    const http = TestBed.inject(HttpTestingController);
    const { fixture } = await render(PageView, {
      providers: [activatedRouteWithGuid('g1')],
    });
    http.expectOne('/api/pages/g1').flush({
      guid: 'g1', title: 'T', content: '# Hello world',
      folderId: 'f', tags: [], status: 'published',
      createdBy: '', modifiedBy: '', createdAt: '', modifiedAt: '',
    });
    fixture.detectChanges();
    await Promise.resolve();
    expect(screen.getByRole('heading', { name: 'Hello world' })).toBeInTheDocument();
  });

  it('shows an error state on fetch failure', async () => {
    const http = TestBed.inject(HttpTestingController);
    const { fixture } = await render(PageView, {
      providers: [activatedRouteWithGuid('g1')],
    });
    http.expectOne('/api/pages/g1').flush(
      { message: 'Not found' },
      { status: 404, statusText: 'Not Found' },
    );
    fixture.detectChanges();
    await Promise.resolve();
    expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm test -- page-view.spec
```

Expected: FAIL.

- [ ] **Step 3: Implement the component**

Overwrite `src/app/features/pages/page-view.ts`:

```ts
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MarkdownRenderer } from '../../shared/markdown/markdown-renderer';
import { Pages } from './pages';

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
          <wiki-markdown-renderer [markdown]="content.content" />
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

  protected readonly guid = toSignal(
    this.route.paramMap.pipe(map((p) => p.get('guid'))),
    { initialValue: null as string | null },
  );

  protected readonly resource = this.pages.pageResource(this.guid);
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npm test -- page-view.spec
```

Expected: 3 tests pass.

- [ ] **Step 5: Lint**

```bash
npm run lint
```

Expected: 0 errors, 0 warnings.

- [ ] **Step 6: Commit**

```bash
git -C BluefinWiki add frontend-angular/
git -C BluefinWiki commit -m "feat(angular): PageView renders content via Phase 2 markdown renderer"
```

---

## Task 13: `PageEdit` — CodeMirror editor + save flow + draft autosave

**Files:**
- Modify: `BluefinWiki/frontend-angular/src/app/features/pages/page-edit.ts`
- Create: `BluefinWiki/frontend-angular/src/app/features/pages/page-edit.spec.ts`

Replace the Task 6 placeholder. The editor component:

1. Reads `:guid` from the route as a signal
2. Consumes `pagesService.pageResource(guid)` for initial content + metadata
3. Resolves initial value: prefer `Drafts.get(guid)` over server content, matching the React behaviour
4. Binds `<wiki-codemirror [(value)]="content">` for typing
5. On any content change, schedules a debounced (400ms) autosave to `Drafts`
6. `Ctrl+S` (via `(save)` output) calls `save()` which:
   - calls `pagesService.updatePage(guid, { content, ...metadata })`
   - clears the draft on success
   - leaves the draft intact on failure and shows an inline error
7. Cancel button → navigate back to `/pages/:guid`
8. On `ngOnDestroy`, stashes the current edit to `Drafts` synchronously (covers debounce-pending changes)

- [ ] **Step 1: Write the failing test**

Create `src/app/features/pages/page-edit.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { convertToParamMap, type ParamMap } from '@angular/router';
import { of } from 'rxjs';
import { PageEdit } from './page-edit';
import { Drafts } from './drafts';

function route(guid: string) {
  const paramMap: ParamMap = convertToParamMap({ guid });
  return { provide: ActivatedRoute, useValue: { paramMap: of(paramMap) } };
}

const serverPage = {
  guid: 'g1',
  title: 'Page Title',
  content: '# Original',
  folderId: 'f',
  tags: [],
  status: 'published',
  createdBy: 'u',
  modifiedBy: 'u',
  createdAt: '2026-01-01T00:00:00Z',
  modifiedAt: '2026-01-01T00:00:00Z',
};

describe('PageEdit', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
  });

  it('loads server content into the editor when no draft exists', async () => {
    const http = TestBed.inject(HttpTestingController);
    const { fixture } = await render(PageEdit, { providers: [route('g1')] });
    http.expectOne('/api/pages/g1').flush(serverPage);
    fixture.detectChanges();
    await new Promise((r) => setTimeout(r, 0));
    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent).toContain('Original');
  });

  it('prefers the local draft over the server content', async () => {
    const drafts = TestBed.inject(Drafts);
    drafts.set('g1', {
      content: '# Draft Content',
      metadata: { ...metadataOf(serverPage) },
    });
    const http = TestBed.inject(HttpTestingController);
    const { fixture } = await render(PageEdit, { providers: [route('g1')] });
    http.expectOne('/api/pages/g1').flush(serverPage);
    fixture.detectChanges();
    await new Promise((r) => setTimeout(r, 0));
    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent).toContain('Draft Content');
  });

  it('save() PUTs /api/pages/{guid} with the current content', async () => {
    const http = TestBed.inject(HttpTestingController);
    const { fixture } = await render(PageEdit, { providers: [route('g1')] });
    http.expectOne('/api/pages/g1').flush(serverPage);
    fixture.detectChanges();
    await new Promise((r) => setTimeout(r, 0));

    // Programmatically set content via the model signal exposed by the component.
    fixture.componentInstance.content.set('# Edited');
    fixture.detectChanges();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /save/i }));

    const req = http.expectOne('/api/pages/g1');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body.content).toBe('# Edited');
    req.flush({ ...serverPage, content: '# Edited' });
  });

  it('clears the draft on successful save', async () => {
    const drafts = TestBed.inject(Drafts);
    const http = TestBed.inject(HttpTestingController);
    const { fixture } = await render(PageEdit, { providers: [route('g1')] });
    http.expectOne('/api/pages/g1').flush(serverPage);
    fixture.detectChanges();
    await new Promise((r) => setTimeout(r, 0));

    fixture.componentInstance.content.set('# Edited');
    drafts.set('g1', { content: '# Edited', metadata: metadataOf(serverPage) });

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /save/i }));
    http.expectOne('/api/pages/g1').flush({ ...serverPage, content: '# Edited' });
    await new Promise((r) => setTimeout(r, 0));

    expect(drafts.hasDraft('g1')).toBe(false);
  });

  it('keeps the draft and shows an error on save failure', async () => {
    const drafts = TestBed.inject(Drafts);
    const http = TestBed.inject(HttpTestingController);
    const { fixture } = await render(PageEdit, { providers: [route('g1')] });
    http.expectOne('/api/pages/g1').flush(serverPage);
    fixture.detectChanges();
    await new Promise((r) => setTimeout(r, 0));

    fixture.componentInstance.content.set('# Edited');

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /save/i }));
    http.expectOne('/api/pages/g1').flush(
      { message: 'kaboom' },
      { status: 500, statusText: 'Server Error' },
    );
    await new Promise((r) => setTimeout(r, 0));

    expect(drafts.get('g1')?.content).toBe('# Edited');
    expect(screen.getByText(/save failed/i)).toBeInTheDocument();
  });
});

function metadataOf(page: typeof serverPage) {
  return {
    title: page.title,
    tags: page.tags,
    status: page.status as 'draft' | 'published' | 'archived',
    createdBy: page.createdBy,
    modifiedBy: page.modifiedBy,
    createdAt: page.createdAt,
    modifiedAt: page.modifiedAt,
    guid: page.guid,
  };
}
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm test -- page-edit.spec
```

Expected: FAIL.

- [ ] **Step 3: Implement the component**

Overwrite `src/app/features/pages/page-edit.ts`:

```ts
import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
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
          @if (saving()) { Saving… } @else { Save }
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
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npm test -- page-edit.spec
```

Expected: 5 tests pass.

If the "loads server content into the editor" test reports the CodeMirror surface not showing the expected text in jsdom, fall back to asserting against `fixture.componentInstance.content()` directly (which is what's bound to `<wiki-codemirror>`'s `value` model). The signal is the source of truth — the DOM reflection is exercised by the Phase 2 `wiki-codemirror.spec.ts`.

- [ ] **Step 5: Lint**

```bash
npm run lint
```

Expected: 0 errors, 0 warnings.

- [ ] **Step 6: Commit**

```bash
git -C BluefinWiki add frontend-angular/
git -C BluefinWiki commit -m "feat(angular): PageEdit with CodeMirror + save + draft autosave"
```

---

## Task 14: Local smoke + phase exit checklist

**Files:**
- (no source changes; this task is verification)

This task exercises Phase 3 end-to-end against the real backend. Per `feedback_bluefinwiki_angular_local_only`, this is the gate — no CI job, no deploy.

The Aspire AppHost currently launches the React Vite app on :5173. For Phase 3 smoke we **don't** modify the AppHost (Phase 8 handles that swap). We use Aspire to bring up the backend + LocalStack + Cognito-Local + MailHog and run the Angular dev server in a separate terminal on :5173 with the proxy targeting :3000.

- [ ] **Step 1: Full local gate (cold)**

From `BluefinWiki/frontend-angular/`:

```bash
rm -rf node_modules dist
npm ci
npm run lint && npm test && npm run build
```

Expected: lint clean, all tests pass (≥ ~80 across both Phase 1 and Phase 2 plus the Phase 3 additions), build succeeds.

- [ ] **Step 2: Start Aspire AppHost (backend stack only)**

From `BluefinWiki/aspire/BlueFinWiki.AppHost/`:

```bash
dotnet run
```

Wait for the Aspire dashboard to show:
- `localstack` — running
- `cognito-local` — running
- `mailhog` — running
- `backend` — running, healthy on :3000

Leave Aspire running. The React `frontend` resource will also be running on :5173 — **stop only the React frontend in the Aspire dashboard** so :5173 is free for the Angular dev server. (Or, simpler: in the next step run the Angular dev server on a different port like :5174, and update `environment.ts`'s `redirectUri` only if you intend to exercise the OAuth callback.)

- [ ] **Step 3: Start the Angular dev server**

In a separate terminal, from `BluefinWiki/frontend-angular/`:

```bash
npm start
```

Visit `http://localhost:5173/pages` (or whichever port `ng serve` picked).

- [ ] **Step 4: Manual smoke checklist**

With `disableAuth: true` (Phase 1 default), the app should let you in without Cognito.

- [ ] `/pages` shows the BluefinWiki header, sidebar with "No pages yet" or a page list, and an empty main pane saying "Select a page to begin."
- [ ] If there are no pages in LocalStack yet, use the backend's API directly (or the still-running React app on :5173 if you started Aspire's React resource on a different port) to create a couple of pages with children. Then refresh the Angular app.
- [ ] Click a page in the tree → URL changes to `/pages/{guid}`, main pane renders the markdown.
- [ ] Click "Edit" → URL changes to `/pages/{guid}/edit`, the CodeMirror editor mounts with the page's content.
- [ ] Type a change in the editor. Wait > 500ms. Open DevTools → Application → Local Storage → confirm `bluefinwiki:draft:{guid}` is set.
- [ ] Refresh the page. The draft content (not the server content) shows up — confirming `Drafts.get()` is preferred.
- [ ] Click Save. URL navigates back to `/pages/{guid}`. The rendered markdown matches what you typed. `bluefinwiki:draft:{guid}` is gone from localStorage.
- [ ] Expand a page in the tree to load its children. Drag one child onto another node. The drop succeeds, and the tree refreshes to show the new parent containing the moved page.
- [ ] Drag a page to the "Drop here to make a root page" zone. The page becomes a root page.
- [ ] Double-click a page in the tree. The rename overlay appears, focused. Change the title and press Enter. The tree updates with the new title.
- [ ] Click the hover-revealed delete button on a tree item. Confirm in the prompt. The page disappears from the tree.
- [ ] Open DevTools Console — no errors during any of the above.

- [ ] **Step 5: Phase 3 exit checklist**

All boxes must be true before declaring Phase 3 complete:

- [ ] `npm run lint` — 0 errors, 0 warnings.
- [ ] `npm test` — all tests pass, 0 skipped (except the documented CodeMirror Ctrl+S test if it landed as `xit` in Phase 2).
- [ ] `npm run build` — succeeds.
- [ ] `npm run build:prod` — succeeds with the stub `NG_APP_*` env vars Phase 1 added (still no production deploy).
- [ ] The Step 4 manual smoke checklist is all green.
- [ ] No production push, no `git push`, no `deploy-infra` runs — per the local-only constraint.
- [ ] If any surprises hit during the phase (Material 21 + zoneless quirks, CDK 21 drag-drop oddities, jsdom focus issues, etc.), capture a memory entry before moving on.

- [ ] **Step 6: Final commit (if anything was tweaked during smoke)**

```bash
git -C BluefinWiki status
# only commit if there are actual changes from the smoke pass
git -C BluefinWiki add frontend-angular/
git -C BluefinWiki commit -m "fix(angular): Phase 3 smoke-test follow-ups"
```

- [ ] **Step 7: Tag (local-only)**

```bash
git -C BluefinWiki tag phase-3-pages-mvp
```

Do **not** `git push` the tag — per the local-only constraint.

---

## What's next

Phase 3 leaves you with:
- A signed-in user can navigate, read, and edit pages.
- Drafts persist across reloads and route changes via the same localStorage keys as React.
- Drag-drop reparents pages, with the page-type constraint helper ready to enforce rules once Phase 6's `PageTypesService` populates the map.
- `PagesService`, `Drafts`, and `Layout` are signal/resource-shaped and consumable by the rest of the phases.

Hand back to the writing-plans skill to draft **Phase 4: Editor extras** — InspectorPanel, PagePropertiesPanel, CustomPropertiesEditor, AttachmentManager + AttachmentUploader + FileUpload, LinkAutocomplete, MarkdownToolbar, ResizeDivider, EditorErrorBoundary, NewPageModal, CreatePageFromLinkModal, LinkedPagesPanel, PageContextMenu. Phase 4's first task should wire the `EditorView.editable.reconfigure` effect into `<wiki-codemirror>` (the Phase 2 carry-forward) and convert `PageView` to an in-route edit/view toggle.
