# Step 4.8 — Attachment manager

| | |
|---|---|
| Phase | 4 — Inspector |
| Gap refs | §3.4 "Attachments" (`attachment-manager.ts`); §11 checklist; punch list 🔴 #9 |
| Impact | 🔴 Functional |
| Depends on | 3.7 (`WikiImage` authed-image component) |
| Est. size | L |

## Problem

Angular `attachment-manager.ts` lists name / size / date and offers **Insert +
Delete only**. Missing vs React:

- **exponential-backoff auto-retry** on load failure (1 s → 30 s, ≤10
  attempts) + a manual **Refresh** button,
- **newest-first sort**,
- per item: type emoji, **image thumbnail** (presigned) → **full-screen
  lightbox**,
- actions **Download**, **Copy Markdown**, **Drag Link** (in addition to Insert
  + Delete).

Delete permission (Admin or author or uploader) + `window.confirm` already
match — keep.

## Target behaviour

- On load failure, retry with exponential backoff: 1s, 2s, 4s… capped at 30s,
  max 10 attempts; a Refresh button forces an immediate retry and resets the
  backoff.
- List sorted by upload date, newest first.
- Each row: a type emoji by extension/mime; for images, a thumbnail rendered
  via `WikiImage` (step 3.7) using the presigned URL; clicking the thumbnail
  opens a full-screen lightbox (also `WikiImage`, Esc / backdrop to close).
- Row actions:
  - **Insert** → insert markdown at the editor cursor (shared helper, step 4.9 /
    3.4),
  - **Download** → trigger a download of the presigned URL,
  - **Copy Markdown** → copy `![name](name.ext)` (or the attachment markdown
    form) to the clipboard,
  - **Drag Link** → `draggable` row emitting the markdown as drag data so it
    can be dropped into the editor,
  - **Delete** → unchanged (perm check + confirm).

## Implementation notes

**Files:** `features/attachments/attachment-manager.ts`,
`features/attachments/attachments.ts` (presign / list — reuse), reuse
`shared/markdown/wiki-image.ts` from step 3.7, a small `backoff` helper
(`nextDelay(attempt) => ms`).

- Backoff as a pure helper; the retry loop uses `timer` + `retryWhen` /
  `retry({ delay })` on the list observable, or a manual scheduler.
- Lightbox: a CDK overlay / `mat-dialog` with the full-size `WikiImage`.
- Clipboard: `navigator.clipboard.writeText`.

## Tests first (TDD)

- `backoff.spec.ts`: `nextDelay` sequence 1000, 2000, 4000, … clamped at
  30000; stops signalling after 10.
- `attachment-manager.spec.ts`: load failure → retries with growing delays
  (fake timers), gives up after 10; Refresh resets; list renders newest-first;
  image rows show a `WikiImage` thumbnail; Copy Markdown writes the right
  string; Download triggers; Drag Link sets drag data; Delete still perm-gated
  + confirmed.

## Acceptance criteria

- [ ] Exponential-backoff auto-retry (1s→30s, ≤10) + manual Refresh.
- [ ] Newest-first sort.
- [ ] Type emoji + image thumbnail → lightbox.
- [ ] Download / Copy Markdown / Drag Link / Insert / Delete all present.
- [ ] Delete perms + confirm unchanged.
- [ ] Backoff helper + manager behaviour unit-tested.

## Out of scope

- The upload flow itself (→ 4.9).
