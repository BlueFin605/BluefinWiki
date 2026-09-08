# Step 3.7 — Preview: attachment URLs + authed images + drag-resize

| | |
|---|---|
| Phase | 3 — Editor & preview |
| Gap refs | §3.4 Preview "Images / attachments"; §11 checklist; punch list 🔴 #7, #9(shared) |
| Impact | 🔴 Functional |
| Depends on | — (produces the authed-image component reused by 4.8) |
| Est. size | L |

## Problem

`markdown-renderer.ts` takes only `markdown` — no `pageGuid` — and `page-detail`
passes no `pipelineOptions`. So:

- **No attachment-path rewrite.** React rewrites a bare filename
  `![alt](name.png)` → `/pages/:guid/attachments/name.png` (plus a legacy
  `guid/filename` form).
- **No authed image component.** React uses `AsyncImage` (authed fetch →
  presigned `{url}` → `<img>`) with loading + "Failed to load image" states.
  Angular renders a raw `<img src>`, so API-backed images needing an auth
  header will not load.
- **No drag-to-resize.** React has a drag handle on images that rewrites
  `![alt|WIDTH]` in the source markdown.

`remark-image-size` (`![alt|WIDTH]` parsing) is already ported and works.

## Target behaviour

- `markdown-renderer` accepts `pageGuid` (+ an options object) and threads it
  into `unified-pipeline`.
- A pipeline plugin rewrites bare-filename image URLs to
  `/api/pages/${pageGuid}/attachments/${name}` (and normalises the legacy
  `${guid}/${filename}` form). External URLs (`http(s)://`, `data:`) pass
  through untouched.
- A `WikiImage` component (Angular) replaces raw `<img>` for
  attachment-backed sources: requests the presigned URL via the authed
  `HttpClient` (through `attachments` service), shows a loading state, renders
  the `<img>` on success, "Failed to load image" on error. Reuse the existing
  `Attachments` presign/fetch method if present.
- Drag handle on rendered images (edit/split mode only): dragging changes the
  width and rewrites the nearest `![alt|WIDTH]` token in the CodeMirror buffer.
- This `WikiImage` component is the same one step 4.8 uses for attachment
  thumbnails / lightbox — build it here, reuse there.

## Implementation notes

**Files:** `shared/markdown/markdown-renderer.ts` (new `pageGuid` input),
`shared/markdown/unified-pipeline.ts` (+ options),
new `shared/markdown/plugins/remark-attachment-urls.ts`,
new `shared/markdown/wiki-image.ts` (or `shared/components/`),
`features/pages/page-detail.ts` (pass `pageGuid`),
`shared/codemirror/wiki-codemirror.ts` (width rewrite helper).

- Rendering `WikiImage` inside a `unified`→HTML string pipeline means the
  pipeline must emit a placeholder element the renderer hydrates into the
  component (the app likely already hydrates `wiki-mermaid` / `wiki-link` this
  way — follow that exact pattern).
- Width-rewrite helper: pure `setImageWidth(markdown, imageIndexOrAlt, width)`.

## Tests first (TDD)

- `remark-attachment-urls.spec.ts`: bare `name.png` → `/api/pages/<guid>/attachments/name.png`;
  `http://…` untouched; `data:` untouched; legacy `guid/file` normalised.
- `wiki-image.spec.ts`: shows loading, then `<img>` on presign success;
  "Failed to load image" on error; external URL path skips the presign.
- `set-image-width.spec.ts`: `![a](x.png)` → `![a|300](x.png)`;
  `![a|100](x.png)` → `![a|300](x.png)`.
- `markdown-renderer.spec.ts`: passing `pageGuid` produces rewritten URLs;
  omitting it leaves relative URLs alone (no crash).

## Acceptance criteria

- [ ] `markdown-renderer` accepts and threads `pageGuid`.
- [ ] Bare-filename image URLs rewritten to the attachments endpoint.
- [ ] Attachment images load via an authed presigned request with
      loading/error states.
- [ ] Images can be drag-resized, rewriting `![alt|WIDTH]`.
- [ ] `WikiImage` is reusable (consumed later by 4.8).
- [ ] All helpers + the component unit-tested.

## Out of scope

- The `#anchor` / wiki-link behaviour (→ 3.8).
- Attachment manager UI (→ 4.8) — it consumes `WikiImage`.
