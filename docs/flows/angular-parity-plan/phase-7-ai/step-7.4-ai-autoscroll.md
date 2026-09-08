# Step 7.4 — AI auto-scroll to bottom

| | |
|---|---|
| Phase | 7 — AI sidebar |
| Gap refs | §3.7 "Message roles" ("no auto-scroll to bottom"); punch list 🟠 |
| Impact | 🟠 |
| Depends on | — |
| Est. size | XS |

## Problem

The chat transcript does not auto-scroll to the newest message. React scrolls
to the bottom as messages arrive.

## Target behaviour

- When a new message (user / assistant / system / tool) is appended, or the
  assistant message streams/updates, the transcript scrolls to the bottom.
- If the user has scrolled **up** to read history, don't yank them down —
  only auto-scroll when they're already near the bottom (React-typical; match
  if React does this, otherwise always-scroll is acceptable).

## Implementation notes

**Files:** `features/ai/ai-sidebar.ts` (transcript container).

- An `effect()` on the messages signal (+ the "thinking" flag) that sets
  `container.scrollTop = container.scrollHeight` via a `viewChild` +
  `afterNextRender` / `afterRenderEffect`.
- "Near the bottom" check: `scrollHeight - scrollTop - clientHeight < ~64`.

## Tests first (TDD)

- `ai-sidebar.spec.ts`: appending a message scrolls the container to the
  bottom; with the container scrolled up beyond the threshold, a new message
  does **not** force-scroll (if implementing the guard).

## Acceptance criteria

- [ ] New / updated messages scroll the transcript to the bottom.
- [ ] Reading-history guard (if matching React).
- [ ] Test covers append-scrolls and (optionally) the guard.

## Out of scope

- Tool row rendering (→ 7.2).
