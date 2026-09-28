# Page comments

## Goal

Let users discuss a wiki page via threaded comments, surfaced as a new tab
in the editor's inspector panel (alongside Properties / Attachments /
Linked). Comments can be created, edited, and deleted by their own author
(Admins can also delete any comment, as a moderation backstop). The MCP
server exposes the same CRUD as tools for AI clients.

## Storage

Comments are **not** stored in the page's own YAML frontmatter. That was
the original idea, but two things in this codebase make it the wrong fit:

1. The frontmatter parser (`S3StoragePlugin.parseFrontmatter`) is a small
   hand-rolled line parser, not a real YAML library — it doesn't safely
   round-trip free-form multi-line text containing colons/quotes, which
   comment bodies will routinely contain.
2. Page saves (`pages-update.ts`, the MCP `update_page` tool) overwrite the
   *entire* page document via `StoragePlugin.savePage`, with no
   optimistic-concurrency check anywhere in that path. Comments living
   inside that document would inherit that race: a content edit and a
   comment landing around the same time could silently clobber each other.

Instead, each page gets a **sidecar JSON object** in S3:
`{guid}.comments.json`, stored next to `{guid}.md` — the same pattern
already used for attachment metadata (`getAttachmentMetadata` /
`saveAttachmentMetadata`). This means:

- Comment writes and page-content writes touch different S3 objects, so
  they can't clobber each other. **No changes needed to `pages-update.ts`
  or the MCP `update_page` tool.**
- No frontmatter-parser risk — it's plain JSON.
- The page's own S3 version history and `modifiedBy`/`modifiedAt` stay
  clean of comment activity.

The remaining race is comment-vs-comment (two people acting on the same
page's comment thread at once), since all of a page's comments live in one
shared JSON file. That's handled with S3 conditional writes:

- Read the sidecar + note its ETag (treat a missing object as an empty
  comment list with no ETag).
- Apply exactly one mutation (add/edit/delete) to an in-memory copy.
- `PutObject` with `IfMatch: <etag>` (omit `IfMatch` — i.e. `IfNoneMatch:
  '*'` — when creating the sidecar for the first time).
- On a 412 Precondition Failed, re-read (new content + new etag), re-apply
  the same mutation, and retry. Cap at a few attempts, then return 409 to
  the caller.

This logic lives once, as a shared helper (e.g. `withCommentsUpdate
(pageGuid, mutate)`), used by all three write endpoints so the retry loop
isn't duplicated three times.

**Verify during implementation:** local dev runs S3 via LocalStack
(through Aspire). Real AWS S3 has enforced `IfMatch` on `PutObject` since
August 2024; LocalStack's community edition may not enforce it with the
same fidelity. If it doesn't, comment writes are still functionally
correct locally (every write "succeeds," since nothing is actually
racing in a single-developer local session) — only the *safety net* is a
no-op locally. Confirm this doesn't break anything either way; it's not a
design blocker.

Deleting a page also deletes its `{guid}.comments.json` sidecar (extend
`deletePage`).

## Data model

```json
{
  "comments": [
    {
      "id": "uuid-v4",
      "parentId": "uuid-v4 | null",
      "authorId": "cognito-sub | \"mcp-client\"",
      "authorName": "display name, snapshotted at post time",
      "body": "comment text",
      "createdAt": "ISO 8601",
      "editedAt": "ISO 8601 | null",
      "deletedAt": "ISO 8601 | null"
    }
  ]
}
```

- **One level of nesting.** `parentId: null` = top-level comment.
  `parentId` set = a reply to a top-level comment. A reply's `parentId`
  must reference an existing top-level comment; replying to a reply is
  rejected (400).
- **Delete semantics:** if a comment has no replies, remove it from the
  array entirely. If it has replies, soft-delete it — clear `body`, set
  `deletedAt` — so the thread structure survives and the frontend can
  render a `[deleted]` placeholder in place of the original text.
- `authorName` is a snapshot (not a live lookup) so a later display-name
  change doesn't rewrite history, consistent with how page frontmatter
  already snapshots `createdBy`/`modifiedBy` as immutable Cognito subs.

## StoragePlugin interface

Two new methods, mirroring the existing attachment-metadata sidecar shape:

```typescript
getComments(pageGuid: string): Promise<{ comments: Comment[]; etag: string | null }>;
saveComments(pageGuid: string, comments: Comment[], expectedEtag: string | null): Promise<{ etag: string }>;
```

`saveComments` throws a `COMMENTS_CONFLICT` error (409) on an `IfMatch`
mismatch; callers (the shared retry helper) catch it and retry.

## API endpoints

All under `/pages/{guid}/comments`, Cognito-authed via the existing
`withAuth` middleware, same error-shape conventions as the other
`pages-*` handlers.

- **`GET /pages/{guid}/comments`** — list all comments (soft-deleted rows
  included, with `body` already blanked server-side) as a flat array; the
  frontend groups by `parentId` for rendering.
- **`POST /pages/{guid}/comments`** — create. Body: `{ body: string,
  parentId?: string | null }`. Server sets `id`, `authorId`/`authorName`
  from the JWT, `createdAt`. Validates `parentId` (if present) references
  an existing top-level comment.
- **`PUT /pages/{guid}/comments/{commentId}`** — edit. Body: `{ body:
  string }`. **403 unless the caller's `userId` matches the comment's
  `authorId`.** Sets `editedAt`.
- **`DELETE /pages/{guid}/comments/{commentId}`** — delete (hard or soft,
  per the rule above). **403 unless the caller's `userId` matches
  `authorId`, or the caller has the Admin role.**

Ownership is enforced **server-side** here — worth calling out because the
existing attachment-delete ownership check (`pages-attachments-delete.ts`)
has no server-side check at all today; it's UI-only (the delete button is
just hidden client-side in `attachment-manager.ts`). Comments do it
properly since the endpoint already loads the sidecar to mutate it, so the
check is nearly free.

