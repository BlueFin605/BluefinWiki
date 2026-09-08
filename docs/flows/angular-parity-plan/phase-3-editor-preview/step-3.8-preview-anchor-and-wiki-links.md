# Step 3.8 — Preview: anchor scroll + wiki-link GUID href + broken-link resolver

| | |
|---|---|
| Phase | 3 — Editor & preview |
| Gap refs | §3.4 Preview "In-page `#anchor` links", "Wiki links `[[…]]`", "Broken wiki links"; punch list 🟠 |
| Impact | 🟠 |
| Depends on | 3.7 (pipeline options plumbing); pairs with 2.7 |
| Est. size | M |

## Problem

- **`#anchor` smooth-scroll broken.** Every `<a>` is rendered
  `target="_blank" rel="noopener"`, so `#heading` links open a blank tab and
  never scroll.
- **Wiki-link href may be a title.** `[[…]]` renders as
  `<a [routerLink]="href()">` where `href` = `data-wiki-target`, which may be a
  **title** (won't resolve) or a guid.
- **Broken-link detection dead.** `wiki-link.ts` can render a broken state from
  `data-broken`, but nothing resolves page existence, so broken links never
  appear and `page-detail.onBrokenLink` is unreachable.

## Resolved decisions (from the plan README)

- **Keep click-to-navigate** for wiki links; the pipeline **must always resolve
  `[[…]]` to a GUID href**.
- **Wire a `pageExists` resolver** so broken-link detection and the
  create-from-link flow (step 2.7) work end to end.

## Target behaviour

- **Hash links:** an `<a href="#slug">` is rendered as a normal in-page link
  (no `target="_blank"`); clicking it `preventDefault`s and smooth-scrolls to
  the element whose `id` is `slug` (the heading slugs already exist), updating
  `location.hash`.
- **External links** (`http(s)://…`): keep `target="_blank" rel="noopener"`.
- **Wiki links:** the pipeline resolves each `[[target]]` to a guid via a
  provided resolver (`resolveWikiTarget(target) => { guid, exists }`). The
  rendered link's `routerLink` is always `/pages/<guid>`. If the target is
  already a guid, use it directly.
- **Broken links:** when `exists === false`, render the broken state — red text
  + trailing `?` + tooltip "Page not found: {target}. Click to create." —
  clicking opens the Create-Page-from-Link modal (step 2.7) with `target`
  prefilled; on success the source markdown is rewritten (step 2.7).
- The resolver is passed through `markdown-renderer` → `unified-pipeline`
  options (the `pageGuid` plumbing from step 3.7 is the same channel).

## Implementation notes

**Files:** `shared/markdown/unified-pipeline.ts` /
`shared/markdown/plugins/remark-wiki-links.ts` (accept a resolver + emit
guid href / broken flag), `shared/markdown/wiki-link.ts` (broken UI + click →
modal), `shared/markdown/markdown-renderer.ts` (new `resolveWikiTarget` input),
`features/pages/page-detail.ts` (provide the resolver; it can batch-resolve
via a `Pages` search/lookup — confirm an existence/lookup endpoint, else use
`GET /pages/search?q=` and match, or a dedicated `pageExists`).
Link-rendering: the `<a>` post-processing that currently forces `_blank` —
special-case `#` and internal targets.

- Resolver caching: resolve each distinct target once per render pass.
- If no batch lookup endpoint exists, document what was used.

## Tests first (TDD)

- `unified-pipeline.spec.ts`: `[[Some Page]]` with a resolver returning
  `{ guid: 'g1', exists: true }` → `<a>` with `routerLink="/pages/g1"`;
  `exists: false` → broken markup with `data-broken`.
- Link post-processing spec: `#intro` → no `target=_blank`, gets the
  smooth-scroll hook; `https://x.com` → keeps `target=_blank`.
- `wiki-link.spec.ts`: broken link click opens the create modal with the
  target prefilled.
- `page-detail.spec.ts`: `resolveWikiTarget` is provided and its results reach
  the renderer.

## Acceptance criteria

- [ ] `#anchor` links smooth-scroll and set `location.hash`; no blank tab.
- [ ] External links still open in a new tab.
- [ ] Wiki links always navigate via `/pages/<guid>` — never a bare title.
- [ ] Missing targets render broken and open the create modal on click.
- [ ] Resolver plumbed through renderer options; caching in place.
- [ ] Tests cover hash / external / valid-wiki / broken-wiki.

## Out of scope

- The source-markdown rewrite after creation (owned by step 2.7).
