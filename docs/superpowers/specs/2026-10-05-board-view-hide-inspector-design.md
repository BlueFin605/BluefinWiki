# Auto-hide the inspector (info tabs) in Board view — design

Date: 2026-10-05 · Piece 1 of the Board & UI improvements (Wiki Enhancements board)

## Problem

On a board-eligible page, switching the Content | Board toggle to **Board** hides
the info button (`page-detail.ts` — the right-hand bar controls are wrapped in
`@if (viewMode() !== 'board')`), but the hoisted inspector drawer
(Properties / Attachments / … tabs, rendered by `pages-view`) stays open. Its
open state is `pages-view.inspectorOpened()`, which only looks at
`Layout.inspectorVisible` (desktop, persisted) or `PageContext.inspectorSheetOpen`
(mobile, ephemeral). Nothing tells the shell a board is showing, so the user has
to switch to Content, close the inspector, and switch back.

## Behaviour

- While a page's Board view is rendered, the inspector is hidden — desktop
  drawer and mobile bottom sheet alike.
- The user's inspector preference is **not** changed. Switching back to Content
  (or navigating to another page) shows the inspector again exactly if it was
  open before.
- There is no way to open the inspector while in Board view (the info button is
  already hidden there). Out of scope: a board-header info button.

## Design

### 1. `PageContext.boardView` (new signal)

`frontend/src/app/features/pages/page-context.ts`:

```ts
/** True while page-detail is rendering its Board view (not Content/Edit). */
readonly boardView: WritableSignal<boolean> = signal(false);
```

`reset()` also sets it back to `false`, so leaving a board page never leaves the
inspector suppressed.

### 2. `page-detail` publishes it

`frontend/src/app/features/pages/page-detail.ts` — add a computed with **exactly**
the template's board-render condition (`mode() !== 'edit'` branch →
`viewMode() === 'board' && boardEligible()`):

```ts
protected readonly showingBoard = computed(
  () => this.mode() !== 'edit' && this.viewMode() === 'board' && this.boardEligible(),
);
```

and push it from the existing publish effect in the constructor (the one that
sets `pageContext.guid` / `pageContext.mode`):

```ts
this.pageContext.boardView.set(this.showingBoard());
```

Using the render condition (not raw `viewMode()`) means a `defaultView: 'board'`
page whose eligibility hasn't resolved yet — or has been lost — keeps its
inspector, matching what is actually on screen.

### 3. `pages-view` honours it

`frontend/src/app/features/pages/pages-view.ts`:

- `inspectorOpened()` returns `false` when `this.ctx.boardView()` is true (after
  the existing guid/metadata gate, before the desktop/mobile split).
- `onInspectorClosed()` returns early when `this.ctx.boardView()` is true. The
  `(closed)` event fires when the drawer closes reactively; without this guard
  the desktop path would persist `inspectorVisible: false` and the mobile path
  would clear `inspectorSheetOpen`, wiping the preference every time a board
  opens.

No changes to `Layout`, `InspectorPanel` or the board components.

## Testing

Unit (Jest):

- `pages-view.spec.ts`
  - desktop, `inspectorVisible: true`, `ctx.boardView.set(true)` → drawer not
    opened; `layout.inspectorVisible()` still `true` after `(closed)` fires;
    `boardView.set(false)` → drawer opened again.
  - mobile, `inspectorSheetOpen` true, board view on → sheet closed,
    `inspectorSheetOpen()` still `true`; off → sheet opens again.
- `page-detail.spec.ts`
  - Content → Board toggle sets `pageContext.boardView()` true; back to Content
    sets it false.
  - `defaultView: 'board'` on an eligible page publishes true once eligibility
    resolves; on an ineligible page it stays false.
- `page-context.spec.ts` — `reset()` clears `boardView`.

E2E (Playwright, new `e2e/tests/board-hides-inspector.spec.ts`, modelled on
`board-view-functional.spec.ts` + `inspector-sheet.spec.ts` helpers):

- Desktop: board-eligible parent page (state-typed child, `boardConfig` with
  `targetTypeGuid`, `defaultView: 'content'`); open the inspector with
  `toggleInspector`; switch the view toggle to Board → `inspector(page)` is not
  `mat-drawer-opened`; switch to Content → it is open again; reload → still open
  (preference survived).

## Out of scope

- An info button / inspector access in Board view.
- Any change to what the inspector shows.

## Addendum (2026-10-05): manual board refresh button

Board view hides the page's Refresh button (it acts on the page's own
content), so there is no way to re-pull the cards by hand.

- `BoardView` gains `refresh(): void` — `bus.bumpMany([childrenTag(parentGuid()), pageTypesListTag()])`
  (its cards resource already reads `children:<parent>`; `page-types:list`
  re-resolves icons / leaf types) — and `refreshing = computed(() => childrenResource.isLoading())`.
  Existing behaviour is kept: cards stay painted during the reload
  (`showInitialLoading` only fires on an empty board) and the list restarts at
  page one, as any invalidation does.
- `page-detail` reaches it via `viewChild(BoardView)` and shows an icon button
  (`refresh`, aria-label "Refresh board") next to the Board settings gear,
  only while `viewMode() === 'board'`; disabled while `refreshing()`, icon
  spins (CSS) meanwhile.
- Tests: board-view spec — `refresh()` re-requests children and the old cards
  stay visible until it resolves; page-detail spec — the button exists only in
  Board view and clicking it re-requests children; e2e — change a card's state
  via the API, click Refresh, the card moves (still useful once real-time
  updates land).
