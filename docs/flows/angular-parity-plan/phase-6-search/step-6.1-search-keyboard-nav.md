# Step 6.1 — Search keyboard navigation

| | |
|---|---|
| Phase | 6 — Search dialog |
| Gap refs | §0.7, §3.6 "Keyboard nav"; §11 checklist; punch list 🔴 #12 |
| Impact | 🔴 Functional |
| Depends on | — |
| Est. size | M |

## Problem

Angular search results are **mouse-click only**. `Esc` closes (Material).
`aria-selected` is hardcoded `false`. React has full keyboard nav:
`↑/↓` move, `Home/End` jump, `Enter` open, `Ctrl/Cmd+Enter` open in a **new
tab**, `Esc` close, hover sets selection, selected row scrolls into view,
`aria-activedescendant` on the input.

## Target behaviour

- A `selectedIndex` signal, `-1` when nothing is selected.
- `↑` / `↓` move within `[0, results.length-1]` (clamp or wrap — match React;
  clamp is typical).
- `Home` → 0, `End` → last.
- `Enter` → navigate to the selected result (`router.navigate(['/pages', guid])`)
  and close.
- `Ctrl/Cmd+Enter` → `window.open('/pages/' + guid, '_blank')`, keep the dialog
  open (or close — match React).
- Mouse hover over a row sets `selectedIndex` to that row.
- The selected row `scrollIntoView({ block: 'nearest' })`.
- The input has `role="combobox"` + `aria-activedescendant` pointing at the
  selected row's id; each row `id="search-result-<i>"` with
  `aria-selected="true|false"`.
- Keystrokes are handled on the input / dialog, not per-row.

## Implementation notes

**Files:** `features/search/search-dialog.ts`.

- A pure `moveSelection(current, key, length) => next` helper for the
  arrow/Home/End maths.
- Reset `selectedIndex` to `-1` (or `0`) whenever the result list changes.

## Tests first (TDD)

- `move-selection.spec.ts`: ↓ from -1 → 0; ↓ at last → last (clamp); ↑ at 0 →
  0; Home → 0; End → last.
- `search-dialog.spec.ts`: ↓/↑ update the highlighted row + `aria-selected` +
  `aria-activedescendant`; `Enter` navigates + closes; `Ctrl/Cmd+Enter` calls
  `window.open(_blank)`; hover sets selection; the selected row's
  `scrollIntoView` is called.

## Acceptance criteria

- [ ] Full keyboard nav: ↑/↓/Home/End/Enter/Ctrl+Enter.
- [ ] Hover sets selection; selected row scrolls into view.
- [ ] `aria-activedescendant` / `aria-selected` correct.
- [ ] Selection resets when results change.
- [ ] Maths helper + dialog behaviour unit-tested.

## Out of scope

- `aria-live` announcements (→ 6.6).
- Pagination interaction (→ 6.2 — ensure selection survives appended results).
