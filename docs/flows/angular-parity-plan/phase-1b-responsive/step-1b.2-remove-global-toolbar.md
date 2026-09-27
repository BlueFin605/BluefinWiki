# Step 1b.2 — Remove the global app toolbar

| | |
|---|---|
| Phase | 1b — Responsive / mobile layer |
| Design | DESIGN.md D5 |
| Gap refs | F12; §1 "Chrome-less" |
| Impact | ⚪ in the doc — promoted to do (blocks a clean mobile top bar) |
| Depends on | — (coordinate with step 8.1) |
| Est. size | S |

## Problem

`app.html` renders `<mat-toolbar color="primary">BlueFinWiki</mat-toolbar>`
above **every** route — including `/callback` (should be chrome-less) and every
admin page (redundant with their own headers). On `/pages` it stacks on top of
`pages-view`'s own toolbar. React's callback page is chrome-less and there is no
app-global bar.

## Target behaviour

- `app.html` = just `<router-outlet>`. No global toolbar.
- `/pages` keeps its own top bar (`pages-view`), which gains the hamburger in
  step 1b.4.
- `/callback` renders chrome-less (already the case for its own component).
- `/settings`, `/admin/*`, `/profile` rely on the back-header from
  [step 8.1](../phase-8-admin-profile/step-8.1-admin-back-navigation.md). If
  step 8.1 has not landed yet, add a minimal `<h1>` + back button inline and
  leave a `TODO(8.1)` — do not ship an admin screen with no title.
- `/404`, `/403` are standalone full-screen components — unaffected.

## Implementation notes

**Files:** `app.html`, `app.ts` (drop `MatToolbarModule` / `RouterLink` if now
unused).

## Tests first (TDD)

- `app.spec.ts`: renders only the `router-outlet`; no `mat-toolbar`.
- Smoke: `settings-page.spec.ts` / one admin spec still shows a title +
  back affordance (via step 8.1 or the interim).

## Acceptance criteria

- [ ] No `<mat-toolbar>` in `app.html`.
- [ ] `/callback` is chrome-less.
- [ ] Admin / settings / profile still have a title + back to `/pages`.
- [ ] `app.ts` imports trimmed.
- [ ] Tests updated.

## Out of scope

- The hamburger / mobile top-bar contents (→ 1b.4).
