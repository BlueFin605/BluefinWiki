# Step 3.6 — `[[` autocomplete: outside-click dismiss

| | |
|---|---|
| Phase | 3 — Editor & preview |
| Gap refs | §3.4 "`[[` autocomplete" ("no click-outside dismiss"); §0.7 |
| Impact | ⚪ in the doc — small, bundled here |
| Depends on | — |
| Est. size | XS |

## Problem

`link-autocomplete.ts` matches React except it has **no click-outside
dismiss** — the popup only closes on `Esc` or when the `[[` regex context
breaks.

## Target behaviour

- Clicking anywhere outside the autocomplete popup (and outside the active
  `[[` token) closes it, matching the tree context-menu / search behaviours.
- `Esc` and regex-break dismissal keep working.

## Implementation notes

**Files:** `features/editor/link-autocomplete.ts`.

- Add a `pointerdown` listener on `document` (registered while the popup is
  open, torn down on close) that closes the popup unless the event target is
  inside the popup element. Use CDK `Overlay`'s backdrop if the popup already
  uses an overlay; otherwise a manual listener via `Renderer2` /
  `takeUntilDestroyed`.

## Tests first (TDD)

- `link-autocomplete.spec.ts`: with the popup open, a `pointerdown` outside
  closes it; a `pointerdown` inside the popup does not; `Esc` still closes.

## Acceptance criteria

- [ ] Outside click / pointerdown closes the popup.
- [ ] Inside interactions and `Esc` unaffected.
- [ ] Listener is cleaned up on close/destroy (no leak).
- [ ] Test covers inside vs outside.

## Out of scope

- Any change to the search query / debounce / result rendering.
