# React → Angular Conversion — Phase 5: Board

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** `docs/superpowers/specs/2026-05-21-bluefinwiki-react-to-angular-design.md`
**Roadmap:** `docs/superpowers/plans/2026-05-21-bluefinwiki-react-to-angular-roadmap.md`
**Branch:** `feat/angular-rewrite` (continues from local tag `phase-4-editor-extras`, commit `4c2c1a9`).
**Working directory:** `BluefinWiki/frontend-angular/`.

**Goal:** Ship the Kanban-style Board view. A page whose children have a `state` property (or a configured `targetTypeGuid` for deep-collection boards) renders a column-per-state board with drag-drop between columns. Dropping a card between columns calls `pages.updatePage` to set the new `state`. Cross-column drag via `cdkDropListConnectedTo`. "Uncategorised" column collects cards without a state. Each card is clickable for a summary dialog. Settings panel configures columns and colors.

**Architecture:**
- **Data:** New `pages.childrenWithPropertiesResource(parentGuid, options)` rxResource reader that GETs `/api/pages/:guid/children?include=properties[&type=...&depth=...&limit=...&cursor=...]`. Returns `{ children: PageChildDetail[], hasMore, nextCursor }`. For Phase 5 we skip pagination cursor follow-up — fetch a single 200-item page; deferred deep-pagination work is a polish pass.
- **Grouping:** A pure helper `groupByState(children, boardConfig)` returns `{ columns: string[], cardsByColumn: Record<string, PageChildDetail[]> }`. Sorting matches React: by `boardOrder` ascending, then `modifiedAt` desc. Column ordering: configured columns first (in config order), then unconfigured alphabetically, then `Uncategorised` last (only if it has cards). Tested as a unit independent of the view.
- **Drag-drop:** Each `BoardColumn` is a `cdkDropList`. Columns share a `cdkDropListGroup`/`cdkDropListConnectedTo` so cards can drag between them. Drop sets the dragged card's `state` property via `pages.updatePage(guid, { properties: { ...existing, state: { type: 'string', value: targetColumn } } })`. Drop within the same column (reorder) is deferred — Phase 5 ships cross-column drag only; same-column reorder is a polish task (CDK gives `moveItemInArray` but we'd need to mutate `boardOrder` server-side; out of scope).
- **View toggle:** `PageView` gets a `(content|board)` toggle bar that appears only when the children of the current page contain at least one card with a `state` property OR when `pageData.boardConfig.targetTypeGuid` is set. Default view comes from `boardConfig.defaultView`.

**Cross-phase reminders:** Local-only execution. Angular 21 zoneless testing gotchas per `feedback_angular_21_zoneless_testing` (flush effects with `tickFlush`, render-before-inject, `input.required` not constructor-readable, rxResource sentinel pattern, mermaid mock for markdown-transitive specs, no `resize`/`change` output names, `mat-tab-group` lazy-mount unreliable in jsdom — prefer `@if`, `mat-select` needs click-to-open).

---

## Task 1: `pages.childrenWithPropertiesResource` + types

**Files:**
- Modify: `BluefinWiki/frontend-angular/src/app/features/pages/pages.ts`
- Modify: `BluefinWiki/frontend-angular/src/app/features/pages/pages.spec.ts`

Add the reader. The `PageChildDetail` type from Phase 3's `page.types.ts` already covers the response shape.

```ts
export interface ChildrenWithPropertiesOptions {
  targetTypeGuid?: string;
  depth?: number;
  limit?: number;
  cursor?: string | null;
}

childrenWithPropertiesResource(
  parentGuid: Signal<string | null>,
  options: Signal<ChildrenWithPropertiesOptions | null>,
) {
  return rxResource({
    params: () => ({ parentGuid: parentGuid(), opts: options() ?? {}, v: this._version() }),
    stream: ({ params }) => {
      if (!params.parentGuid) throw new Error('skip');
      const qs = new URLSearchParams();
      qs.set('include', 'properties');
      if (params.opts.targetTypeGuid) qs.set('type', params.opts.targetTypeGuid);
      if (params.opts.depth) qs.set('depth', String(params.opts.depth));
      if (params.opts.limit) qs.set('limit', String(params.opts.limit));
      if (params.opts.cursor) qs.set('cursor', params.opts.cursor);
      return this.http.get<{ children: PageChildDetail[]; hasMore?: boolean; nextCursor?: string | null }>(
        `/api/pages/${params.parentGuid}/children?${qs.toString()}`,
      );
    },
  });
}
```

Tests (~4): basic GET with `include=properties`, deep-fetch sends `type`+`depth`, sentinel-style skip when parent is null, options signal change triggers refetch.

- [ ] Spec + implement + `git commit -m "feat(angular): childrenWithPropertiesResource for board view"`

---

