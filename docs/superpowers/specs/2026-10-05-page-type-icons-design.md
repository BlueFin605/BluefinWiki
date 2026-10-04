# Page type icons + Bug page type — design

Date: 2026-10-05 · Piece 2 of the Board & UI improvements (Wiki Enhancements board)

## Problem

Page-type icons are free-text emoji (`PageTypeDefinition.icon`), entered in the
page-types admin and rendered by the tree (`pages/row-icon.ts`), board cards
(`board/board-card.ts`) and the card summary dialog. The admin pre-fills new
types with `📄` — which is also the icon of an untyped leaf page
(`DOCUMENT_ICON`). As a result Initiative, Epic, Story, Task, Movies Kanban and
TV Kanban all show `📄` and are indistinguishable from plain documents.

The problem is mostly data. The code fix is to stop the admin from steering new
types into the trap and to make picking a good icon easy. A Bug type needs no
code: kanban nesting is driven by each type's `allowedChildTypes`
(`backend/src/mcp/tools/kanban/kanban.ts` validates against it).

Rejected: switching to Material icons (page-type icons are user-entered emoji —
the earlier Haiku attempt broke exactly this), and a full searchable emoji
picker (new dependency; not needed for ~10 types).

## Code changes (frontend only)

All in `frontend/src/app/features/page-types/`.

### 1. `icon-suggestions.ts` (new)

```ts
/** Clickable icon suggestions shown under the page-type admin's Icon field. */
export const ICON_SUGGESTIONS: readonly string[] = [
  '🎯', '🏔️', '📘', '✅', '🐞', '🗂️', '📺', '🎬',
  '🎞️', '📚', '🧪', '💡', '🛠️', '📌', '🗓️', '⭐',
];

/** Icons a typed page should not use: they are the untyped page/folder icons. */
export const GENERIC_ICONS: readonly string[] = ['📄', '📁'];

export function isGenericIcon(icon: string): boolean {
  return GENERIC_ICONS.includes(icon.trim());
}
```

`GENERIC_ICONS` duplicates `DOCUMENT_ICON` / `FOLDER_ICON` from
`pages/row-icon.ts` by importing them, not by re-typing the literals.

### 2. `page-types-admin.ts`

- `emptyForm().icon` becomes `''`. `canSave` already requires a non-blank icon,
  so a new type cannot be saved until one is chosen.
- Icon input `maxlength` goes from `4` to `16` (backend allows 50; ZWJ emoji
  such as 🧑‍💻 exceed 4 UTF-16 units).
- Under the Icon field, a row of suggestion buttons, one per
  `ICON_SUGGESTIONS` entry: `<button type="button" class="icon-suggestion"
  [attr.aria-label]="'Use icon ' + s" (click)="updateIcon(s)">{{ s }}</button>`.
  The one equal to the current icon gets `.selected` / `aria-pressed="true"`.
- A `mat-hint` on the Icon field, shown when `isGenericIcon(form().icon)`:
  *"Same as an untyped page — it won't stand out in the tree or on boards."*
  A warning only; Save stays enabled.

No backend changes. Existing types keep their icons until edited.

## Data changes (Dean, in the page-types admin, after deploy)

- Re-icon: Initiative 🎯, Epic 🏔️, Story 📘, Task ✅, Movies Kanban 🗂️,
  TV Kanban 🗂️ (Dean may choose differently).
- Create **Bug** 🐞 with property `state` (string, required); add Bug to
  Story's allowed child types.
- Smoke check: `kanban_create` a Bug under a Story on a scratch initiative (or
  ask Claude to), then delete it.

Follow-up (Claude, Home repo, not BluefinWiki): mention Bug as a leaf type
alongside Task in the `bluefin-kanban` skill.

## Testing

`page-types-admin.spec.ts` (Jest + testing-library):

- New page type → Icon input is empty and Save is disabled until an icon is set.
- Clicking `Use icon 🐞` sets the Icon input to 🐞 and the POST body carries it.
- The hint text appears when the icon is 📄 or 📁 and is absent for ✅.
- Existing tests that relied on the 📄 default (`Save (new)` clears then types
  `R`) still pass.

`icon-suggestions.spec.ts`: `isGenericIcon` true for 📄, 📁 and ' 📄 ', false
for ✅ and ''.

No e2e — the behaviour is form logic fully covered by unit tests.

## Out of scope

- Material icons, a searchable emoji picker, icon validation on the backend.
- Changing the untyped page/folder icons.
