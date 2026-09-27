# React → Angular Conversion — Phase 4: Editor Extras

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** `docs/superpowers/specs/2026-05-21-bluefinwiki-react-to-angular-design.md`
**Roadmap:** `docs/superpowers/plans/2026-05-21-bluefinwiki-react-to-angular-roadmap.md`
**Branch:** `feat/angular-rewrite` (continues from local tag `phase-3-pages-mvp`, commit `9cf95f1` + plan doc commit `896dcc7`).
**Working directory:** `BluefinWiki/frontend-angular/`.

**Goal:** Bring the page-editing experience up to feature parity with React: page creation, full property editing, custom page-type properties, attachments (presigned-URL upload + list + delete), link autocomplete in the editor, formatting toolbar, backlinks panel, resize divider, context menu, broken-link "create page" flow. Wire it all into an `InspectorPanel` (right-side tabbed pane). Add a render-error fallback for the editor pane. Keep `npm run lint`, `npm test`, and `npm run build` green.

**Architecture:**
- **Inspector pattern:** A right-side `<mat-sidenav>` hosts a tabbed pane (`Properties`, `Attachments`, `Linked`). Toggled via a button in the `PageEdit`/`PageView` header. Width persists via `LayoutService`. On mobile (CDK `BreakpointObserver` → `Breakpoints.Small`/`Handset`), the same content opens as a `<mat-bottom-sheet>` instead. (Phase 4 ships the sidenav shell; mobile bottom-sheet variant can be a single `@if (isMobile())` swap inside the same component.)
- **Toolbar + editor wiring:** A new `<wiki-markdown-toolbar>` component emits `(action)` events with a `ToolbarAction` union. `<wiki-codemirror>` exposes an `applyAction()` method that dispatches the corresponding CM6 transaction. `PageEdit` owns the bus between them.
- **Link autocomplete:** Driven by a `cursorAt: Signal<{ from: number; to: number; query: string } | null>` exposed by `<wiki-codemirror>`. When non-null, a `<wiki-link-autocomplete>` overlay renders below the cursor coordinates, queries `pagesService.pageSearch(query)` (a new `rxResource`-backed reader), and on select dispatches a CM6 transaction that replaces the `[[query]` segment with the resolved `[[Title]]` or `[[guid|Display]]`.
- **Attachments:** `Attachments` service mirrors `frontend/src/hooks/useAttachments.ts` — three-step pipeline: presign → S3 PUT → confirm. We use Angular's `HttpClient` for the presign + confirm legs and **bypass the auth interceptor** for the S3 PUT by hitting `uploadUrl` (an absolute, presigned URL) — the interceptor's check is `req.url.startsWith('/api')`, so absolute S3 URLs flow through untouched. Validation lives in `attachment.types.ts` ported verbatim from React.
- **Page types:** `PageTypes` service ships in Phase 4 (read-only) because `PagePropertiesPanel` + `CustomPropertiesEditor` + `NewPageModal` all need the schema. Phase 6's admin component will reuse this service and add mutations.
- **Error boundary:** Angular's `GlobalErrorHandler` already exists (Phase 1). Phase 4 extends it with an injectable `EditorErrorState` signal — when set, `PageEdit` renders an inline retry panel instead of the editor. Cleared via a "Reload editor" button that bumps a `version` signal forcing remount of `<wiki-codemirror>`.

**Tech stack additions:** none new — `@angular/cdk@21` + `@angular/material@21` are already installed.

**Carry-forward from Phase 2:** `<wiki-codemirror>`'s `editable` input is read once at init. Task 1 wires an `effect()` that dispatches `EditorView.editable.reconfigure(this.editable())` on change. This unlocks an in-route view/edit toggle (Task 17). For Phase 4 we **keep** the split `/pages/:guid` and `/pages/:guid/edit` routes — the toggle is **inside** `/pages/:guid/edit` between "preview" and "edit" view-modes (mirroring React's `EditorPane` view-mode toggle).

**Spec → plan adjustments locked in here:**
- Mobile drawer for the page-tree sidebar (`MobileDrawer` in React) is out of scope for Phase 4; the existing fixed sidebar stays. Mobile support across the app is a polish pass after Phase 8 cutover.
- `TableOfContents` (a React polish in `EditorPane`) is deferred — not core to editing.
- `MarkdownEditor` and `MarkdownPreview` (React wrapper layers around `<WikiCodemirror>` and `<MarkdownRenderer>`) don't get separate Angular components — `PageEdit` and `PageView` consume the shared primitives directly.
- `useTags` (tag-vocabulary autocomplete) is deferred — Phase 4 tag input is plain free-form chips.
- `Breadcrumbs` is added in Task 17 alongside the inspector wiring (it shares the page-ancestors data already exposed by `PagesService.ancestorsResource`).