## Task 2: `groupByState` helper

**Files:**
- Create: `BluefinWiki/frontend-angular/src/app/features/board/group-by-state.ts`
- Create: `BluefinWiki/frontend-angular/src/app/features/board/group-by-state.spec.ts`

Pure function:

```ts
import type { PageChildDetail, BoardConfig } from '../pages/page.types';

export const UNCATEGORISED = 'Uncategorised';

export interface BoardGrouping {
  columns: string[];
  cardsByColumn: Record<string, PageChildDetail[]>;
}

export function groupByState(
  children: readonly PageChildDetail[],
  boardConfig?: BoardConfig,
): BoardGrouping {
  const byState: Record<string, PageChildDetail[]> = {};
  for (const child of children) {
    const stateValue = child.properties?.['state']?.value;
    const state = typeof stateValue === 'string' && stateValue ? stateValue : UNCATEGORISED;
    if (!byState[state]) byState[state] = [];
    byState[state].push(child);
  }

  // Sort cards within each column: boardOrder asc, then modifiedAt desc
  for (const state of Object.keys(byState)) {
    byState[state].sort((a, b) => {
      const aHas = a.boardOrder !== undefined;
      const bHas = b.boardOrder !== undefined;
      if (aHas && bHas) return (a.boardOrder ?? 0) - (b.boardOrder ?? 0);
      if (aHas) return -1;
      if (bHas) return 1;
      return new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime();
    });
  }

  let orderedColumns: string[];
  if (boardConfig?.columns?.length) {
    const configuredSet = new Set(boardConfig.columns);
    const unconfigured = Object.keys(byState)
      .filter((s) => !configuredSet.has(s) && s !== UNCATEGORISED)
      .sort();
    orderedColumns = [...boardConfig.columns, ...unconfigured];
    // Ensure all configured columns exist even if empty
    for (const col of boardConfig.columns) {
      if (!byState[col]) byState[col] = [];
    }
  } else {
    orderedColumns = Object.keys(byState).filter((s) => s !== UNCATEGORISED).sort();
  }

  if (byState[UNCATEGORISED]?.length) {
    orderedColumns.push(UNCATEGORISED);
  }

  return { columns: orderedColumns, cardsByColumn: byState };
}
```

Tests (~6):
- groups by state property value
- cards without `state` go to `Uncategorised`
- columns appear in config order when `boardConfig.columns` given
- alphabetical when no config
- `Uncategorised` always last (only if it has cards)
- empty configured column still appears

- [ ] Spec + implement + `git commit -m "feat(angular): groupByState helper for board view"`

---

## Task 3: `<wiki-board-card>` (cdkDrag)

**Files:**
- Create: `BluefinWiki/frontend-angular/src/app/features/board/board-card.ts`
- Create: `BluefinWiki/frontend-angular/src/app/features/board/board-card.spec.ts`

Single card showing:
- Page type icon (or 📄 default)
- Title (large)
- Parent title as subtitle when `swapTitles` is true (or `boardConfig.showParentTitle`)
- A few custom property chips (string/number/date — skip tags for now)

API:
```ts
input.required<PageChildDetail>('card');
input<Record<string, PageTypeDefinition>>('pageTypesMap', {});
input<boolean>('swapTitles', false);
output<PageChildDetail>('cardClick');
```

Make the root element `cdkDrag [cdkDragData]="card()"`.

Tests (~4): renders title, swapTitles swaps primary/subtitle, cdkDrag attribute present, click emits cardClick.

- [ ] Spec + implement + `git commit -m "feat(angular): BoardCard cdkDrag with optional swap titles"`

---

## Task 4: `<wiki-board-column>` (cdkDropList)

**Files:**
- Create: `BluefinWiki/frontend-angular/src/app/features/board/board-column.ts`
- Create: `BluefinWiki/frontend-angular/src/app/features/board/board-column.spec.ts`

API:
```ts
input.required<string>('name');
input.required<string>('color');
input.required<PageChildDetail[]>('cards');
input<Record<string, PageTypeDefinition>>('pageTypesMap', {});
input<boolean>('swapTitles', false);
output<{ card: PageChildDetail; targetState: string }>('cardDropped');
output<PageChildDetail>('cardClick');
```

Implementation:
- Column header: colored dot + name + count chip
- `cdkDropList` wraps the card area. `[cdkDropListData]="name()"`.
- Inside: `@for (card of cards()) { <wiki-board-card [card]="card" (cardClick)="cardClick.emit($event)" /> }`
- On `(cdkDropListDropped)`: extract dragged card from event, emit `cardDropped` with `{ card, targetState: this.name() }`

Tests (~4): renders cards count in header, renders one wiki-board-card per card, drop event emits cardDropped, cardClick bubbles from child.

- [ ] Spec + implement + `git commit -m "feat(angular): BoardColumn cdkDropList with drop handler"`

