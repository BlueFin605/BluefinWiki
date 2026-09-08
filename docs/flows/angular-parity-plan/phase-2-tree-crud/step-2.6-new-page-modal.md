# Step 2.6 — New Page modal

| | |
|---|---|
| Phase | 2 — Page tree & CRUD |
| Gap refs | §3.3 "New Page modal" (5 rows); punch list 🔴 #3, 🟠 "inline validation / no # Title content" |
| Impact | 🔴 Functional + 🟠 |
| Depends on | 1.1 (page-types map), 2.3 (force-expand) |
| Est. size | L |

## Problem

`new-page-modal.ts` has code paths but they are unfed / incomplete:

| Gap | Detail |
|---|---|
| Allowed-child scoping **dead** | `allowedChildTypesResource` exists but `pages-view` never passes `parentPageType`, so the modal shows **all** types regardless of parent. No auto-select. |
| Property inheritance **absent** | `createPage` body carries no `properties`. React builds defaults from the type schema and inherits the parent's same-name/same-type values. |
| Content boilerplate **missing** | `createPage` sends no `content`; new pages start blank. React sends `content = "# {title}\n\nStart writing…"`. |
| Inline validation **missing** | Title required/trimmed 3–100 is enforced only by disabling the button + server errors — no inline "required / 3–100" messages. |
| Parent expand **missing** | On success navigates to `/pages/:guid/edit` but does not expand the parent (see 2.3). |

## Target behaviour

- `pages-view` looks up the parent page's `pageType` before opening the modal
  and passes it as `parentPageType`. The modal scopes the type `<select>` to
  `GET /page-types/:parentType/allowed-children`. When exactly one type is
  allowed **and** untyped wiki pages are disallowed → auto-select it.
- On submit, build `properties`:
  - start from the chosen type's schema defaults,
  - overlay any parent property whose name **and** type match,
  - include the result in the `CreatePageRequest`.
- Send `content = "# ${title}\n\nStart writing…"` **unless** verification shows
  the backend already seeds page content — check `POST /api/pages` behaviour
  and note the finding in the PR. If the backend seeds it, skip and document.
- Inline messages under the title field: "Title is required" / "3–100
  characters". Show on blur / submit-attempt.
- On success: navigate to edit mode (already works) **and** emit the
  force-expand signal for the parent (step 2.3).

## Implementation notes

**Files:** `features/pages/new-page-modal.ts`, `features/pages/pages-view.ts`
(`onNewPage` / `onNewChildRequested` — pass `parentPageType`), a pure
`buildInheritedProperties(schema, parentProps)` helper,
`features/pages/page.types.ts` (`CreatePageRequest.properties` / `.content`).

- The parent's `pageType` + `properties`: `pages-view` has the active page
  content or can read the tree summary; for "New child" it has the target
  guid — fetch the parent's detail only if not already in hand.
- Keep the modal dumb: inputs `parentPageType`, `parentProperties`; outputs the
  create request.

## Tests first (TDD)

- `build-inherited-properties.spec.ts`: schema defaults applied; matching
  parent prop overrides a default; non-matching type is ignored.
- `new-page-modal.spec.ts`: given `parentPageType` with one allowed child +
  wiki disallowed → that type is pre-selected; blank title → inline "required";
  2-char title → inline "3–100"; submit builds a request with `content`
  starting `# ` and a `properties` object.
- `pages-view.spec.ts`: opening "New child" passes the parent's `pageType`;
  on success the parent guid is sent to the tree expand input.

## Acceptance criteria

- [ ] Type list is scoped to the parent; auto-selects per the rule.
- [ ] Created pages carry inherited `properties`.
- [ ] Created pages carry `# Title` boilerplate (or backend-seeding verified +
      documented).
- [ ] Inline required / 3–100 messages show.
- [ ] Parent expands on success.
- [ ] Helpers unit-tested; modal + wiring integration-tested.

## Out of scope

- Modal title wording "Create New/Child Page" (⚪).
- "Wiki Page (no type)" vs "(none)" label (⚪).
