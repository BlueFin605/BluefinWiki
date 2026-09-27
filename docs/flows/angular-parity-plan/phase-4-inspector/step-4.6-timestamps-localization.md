# Step 4.6 — Timestamps localization

| | |
|---|---|
| Phase | 4 — Inspector |
| Gap refs | §3.4 "Properties — Author / timestamps" |
| Impact | ⚪ in the doc — small, bundled here |
| Depends on | — |
| Est. size | XS |

## Problem

Angular shows `createdAt` / `modifiedAt` as **raw** strings
(`{{ metadata().createdAt }}`), and `createdBy` / `modifiedBy` as **ids**.
React shows localized dates and resolves ids to names where available.

## Target behaviour

- Dates rendered with Angular's `DatePipe` (e.g. `medium` or a locale-aware
  format) in the user's locale.
- `createdBy` / `modifiedBy`: if a name is resolvable (a users lookup already
  in memory, or the metadata carries a display name), show the name; otherwise
  fall back to the id (do not fetch users just for this — best-effort).

## Implementation notes

**Files:** `features/editor/page-properties-panel.ts` (template).

- `{{ metadata().createdAt | date:'medium' }}`.
- Name resolution: check whether `metadata()` already includes
  `createdByName` / a users signal is available; if not, leave the id and note
  it.

## Tests first (TDD)

- `page-properties-panel.spec.ts`: a known ISO timestamp renders in the
  expected formatted form (assert it is not the raw ISO string); a resolvable
  author id renders the name; an unresolvable one renders the id.

## Acceptance criteria

- [ ] Timestamps are localized, not raw ISO.
- [ ] Author ids resolve to names when data is available, else fall back.
- [ ] Test covers date formatting + both author paths.

## Out of scope

- Adding a new users fetch purely for name resolution.
