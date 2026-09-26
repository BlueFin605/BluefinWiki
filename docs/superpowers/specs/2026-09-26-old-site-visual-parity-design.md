# Old-site visual parity (chrome + inspector density)

## Goal

Bring the Angular frontend's visual styling closer to the previous React
production site (`wiki.bluefin605.com`), without changing any layout
structure, DOM/component tree, or responsive (mobile drawer / AI overlay /
hamburger) behavior. Visual polish only — colors, spacing, density,
typography. Confirmed with Dean: full chrome rebuild (moving icons out of
the top app bar into a sidebar header) is explicitly out of scope and would
be its own follow-up phase given how much of the documented Phase 1b
responsive design is keyed off the current `.topbar` structure.

Dean specifically called out the inspector panel's density: the old React
inspector felt tighter/more compact than the current Angular one.

## Method

Compared the live old site (authenticated, `wiki.bluefin605.com/pages`)
against the Angular app running locally (`localhost:5173`) side by side,
then read computed styles directly from the old site via injected JS to get
exact values (Tailwind-authored, so classes were also visible in the DOM).

## Measured tokens (old site)

| Token | Value |
|---|---|
| App canvas background | `#f9fafb` (Tailwind `gray-50`) |
| Sidebar / inspector panel background | `#ffffff` |
| Border | `#e5e7eb` (Tailwind `gray-200`) |
| Accent / primary | `rgb(21,93,252)` (Tailwind `blue-600`) |
| Heading text | `rgb(16,24,40)` (Tailwind `gray-900`) |
| Muted text | `rgb(106,114,130)` (Tailwind `gray-500`) |
| Font family | `Inter, system-ui, Avenir, Helvetica, Arial, sans-serif` |
| Save-status pill | bg `rgb(219,252,231)` (green-100), text `rgb(0,130,53)` (green-700), border green-500, radius `4px`, padding `6px 12px`, `14px` font |
| Save button | bg blue-600, white text, radius `4px`, padding `6px 16px`, `14px/500` font; disabled → bg `rgb(209,213,220)` (gray-300), text gray-500 |
| Inspector tab (e.g. "Properties") | underline style: `px-3 py-2`, `12px/500` font, `2px` bottom border, active = blue-600 border + text, inactive = gray, **not** a filled/ripple Material tab |

## Current Angular state (for contrast)

- `frontend/src/styles.scss`: Material theme via `mat.theme()`, Roboto
  typography, `density: 0` (the least-compact Material density step).
- `pages-view.ts` `.body .sidebar` / `.body .inspector`: sidebar bg
  `#f9fafb`, inspector bg `#fff` — inverted vs. the old site's white
  sidebar / gray-50 canvas.
- `pages-view.ts` `.topbar`: `<mat-toolbar color="primary">` — a solid
  Material primary-color band with white icon buttons; old site has no
  colored top bar at all.
- `inspector-panel.ts`: stock `mat-tab-group` (Material's default filled/
  ripple tab header, larger and denser-feeling than old's thin underline
  tabs).
- `page-properties-panel.ts` / `custom-properties-editor.ts`: every field
  uses `mat-form-field appearance="fill"`, which — combined with
  `density: 0` — renders noticeably taller/looser than the old site's plain
  bordered inputs.
- `page-detail.ts` `.bar`: already uses `#f9fafb` background and `#e5e7eb`
  border (close to old already); Save/status-pill colors need to align to
  the measured values above.

## Changes (visual only — no template/DOM restructuring)

1. **Global** (`styles.scss`): typography → Inter (Roboto fallback);
   density `0` → `-2`.
2. **`pages-view.ts` `.topbar`**: remove `color="primary"`; white
   background, `1px solid #e5e7eb` bottom border; icon/button color
   `#6a7282` instead of Material's on-primary white.
3. **`pages-view.ts` `.body .sidebar` / `.body .inspector`**: swap
   backgrounds — sidebar/inspector → `#ffffff`, and give the outer shell
   (`.body`/`.pages-shell`) the `#f9fafb` canvas color instead.
4. **`inspector-panel.ts`**: override Material's tab CSS custom properties
   (`--mat-tab-header-*` / label/indicator tokens) for a smaller (~12–13px),
   underline-style tab header — same `mat-tab-group`, no markup change.
5. **`page-properties-panel.ts` / `custom-properties-editor.ts`**: switch
   `appearance="fill"` → `appearance="outline"` on all `mat-form-field`s;
   tighten `.panel` gap/padding to read closer to the old plain inputs.
6. **`page-detail.ts`**: align Save button and `.save-status` pill colors/
   radius/padding to the measured old-site values (§ table above).

## Explicitly out of scope

- Moving search/AI/new-page icons out of the top app bar into a "Pages"
  sidebar header, and moving Settings/account to the bottom of the sidebar
  (matches old exactly, but touches the documented Phase 1b mobile drawer /
  AI-overlay / hamburger responsive logic — its own follow-up phase if
  wanted later).
- Any behavioral change to the View/Edit toggle, mobile bottom-sheet
  inspector, or AI sidebar.

## Verification

- Visual: screenshot the pages list, a content-heavy page (view + edit
  mode), and the inspector's Properties tab in the Angular dev app before/
  after, compared against the old site's equivalent screens.
- Existing Jest unit tests and Playwright e2e suite (Phase 1b responsive
  coverage) must still pass unmodified — these changes touch only CSS/
  style blocks and Material appearance attributes, not markup structure or
  component logic.
