# Board config defaults on page types — design

Date: 2026-10-05 · Piece 4 of the Board & UI improvements (Wiki Enhancements board).
Builds on piece 3 (`board/card-types.ts`, `BoardConfig.targetTypeGuids` / `leafTypes`).

## Problem

Every board stores its full `BoardConfig` on its own page. Each new Initiative
needs its columns, colours, card selection and default view set by hand, and a
later change (say, a new "Waiting for Action" column) has to be repeated on
every board.

## Behaviour

- A page type can carry **board defaults**. Every page of that type uses them
  unless it overrides them.
- Overrides are **per field group**: a page that changes only its columns keeps
  following the type for everything else, and later edits to the type's
  defaults reach it.
- Defaults are set **from a board's Board Settings**: "Save as default for
  🎯 Initiative pages" promotes this board's full settings to the type and
  clears this page's overrides. "Reset to 🎯 Initiative default" drops this
  page's overrides. Overridden groups are tagged "overridden" in the dialog.
- Pages whose type has no defaults (or that have no type) behave exactly as
  today.

## Field groups

Each group is taken whole from the page if the page sets any of its keys,
otherwise from the type defaults:

| Group | Keys | Normalised default |
|---|---|---|
| `columns` | `columns` | `[]` (derive from state values) |
| `colors` | `colors` | `{}` |
| `cards` | `leafTypes`, `targetTypeGuids`, `targetTypeGuid` (legacy) | direct children |
| `depth` | `depth` | `10` |
| `showParentTitle` | `showParentTitle` | `true` |
| `swapTitles` | `swapTitles` | `false` |
| `defaultView` | `defaultView` | `'content'` |

An override can express "off/empty" explicitly: `columns: []`,
`leafTypes: false` (direct children), `swapTitles: false`,
`defaultView: 'content'`. All already pass the backend `BoardConfigSchema`.

## Data model

- `PageTypeDefinition.boardDefaults?: BoardConfig` (frontend + backend types).
- Backend: `BoardConfigSchema` moves to `backend/src/pages/board-config-schema.ts`
  (re-exported from `pages-update.ts`); page-types create/update zod schemas
  accept `boardDefaults: BoardConfigSchema.unwrap().unwrap().optional()` (a
  plain object, not null); `page-types-service` serialises it as JSON like
  `properties`, adds it to `updatePageType`'s update expression, and parses it
  in `deserializePageType`. Permission is the existing page-type rule (creator
  or admin).
- `page.boardConfig` means "overrides" when the page's type has defaults; no
  migration — an existing full config simply overrides every group it sets.

## Frontend

New pure module `features/board/board-defaults.ts`:

```ts
export type BoardGroup = 'columns' | 'colors' | 'cards' | 'depth' | 'showParentTitle' | 'swapTitles' | 'defaultView';
export const BOARD_GROUPS: readonly BoardGroup[];
export function overriddenGroups(pageCfg: BoardConfig | null | undefined): BoardGroup[];
export function effectiveBoardConfig(pageCfg: BoardConfig | null | undefined, typeDefaults: BoardConfig | null | undefined): BoardConfig | null;
//   no defaults → pageCfg as-is; else per-group merge; null when both empty
export function boardOverrides(full: BoardConfig, typeDefaults: BoardConfig): BoardConfig | null;
//   groups whose normalised value differs from the defaults' normalised value,
//   written explicitly (cards: {leafTypes:true} | {targetTypeGuids} | {leafTypes:false});
//   null when nothing differs
```

Invariant (tested): `effectiveBoardConfig(boardOverrides(x, d), d)` normalises
equal to `x` for every group.

`page-detail.ts`:

- `pageTypeDef` computed — this page's `PageTypeDefinition` from
  `pageTypesMap()` (null when untyped/unknown).
- `boardConfig` computed becomes
  `effectiveBoardConfig(page.boardConfig, pageTypeDef()?.boardDefaults)`; it
  already feeds eligibility, the default-view effect and the probe gate.
- Template: `<wiki-board-view [boardConfig]="boardConfig()">` instead of
  `page.boardConfig ?? null`.
- `openBoardSettings()` passes the effective config plus
  `typeDefaults: { name, icon, canEdit }` (null when the type has no
  defaults *and* the page is untyped) and `overridden: overriddenGroups(page.boardConfig)`
  (only when the type has defaults). `canEdit` = `auth.user()?.role === 'Admin'
  || type.createdBy === auth.user()?.userId`.
- Handles the dialog result `{ action, config }`:
  - `save` — type has defaults → `updatePage(boardConfig: boardOverrides(config, defaults))`
    (`null` removes it); otherwise `updatePage(boardConfig: config)` as today.
  - `reset` — `updatePage(boardConfig: null)`.
  - `saveAsDefault` — `pageTypes.updatePageType(type.guid, { boardDefaults: config })`
    then `updatePage(boardConfig: null)`; snack on failure of either.

`board-settings-panel.ts`:

- `BoardSettingsPanelData` gains
  `type?: { name: string; icon: string; hasDefaults: boolean; canEdit: boolean } | null`
  and `overridden?: BoardGroup[]`.
- Closes with `BoardSettingsResult = { action: 'save' | 'reset' | 'saveAsDefault'; config: BoardConfig }`
  (or `null` on cancel). `config` is the same shape Save builds today.
- Section headings get an `overridden` chip for groups in `data.overridden`
  (columns+colors share the Columns section; cards+depth the "Collect pages of"
  section; showParentTitle/swapTitles the toggles; defaultView its section).
- Actions row: **Reset to {icon} {name} default** (only when `type.hasDefaults`
  and `overridden.length > 0`); **Save as default for {icon} {name} pages**
  (only when `type && type.canEdit`); Cancel; Save.

## Testing

- `board-defaults.spec.ts` — group merge per group, legacy `targetTypeGuid`
  counts as a cards override, explicit off values, diff round-trip, `null`
  when nothing differs.
- `board-settings-panel.spec.ts` — overridden chips, Reset/Save-as-default
  visibility rules, result `action` for each button.
- `page-detail.spec.ts` — type defaults with `leafTypes` + `defaultView: 'board'`
  open an untouched page on the board; Save stores only the diff; Reset sends
  `boardConfig: null`; Save as default PUTs the page type then the page.
- Backend: `board-config-schema` test still passes from the new module;
  new `page-types-board-defaults.test.ts` for create/update schema acceptance
  and serialise/deserialise round-trip (DynamoDB client mocked the way
  existing service tests do, or the pure (de)serialisers exported for test).
- E2E `board-defaults.spec.ts` — two pages of a temp type; on page A set
  columns and Save as default; page B shows those columns; override page B's
  columns; change the type default's card mode via A; B keeps its columns and
  picks up the new card mode.

## Out of scope

- Editing defaults in the page-types admin, clearing a type's defaults
  (overwrite them instead), parent-page defaults, property defaults.
