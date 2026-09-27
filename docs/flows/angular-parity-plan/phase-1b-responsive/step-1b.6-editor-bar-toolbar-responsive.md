# Step 1b.6 — Editor bar + markdown toolbar responsive

| | |
|---|---|
| Phase | 1b — Responsive / mobile layer |
| Design | DESIGN.md §"Per-surface behaviour" |
| Gap refs | §3.4 "View modes" (Split hidden on mobile), "Markdown toolbar" (bottom-pinned, compact); §0.5 |
| Impact | 🔴 Functional |
| Depends on | 1b.1; step 3.1 (Split view); step 3.4 (`compact` input) |
| Est. size | M |

## Problem

After step 3.1 the editor has `Edit | Split | Preview`; after step 3.4 the
markdown toolbar has a `compact` input and Image/Attachment buttons. Neither
adapts to viewport. React: below 1024 the mode toggle is **Edit/Preview only**
(Split hidden), and the toolbar is **fixed to the bottom** of the screen,
horizontally scrollable, `compact` (OL/Task/code-block hidden, headings H1–H3),
heading menu opens **upward**.

## Target behaviour

- **Mode toggle** (`page-detail` bar): when `!bp.isDesktop()`, the `Split`
  `mat-button-toggle` is not rendered. If the current mode is `split` when the
  viewport shrinks below 1024, fall back to `edit`.
- **Markdown toolbar:** when `!bp.isDesktop()`:
  - `compact` input = `true` (hides OL / Task / code-block; heading menu H1–H3
    only; heading menu `yPosition="above"`);
  - the toolbar container is `position: sticky`/`fixed` to the bottom of the
    editor viewport, `overflow-x: auto`, with
    `padding-bottom: env(safe-area-inset-bottom)`;
  - the editor body gets bottom padding equal to the toolbar height so content
    isn't hidden behind it.
- Desktop: unchanged (toolbar above the editor, full button set).

## Implementation notes

**Files:** `features/pages/page-detail.ts` (mode toggle `@if`, split→edit
fallback effect, toolbar placement class), `features/editor/markdown-toolbar.ts`
(honour `compact` for layout + `yPosition`; the button-hiding logic is already
in step 3.4 — this step just drives the input from `Breakpoint` and adds the
bottom-pinned styling).

- Split→edit fallback: an `effect()` — `if (!isDesktop() && mode() === 'split') mode.set('edit')`.
- Bottom-pinned toolbar: simplest is a class on the toolbar host toggled by
  `!isDesktop()`; the CSS does `position: sticky; bottom: 0` within the
  scrolling editor pane, or `position: fixed` if the pane doesn't scroll as a
  unit — verify against the `.body { overflow: auto }` in `page-detail`.

## Tests first (TDD)

- `page-detail.spec.ts` (Breakpoint stub): mobile → mode toggle has only
  `view`/`edit` (no `split`); starting in `split` then going mobile switches to
  `edit`; the toolbar host carries the bottom-pinned class on mobile.
- `markdown-toolbar.spec.ts`: `compact = true` sets `yPosition="above"` on the
  heading menu and applies the scrollable layout (button-hiding already covered
  in step 3.4's spec).

## Acceptance criteria

- [ ] Split is hidden `<1024`; a live `split` mode falls back to `edit`.
- [ ] Toolbar is bottom-pinned + horizontally scrollable + safe-area padded on
      mobile; `compact` on; heading menu opens upward.
- [ ] Editor content is not obscured by the pinned toolbar.
- [ ] Desktop editor bar + toolbar unchanged.
- [ ] Specs cover the mode toggle + toolbar adaptation.

## Out of scope

- The toolbar's Image/Attachment buttons + `compact` button-hiding (→ step 3.4).
