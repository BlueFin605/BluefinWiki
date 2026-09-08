# Step 5.7 — Card Summary: inline edit

| | |
|---|---|
| Phase | 5 — Board view |
| Gap refs | §3.5 "Card Summary dialog"; §11 checklist; punch list 🔴 #11 |
| Impact | 🔴 Functional |
| Depends on | 1.1 (types/schema), 4.4 (`mergeSchema`), 4.5 (tag input) |
| Est. size | M |

## Problem

`card-summary-dialog.ts` is **read-only** ("deferred to a polish pass"). It
shows title / type / parent / properties; "Open page" is a **same-tab
`routerLink`**. React: edit **title + properties inline** (text/number/date/tags
w/ vocab), merge schema defaults on save, `PUT /pages/:cardGuid`, invalidate,
**"Open full editor" → `window.open('/pages/:guid','_blank')`**, `Esc` close,
Save disabled unless changed.

## Target behaviour

- Editable Title field.
- Editable properties using the same per-type editors as the inspector
  (text / number / date / tags-with-vocab — reuse the components from steps
  4.5 / 4.7).
- On Save: build the merged property set (`mergeSchema`, step 4.4), `PUT
  /pages/:cardGuid` with `title` + `properties`, invalidate the board's
  `children:<parent>` tag (step 1.2), close.
- Save disabled unless something changed (dirty check vs the opened snapshot).
- "Open full editor" → `window.open('/pages/' + guid, '_blank')` (new tab).
- `Esc` / backdrop close (Material default — keep).

## Implementation notes

**Files:** `features/board/card-summary-dialog.ts`, reuse
`TagInputComponent` + the property editors from Phase 4, `mergeSchema` helper.

- Keep the dialog self-contained: input = the card detail + schema; output =
  nothing (it does its own `PUT`) or an "updated" event the board listens for.
- Snapshot the initial `{ title, properties }` for the dirty check.

## Tests first (TDD)

- `card-summary-dialog.spec.ts`: editing the title enables Save; editing a
  number property enables Save; Save issues `PUT /pages/<cardGuid>` with merged
  properties + title, then closes; no change → Save disabled; "Open full
  editor" calls `window.open` with `_blank`; `Esc` closes.

## Acceptance criteria

- [ ] Title + properties editable with the correct per-type inputs.
- [ ] Save persists a merged property set + title; invalidates the board.
- [ ] Save gated on dirty.
- [ ] "Open full editor" opens a new tab.
- [ ] Reuses Phase 4 components (no duplicate editors).
- [ ] Tests cover edit/save/disabled/open/esc.

## Out of scope

- "Add card" from the board (absent in both — parity, leave).