**Cross-phase reminders (don't re-litigate per task):**
- Per `feedback_bluefinwiki_angular_local_only`: no `git push`, no `deploy-infra`, no tag push. Commits stay local. CI gates are out — local lint+test+build is the gate.
- Per `feedback_angular_21_zoneless_testing`: in tests, flush effects with `for (let i=0; i<5; i++) await Promise.resolve(); TestBed.tick(); for (let i=0; i<5; i++) await Promise.resolve();`. Call `render()` before `TestBed.inject(...)`. Don't read `input.required()` in the constructor — use `afterNextRender` or `ngOnInit`.
- Per `feedback_angular_no_suffix_naming`: files are kebab-case, no `.component`/`.service`/`.directive` suffix. Class is the noun. Guards/interceptors keep their suffix.
- Per `feedback_angular_effect_signal_writes`: don't add `allowSignalWrites: true` — Angular 19+ dropped it.
- Per `reference_react_remark_wiki_links_bug`: standalone `[[Title]]` already renders correctly in the Angular port (verified by Phase 2 regression test).
- Markdown imports of `<wiki-mermaid>` transitively pull in `khroma` — any spec that mounts a markdown-rendering component needs `jest.mock('mermaid', () => ({ __esModule: true, default: { initialize: jest.fn(), render: jest.fn().mockResolvedValue({ svg: '' }) } }));` at the top.

---

## Task 1: `<wiki-codemirror>` editable reconfigure (Phase 2 carry-forward)

**Files:**
- Modify: `BluefinWiki/frontend-angular/src/app/shared/codemirror/wiki-codemirror.ts`
- Modify: `BluefinWiki/frontend-angular/src/app/shared/codemirror/wiki-codemirror.spec.ts`

Add a `Compartment` for the `editable` extension and an `effect()` that dispatches `editable.reconfigure(...)` on input change. Add `applyAction()` and `insertText()` helper methods that Phase 4's toolbar and link-autocomplete will call.

- [ ] **Step 1: Add the failing test**

Append to `wiki-codemirror.spec.ts`:

```ts
it('toggling editable input dispatches reconfigure', async () => {
  const { fixture } = await render(WikiCodemirror, { inputs: { value: 'a', editable: true } });
  fixture.detectChanges();
  const view = fixture.componentInstance.getView();
  expect(view).not.toBeNull();
  const editableBefore = view!.state.facet(EditorView.editable);
  expect(editableBefore).toBe(true);

  fixture.componentRef.setInput('editable', false);
  fixture.detectChanges();
  await Promise.resolve();

  const editableAfter = view!.state.facet(EditorView.editable);
  expect(editableAfter).toBe(false);
});

it('applyAction("bold") wraps the selection with **', async () => {
  const { fixture } = await render(WikiCodemirror, { inputs: { value: 'hello world' } });
  fixture.detectChanges();
  const view = fixture.componentInstance.getView();
  view!.dispatch({ selection: { anchor: 0, head: 5 } });
  fixture.componentInstance.applyAction('bold');
  expect(view!.state.doc.toString()).toBe('**hello** world');
});

it('insertText replaces a range with the given text', async () => {
  const { fixture } = await render(WikiCodemirror, { inputs: { value: 'foo bar baz' } });
  fixture.detectChanges();
  fixture.componentInstance.insertText(4, 7, 'BAR');
  expect(fixture.componentInstance.getView()!.state.doc.toString()).toBe('foo BAR baz');
});
```

Run:
```bash
npm test -- wiki-codemirror
```
Expected: 3 new tests fail.

- [ ] **Step 2: Implement compartment + applyAction + insertText**

Modify `wiki-codemirror.ts`:

1. Add `Compartment` import: `import { Compartment, EditorState, type Extension } from '@codemirror/state';`
2. Add a `private readonly editableCompartment = new Compartment();` field.
3. In `makeState()`, replace `EditorView.editable.of(this.editable())` with `this.editableCompartment.of(EditorView.editable.of(this.editable()))`.
4. Add an effect in the constructor (after the existing value-sync effect):

```ts
effect(() => {
  const editable = this.editable();
  const view = this.view;
  if (!view) return;
  view.dispatch({
    effects: this.editableCompartment.reconfigure(EditorView.editable.of(editable)),
  });
});
```

5. Add public methods:

```ts
applyAction(action: 'bold' | 'italic' | 'strikethrough' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'ul' | 'ol' | 'task' | 'link' | 'code' | 'codeblock'): void {
  const view = this.view;
  if (!view) return;
  const { from, to } = view.state.selection.main;
  const selected = view.state.doc.sliceString(from, to);
  const wrap = (open: string, close = open, fallback = '') =>
    ({ from, to, insert: `${open}${selected || fallback}${close}` });
  const prefix = (p: string, fallback = '') =>
    ({ from, to, insert: `${p}${selected || fallback}` });
  let changes;
  switch (action) {
    case 'bold': changes = wrap('**', '**', 'bold text'); break;
    case 'italic': changes = wrap('*', '*', 'italic text'); break;
    case 'strikethrough': changes = wrap('~~', '~~', 'strikethrough text'); break;
    case 'h1': changes = prefix('# ', 'Heading 1'); break;
    case 'h2': changes = prefix('## ', 'Heading 2'); break;
    case 'h3': changes = prefix('### ', 'Heading 3'); break;
    case 'h4': changes = prefix('#### ', 'Heading 4'); break;
    case 'h5': changes = prefix('##### ', 'Heading 5'); break;
    case 'h6': changes = prefix('###### ', 'Heading 6'); break;
    case 'ul': changes = prefix('- ', 'List item'); break;
    case 'ol': changes = prefix('1. ', 'List item'); break;
    case 'task': changes = prefix('- [ ] ', 'Task'); break;
    case 'link': changes = wrap('[', '](url)', 'link text'); break;
    case 'code': changes = wrap('`', '`', 'code'); break;
    case 'codeblock': changes = wrap('```\n', '\n```', 'code'); break;
  }
  view.dispatch({ changes, selection: { anchor: from + changes.insert.length } });
  view.focus();
}

insertText(from: number, to: number, text: string): void {
  const view = this.view;
  if (!view) return;
  view.dispatch({ changes: { from, to, insert: text }, selection: { anchor: from + text.length } });
  view.focus();
}
```

6. Run:
```bash
npm test -- wiki-codemirror
```
Expected: all wiki-codemirror tests pass (including the 5 prior + 3 new).

- [ ] **Step 3: Lint + commit**

```bash
npm run lint
git -C BluefinWiki add frontend-angular/
git -C BluefinWiki commit -m "feat(angular): WikiCodemirror editable compartment + applyAction + insertText"
```

---

## Task 2: `PageTypes` service (read-only)

**Files:**
- Create: `BluefinWiki/frontend-angular/src/app/features/page-types/page-types.ts`
- Create: `BluefinWiki/frontend-angular/src/app/features/page-types/page-types.spec.ts`

Mirror Phase 3's `PagesService` shape: `rxResource` readers + `bumpVersion`. Three readers:

| Method | Endpoint | Returns |
|---|---|---|
| `pageTypesResource()` (no params) | `GET /api/page-types` | `PageTypeDefinition[]` |
| `pageTypeResource(guid)` | `GET /api/page-types/:guid` | `PageTypeDefinition` |
| `allowedChildTypesResource(parentTypeGuid)` | `GET /api/page-types/:guid/allowed-children` | `{ allowedChildTypes, allowWikiPageChildren }` |

Add a `SKIP_FETCH: unique symbol` sentinel for consumers that want to disable the fetch (mirroring Phase 3's pattern in `Pages`).

Test shape (~6 tests): GET-the-right-URL, reruns on signal change, bumpVersion refetches. Follow `pages.spec.ts` style — see Phase 3.

- [ ] **Step 1:** Write `page-types.spec.ts` covering the three readers + bumpVersion.
- [ ] **Step 2:** Implement `page-types.ts`. Pattern:

```ts
import { HttpClient } from '@angular/common/http';
import { Injectable, type Signal, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import type { PageTypeDefinition } from '../pages/page.types';

export const SKIP_PAGE_TYPE_FETCH: unique symbol = Symbol('SKIP_PAGE_TYPE_FETCH');

@Injectable({ providedIn: 'root' })
export class PageTypes {
  private readonly http = inject(HttpClient);
  private readonly _version = signal(0);

  bumpVersion(): void { this._version.update((v) => v + 1); }

  pageTypesResource() {
    return rxResource({
      params: () => this._version(),
      stream: () => this.http.get<{ pageTypes: PageTypeDefinition[] }>('/api/page-types').pipe(map((r) => r.pageTypes ?? [])),
    });
  }

  pageTypeResource(guid: Signal<string | null | typeof SKIP_PAGE_TYPE_FETCH>) {
    return rxResource({
      params: () => ({ guid: guid(), v: this._version() }),
      stream: ({ params }) => {
        if (params.guid === SKIP_PAGE_TYPE_FETCH || !params.guid) throw new Error('skip');
        return this.http.get<PageTypeDefinition>(`/api/page-types/${params.guid}`);
      },
    });
  }

  allowedChildTypesResource(parentTypeGuid: Signal<string | null | typeof SKIP_PAGE_TYPE_FETCH>) {
    return rxResource({
      params: () => ({ guid: parentTypeGuid(), v: this._version() }),
      stream: ({ params }) => {
        if (params.guid === SKIP_PAGE_TYPE_FETCH || !params.guid) throw new Error('skip');
        return this.http.get<{ allowedChildTypes: PageTypeDefinition[]; allowWikiPageChildren: boolean }>(
          `/api/page-types/${params.guid}/allowed-children`,
        );
      },
    });
  }
}
```

- [ ] **Step 3:** `npm run lint && npm test -- page-types && git -C BluefinWiki commit -m "feat(angular): PageTypes service (read-only) for Phase 4 consumers"`

---

## Task 3: Port `attachment.types.ts`

**Files:**
- Create: `BluefinWiki/frontend-angular/src/app/features/attachments/attachment.types.ts`
- Create: `BluefinWiki/frontend-angular/src/app/features/attachments/attachment.types.spec.ts`

Port `BluefinWiki/frontend/src/types/attachment.ts` byte-for-byte (it's pure TS). Export `AttachmentMetadata`, `AttachmentUploadResponse`, `AttachmentUploadProgress`, `AttachmentValidationError`, `FILE_LIMITS`, `ALLOWED_MIME_TYPES`, `validateFile`, `formatFileSize`, `isImageFile`.

Test the validators (~5 tests): valid image, oversized image rejected, unsupported mime rejected, formatFileSize for KB/MB/GB, isImageFile true/false.

- [ ] **Step 1:** Write tests against the exported functions.
- [ ] **Step 2:** Copy the React file content verbatim into the new location.
- [ ] **Step 3:** `npm run lint && npm test -- attachment.types && git -C BluefinWiki commit -m "feat(angular): port attachment.types for Phase 4 uploads"`

---

## Task 4: `Attachments` service (presigned upload + list + delete)

**Files:**
- Create: `BluefinWiki/frontend-angular/src/app/features/attachments/attachments.ts`
- Create: `BluefinWiki/frontend-angular/src/app/features/attachments/attachments.spec.ts`

Three-step pipeline mirroring React's `useAttachments`:
1. `POST /api/pages/:guid/attachments/presign` → `{ uploadUrl, attachmentKey, filename }`
2. `PUT <uploadUrl>` with the file body (Content-Type set, no auth — absolute URL bypasses the `/api` interceptor)
3. `POST /api/pages/:guid/attachments/confirm` → `AttachmentUploadResponse`

API surface:
```ts
@Injectable({ providedIn: 'root' })
export class Attachments {
  uploadFile(pageGuid: string, file: File, onProgress?: (pct: number) => void): Promise<AttachmentUploadResponse>;
  listResource(pageGuid: Signal<string | null>): ResourceRef<AttachmentMetadata[] | undefined>;
  async deleteAttachment(pageGuid: string, filename: string): Promise<void>;
  bumpVersion(): void;
}
```

Validate via `validateFile()` from Task 3 before the presign call.

The S3 PUT progress callback uses Angular's `HttpClient` event stream: `this.http.put(url, file, { observe: 'events', reportProgress: true })` and emits the percentage from `HttpEventType.UploadProgress`.

Tests (~8): presign called with right body, S3 PUT bypasses interceptor, confirm called with right body, list rxResource fires, listResource reruns after bumpVersion, delete sends DELETE, validation rejects oversized image, validation rejects unsupported mime.

- [ ] **Step 1:** Write the spec.
- [ ] **Step 2:** Implement.
- [ ] **Step 3:** `npm run lint && npm test -- attachments.spec && git -C BluefinWiki commit -m "feat(angular): Attachments service with presigned upload pipeline"`

**Snippet for the upload pipeline:**

```ts
async uploadFile(pageGuid: string, file: File, onProgress?: (pct: number) => void): Promise<AttachmentUploadResponse> {
  const validationError = validateFile(file);
  if (validationError) throw new Error(validationError);

  // 1. presign
  onProgress?.(5);
  const presign = await firstValueFrom(
    this.http.post<{ uploadUrl: string; attachmentKey: string; filename: string }>(
      `/api/pages/${pageGuid}/attachments/presign`,
      { filename: file.name, contentType: file.type, size: file.size },
    ),
  );

  // 2. S3 PUT — absolute URL, bypasses /api interceptor
  await firstValueFrom(
    this.http.put(presign.uploadUrl, file, {
      headers: { 'Content-Type': file.type },
      observe: 'events',
      reportProgress: true,
    }).pipe(
      tap((event) => {
        if (event.type === HttpEventType.UploadProgress && event.total) {
          onProgress?.(10 + Math.round((event.loaded * 80) / event.total));
        }
      }),
      filter((event) => event.type === HttpEventType.Response),
    ),
  );

  // 3. confirm
  onProgress?.(95);
  const confirmed = await firstValueFrom(
    this.http.post<AttachmentUploadResponse>(
      `/api/pages/${pageGuid}/attachments/confirm`,
      { filename: presign.filename, contentType: file.type, size: file.size, attachmentKey: presign.attachmentKey },
    ),
  );
  onProgress?.(100);
  this.bumpVersion();
  return confirmed;
}
```

---

## Task 5: `<wiki-resize-divider>`

**Files:**
- Create: `BluefinWiki/frontend-angular/src/app/shared/components/resize-divider.ts`
- Create: `BluefinWiki/frontend-angular/src/app/shared/components/resize-divider.spec.ts`

A draggable divider that emits a stream of pixel positions. Backed by CDK's `CdkDrag` with `cdkDragLockAxis="x"` (vertical orientation, horizontal drag) or `"y"` (horizontal orientation, vertical drag).

API:
```ts
@Component({ selector: 'wiki-resize-divider', ... })
export class ResizeDivider {
  readonly orientation = input<'horizontal' | 'vertical'>('vertical');
  readonly resize = output<number>(); // emits new pixel position (clientX or clientY)
}
```

Implementation: render a thin draggable handle. Bind `(cdkDragMoved)` to `(event) => this.resize.emit(event.pointerPosition.x)` (or `.y`). Use `[cdkDragFreeDragPosition]` plus a `position` reset effect to keep the element from drifting visually — CDK draggables physically move by default. The dance:

```ts
import { CdkDrag, CdkDragMove } from '@angular/cdk/drag-drop';

@Component({
  selector: 'wiki-resize-divider',
  standalone: true,
  imports: [CdkDrag],
  template: `
    <div
      class="divider"
      [class.vertical]="orientation() === 'vertical'"
      [class.horizontal]="orientation() === 'horizontal'"
      cdkDrag
      [cdkDragLockAxis]="orientation() === 'vertical' ? 'x' : 'y'"
      [cdkDragFreeDragPosition]="{ x: 0, y: 0 }"
      (cdkDragMoved)="onMove($event)"
      (cdkDragEnded)="resetPosition()"
    ></div>
  `,
  styles: [`
    .divider { background: transparent; }
    .divider.vertical { width: 4px; cursor: col-resize; }
    .divider.horizontal { height: 4px; cursor: row-resize; }
    .divider:hover { background: #2563eb; }
  `],
})
export class ResizeDivider {
  readonly orientation = input<'horizontal' | 'vertical'>('vertical');
  readonly resize = output<number>();

  // Force the position back to {0,0} after each drag so the divider doesn't physically move
  protected readonly position = signal({ x: 0, y: 0 });

  onMove(event: CdkDragMove): void {
    const pos = this.orientation() === 'vertical'
      ? event.pointerPosition.x
      : event.pointerPosition.y;
    this.resize.emit(pos);
  }

  resetPosition(): void {
    // CDK auto-resets via [cdkDragFreeDragPosition]={x:0,y:0}; no-op kept for clarity
  }
}
```

Tests (~3): renders a draggable element, emits `resize` when dragged (use `CdkDragMove`-shaped synthetic event), respects orientation.

- [ ] **Step 1:** Spec — synthetic `cdkDragMoved` event with `pointerPosition: { x: 250, y: 0 }` should fire `resize` with `250`.
- [ ] **Step 2:** Implement.
- [ ] **Step 3:** `npm run lint && npm test -- resize-divider && git -C BluefinWiki commit -m "feat(angular): ResizeDivider with CDK lockAxis"`

---

## Task 6: `<wiki-markdown-toolbar>`

**Files:**
- Create: `BluefinWiki/frontend-angular/src/app/features/editor/markdown-toolbar.ts`
- Create: `BluefinWiki/frontend-angular/src/app/features/editor/markdown-toolbar.spec.ts`

Single `output<ToolbarAction>('action')`. Renders Material icon buttons via `mat-icon-button`. Use a `mat-menu` for the heading dropdown (h1–h6). Use built-in Material icons (`format_bold`, `format_italic`, `strikethrough_s`, `format_list_bulleted`, `format_list_numbered`, `check_box`, `link`, `code`, `data_object` for codeblock).

Don't ship a `compact` mode in Phase 4 — defer mobile-specific layout to a polish pass.

`ToolbarAction` type lives in this file (re-exported), matching the union in Task 1's `applyAction`.

Tests (~4): clicking bold emits `'bold'`, clicking each heading in the menu emits the right h1–h6 string, disabled prop disables all buttons, all action buttons are accessible by `aria-label`.

- [ ] **Step 1:** Spec.
- [ ] **Step 2:** Implement.
- [ ] **Step 3:** `npm run lint && npm test -- markdown-toolbar && git -C BluefinWiki commit -m "feat(angular): MarkdownToolbar with Material icon buttons"`

---

## Task 7: `<wiki-link-autocomplete>` overlay

**Files:**
- Create: `BluefinWiki/frontend-angular/src/app/features/editor/link-autocomplete.ts`
- Create: `BluefinWiki/frontend-angular/src/app/features/editor/link-autocomplete.spec.ts`
- Modify: `BluefinWiki/frontend-angular/src/app/features/pages/pages.ts` (add `pageSearchResource`)

First add to `Pages` service:

```ts
export interface PageSearchResult { guid: string; title: string; path: string; folderId: string | null; }

// In Pages class:
pageSearchResource(query: Signal<string | null>) {
  return rxResource({
    params: () => ({ q: query()?.trim() ?? '', v: this._version() }),
    stream: ({ params }) => {
      if (!params.q) throw new Error('skip');
      return this.http.get<{ results: PageSearchResult[] }>(`/api/pages/search?q=${encodeURIComponent(params.q)}&limit=10`).pipe(map((r) => r.results ?? []));
    },
  });
}
```

Then the autocomplete component:

```ts
@Component({
  selector: 'wiki-link-autocomplete',
  standalone: true,
  imports: [],
  template: `
    @if (visible() && (results.value()?.length ?? 0) > 0) {
      <div
        class="autocomplete"
        [style.top.px]="position().top"
        [style.left.px]="position().left"
        role="listbox"
      >
        @for (item of results.value() ?? []; track item.guid; let i = $index) {
          <button
            type="button"
            class="item"
            [class.selected]="i === selectedIndex()"
            (click)="selectIndex(i)"
            role="option"
          >
            <span class="title">{{ item.title }}</span>
            <span class="path">{{ item.path }}</span>
          </button>
        }
      </div>
    }
  `,
  styles: [`
    .autocomplete { position: fixed; background: white; border: 1px solid #cbd5e1; border-radius: 4px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); z-index: 100; min-width: 240px; max-width: 360px; }
    .item { display: flex; flex-direction: column; align-items: flex-start; width: 100%; padding: 0.5rem 0.75rem; border: 0; background: none; cursor: pointer; }
    .item.selected, .item:hover { background: #dbeafe; }
    .title { font-weight: 500; }
    .path { font-size: 0.75rem; color: #6b7280; }
  `],
})
export class LinkAutocomplete {
  private readonly pages = inject(Pages);

  readonly query = input.required<string>();
  readonly position = input.required<{ top: number; left: number }>();
  readonly visible = input.required<boolean>();
  readonly select = output<PageSearchResult>();
  readonly dismiss = output<void>();

  protected readonly selectedIndex = signal(0);
  // Debounce query via toSignal + debounceTime — simplest: wrap input in computed with setTimeout? Use rxjs:
  private readonly query$ = toObservable(this.query).pipe(debounceTime(200), distinctUntilChanged());
  private readonly debouncedQuery = toSignal(this.query$, { initialValue: '' });

  protected readonly results = this.pages.pageSearchResource(this.debouncedQuery);

  @HostListener('window:keydown', ['$event'])
  onKey(event: KeyboardEvent): void {
    if (!this.visible()) return;
    const len = this.results.value()?.length ?? 0;
    if (event.key === 'ArrowDown') { this.selectedIndex.update((i) => (i + 1) % Math.max(len, 1)); event.preventDefault(); }
    else if (event.key === 'ArrowUp') { this.selectedIndex.update((i) => (i - 1 + len) % Math.max(len, 1)); event.preventDefault(); }
    else if (event.key === 'Enter') { this.selectCurrent(); event.preventDefault(); }
    else if (event.key === 'Escape') { this.dismiss.emit(); event.preventDefault(); }
  }

  selectIndex(i: number): void {
    const r = this.results.value()?.[i];
    if (r) this.select.emit(r);
  }

  selectCurrent(): void {
    this.selectIndex(this.selectedIndex());
  }
}
```

Tests (~4): renders results from the resource, ArrowDown moves selection, Enter emits select with current item, Escape emits dismiss. Mock `Pages.pageSearchResource` via `provideHttpClientTesting` + flushing the canned response.

- [ ] **Step 1:** Add `pageSearchResource` to `Pages` service + test.
- [ ] **Step 2:** Write `link-autocomplete.spec.ts`.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** `npm run lint && npm test -- link-autocomplete && git -C BluefinWiki commit -m "feat(angular): LinkAutocomplete overlay with debounced search"`

---

## Task 8: `<wiki-page-context-menu>` (mat-menu)

**Files:**
- Create: `BluefinWiki/frontend-angular/src/app/features/pages/page-context-menu.ts`
- Create: `BluefinWiki/frontend-angular/src/app/features/pages/page-context-menu.spec.ts`
- Modify: `BluefinWiki/frontend-angular/src/app/features/pages/page-tree-item.ts` (wire right-click → open menu)
- Modify: `BluefinWiki/frontend-angular/src/app/features/pages/pages-view.ts` (handle new menu outputs: sort children)

Use Angular Material's `MatMenu` + `MatMenuTrigger` triggered by a right-click handler. Items: Rename, New Child Page, Sort Children A–Z (only when hasChildren), Sort Children Z–A (only when hasChildren), Move, Delete (admin-only).

The menu emits `(rename)`, `(newChild)`, `(sort)` (with direction), `(move)`, `(delete)` events that bubble up to `PagesView`.

Implementation hint: use a single `MatMenu` defined in `PageTreeItem`'s template. Open it via `MatMenuTrigger` positioned at the cursor (Material 21 supports `[matMenuTriggerData]` and `openMenu()` from a synthesized origin). The simplest path: wrap the row in a `[matContextMenu]` directive — but Material doesn't ship one out of the box, so we hand-roll the trigger:

```ts
// In page-tree-item.ts:
import { MatMenu, MatMenuTrigger } from '@angular/material/menu';
@ViewChild(MatMenuTrigger) menuTrigger!: MatMenuTrigger;

onContextMenu(event: MouseEvent): void {
  event.preventDefault();
  // Position the menu at the cursor.
  this.menuPosition.set({ x: event.clientX + 'px', y: event.clientY + 'px' });
  this.menuTrigger.openMenu();
}
```

And in the template, an invisible trigger anchored at `[style.left]="menuPosition().x" [style.top]="menuPosition().y" style="position: fixed;"`.

`PagesView` handles the events:
- `rename(guid)` → existing `renameTarget.set(...)` flow
- `newChild(guid)` → open `NewPageModal` (Task 9) with `parentGuid: guid`
- `sort(guid, direction)` → fetch children, sort by title (matching React's `replace(/^(the|a|an)\s+/i, '')` rule), call `pages.reorderPages({ parentGuid: guid, orderedGuids })`
- `move(guid)` → `alert('Move dialog coming in a later phase')` for Phase 4; full move dialog is out of scope
- `delete(guid)` → existing delete flow

Tests (~4): menu opens on right-click, rename item emits rename with guid, sort A-Z item emits sort with 'asc', delete is hidden when user is not admin (use a mock `Auth` service with role: 'Standard').

- [ ] **Step 1:** Spec.
- [ ] **Step 2:** Implement.
- [ ] **Step 3:** Wire into `PageTreeItem` (`@HostListener('contextmenu')`) and `PagesView` (handle sort + newChild outputs).
- [ ] **Step 4:** `npm run lint && npm test -- page-context-menu && git -C BluefinWiki commit -m "feat(angular): PageContextMenu with Material mat-menu"`

---

## Task 9: `<wiki-new-page-modal>` (mat-dialog)

**Files:**
- Create: `BluefinWiki/frontend-angular/src/app/features/pages/new-page-modal.ts`
- Create: `BluefinWiki/frontend-angular/src/app/features/pages/new-page-modal.spec.ts`
- Modify: `BluefinWiki/frontend-angular/src/app/features/pages/pages.ts` — add `async createPage(req: CreatePageRequest): Promise<PageContent>`
- Modify: `BluefinWiki/frontend-angular/src/app/features/pages/pages-view.ts` (re-enable "New page" button + wire modal)

Material `<mat-dialog>` opened via `MatDialog`. Form fields:
- Title (required, 3–100 chars)
- Description (optional)
- Parent — fixed by the caller (read-only display: parent title from `pages.pageResource(parentGuid)` when set, "Root" when null)
- Page type dropdown — `(none)` + entries from `pageTypes.allowedChildTypesResource(parentTypeGuid)` when parent has a type, else from `pageTypes.pageTypesResource()`. Hide the dropdown if no types exist.
- (Custom properties live in Phase 4's `PagePropertiesPanel` Task 12; the modal does NOT include them — page-type properties get filled in after creation. Matches React behaviour roughly; deviation is the property-inheritance step which we skip.)

On submit: call `pages.createPage(req)`, emit `(created)` with the new page guid.

Tests (~5): renders with title input, rejects empty title, calls `createPage` with right body on submit, emits `created` with new guid, dropdown lists allowed child types from `allowedChildTypesResource`.

- [ ] **Step 1:** Add `createPage` to `Pages` + test it.
- [ ] **Step 2:** Spec the modal.
- [ ] **Step 3:** Implement the modal.
- [ ] **Step 4:** Wire the "New page" button in `PagesView` (and in `PageContextMenu`'s `newChild`): open via `MatDialog.open(NewPageModal, { data: { parentGuid } })`; on `afterClosed()`, if a guid comes back, `router.navigate(['/pages', guid, 'edit'])`.
- [ ] **Step 5:** `npm run lint && npm test -- new-page-modal && git -C BluefinWiki commit -m "feat(angular): NewPageModal with page-type-aware dropdown"`

---

## Task 10: `<wiki-create-page-from-link-modal>`

**Files:**
- Create: `BluefinWiki/frontend-angular/src/app/features/pages/create-page-from-link-modal.ts`
- Create: `BluefinWiki/frontend-angular/src/app/features/pages/create-page-from-link-modal.spec.ts`

When the user clicks a broken `<wiki-link>` in the renderer, this modal opens prefilled with the link target as the title. On submit, creates the page **at the same parent** as the current page (received via `data`).

This is a thin wrapper around the Task 9 modal logic — could share component, but cleaner to keep separate so the broken-link UX (warning copy: "This page doesn't exist yet. Create it?") differs.

Tests (~3): prefills title from `data.target`, creates with parent set to `data.parentGuid`, emits `created` event.

- [ ] **Step 1:** Spec + implement + wire `<wiki-link>`'s `(brokenClick)` in `PageView` to open this modal.
- [ ] **Step 2:** `npm run lint && npm test -- create-page-from-link-modal && git -C BluefinWiki commit -m "feat(angular): CreatePageFromLinkModal for broken wiki-link clicks"`

---

## Task 11: `<wiki-page-properties-panel>`

**Files:**
- Create: `BluefinWiki/frontend-angular/src/app/features/editor/page-properties-panel.ts`
- Create: `BluefinWiki/frontend-angular/src/app/features/editor/page-properties-panel.spec.ts`

Reactive forms (Material `<mat-form-field>` + `MatInput` + `MatSelect` + chip input for tags). Two-way binds via `model<PageMetadata>()` — emits a partial-update event whenever any field changes (debounced 200ms to avoid flooding).

Field list (matching React):
- Title (text input — usually editable elsewhere but render here as well)
- Tags (chip input, no autocomplete from vocabulary in Phase 4 — `useTags` deferred)
- Status (`<mat-select>` with Draft/Published/Archived)
- Page type (`<mat-select>` with `(none)` + types from `pageTypesResource()`)
- Author (read-only, from metadata)
- Created/Modified timestamps (read-only)

Tests (~5): renders fields from metadata, edits emit changes (debounced — `await wait(250)`), status select changes the form value, page type select includes all types from resource, read-only mode hides edit affordances.

- [ ] **Step 1:** Spec + implement + commit (`feat(angular): PageProperties panel with reactive forms`).

---

## Task 12: `<wiki-custom-properties-editor>`

**Files:**
- Create: `BluefinWiki/frontend-angular/src/app/features/editor/custom-properties-editor.ts`
- Create: `BluefinWiki/frontend-angular/src/app/features/editor/custom-properties-editor.spec.ts`

Driven by the page-type's `properties` schema. For each schema property, render the appropriate input (string → text, number → number input, date → `<input type="date">` or `MatDatepicker`, tags → chip input).

API:
```ts
input.required<PageTypeDefinition>('pageType');
model<Record<string, PageProperty>>('properties');
input<boolean>('editable', true);
```

On any field change, emit a merged `properties` value via the `model`.

Tests (~4): renders one input per schema property, types render correct input types, editing string property updates the model, switching `editable` to false disables all inputs.

- [ ] **Step 1:** Spec + implement + commit (`feat(angular): CustomPropertiesEditor driven by page-type schema`).

---

## Task 13: `<wiki-linked-pages-panel>` + backlinks resource

**Files:**
- Create: `BluefinWiki/frontend-angular/src/app/features/pages/linked-pages-panel.ts`
- Create: `BluefinWiki/frontend-angular/src/app/features/pages/linked-pages-panel.spec.ts`
- Modify: `BluefinWiki/frontend-angular/src/app/features/pages/pages.ts` — add `backlinksResource(guid: Signal<string | null>)`

`backlinksResource` GETs `/api/pages/:guid/backlinks` → `{ guid, backlinks: Backlink[], count }`. Pattern matches `pageResource`.

The panel shows the backlinks list with each item linking to `/pages/:guid`. Empty state when count is 0.

Tests (~3): renders backlinks from resource, click navigates, empty state.

- [ ] **Step 1:** Add `backlinksResource` + test.
- [ ] **Step 2:** Spec the panel.
- [ ] **Step 3:** Implement + commit (`feat(angular): LinkedPagesPanel for backlinks`).

---

## Task 14: `<wiki-attachment-uploader>` + `<wiki-attachment-manager>`

**Files:**
- Create: `BluefinWiki/frontend-angular/src/app/features/attachments/attachment-uploader.ts`
- Create: `BluefinWiki/frontend-angular/src/app/features/attachments/attachment-uploader.spec.ts`
- Create: `BluefinWiki/frontend-angular/src/app/features/attachments/attachment-manager.ts`
- Create: `BluefinWiki/frontend-angular/src/app/features/attachments/attachment-manager.spec.ts`

**Uploader:** drop-zone + file-input that calls `Attachments.uploadFile` per file, tracks progress in a local `signal<Map<string, AttachmentUploadProgress>>`, emits `(uploaded)` per successful upload with the `AttachmentUploadResponse`. Uses Material `<mat-progress-bar>` per file.

**Manager:** lists attachments via `Attachments.listResource(pageGuid)`, each row has filename + size + uploaded date + "Insert into page" button (emits `insertMarkdown` with `![filename](url)` text) + "Delete" button (admin-only — or page author per existing React rule).

Tests (~6 total): uploader rejects unsupported file, progress updates as file uploads, manager renders attachments from resource, insert button emits markdown text, delete sends DELETE, delete is hidden for non-admin non-author.

- [ ] **Step 1:** Spec + implement uploader.
- [ ] **Step 2:** Spec + implement manager.
- [ ] **Step 3:** `npm run lint && npm test -- attachment- && git -C BluefinWiki commit -m "feat(angular): AttachmentUploader + AttachmentManager"`

---

## Task 15: `<wiki-inspector-panel>` (tabbed `mat-sidenav`)

**Files:**
- Create: `BluefinWiki/frontend-angular/src/app/features/editor/inspector-panel.ts`
- Create: `BluefinWiki/frontend-angular/src/app/features/editor/inspector-panel.spec.ts`

Material `<mat-tab-group>` with three tabs:
1. **Properties** — `<wiki-page-properties-panel>` + `<wiki-custom-properties-editor>` (only shown when page has a pageType)
2. **Attachments** — `<wiki-attachment-uploader>` + `<wiki-attachment-manager>`
3. **Links** — `<wiki-linked-pages-panel>` with the backlinks count as a badge on the tab label

Inputs: `pageGuid`, `metadata`, `currentUserId`, `currentUserRole`, `pageAuthorId`.
Outputs: `metadataChange`, `insertMarkdown`.

Tests (~3): renders three tabs, switching tabs swaps content, links tab shows badge count from backlinks resource.

- [ ] **Step 1:** Spec + implement + commit (`feat(angular): InspectorPanel with Properties/Attachments/Links tabs`).

---

## Task 16: `EditorErrorBoundary` via Angular `ErrorHandler`

**Files:**
- Modify: `BluefinWiki/frontend-angular/src/app/core/error/global-error-handler.ts`
- Create: `BluefinWiki/frontend-angular/src/app/core/error/editor-error-state.ts`
- Create: `BluefinWiki/frontend-angular/src/app/core/error/editor-error-state.spec.ts`

`EditorErrorState` is a small `@Injectable({ providedIn: 'root' })` service holding a `WritableSignal<{ message: string } | null>`. `GlobalErrorHandler` checks an editor scope token; in Phase 4 the simpler approach is: `GlobalErrorHandler` always sets `EditorErrorState` (clearing it when any successful navigation happens). `PageEdit` reads the signal and conditionally renders an inline retry panel.

Reasoning for the simpler approach: Angular's `ErrorHandler.handleError(err)` doesn't know what component threw. Tagging instances is awkward. For Phase 4 we accept the trade-off — any uncaught error in any component sets the editor state, but on navigation we clear it. The retry-reload button in `PageEdit` increments a `version` signal that's the key for `<wiki-codemirror>`, forcing a remount.

Tests (~3): `EditorErrorState` is null on init, `setError` sets a message, `clear` resets to null.

- [ ] **Step 1:** Spec + implement `EditorErrorState`.
- [ ] **Step 2:** Modify `GlobalErrorHandler` to call `EditorErrorState.setError(err.message)` in its `handleError`.
- [ ] **Step 3:** `git -C BluefinWiki commit -m "feat(angular): EditorErrorState + GlobalErrorHandler bridge"`

---

## Task 17: Wire everything into `PageEdit`, `PageView`, `PagesView` + `<wiki-breadcrumbs>`

**Files:**
- Modify: `BluefinWiki/frontend-angular/src/app/features/pages/page-edit.ts`
- Modify: `BluefinWiki/frontend-angular/src/app/features/pages/page-view.ts`
- Modify: `BluefinWiki/frontend-angular/src/app/features/pages/pages-view.ts`
- Create: `BluefinWiki/frontend-angular/src/app/shared/components/breadcrumbs.ts`
- Create: `BluefinWiki/frontend-angular/src/app/shared/components/breadcrumbs.spec.ts`

**Breadcrumbs:** Reads `pages.ancestorsResource(guid)`, renders a horizontal list of clickable ancestor links + the current page title.

**PageEdit changes:**
- Add a `<wiki-markdown-toolbar>` above the editor; bind `(action)` to `(action) => editor.applyAction(action)`.
- Add a viewchild ref `#editor` to `<wiki-codemirror>`.
- Add `<wiki-link-autocomplete>` overlay positioned at the cursor when CodeMirror detects `[[query` context. (Implementation in `<wiki-codemirror>`: emit a `cursorContext` signal that's null when not in `[[...]]` and `{ from, to, query, coords }` when in one. The autocomplete component uses these to position and search.)
  - For Phase 4, push the `[[…` detection into `<wiki-codemirror>` as a `cursorContext` `output` signal. Use a `EditorView.updateListener` that inspects the doc near the cursor: `regex /\[\[([^\]]*?)$/` against the current line up to the cursor.
- Add `<wiki-inspector-panel>` inside a `<mat-sidenav>` (right side, `mode="over"` on mobile, `"side"` on desktop via `BreakpointObserver`). Toggle button in the header.
- Re-mount key on `<wiki-codemirror>` driven by `EditorErrorState` retry version.
- Save button + Cancel button remain.

**PageView changes:**
- Add `<wiki-breadcrumbs>` above the rendered content.
- Wire `(brokenClick)` of `<wiki-markdown-renderer>` to open `<wiki-create-page-from-link-modal>`.

**PagesView changes:**
- Re-enable the "New page" button: opens `NewPageModal` with `parentGuid: null`.

Tests: light integration tests on each modified component verifying the new wiring loads (one or two assertions per component); the deep behaviour is already covered by Task 1–16 unit tests.

- [ ] **Step 1:** Breadcrumbs component + spec.
- [ ] **Step 2:** Wire `PageView` (breadcrumbs + broken-link modal). Add minimal `page-view.spec.ts` extension verifying breadcrumbs render.
- [ ] **Step 3:** Wire `PageEdit` (toolbar + autocomplete + inspector + error retry). Update `page-edit.spec.ts` to verify toolbar action triggers `applyAction` on the editor (mock the child component if needed).
- [ ] **Step 4:** Wire `PagesView` (new-page button live). Update spec.
- [ ] **Step 5:** Add `cursorContext` output to `<wiki-codemirror>` + small unit test verifying it fires when text is at `[[query` form.
- [ ] **Step 6:** `npm run lint && npm test && npm run build`
- [ ] **Step 7:** `git -C BluefinWiki commit -m "feat(angular): wire Phase 4 components into PageEdit/PageView/PagesView"`

---

## Task 18: Local smoke + Phase 4 exit checklist

**Files:** (no source changes)

- [ ] **Step 1: Cold local gate**

```bash
cd BluefinWiki/frontend-angular
rm -rf node_modules dist
npm ci
npm run lint && npm test && npm run build && npm run build:prod
```

All four must succeed. Per `feedback_npm_install_zero_warnings`, `npm ci` should be zero-warning. If new warnings appeared during Phase 4 npm operations, flag them.

- [ ] **Step 2: Aspire-driven manual smoke (interactive — assistant cannot complete)**

If a human is running this gate:
1. Start Aspire AppHost from `BluefinWiki/aspire/BlueFinWiki.AppHost/` (`dotnet run`). Confirm backend is up on :3000.
2. Stop the Aspire-launched React frontend or let the Angular dev server pick a different port.
3. From `BluefinWiki/frontend-angular/`, `npm start`.
4. Manual checklist (open DevTools console alongside — no errors expected for any step):
   - [ ] Click "New page" — modal opens. Title "Smoke Test 1", page type "(none)", create. Lands on `/pages/{guid}/edit`.
   - [ ] Open the inspector (toggle). Three tabs visible.
   - [ ] Toolbar: bold/italic/heading/list buttons each insert correct markdown.
   - [ ] Type `[[Smo` — autocomplete shows the just-created page; Enter completes it.
   - [ ] Right-click a tree node → context menu. Rename works, Sort A-Z reorders children, Delete (as admin) deletes.
   - [ ] Inspector → Attachments tab → upload a small image. Progress bar advances. Item appears in the list.
   - [ ] Click "Insert into page" on the attachment — `![file](url)` lands at the cursor.
   - [ ] Inspector → Properties tab → change Status to "Archived". Save. Status persists.
   - [ ] Inspector → Links tab → if the page has backlinks, they list. Click a link → navigates.
   - [ ] Click a known broken `[[Missing Page]]` link in a rendered page → CreatePageFromLink modal opens prefilled with "Missing Page".
   - [ ] Resize the inspector via the divider. Width persists across reload.

If the assistant is running this gate non-interactively, document Step 2 as "deferred to user".

- [ ] **Step 3: Phase 4 exit checklist**

- [ ] `npm run lint` clean (0/0)
- [ ] `npm test` all green, 0 skipped (except documented xit in Phase 2)
- [ ] `npm run build` succeeds
- [ ] `npm run build:prod` succeeds (with stub env)
- [ ] No new console errors during smoke
- [ ] No `git push`, no `deploy-infra`, no tag push — local only

- [ ] **Step 4: Local tag**

```bash
git -C BluefinWiki tag phase-4-editor-extras
```

(Do not push.)

- [ ] **Step 5: Commit any smoke-test follow-ups**

```bash
git -C BluefinWiki status
# only if there are changes from manual smoke
git -C BluefinWiki add frontend-angular/
git -C BluefinWiki commit -m "fix(angular): Phase 4 smoke-test follow-ups"
```

---

## What's next

Phase 4 leaves you with editor parity. Hand back to writing-plans for **Phase 5: Board** — `BoardView` + `BoardColumn` (cdkDropList) + `BoardCard` (cdkDrag) + `BoardSettingsPanel` + `CardSummaryDialog`. Drop-between-columns calls `pages.updatePage` to set the `state` property; cross-column drag via `cdkDropListConnectedTo`; "Uncategorised" column collects unset state.
