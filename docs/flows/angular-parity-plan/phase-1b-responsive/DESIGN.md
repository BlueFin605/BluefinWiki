# Phase 1b — Responsive / mobile layer — design

Design pass for **F4** (§0 of the gap analysis) — the Angular app has no mobile
layout at all. This document is the approved spec; the sibling step files
(`step-1b.*.md`) are its implementation breakdown.

Source of truth for target behaviour:
[`react-frontend-page-reference.md`](../../react-frontend-page-reference.md)
§0.5, §3.1, §3.4, §3.6, §3.7.

---

## Resolved decisions

| # | Decision | Rationale |
|---|---|---|
| D1 | **Binary breakpoint at 1024px.** One `isDesktop` switch drives every responsive decision. The named `mobile` / `tablet` / `desktop` breakpoints exist in the service but nothing keys off them yet. | React defines three breakpoints but every documented behaviour flips at `<lg` (1024). Less surface area, same result. |
| D2 | **`@angular/cdk/layout` `BreakpointObserver`**, wrapped as a signal service. | Already installed; battle-tested; SSR-safe. No hand-rolled `matchMedia`. |
| D3 | **Single hoisted `mat-sidenav-container` in `pages-view`.** `page-detail` stops owning a container. | One place for all responsive mode logic; avoids nested containers; the tree drawer, inspector sheet and backdrop/scroll-lock are all managed together. |
| D4 | **Inspector = reactive `mat-sidenav`** (`mode='side'` + `inspectorWidth` on desktop; `mode='over'` + full-width/75vh-bottom styling below 1024). Not `MatBottomSheet`. | One mount path; reuses the step 4.1 `Layout` binding; no second copy of inspector state to keep in sync. |
| D5 | **Remove the global `app.html` `<mat-toolbar>` entirely** (the F12 gap). | `/pages` has its own top bar; admin/settings/profile get the back-header from [step 8.1](../phase-8-admin-profile/step-8.1-admin-back-navigation.md); `/callback` is chrome-less; 404/403 are standalone. Nothing needs it. |
| D6 | **Drawer open/close state is ephemeral** — component-local signals, never persisted. Resize dividers stay desktop-only. | Matches React (`MobileDrawer` state is component-local). |
| D7 | **AI sidebar below 1024 = full-width fixed overlay**, not a third sidenav. | Two `end` sidenavs collide. |
| D8 | **Phase 1b runs after Phases 3 and 4**, not right after Phase 1. | The inspector hoist (1b.3) and the editor-bar rework (1b.6) both refactor `page-detail`; doing them after Split view (3.1), the save pill (3.3) and the inspector work (Phase 4) avoids reworking the same file twice. The mobile-tagged acceptance criteria in Phases 3/4/6 are ticked here. |

---

## Architecture

### `Breakpoint` service — `core/layout/breakpoint.ts`

```
@Injectable({ providedIn: 'root' })
class Breakpoint {
  isDesktop: Signal<boolean>   // (min-width: 1024px).matches — default true on first tick / SSR
  isTablet:  Signal<boolean>   // 768–1023  (exposed, unused for now)
  isMobile:  Signal<boolean>   // ≤767      (exposed, unused for now)
}
```

Built from `toSignal(breakpointObserver.observe([...]).pipe(map(...)))`. Every
consumer injects `Breakpoint` and reads `isDesktop()`.

### Shell — `pages-view`

```
<mat-toolbar>
  @if (!bp.isDesktop()) <button hamburger (click)="treeDrawerOpen.set(true)">
  <span class="title">BlueFinWiki</span>
  <span class="spacer">
  <button Search>  <wiki-ai-button>  <button New page>  <user-menu>
</mat-toolbar>

<mat-sidenav-container class="body">
  <mat-sidenav #tree start
    [mode]="bp.isDesktop() ? 'side' : 'over'"
    [opened]="bp.isDesktop() || treeDrawerOpen()"
    (closed)="treeDrawerOpen.set(false)"
    [style.width.px]="bp.isDesktop() ? layout.treeWidth() : null">
    <wiki-page-tree ... (pageSelect)="onPageSelect($event); closeTreeDrawerIfMobile()">
    @if (bp.isDesktop()) <wiki-resize-divider (resized)="onTreeResize($event)">
  </mat-sidenav>

  <mat-sidenav-content>
    <router-outlet/>        <!-- page-detail -->
    @if (!bp.isDesktop() && aiOpen()) <div class="ai-overlay"><wiki-ai-sidebar/></div>
  </mat-sidenav-content>
  @if (bp.isDesktop() && aiOpen()) <div class="ai-pane"><wiki-ai-sidebar/></div>

  <mat-sidenav #inspector end
    [mode]="bp.isDesktop() ? 'side' : 'over'"
    [opened]="bp.isDesktop() ? layout.inspectorVisible() : inspectorSheetOpen()"
    (closed)="onInspectorClosed()"
    class="inspector" [class.mobile-sheet]="!bp.isDesktop()"
    [style.width.px]="bp.isDesktop() ? layout.inspectorWidth() : null">
    @if (ctx.guid() && ctx.metadata(); as m)
      <wiki-inspector-panel [pageGuid]="ctx.guid()!" [metadata]="m"
        [canInsert]="ctx.canInsert()"
        (metadataChange)="ctx.metadata.set($event)"
        (insertMarkdown)="ctx.emitInsert($event)"/>
  </mat-sidenav>
</mat-sidenav-container>
```