---

## Task 5: `<wiki-card-summary-dialog>` (mat-dialog)

**Files:**
- Create: `BluefinWiki/frontend-angular/src/app/features/board/card-summary-dialog.ts`
- Create: `BluefinWiki/frontend-angular/src/app/features/board/card-summary-dialog.spec.ts`

Material dialog shown when a card is clicked. Displays:
- Title
- Page type icon + name
- All custom properties as a definition list
- "Open page" link (router) → `/pages/:guid`

Open via `MatDialog.open(CardSummaryDialog, { data: { card, pageType } })`. Inject `MAT_DIALOG_DATA` using the generic-form pattern from Phase 4 (`inject<DataShape>(MAT_DIALOG_DATA)`).

Tests (~3): renders title from data, lists custom properties, "Open page" link points to `/pages/:guid`.

- [ ] Spec + implement + `git commit -m "feat(angular): CardSummaryDialog mat-dialog"`

---

## Task 6: `<wiki-board-view>` (composes columns)

**Files:**
- Create: `BluefinWiki/frontend-angular/src/app/features/board/board-view.ts`
- Create: `BluefinWiki/frontend-angular/src/app/features/board/board-view.spec.ts`

API:
```ts
input.required<string>('parentGuid');
input<BoardConfig | null>('boardConfig', null);
```

Internal:
- `childrenResource` via `Pages.childrenWithPropertiesResource(parentGuidSig, optionsSig)`. `optionsSig` derives from `boardConfig` — `targetTypeGuid: cfg.targetTypeGuid, depth: cfg.depth ?? 10, limit: 200` when `targetTypeGuid` is set, else `{ limit: 200 }`.
- `pageTypesResource` from `PageTypes` service.
- `grouping = computed(() => groupByState(children.value() ?? [], boardConfig() ?? undefined))`
- Renders header row + horizontal scroll of columns inside a `cdkDropListGroup`.
- On card-dropped: call `pages.updatePage(card.guid, { properties: { ...existing, state: { type: 'string', value: targetState } } })`. Show a `MatSnackBar` on error. Optimistic update: the rxResource version-bump triggered by `updatePage` will refetch.
- On card-click: open `CardSummaryDialog`.

```ts
@Component({
  selector: 'wiki-board-view',
  standalone: true,
  imports: [CdkDropListGroup, BoardColumn, ...],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (childrenResource.isLoading()) {
      <div class="state">Loading board...</div>
    } @else if (childrenResource.error()) {
      <div class="state error">Failed to load.</div>
    } @else {
      <div cdkDropListGroup class="board-cols">
        @for (col of grouping().columns; track col) {
          <wiki-board-column
            [name]="col"
            [color]="columnColor(col)"
            [cards]="grouping().cardsByColumn[col] ?? []"
            [pageTypesMap]="pageTypesMap()"
            [swapTitles]="boardConfig()?.swapTitles ?? false"
            (cardDropped)="onCardDropped($event)"
            (cardClick)="onCardClick($event)"
          />
        }
      </div>
    }
  `,
  styles: [`
    :host { display: block; height: 100%; }
    .board-cols { display: flex; gap: 1rem; padding: 1rem; overflow-x: auto; height: 100%; }
    .state { padding: 2rem; color: #6b7280; }
    .state.error { color: #b91c1c; }
  `],
})
export class BoardView {
  private readonly pages = inject(Pages);
  private readonly pageTypes = inject(PageTypes);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(MatSnackBar);

  readonly parentGuid = input.required<string>();
  readonly boardConfig = input<BoardConfig | null>(null);

  private readonly parentGuidSig = computed<string | null>(() => this.parentGuid());
  private readonly options = computed<ChildrenWithPropertiesOptions | null>(() => {
    const cfg = this.boardConfig();
    if (cfg?.targetTypeGuid) return { targetTypeGuid: cfg.targetTypeGuid, depth: cfg.depth ?? 10, limit: 200 };
    return { limit: 200 };
  });

  readonly childrenResource = this.pages.childrenWithPropertiesResource(this.parentGuidSig, this.options);
  readonly pageTypesResource = this.pageTypes.pageTypesResource();

  protected readonly pageTypesMap = computed<Record<string, PageTypeDefinition>>(() => {
    const list = this.pageTypesResource.value() ?? [];
    return Object.fromEntries(list.map((t) => [t.guid, t]));
  });

  protected readonly grouping = computed(() =>
    groupByState((this.childrenResource.value()?.children ?? []) as PageChildDetail[], this.boardConfig() ?? undefined),
  );

  columnColor(name: string): string { return getColumnColor(name, this.boardConfig()?.colors); }

