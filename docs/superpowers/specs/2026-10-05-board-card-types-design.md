# Board card selection: leaf types + multi-select — design

Date: 2026-10-05 · Piece 3 of the Board & UI improvements (Wiki Enhancements board)

## Problem

A deep board collects descendants of exactly one page type
(`BoardConfig.targetTypeGuid`). An Initiative board wants Tasks **and** Bugs
(piece 2 adds Bug); a TV board might want Seasons. Picking one type means the
board misses work, and every new leaf type means re-editing every board.

Also found: with a target type and `depth: 1`, `pages-list-children` takes the
standard direct-children path (the collector only runs for `depth > 1`) and
ignores the type filter entirely.

## Behaviour

Board Settings → "Collect pages of" offers three modes:

- **Direct children** — as today (no type filter).
- **Leaf types** — every *leaf type*, resolved each time the board loads, so a
  new leaf type (e.g. Bug) appears on every leaf-mode board automatically. The
  panel shows the current resolution, e.g. "Currently: ✅ Task · 🐞 Bug ·
  🎞️ Movie · 🎬 Season".
- **Specific types** — a multi-select of boardable types.

Depth and the two parent-title toggles show for Leaf types and Specific types.

**Leaf type** = a boardable type (has a `state` property) whose
`allowedChildTypes` contains no boardable type. With today's data: Task, Movie,
Season (+ Bug after piece 2). Epic/Story/Initiative/TV Show are not leaves.

## Data model

`BoardConfig` (frontend `pages/page.types.ts`, backend `types/index.ts`):

```ts
targetTypeGuid?: string;    // LEGACY — read as [targetTypeGuid]; never written
targetTypeGuids?: string[]; // Specific types mode
leafTypes?: boolean;        // Leaf types mode (wins over targetTypeGuids)
```

Backend `BoardConfigSchema` (zod, `pages/pages-update.ts`) adds
`targetTypeGuids: z.array(z.string().uuid()).min(1).max(50).optional()` and
`leafTypes: z.boolean().optional()`; keeps `targetTypeGuid`. No data migration:
the settings panel saves only the new fields, and `boardConfig` is replaced
wholesale on update, so the legacy field disappears on the first save.

## Frontend

New pure module `features/board/card-types.ts`:

```ts
export function leafTypes(pageTypes: readonly PageTypeDefinition[]): PageTypeDefinition[];
export function configuredTypeGuids(cfg: BoardConfig | null | undefined): string[];
//   targetTypeGuids ?? (targetTypeGuid ? [targetTypeGuid] : [])
export function hasCardTypeSelection(cfg: BoardConfig | null | undefined): boolean;
//   leafTypes === true || configuredTypeGuids(cfg).length > 0
export function resolveCardTypes(
  cfg: BoardConfig | null | undefined,
  pageTypes: readonly PageTypeDefinition[],
): string[];
//   leafTypes ? leafTypes(pageTypes).map(guid) : configuredTypeGuids(cfg)
```

Callers switch from `cfg.targetTypeGuid` truthiness to these:

- `is-board-eligible.ts` — `hasCardTypeSelection(page.boardConfig)`.
- `page-detail.ts` `eligibilityParentGuid` — skip the probe when
  `hasCardTypeSelection(...)`.
- `board-view.ts` `options` — `resolveCardTypes(cfg, pageTypes)`; non-empty →
  `{ targetTypeGuids, depth: cfg.depth ?? 10, limit }`, empty → direct
  children. In leaf mode the board waits for page types (`awaitingTypes()`):
  the resource's parent guid is `null` meanwhile, the initial-loading state
  stays on, and the error branch is suppressed while waiting.
- `pages.ts` — `ChildrenWithPropertiesOptions.targetTypeGuid` becomes
  `targetTypeGuids?: string[]`, sent as `type=a,b,c`.
- `board-settings-panel.ts` — signals `cardMode: 'children' | 'leaves' |
  'types'` (initialised from config: leafTypes → leaves, configured guids →
  types, else children) and `targetTypeGuids: string[]`; a
  `mat-button-toggle-group` (aria-label "Collect pages of") with Direct
  children / Leaf types / Specific types; a `mat-select multiple` (label
  "Page types") in types mode; a "Currently: …" line in leaves mode (or "No leaf
  types yet" when empty). `onSave` writes `leafTypes: true` or
  `targetTypeGuids`, plus depth/showParentTitle/swapTitles, for either
  non-children mode; Specific with nothing selected saves as Direct children.

## Backend

`pages/pages-list-children.ts`:

- Parse `type` as a comma-separated list into a `Set<string>` (empty strings
  dropped); empty set = no filter.
- `collectDescendantsByType` takes `targetTypeGuids: ReadonlySet<string>` and
  matches `targetTypeGuids.has(child.pageType)`.
- Use the collector whenever `include=properties` and the set is non-empty —
  for **any** depth ≥ 1 (fixes the depth-1 bug).

## Testing

- `card-types.spec.ts` — leafTypes on an Initiative→Epic→Story→Task/Bug +
  TV Show→Season schema; legacy `targetTypeGuid`; leaf mode beats
  `targetTypeGuids`; empty config.
- `is-board-eligible.spec.ts` — leaf mode and `targetTypeGuids` make a page
  eligible.
- `board-settings-panel.spec.ts` — mode initialisation (legacy config opens as
  Specific types), saved shapes per mode, "Currently:" text, multi-select.
- `board-view.spec.ts` — request URL for specific types and for leaf mode
  (after page types load, no request before).
- `pages.spec.ts` — `type=a,b` query string.
- Backend `pages-list-children.test.ts` — two types matched at depth 2;
  depth-1 with a type filters direct children; `type=` empty → standard path.
- Backend `board-config-schema.test.ts` — schema accepts `targetTypeGuids` /
  `leafTypes`, rejects a non-uuid in the list.
- E2E `board-leaf-types.spec.ts` — parent → Story-like type (state, child
  types Task+Bug) → Task and Bug children; leaf-mode board shows the Task and
  Bug cards and not the Story card.

## Out of scope

- Kanban MCP tools (own tree walk, unaffected).
- Board config defaults (piece 4) — it will build on `card-types.ts`.
