# Step 6.7 — Visible Search button

| | |
|---|---|
| Phase | 6 — Search dialog |
| Gap refs | §3.1 "no visible Search button anywhere", §3.6 "Open affordance"; punch list 🟠 |
| Impact | 🟠 |
| Depends on | 1.5 (mobile top bar) — soft; sidebar button can land first |
| Est. size | XS |

## Problem

Search is reachable only via `Ctrl/Cmd+K`. React exposes a 🔍 button in the
sidebar header and in the mobile bar. Angular's `pages-view` moved New page / AI
/ user-menu into the top toolbar but added **no search affordance**.

## Target behaviour

- A visible Search button (magnifier icon, `aria-label="Search"`) that opens
  the same dialog `Ctrl/Cmd+K` opens.
- Placement: the `pages-view` top toolbar (near "New page" / AI), and — once
  step 1.5 lands — the mobile top bar.
- Tooltip shows the `Ctrl/Cmd+K` hint.

## Implementation notes

**Files:** `features/pages/pages-view.ts` (toolbar template + reuse the
existing open-search handler that the `@HostListener` calls).

- Just wire a `mat-icon-button` to the existing method — no new logic.

## Tests first (TDD)

- `pages-view.spec.ts`: the Search button is present with an accessible label;
  clicking it opens the search dialog (same path as the `Ctrl/Cmd+K` handler).

## Acceptance criteria

- [ ] Visible Search button in the pages toolbar; opens the dialog.
- [ ] `Ctrl/Cmd+K` hint in the tooltip.
- [ ] Mobile top-bar placement noted for step 1.5.
- [ ] Test covers presence + click-opens.

## Out of scope

- The mobile top bar itself (→ 1.5).