  async onCardDropped(event: { card: PageChildDetail; targetState: string }): Promise<void> {
    const { card, targetState } = event;
    const currentState = typeof card.properties?.['state']?.value === 'string' ? card.properties['state'].value : 'Uncategorised';
    if (currentState === targetState) return;
    try {
      await this.pages.updatePage(card.guid, {
        properties: {
          ...(card.properties ?? {}),
          state: { type: 'string', value: targetState },
        },
      });
    } catch {
      this.snack.open(`Failed to move "${card.title}".`, 'Dismiss', { duration: 4000 });
    }
  }

  onCardClick(card: PageChildDetail): void {
    this.dialog.open(CardSummaryDialog, { data: { card, pageType: this.pageTypesMap()[card.pageType ?? ''] ?? null } });
  }
}
```

`getColumnColor` lives next to `groupByState` (color map for known states + HSL fallback from name hash). Add it in Task 2 or here.

Tests (~5): renders columns from grouping, drop emits updatePage with merged properties, click opens dialog, loading state, error state.

- [ ] Spec + implement + `git commit -m "feat(angular): BoardView with cdkDropListGroup + state-update on drop"`

---

## Task 7: `<wiki-board-settings-panel>` (mat-dialog)

**Files:**
- Create: `BluefinWiki/frontend-angular/src/app/features/board/board-settings-panel.ts`
- Create: `BluefinWiki/frontend-angular/src/app/features/board/board-settings-panel.spec.ts`

Material dialog that takes the current `BoardConfig` and emits an updated one. Fields:
- Columns (chip-list — add/remove/reorder via simple up/down buttons, no drag-drop here)
- Default view (`mat-button-toggle-group`: content / board)
- Colors per column (color input next to each column chip)
- Target type GUID (`mat-select` from PageTypes, "(direct children)" option)
- Depth (number input, 1–10) — only shown when targetTypeGuid is set
- Swap titles toggle

API:
```ts
inject(MAT_DIALOG_DATA) with shape: { config: BoardConfig | null; pageTypes: PageTypeDefinition[] }
output via dialogRef.close(updatedConfig | null)
```

Tests (~3): renders the existing config fields, adding a column updates the model, saving closes with the new config.

- [ ] Spec + implement + `git commit -m "feat(angular): BoardSettingsPanel mat-dialog"`

---

## Task 8: Wire Content/Board toggle into `PageView`

**Files:**
- Modify: `BluefinWiki/frontend-angular/src/app/features/pages/page-view.ts`
- Modify: `BluefinWiki/frontend-angular/src/app/features/pages/page-view.spec.ts`

In `PageView`:
- After loading the page, also check (via `childrenWithPropertiesResource(parentGuid, { limit: 1 })`) if any child has a `state` property, OR check if `page.boardConfig?.targetTypeGuid` is set. If either, show a Content/Board toggle.
- Cheaper approach: the page's `boardConfig` alone gates whether we show the toggle. If `boardConfig` exists OR `boardConfig.defaultView === 'board'`, render `<wiki-board-view>` instead of `<wiki-markdown-renderer>`. This matches React's `boardEligible` logic at a slightly tighter scope (no children-snooping until the user opens the page).
- Per the spec, defaultView from `boardConfig.defaultView` decides initial view.
- Add a board-settings cog button when in Board view; opens `BoardSettingsPanel`, saves config via `pages.updatePage(guid, { boardConfig: newConfig })`.

Light test (~3): renders MarkdownRenderer when no boardConfig, renders BoardView when boardConfig set + defaultView is board, toggle switches view.

- [ ] Spec + implement + `git commit -m "feat(angular): Content/Board view toggle wired into PageView"`

---

## Task 9: Local smoke + Phase 5 exit gate

**Files:** no source changes.

- [ ] **Step 1: Local gate**

```bash
cd BluefinWiki/frontend-angular
npm run lint && npm test && npm run build && npm run build:prod
```

Expected: all green.

- [ ] **Step 2: Optional manual smoke (deferred to user if assistant runs non-interactively)**

Bring up Aspire backend, run Angular dev server, create or open a page whose children have a `state` property — verify:
- Board view renders columns per distinct state value.
- Drag a card from one column to another. The card lands in the new column; `pages.updatePage` fires. Refresh shows the card persists in the new state.
- Click a card → CardSummaryDialog opens.
- Settings cog → BoardSettingsPanel, change column order, save. Board reflows.

- [ ] **Step 3: Tag (local-only)**

```bash
git -C BluefinWiki tag phase-5-board
```

Do NOT push.

---

## What's next

Phase 5 hands off to **Phase 6: Admin** — `PageTypesAdmin`, `SettingsPage`, `UserManagement`, `InvitationManagement`, `RebuildPageIndex`, `ProfilePage`. Phase 4 already shipped the read-only `PageTypes` service; Phase 6 extends it with mutations and wires the admin UI.