`.mobile-sheet` CSS: `width: 100vw; max-width: 100vw; height: auto; max-height: 75vh;`
anchored to the bottom (Material `position="end"` still slides from the right;
override with `transform`/`bottom` or use a `bottom`-anchored container class —
the step covers the exact CSS).

### `PageContext` service — `features/pages/page-context.ts`

The inspector moves out of `page-detail` into the shell. A root service is the
channel:

```
@Injectable({ providedIn: 'root' })
class PageContext {
  guid       = signal<string | null>(null)
  metadata   = signal<PageMetadata | null>(null)
  mode       = signal<'view' | 'edit'>('view')
  canInsert  = computed(() => this.mode() === 'edit')
  inspectorOpen = signal(false)            // desktop delegates to Layout.inspectorVisible
  private _insert = new Subject<string>()
  insert$ = this._insert.asObservable()
  emitInsert(md: string) { this._insert.next(md) }
  toggleInspector() { ... }                // desktop → layout.update({inspectorVisible}); mobile → inspectorSheetOpen
  reset() { guid.set(null); metadata.set(null) }   // on page-detail destroy
}
```

- `page-detail` (in `ngOnInit`/effects): pushes `guid`, `metadata`, `mode`;
  subscribes to `insert$` and routes into `wiki-codemirror`; calls `reset()` on
  destroy; its `.bar` inspector button calls `ctx.toggleInspector()`.
- `pages-view` renders the inspector from `PageContext` + `Layout` + `Breakpoint`.
- Step 4.1's "bind inspector to `Layout`" is satisfied here — the desktop
  `opened`/`width` come straight from `Layout`.

---

## Per-surface behaviour (`<1024px`)

| Surface | Behaviour | Owner step |
|---|---|---|
| Sidebar / tree | left `over` drawer, opened by the toolbar hamburger; closes on page select and on backdrop/Esc | 1b.4 |
| Toolbar controls | Search / AI / New page live in the mobile top bar (they already do — just add the hamburger) | 1b.4 |
| Editor mode toggle | `Edit \| Preview` only; **Split hidden** | 1b.6 |
| Markdown toolbar | fixed to the bottom, horizontally scrollable, `env(safe-area-inset-bottom)` padding; `compact` on (hides OL / Task / code-block; headings H1–H3); heading menu opens upward | 1b.6 (consumes `compact` from [step 3.4](../phase-3-editor-preview/step-3.4-markdown-toolbar-image-attachment.md)) |
| Breadcrumbs | `>3` segments → `Home ▸ … ▸ Current` | 1b.7 (replaces the `TODO(1.5)` in [step 3.5](../phase-3-editor-preview/step-3.5-breadcrumbs-home-collapse.md)) |
| TOC | collapsible "On this page" bar above the preview (collapsed by default) | 1b.8 (consumes `compact` from [step 3.10](../phase-3-editor-preview/step-3.10-table-of-contents.md)) |
| Inspector | bottom sheet (`over`, 100vw, ≤75vh); toggle is an info icon in the editor bar | 1b.3 / 1b.5 (satisfies [step 4.1](../phase-4-inspector/step-4.1-inspector-layout-binding.md)) |
| Search dialog | full-screen `MatDialog` (panel class); centered 640px on desktop | 1b.9 |
| AI sidebar | full-width fixed overlay above the content | 1b.9 |
| Visible Search button | already added in [step 6.7](../phase-6-search/step-6.7-search-visible-button.md); 1b.4 confirms it sits in the mobile top bar | 1b.4 |

---

## Testing

TDD, Jest + Testing Library, as the parent plan. `Breakpoint` is mocked per
spec — provide a stub whose `isDesktop` is a `signal<boolean>` the test flips.
Component specs assert:

- sidenav `mode` / `opened` switch when `isDesktop` flips,
- the hamburger shows only below 1024 and opens the tree drawer,
- selecting a page closes the mobile drawer,
- the inspector renders from `PageContext` and its `insert$` reaches the editor,
- Split is absent from the mode toggle below 1024,
- the toolbar carries the `compact` flag and the bottom-pinned class below 1024.

Manual matrix: 360×640 (mobile), 800×1000 (tablet — behaves as mobile per D1),
1440×900 (desktop). Verify no horizontal body scroll at any width.

---

## Out of scope

- Dark mode (F3 — permanently out).
- Any desktop layout change beyond what the hoist (D3) mechanically requires.
- "No page selected" empty-state polish (§3.1 ⚪).
- Persisting drawer state (D6).
