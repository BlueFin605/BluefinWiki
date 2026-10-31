# Delete a page tree with typed confirmation

## Goal

Make deleting a page that has children a deliberate act: the user must type the
page's title before the delete goes through. Shorten the S3 retention of deleted
(and previously edited) page versions from 365 to 30 days.

## Current state

- Recursive delete already works end to end. `S3StoragePlugin.deletePage(guid, recursive)`
  and the MCP `delete_page` tool take `recursive`; the UI sends `recursive: true`
  when the page has children (`pages-view.ts` `onDeleteRequested`).
- The confirmation is a plain `ConfirmDialog` ("Delete this page and all its child
  pages? This action cannot be undone."). No typed confirmation.
- The pages bucket is versioned in all environments. A delete leaves a delete
  marker; a lifecycle rule (`UnifiedStack.cs`, `DeleteOldVersions`) hard-deletes
  noncurrent versions after 365 days. The app has no restore feature.

## Design

### Piece 1 — typed-confirm dialog (frontend only)

- `onDeleteRequested` keeps its leaf branch unchanged (plain `ConfirmDialog`,
  `recursive: false`).
- The has-children branch opens a new typed-confirm dialog. The dialog names the
  page, states that all child pages are deleted too, and has a text field. The
  Delete button stays disabled until the field equals the page title
  (trimmed, case-insensitive). Cancel / dismiss performs no delete.
- Copy: "Deleted pages are kept for 30 days and can be recovered by an admin."
  replaces "This action cannot be undone."
- The `deleteRequested` payload (`page-tree.ts`, `page-tree-item.ts`) grows from
  `{ guid, hasChildren }` to `{ guid, title, hasChildren }`.
- No backend change; `recursive: true` is already supported.

### Piece 2 — retention 365 → 30 days (infra)

- `UnifiedStack.cs`: `NoncurrentVersionExpiration = Duration.Days(30)` and add
  `ExpiredObjectDeleteMarker = true` so empty delete markers are cleaned up.
- Side effect, accepted: page edit history (also stored as S3 versions) is kept
  for 30 days rather than 365.
- Infra change: applied manually per environment with `deploy-infra.ps1`, never
  via the deploy workflow.

## Testing

- Unit: new dialog spec (Delete disabled until the title matches, enabled on
  match, ignores surrounding whitespace and case, cancel returns false);
  `pages-view.spec.ts` has-children case opens the typed dialog and passes
  `recursive: true`; leaf case unchanged.
- E2E: update `e2e/tests/tree-delete-confirm.spec.ts` for the typed step.
- `ng lint` before closing.

## Docs impact

None. `infrastructure/INFRASTRUCTURE.md` lists S3 versioning but does not state the
retention period, and no SYSDOC covers the dialog or lifecycle rule.

## API impact

None. No route is added or changed.

## Out of scope

- A restore/undelete feature.
- Auto-purging Done kanban items after a TTL (parked; needs a `doneAt` timestamp
  and a scheduled sweep).
