# Step 1b.8 — TOC mobile bar

| | |
|---|---|
| Phase | 1b — Responsive / mobile layer |
| Design | DESIGN.md §"Per-surface behaviour" |
| Gap refs | §3.4 "Table of contents" (mobile collapsible bar); §0.5 |
| Impact | 🔴 Functional |
| Depends on | 1b.1; step 3.10 |
| Est. size | S |

## Problem

Step 3.10 builds the TOC with a `compact` / `mobile` input but leaves *when* to
use it to this phase. React desktop = sticky 224px right rail; mobile = a
collapsible "On this page" bar above the preview.

## Target behaviour

- The TOC consumer (`page-detail` / the preview wrapper) drives the TOC's
  `compact` input from `!bp.isDesktop()`.
- **Desktop:** sticky right rail (from step 3.10) — unchanged.
- **Mobile:** a full-width bar above the preview, **collapsed by default**,
  labelled "On this page"; tapping expands the list; picking an entry
  smooth-scrolls (from step 3.10) and re-collapses the bar.
- Still hidden entirely when `<3` headings, at any width.

## Implementation notes

**Files:** `shared/markdown/table-of-contents.ts` (the `compact` layout — most
of this is step 3.10; here confirm the collapsed-bar markup + the collapse-on-
select behaviour), `features/pages/page-detail.ts` (pass
`[compact]="!bp.isDesktop()"`).

## Tests first (TDD)

- `table-of-contents.spec.ts` (Breakpoint not needed — drive `compact`
  directly): `compact = true` → renders the collapsed "On this page" bar;
  expanding shows the list; selecting an entry scrolls and collapses;
  `<3` headings → nothing regardless of `compact`.
- `page-detail.spec.ts`: `compact` input tracks `!isDesktop()`.

## Acceptance criteria

- [ ] Mobile TOC = collapsible bar above the preview, collapsed by default.
- [ ] Selecting an entry scrolls + re-collapses.
- [ ] Desktop rail unchanged; `<3` headings still hides it.
- [ ] Specs cover compact bar + the consumer wiring.

## Out of scope

- TOC parsing / IntersectionObserver / slugs (→ step 3.10).