Who can comment: any authenticated user (Admin or Standard), matching how
page viewing/editing already works. Comments work regardless of page
status (draft/archived/published) — no extra restriction there, unlike
the MCP `update_page` tool's "published only" rule.

## MCP tools

Four new tools registered in `mcp-handler.ts`, following the existing
tool-file convention (`backend/src/mcp/tools/*.ts`):

- **`list_comments`** — `{ pageGuid }` → full comment list for a page.
- **`add_comment`** — `{ pageGuid, body, parentId? }`.
- **`update_comment`** — `{ pageGuid, commentId, body }`.
- **`delete_comment`** — `{ pageGuid, commentId }`.

MCP has no real user identity (API-key auth only, no Cognito), so it
authors comments as the same fixed pseudo-user `update_page` already uses:
`authorId: "mcp-client"`. Ownership rules apply identically — `update_comment`
and `delete_comment` only succeed on comments where `authorId ===
"mcp-client"` (i.e., MCP can only touch comments it created itself, never
a human's).

## Frontend

New "Comments" tab in `inspector-panel.ts`, alongside Properties /
Attachments / Linked, using the same `matTabContent` lazy-load +
`preserveContent` pattern the other tabs already use (see the comment in
`inspector-panel.ts` explaining why — avoids re-fetching on every tab
bounce).

A new `CommentsPanel` component (`frontend/src/app/features/pages/` or a
new `frontend/src/app/features/comments/`, matching how `linked-pages-panel`
sits under `features/pages/`), mirroring the structure of
`LinkedPagesPanel`/`AttachmentManager`:

- Fetches the flat comment list via a `Comments` service (`rxResource`
  pattern, same as `Pages.backlinksResource`), and groups into top-level +
  one level of replies client-side.
- A reply box under each top-level comment; a "new top-level comment" box
  at the top or bottom of the thread.
- Edit-in-place (reveal a textarea) and delete controls shown only when
  the signed-in user's `userId` matches `authorId`, or the user is an
  Admin (delete only) — same `Auth`-service-injected pattern
  `attachment-manager.ts` already uses for its `canDelete()` check.
- Soft-deleted comments render as a `[deleted]` placeholder, replies still
  indented underneath.
- Tab label shows a comment-count badge, same `matBadge` pattern the
  existing "Linked" tab uses for its backlink count.

## Testing

- **Backend unit tests** (Vitest): comment CRUD handlers — ownership
  enforcement (403 on non-owner edit/delete, Admin override on delete),
  reply-to-reply rejection (400), soft-delete-with-replies vs.
  hard-delete-without, and the conditional-write retry loop (simulate a
  412 and confirm it re-reads/retries rather than failing outright).
- **Backend integration tests** (against LocalStack, per
  `TESTING-WITH-ASPIRE.md`): real S3 round-trip for the sidecar object,
  including the LocalStack `IfMatch` fidelity check called out above.
- **Frontend unit tests** (Jest): `CommentsPanel` — rendering grouped
  threads, edit/delete visibility gating by ownership/role,
  `[deleted]` placeholder rendering.
- **E2E** (Playwright, `e2e/tests/`): a new spec covering the full human
  flow — open a page, post a top-level comment, reply to it, edit your
  own comment, attempt to edit another user's comment (control not
  shown), delete a comment with replies and confirm the `[deleted]`
  placeholder, delete a leaf comment and confirm it's gone. Follows the
  existing one-spec-per-flow convention in `e2e/tests/`.

## Explicitly out of scope

- Inline/anchored comments tied to a text selection or line — this is a
  page-level discussion thread, not Google-Docs-style suggestions.
- Notifications (email/in-app) when someone comments or replies.
- Edit history / revision tracking for comment bodies (only a single
  `editedAt` timestamp, no diff or prior-versions view).
- Reactions/likes on comments.
