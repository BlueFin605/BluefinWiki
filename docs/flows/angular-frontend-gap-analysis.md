# BlueFinWiki — Angular Frontend Gap Analysis

Compares the **Angular rewrite** (`frontend/`, branch `feat/angular-rewrite`, `frontend-angular`,
Angular 21 + Material 3 + CDK + CodeMirror 6 + a hand-rolled `unified` markdown pipeline) against
the documented behaviour of the **React** frontend in
[`react-frontend-page-reference.md`](./react-frontend-page-reference.md).

Purpose: enumerate where the Angular app diverges in **functionality, validation, and user
experience**, and what would have to happen to close each gap. It is **not** a request to make the
two look identical — visual style (Material vs. bespoke Tailwind) is an accepted difference. This
document only records gaps; it does **not** fix them.

Section numbers below mirror the reference doc.

Legend for **Impact**:
- 🔴 **Functional** — a capability the React app has is missing or broken in Angular.
- 🟠 **UX / validation** — the capability exists but behaves worse, is less discoverable, or skips a guard.
- ⚪ **Cosmetic / acceptable** — noted for completeness; no action needed unless desired.

---

## 0. Framework-level differences (cut across every screen)

| # | Area | React | Angular | Impact | What needs to happen |
|---|---|---|---|---|---|
| F1 | **In-app navigation** | `PagesView` is a persistent shell; selecting a page mutates local `activePageGuid` **without changing the URL**. Browser Back does not retrace page visits. | Real router: `/pages`, `/pages/:guid`, `/pages/:guid/edit`. Every selection is a `router.navigate`. Back/forward now walk page history. | ⚪ (improvement) | No fix needed. But downstream behaviours that depended on the old model must be re-mapped deliberately — see F2, 3.3‑c, 3.8. |
| F2 | **Data freshness** | TanStack Query with caching fully disabled (`staleTime:0`, `gcTime:0`, `refetchOnMount`). Every mount refetches. | Angular `rxResource` + a per-service `_version` signal bumped on **every** mutation, which refetches **all** live resources of that service. Values persist for a resource's lifetime; components are recreated on navigation so most resources are short-lived anyway. | 🟠 | Decide the intended stance. Current model is "refresh everything on any write" — heavy but usually fresh. Confirm it is acceptable; document it as the chosen policy. |
| F3 | **Component library** | No component library; bespoke Tailwind. Pervasive `dark:` classes (no toggle). | Angular Material (M3, azure palette, Roboto). `styles.scss` hardcodes `color-scheme: light`. **No dark-mode styling at all** (`dark:` classes dropped, Mermaid always default theme). | ⚪ | Accepted per brief. If dark mode is wanted later it is a fresh piece of work, not a port. |
| F4 | **Responsive / mobile** | Full mobile treatment: `useMediaQuery` breakpoints, hamburger + slide-in `MobileDrawer` for the tree, mobile top bar, bottom-sheet inspector, editor forced to edit/preview (never split), toolbar pinned to bottom, breadcrumb collapsing. | **None.** `pages-shell` is always a flex row; sidebar is a fixed 320 px column; inspector is a fixed 360 px `mat-sidenav`. A few components carry minor `@media` tweaks but there is no mobile layout, drawer, or hamburger. | 🔴 | Build a responsive layer: breakpoint service, drawer for the tree below `lg`, mobile top bar, bottom-sheet (or full-screen) inspector, and mobile-appropriate editor/toolbar behaviour. |
| F5 | **Persisted layout prefs** | `layoutStore` (`bluefinwiki-layout`): `treeWidth` (clamp 200–600), `inspectorWidth` (250–600), `inspectorVisible`, `editorSplitPosition` (20–80). Drag dividers write them. | `Layout` service exists with the same keys/defaults and a localStorage effect, **but nothing ever calls `layout.update(...)`**. `ResizeDivider` component exists but is imported nowhere. Sidebar width is read from the store (never changed); inspector width is a hardcoded CSS value; `inspectorVisible` and `editorSplitPosition` are unused. No clamps (no writes to clamp). | 🔴 | Wire `ResizeDivider` into the shell for the tree and inspector; bind `editorSplitPosition` once Split view exists (3.4‑a); persist `inspectorVisible`; add the clamp ranges. |
| F6 | **401 → refresh → retry** | Response interceptor coalesces concurrent 401s into **one** `refreshIdToken()`, retries the original request **once** (`_retried` guard), else `signOut()` + reject. | `auth-interceptor` refreshes on 401 and retries once, but with **no single-flight coalescing** (explicit `TODO` in the file — concurrent 401s each call `refreshIdToken`) and **no `_retried` guard**. On refresh failure it calls `redirectToLogin()` rather than `signOut()`. | 🟠 | Add an in-flight refresh promise shared on `Auth`; add a retry guard; align the failure path (sign out + clear tokens) with React. |
| F7 | **Auth token** | `Authorization` uses `idToken \|\| accessToken`. | `idToken` only (`auth.getIdToken()`); no accessToken fallback. | ⚪ | Add the fallback if the API ever accepts access tokens. |
| F8 | **Local-dev auth** | `USER_PASSWORD_AUTH` against `cognito-local` via `@aws-sdk/client-cognito-identity-provider`, plus app-client auto-discovery (`ListUserPools`/`ListUserPoolClients`) when `VITE_COGNITO_CLIENT_ID` is stale. `VITE_DISABLE_AUTH` bypass on top. | Only the `disableAuth` mock-admin bypass and the real Hosted-UI code flow. `environment.cognito.endpoint` (cognito-local) is typed but **never used**; no username/password path, no app-client discovery. | 🟠 | Either port the `USER_PASSWORD_AUTH` + discovery path, or formally drop it and document that local dev = `disableAuth: true` only. |
| F9 | **Prod API-URL guard** | Prod build throws if `VITE_API_BASE_URL` is missing or points at localhost (unless explicitly allowed). | `environment.production.ts` ships `apiBaseUrl: ''`, regenerated by `scripts/build-env.mjs`; no runtime/build assertion that it is non-empty or non-local. | 🟠 | Add a guard in `build-env.mjs` or app bootstrap. |
| F10 | **Auth bootstrap race** | `AuthGate` renders nothing while `isLoading`, only redirects once loading settles. | `Auth.bootstrap()` is async; `authGuard` synchronously checks `isAuthenticated()` (`_user() !== null`). On a cold load / deep link the guard can run **before** `getSession()` resolves and bounce a validly-signed-in user to Hosted UI. `disableAuth:true` largely masks this in dev. | 🔴 | Make `authGuard` await `isLoading` settling (e.g. guard returns a promise/observable that waits for the first bootstrap result). Verify at runtime against real Cognito. |
| F11 | **Global error handling** | `EditorErrorBoundary` scoped to the editor subtree only: "Editor Crashed" card with Try Again / Reload Page + autosave reassurance; reset clears the active page. | `GlobalErrorHandler` catches **any** unhandled app error, writes it to `EditorErrorState` (so `PageDetail` shows an "editor crashed" inline panel even for unrelated errors) **and** pops a generic snackbar with Reload. No autosave reassurance, no "Reload Page" affordance distinct from the snackbar. | 🟠 | Scope editor-crash UI to genuine editor failures; keep a separate generic handler for everything else; restore the reassurance copy. |
| F12 | **Global chrome** | Callback page is chrome-less full-screen. | `app.html` always renders a `<mat-toolbar>BlueFinWiki</mat-toolbar>` above every route, including `/callback` and all admin pages. | ⚪ | Optional: hide the shell toolbar on `/callback`. |

### 0.1 Route map

| Route | React | Angular | Note |
|---|---|---|---|
| `/callback` | ✅ | ✅ | OK. |
| `/` | → `/pages` | → `pages` | OK. |
| `/dashboard` | placeholder, nothing links to it | **absent** | Acceptable (reference says so). |
| `/pages`, `/pages/:guid` | ✅ (guid only on first load) | ✅ + `/pages/:guid/edit` as a real route | Behaviour change per F1. |
| `/settings` | `AuthGate` + **`PermissionGuard requiredRole="Admin"`** | `canActivate: [authGuard]` **only — no admin guard** | 🟠 Any authenticated user can open `/settings`; they just see fewer tiles. React gave non-admins a 403 page. |
| `/admin/*` | AuthGate + Admin | `authGuard` + `adminGuard` | `adminGuard` **redirects to `/pages`** instead of showing a 403 page (see §10). |
| `/profile` | any authed user | ✅ | Route OK; page content is thin (see §9). |
| `*` | inline 404 | `NotFound` component | OK. |

### 0.7 Global keyboard shortcuts

| Chord | React | Angular | Impact |
|---|---|---|---|
| `Ctrl/Cmd+K` (open Search) | ✅ anywhere in `PagesView` | ✅ (`pages-view` `@HostListener`) | OK. |
| `Ctrl/Cmd+S` (save) | ✅ | ✅ (CodeMirror keymap → `save()`) | OK. |
| `Ctrl/Cmd+B / I / \`` (bold/italic/code) | ✅ editor keymap | **missing** — CodeMirror keymap has only `Mod-s` + defaults | 🟠 Formatting is toolbar-only. Add the editor keymap. |
| `Ctrl/Cmd+Shift+X` (strikethrough) | ✅ | **missing** | 🟠 |
| `Ctrl/Cmd+K` in editor (insert link) | ✅ (editor keymap wins over Search) | **missing** | 🟠 |
| Search dialog: `↑ ↓ Enter Home End`, `Ctrl/Cmd+Enter` (new tab) | ✅ | **none** (see §3.6) | 🔴 |
| `[[` autocomplete: `↑ ↓ Enter Esc` | ✅ | ✅ | OK. |
| Tree row: `→ / ←` expand/collapse | ✅ | **missing** (only `Enter`/`Space` select, `F2` rename) | 🟠 |
| `Esc` closes modals/menus/drawers | ✅ | ✅ (Material default) | OK. |

---

## 1. `/callback` — OAuth callback

| Aspect | Status |
|---|---|
| Layout: spinner "Completing sign in…"; error card + "Try again" | ✅ parity |
| Requires `code` **and** `state`; CSRF `state` check against `sessionStorage.oauth_state`; "State mismatch. Possible CSRF attack." | ✅ parity (`cognito-oauth.ts`) |
| Success → `/pages` (`replaceUrl`) | ✅ |
| Username resolved from `cognito:username \|\| email \|\| sub` | ✅ |
| Chrome-less | ⚪ shell toolbar shows above it (F12) |

No functional gaps.

---

## 2. `/dashboard`

Not ported. Reference explicitly allows this. No action.

---

## 3. `/pages` and `/pages/:guid` — main application

### 3.1 Overall layout / shell

| Element | React | Angular | Impact | Needs |
|---|---|---|---|---|
| Sidebar header "Pages" + 🔍 / ✨ / + icon buttons | in the sidebar | Angular moved **New page** + **AI** (✨) + a **user menu** (account_circle → Settings/Profile/Sign out) into the top `mat-toolbar`. Sidebar has no header controls. | 🟠 | Fine to relocate, but **there is no visible Search button anywhere** — Search is reachable only via `Ctrl/Cmd+K`. Add a search affordance. |
| Resize dividers between tree / main / inspector | ✅ draggable | **none** (F5) | 🔴 | Wire `ResizeDivider`. |
| "No page selected" empty state (doc icon + copy) | ✅ | `page-empty.ts` = plain text "Select a page to begin." | ⚪ | Optional polish. |
| AI sidebar | fixed right overlay `w-96`, `z-40`, full-width on mobile | 400 px flex **pane** that shrinks the content area (`max-width:100vw`); not an overlay | ⚪ | Acceptable; revisit under F4 for mobile. |
| Search dialog | centered modal `z-50` | `MatDialog`, width 640 px | ✅ | OK. |
| Mobile top bar / drawer | ✅ | **none** (F4) | 🔴 | Part of F4. |

### 3.2 Sidebar / page tree

| Behaviour | React | Angular | Impact | Needs |
|---|---|---|---|---|
| Root + lazy children on expand | ✅ | ✅ (`childrenResource` + `SKIP_CHILDREN_FETCH` sentinel) | ✅ | — |
| `ensureExpanded` after creating a child | ✅ parent force-expands | **missing** — creating via modal navigates to the new page but does not expand the parent in the tree. (A drag-reparent locally sets `_expanded` on the target only.) | 🟠 | Pass a force-expand signal from `pages-view` into the tree after `createPage`. |
| Row icon | type emoji if typed, else **yellow folder if `hasChildren`**, else grey doc | type emoji if typed (but see next row), else always `📄` | ⚪ | Restore folder/doc distinction. |
| Page-type emoji + name in tree | ✅ from page-types map | **dead** — `pages-view` passes a hardcoded empty `pageTypesMap = signal({})` ("Phase 6 will inject PageTypesService"). Tree never shows type icons. | 🟠 | Inject `PageTypes` into `pages-view` and feed the real map to `PageTree`. |
| Active-row styling | `bg-blue-50 border-l-4 border-blue-600` + bold | `background:#dbeafe; font-weight:600` (no left bar) | ⚪ | Cosmetic. |
| Keyboard: `→/←` expand/collapse; `Enter` select | ✅ | `Enter`/`Space` select, `F2` rename, **no arrow expand/collapse**; also `dblclick` → rename (extra) | 🟠 | Add arrow-key handling; set `aria-expanded`. |
| **Drag & drop — reorder** (`before`/`after` zones, top/bottom 25% of a row, `PUT /pages/reorder`, splice into new index) | ✅ | **not implemented.** CDK drop has no positional zones. `PageTreeItem.onDrop` only ever calls `movePage` (reparent). You **cannot reorder siblings by dragging.** | 🔴 | Implement positional drop zones (before/after/onto), the reorder call, and the two-step "move then reorder" for cross-parent before/after drops. |
| **Drag & drop — reparent** (`onto`, middle of row, `PUT /pages/:guid/move`) | ✅ | ✅ (this is the only DnD that works) | ✅ | — |
| **Drag & drop — type constraints** (`checkTypeConstraints`: amber indicator + warning triangle + tooltip listing reasons + `dropEffect='none'` + `alert("Cannot move here:…")` on drop) | ✅ | `check-type-constraints.ts` logic is ported correctly, but it is fed the **empty** `pageTypesMap`, so it never rejects anything. Enforcement is via `cdkDropListEnterPredicate` (silently refuses entry) — **no amber warning, no tooltip, no alert explaining why.** On-drop reparent does not re-check constraints. | 🔴 | Feed the real type map; port the visual warning + the on-drop `alert`; re-check on drop. |
| Root drop zone | tree structure only | an always-visible "Drop here to make a root page" strip pinned to the bottom of the tree | ⚪ | Acceptable UX choice. |
| Drop onto self = no-op | ✅ | ✅ | ✅ | — |
| Context menu — repositions to stay in viewport, closes on outside-click/`Esc` | ✅ custom popover | `mat-menu` anchored at cursor (Material handles reposition + dismiss) | ✅ | — |
| Context menu items | Rename / New Child / Sort A–Z / Z–A (if children) / Move (stub) / **Delete (Admin only)** | Rename / New child / Sort A–Z / Z–A (if children) / Move… (stub `alert`) / Delete (Admin only) | ✅ | Missing the keyboard-hint labels (`F2`, `Ctrl+N`, `Ctrl+M`, `Del`) shown right-aligned in React — ⚪. |
| Sort ignores leading "the/a/an" | ✅ | ✅ (`pages-view.onSortRequested`) | ✅ | — |

### 3.3 Page CRUD flows

**New Page modal**

| Aspect | React | Angular (`new-page-modal.ts`) | Impact | Needs |
|---|---|---|---|---|
| Title required, trimmed 3–100 | inline red messages | `canSubmit` disables the button; **no inline "required / 3–100" messages**, only server errors | 🟠 | Add inline validation messages. |
| Description | textarea | single-line `input` | ⚪ | — |
| Page-type options scoped to parent (`/page-types/:parentType/allowed-children`; auto-select when exactly one allowed and wiki pages disallowed) | ✅ | Code path exists (`allowedChildTypesResource`), **but `pages-view` never passes `parentPageType`**, so the modal always shows **all** types regardless of parent. No auto-select. | 🔴 | Look up the parent's `pageType` before opening the modal and pass it through; port the auto-select rule. |
| "Wiki Page (no type)" explicit option | ✅ | just `(none)` | ⚪ | — |
| **Property inheritance** — build defaults from the type schema; inherit parent's same-name/same-type values | ✅ | **absent** — `createPage` body carries no `properties` | 🔴 | Port the inheritance builder into the modal. |
| Content boilerplate — `POST /pages` with `content = "# {title}\n\nStart writing…"` | ✅ | `createPage` body sends **no `content`** — new pages start blank (unless the backend seeds one) | 🟠 | Send the boilerplate (verify backend does not already do it). |
| On success: select + open in **edit mode** + force-expand parent | ✅ | navigates to `/pages/:guid/edit` (edit ✅); **no parent expand** (3.2) | 🟠 | Add the expand. |
| Modal title "Create New Page" / "Create Child Page" | ✅ | always "New page" | ⚪ | — |

**Create Page from Link modal** (from a broken wiki link)

| Aspect | React | Angular (`create-page-from-link-modal.ts`) | Impact | Needs |
|---|---|---|---|---|
| Title pre-filled from link text; 3–100 validation | ✅ | ✅ | ✅ | — |
| "Create as root page" checkbox + parent `<select>` + "will be created under the current page" | ✅ (select is a stub) | **none** — silently uses the current page as parent (or root if none) | 🟠 | Add the root/parent choice. |
| **Source markdown rewrite** — on success rewrite `[[target]]` / `[[target\|text]]` → `[[newGuid\|text]]` in the source page; user saves manually | ✅ | **absent** — the modal creates the page and closes; `page-detail.onBrokenLink` awaits close and does nothing with the result. The broken link stays broken. | 🔴 | Port the rewrite; surface the "now save the page" hint. |

**Rename** (`page-rename-inline.ts`)

| Aspect | React | Angular | Impact | Needs |
|---|---|---|---|---|
| Small centered modal, input auto-focused + all-selected | ✅ | ✅ (`afterNextRender` focus + select) | ✅ | — |
| Save on `Enter` **or blur**; cancel on `Esc` / backdrop | Enter + blur | `Enter` / `Esc` / backdrop — **no save-on-blur** | ⚪ | — |
| Validation: trimmed 3–100; unchanged just cancels | ✅ | ✅ | ✅ | — |
| **Pre-filled with the real current title** | ✅ | **broken** — `pages-view.onRenameRequested` hardcodes `title: 'Page'`, so the field always shows "Page" instead of the actual title | 🔴 | Pass the real `PageSummary.title` from the tree row through to `renameTarget`. |

**Delete** (`ConfirmDialog`)

| Aspect | React | Angular | Impact | Needs |
|---|---|---|---|---|
| Message differs when the page has children | ✅ | `window.confirm('Delete this page and all its children?')` — always the same, and uses the native `confirm`, not `ConfirmDialog` | 🟠 | Use `ConfirmDialog`; vary the copy; pass `recursive: hasChildren` (currently hardcoded `recursive: true`). |
| Admin-gated in the UI | ✅ (menu item hidden) | ✅ (`page-context-menu.canDelete`) | ✅ | — |
| Failure → surfaced error | `alert(server error)` | `alert('Failed to delete page.')` (generic, drops the server message) | ⚪ | Surface the server message. |

### 3.4 Content view — the editor

| Feature | React | Angular (`page-detail.ts` + friends) | Impact | Needs |
|---|---|---|---|---|
| **View modes** | `Edit \| Split \| Preview` segmented control | `View \| Edit` toggle only (navigates between `/pages/:guid` and `/…/edit`). **No Split / side-by-side.** | 🔴 | Add a Split mode (editor + live preview) and bind `editorSplitPosition` + a divider. |
| Draft-vs-server opens in **split** when they differ | ✅ | N/A (no split) — Angular just loads `draft ?? server` into the single surface | 🟠 | Revisit once Split exists. |
| **Save-status pill** (`Read-only` / `Saving…` / `● Unsaved changes` / `✓ All changes saved`) | ✅ | **none** — only a Save button (shown when in edit mode or `dirty()`), a "Saving..." label, and a `saveError` span | 🟠 | Add the status pill / dirty + saved indicator. |
| **Refresh button** (discard draft, refetch, reset baseline, bump reload version) | ✅ | **none** in the toolbar — `resource.reload()` is only wired to the "Retry" link on a load error | 🔴 | Add a Refresh control that clears the draft and reloads. |
| Save model: draft written **before** the PUT, `clearDraft` only on confirmed success; draft kept on failure with "Your changes are still here — click Save again to retry." | ✅ | draft written before PUT ✅; `drafts.clear` only on success ✅; **but** the failure message is a generic `Save failed: <msg>` span, not the reassurance copy, and it is not dismissible | 🟠 | Restore the reassurance messaging + a dismissible banner. |
| Debounced autosave 400 ms + synchronous stash on unmount / route change | ✅ | ✅ (`DRAFT_DEBOUNCE_MS = 400`, `destroyRef.onDestroy` stash) | ✅ | — |
| Draft store key `bluefinwiki:draft:<guid>`, in-memory `Map` front | ✅ | ✅ (`drafts.ts`) | ✅ | — |
| Dirty detection compares content + `title/status/tags/properties` to a server baseline | ✅ | ✅ (`dirty()` computed) | ✅ | — |
| No optimistic concurrency on page content (last write wins) | ✅ | ✅ | ✅ | — |
| **Breadcrumbs** | `Home ▸ ancestors ▸ Current`; Home clears selection; ancestors select; mobile collapses `>3` to `Home ▸ … ▸ Current`; 200 px truncation + title tooltip | `ancestors ▸ Current` — **no "Home" segment**, separator is `/`, no mobile collapse, no truncation/tooltip. Ancestors are `routerLink`s. | 🟠 | Add Home; add collapse + truncation (ties into F4). |
| **Markdown toolbar** | Bold / Italic / Strike \| Heading (H1–H6) \| UL / OL / Task \| **Link / Image / Attachment** \| Inline code / Code block; compact variant hides OL/Task/codeblock; fixed to bottom on mobile; heading menu opens upward | Bold / Italic / Strike \| Heading (H1–H6) \| UL / OL / Task \| **Link** \| Inline code / Code block. **No Image button, no Attachment button.** No compact/mobile variant. | 🔴 | Add Image insert and Attachment-upload trigger (incl. the "Save the page before uploading attachments" guard); add the compact/mobile layout. |
| Toolbar actions insert at cursor / wrap selection / placeholder text | ✅ | ✅ (`wiki-codemirror.applyAction`) | ✅ | — |
| CodeMirror: markdown highlight, line numbers, active-line, undo/redo, monospace 14px | ✅ | ✅ | ✅ | — |
| Programmatic-update guard so external value changes don't echo as edits | ✅ | ✅ (`suppressEmit`) | ✅ | — |
| **`[[` autocomplete** (debounced 200 ms `GET /pages/search?q=…&limit=10`, title + hierarchy path, `↑/↓/Enter/Esc`, click-outside dismiss) | ✅ | ✅ (`link-autocomplete.ts`) except **no click-outside dismiss** (only `Esc` / regex breaks) | ⚪ | Add outside-click dismiss. |
| Inserts `[[Page Title]]` on pick | ✅ | ✅ | ✅ | — |

**Preview pane** (`markdown-renderer.ts` + `unified-pipeline.ts`)

| Feature | React | Angular | Impact | Needs |
|---|---|---|---|---|
| Pipeline: `remark-gfm`, `remark-breaks`, wiki-links, image-size, `remark-rehype`, `rehype-highlight` | ✅ | ✅ same order (`buildMarkdownPipeline`); hljs `github.css` is imported so code is themed | ✅ | Footnotes support unverified — check `remark-gfm` output renders. |
| Heading slug `id`s | ✅ GitHub slugify | ✅ (`slugify`) | ✅ | — |
| **In-page `#anchor` links smooth-scroll** | ✅ | **broken** — every `<a>` is rendered `target="_blank" rel="noopener"`, so `#heading` links open a blank tab and do not scroll | 🟠 | Special-case hash links → smooth-scroll to the slug id. |
| **Wiki links `[[…]]`** | valid links are **inert in preview** (click logs "disabled in preview"); you navigate via tree/search/breadcrumbs | valid links render as `<a [routerLink]="href()">` and **navigate on click** (`href` = `data-wiki-target`, which may be a title or a guid — a title would not resolve) | 🟠 | Decide: keep click-nav (then guarantee `href` is always a guid) or make them inert like React. Verify `remark-wiki-links` output. |
| **Broken wiki links** — red + trailing `?` + tooltip "Page not found: X. Click to create." → opens Create-Page-from-Link modal | styling/hooks exist but the `pageExists` resolver is **not wired** in React either, so all links treated as valid | Angular: same — `wiki-link.ts` renders the broken state from `data-broken`, but nothing resolves existence, so broken links effectively never appear. `page-detail.onBrokenLink` is wired but unreachable. | 🟠 | If broken-link creation is wanted, wire a resolver (`pageExists`) into the pipeline options. Note the source-rewrite gap in 3.3. |
| **Images / attachments** — bare filename `![alt](name.png)` rewritten to `/pages/:guid/attachments/name.png` (+ legacy `guid/filename`); auth'd fetch via `AsyncImage` (axios → presigned `{url}` → `<img>`) with loading / "Failed to load image"; `![alt\|WIDTH]` sizing; **drag handle to resize, rewriting the markdown** | ✅ | `remark-image-size` handles `![alt\|WIDTH]` ✅. **Everything else missing:** no attachment-path rewrite (the renderer takes only `markdown`, no `pageGuid`; `page-detail` passes no `pipelineOptions`); no auth'd async image component (raw `<img src>` — API-backed images needing auth headers will not load); no drag-to-resize. | 🔴 | Pass `pageGuid` into the renderer; port the URL-rewrite plugin and the authed-image component; port the resize handle. |
| External images render directly | ✅ | ✅ | ✅ | — |
| **Mermaid** — `securityLevel:'strict'`, theme follows `.dark`, errors show source + "Mermaid error: …", "Rendering diagram…" placeholder | ✅ | ✅ (`wiki-mermaid.ts`) — `strict`, error + source, loading placeholder. Theme always default (no dark, per F3). | ✅ | — |
| Code blocks: `rehype-highlight`, mono, horizontal scroll | ✅ | ✅ | ✅ | — |
| **Empty content** → "No content yet. Start writing…" (italic) | ✅ | renders an empty `.wiki-markdown` div — no placeholder | ⚪ | Add the placeholder. |
| Full `prose` typography (h1–h6, tables scroll, blockquote bar) | ✅ Tailwind `prose` | hand-rolled CSS: only h1–h3 styled (h4–h6 unstyled), tables `width:100%` (no horizontal scroll wrapper), blockquote bar ✅ | ⚪ | Flesh out typography; wrap wide tables in an `overflow-x:auto` container. |

**Table of contents** (`TableOfContents`)

| Feature | React | Angular | Impact | Needs |
|---|---|---|---|---|
| Parses `##`–`######` (skips fenced code), shows only if **≥3** headings; desktop sticky 224 px right rail "On this page" with `IntersectionObserver` active-heading tracking + smooth-scroll + hash; mobile collapsible bar | ✅ | **entirely absent** — no TOC component exists | 🔴 | Build the component from scratch. |

**Inspector panel** (`inspector-panel.ts`)

| Tab / feature | React | Angular | Impact | Needs |
|---|---|---|---|---|
| Panel placement | desktop right resizable panel bound to `inspectorWidth`/`inspectorVisible`; mobile bottom sheet | fixed 360 px `mat-sidenav position=end`; open state is a **local** signal (not `layout.inspectorVisible`); not resizable; no mobile sheet | 🟠 | Bind to `Layout`; add divider (F5); mobile sheet (F4). |
| 3 tabs Properties / Attachments / Links(Linked) | ✅ | ✅ (`mat-tab-group`, lazy per tab) | ✅ | — |
| **Backlinks badge count on the Links tab** | ✅ | `backlinkCount` is computed but **not shown** on the tab label | 🟠 | Render the badge. |
| **Properties — Title**: click-to-edit inline; typing updates metadata live; **if line 1 is `# H1`, editing the title rewrites that H1**; empty title on blur resets | ✅ | ✅ **Done (Phase 4.3)** — click-to-edit affordance, debounced (200 ms) metadata update, title↔H1 sync via a CodeMirror transaction (feedback-loop guarded, CRLF-safe), blank-on-blur revert that never persists empty. | ✅ | — |
| Properties — **Page Type** select; hidden entirely if no types exist; changing type merges the schema | shown conditionally | ✅ **Done (Phase 4.4)** — control hidden when the page-types map is empty; changing type persists a **union-merged** property set immediately (`updatePage` with `pageType` + `properties`, no field edit); non-schema props kept (no data loss on type switch); "(none)" clears only the type. | ✅ | — |
| Properties — **Tags**: chips; `Enter`/`,` add (**lower-cased**, deduped); `Backspace` on empty removes last; **vocabulary autocomplete (`page-tags`, top 5)** | ✅ | ✅ **Done (Phase 4.5)** — extracted `wiki-tag-input`: lower-case + trim on add, case-insensitive dedupe, Backspace-on-empty removes last chip, ≤5 vocab suggestions from `GET /tags?scope=_page` excluding applied. | ✅ | — |
| Properties — Author / timestamps (read-only, **localized**) | ✅ | ✅ **Done (Phase 4.6)** — dates via `DatePipe` (`medium`); `createdBy`/`modifiedBy` prefer `createdByName`/`modifiedByName` when present, else the raw id. NOTE: the name fields are a forward-compat seam nothing populates yet (no users fetch — best-effort per spec), so id fallback is the current production behaviour. | ✅ | — |
| Properties — **Custom Properties** (`CustomPropertiesEditor`): **collapsible**; schema merged with saved values; per-type inputs text/number/date/**tags with vocab autocomplete**; **add ad-hoc property** (kebab name, choose type) + **remove** | ✅ | ✅ **Done (Phase 4.7)** — collapsible section; `mergeSchema`-driven rows; per-type editors text/number/date + `wiki-tag-input` chips (per-property-name vocab scope); add ad-hoc (kebab + non-empty + unique name + type select); remove ad-hoc only (schema fields fixed). Renders on **untyped** pages too (empty schema), matching React. | ✅ | — |
| Properties — **Page ID** (read-only mono, "for debugging") | ✅ | **absent** | ⚪ | — |
| Status control in Properties | not shown as a control | Angular adds a Draft/Published/Archived `mat-select` | ⚪ | Harmless addition. |
| **Attachments** (`attachment-manager.ts`) — `GET …/attachments`; **exponential-backoff auto-retry** on load failure (1s→30s, ≤10) + manual "Refresh"; sorted newest-first; per item type emoji, size + date, **image thumbnail** (presigned) → **full-screen lightbox**; actions **Download / Copy Markdown / Drag Link / Insert / Delete**; delete perm = Admin or author or uploader (+`window.confirm`) | ✅ | ✅ **Done (Phase 4.8)** — exponential-backoff auto-retry (1s→30s, 10 total load attempts via `backoff.ts`) + Refresh (resets backoff); newest-first sort; per row type emoji + `WikiImage` thumbnail → `MatDialog` lightbox for images; Download / Copy Markdown / Drag Link / Insert / Delete; delete perm + `window.confirm` unchanged. Markdown unified onto `buildAttachmentMarkdown`. NOTE (→ 1b.3): retry has no visible status text yet; row date localised via `DatePipe`. | ✅ | — |
| **Attachment upload** (`attachment-uploader.ts`) — client `validateFile` → `presign` → direct S3 `PUT` (progress 10–90) → `confirm`; **sequential**; on success the returned markdown is **auto-inserted at the cursor**; list refreshes; first error inline | ✅ core flow: validate → presign → S3 PUT w/ progress → confirm, sequential ✅ | ✅ **Done (Phase 4.9)** — `uploaded` payload extended to `{ filename, markdown }`; on success `inspector-panel` routes the markdown through the shared `insertMarkdown` output → `page-detail.insertMarkdownAtCursor` (same route as the manager's Insert). List refreshes via `attachments:<guid>` bump; first error still inline; failed upload does not insert. | ✅ | — |
| "Save the page before uploading attachments" guard | toolbar Attachment button checks saved state | N/A in Angular's flow (pages are created server-side first, so a guid always exists) — but the toolbar has no Attachment button anyway (3.4) | ⚪ | Reassess when the toolbar Attachment button is added. |
| **Links / Linked** (`linked-pages-panel.ts`) — `GET …/backlinks`; badge count; list title + optional "via: link text"; click navigates; loading skeleton; empty "No pages link to this page" | ✅ | list title + optional **excerpt** (not "via: link text"); click navigates (`routerLink`); loading text; empty "No backlinks yet." Badge not surfaced (see above). | ⚪ | Minor copy/format. |

### 3.5 Board view

| Feature | React | Angular (`board-*.ts`, `group-by-state.ts`) | Impact | Needs |
|---|---|---|---|---|
| **Eligibility** — `boardConfig.targetTypeGuid` set **OR** any direct child has a `state`-property type with a value | ✅ | only when `boardConfig` is truthy (`page-detail`: `mode()==='view' && boardConfig()`). **The "children have state" auto-eligibility is missing.** | 🟠 | Add the child-state heuristic. |
| Content \| Board toggle placement | above the editor regardless of mode; opens on board when `defaultView==='board'` | only in **view** mode; `defaultView` honoured via an effect | ⚪ | Show in edit mode too if desired. |
| Data — `GET …/children?include=properties` (+`type=`,`depth=` for deep boards, cap 10); cursor-paginated, page size 200, **"Load more cards"** | ✅ | fetches with `limit:200` (+`type`/`depth`); `childrenWithPropertiesResource` supports `cursor` but `BoardView` **never reads `hasMore`/`nextCursor`** — **no "Load more"**, boards silently cap at 200 | 🔴 | Wire pagination + a Load-more control. |
| Column grouping / ordering / colours (configured-first, alpha rest, `Uncategorised` last; default colour map; hashed-HSL fallback) | ✅ | ✅ (`group-by-state.ts` mirrors it; `Uncategorised` only shown if non-empty) | ✅ | — |
| Cards — type icon + title; parent subtitle when `showParentTitle`; `swapTitles` flips; up to 3 non-`state` props | ✅ | ✅ **except** the card always shows `parentTitle` if present (ignores `showParentTitle`) | ⚪ | Respect `showParentTitle`. |
| DnD — **column-to-column** (change `state`): optimistic cache patch → `PUT` → **rollback + toast** on failure | ✅ | `PUT` then version-bump refetch; **no optimistic move** (card doesn't move until the server responds), toast on failure, no rollback needed because no optimism | 🟠 | Add optimistic update + rollback for snappy DnD. |
| DnD — **reorder within / into a column at a position** (`onCardReorder`, gap-based `boardOrder` midpoints, `±1000` ends, full-column renumber fallback, cross-column sets `state` in the same PUT) | ✅ | **not implemented** — `board-column.onDrop` only emits `{card, targetState}`; position is ignored; nothing writes `boardOrder` (though the sort reads it and the API supports it) | 🔴 | Implement positional reorder + `boardOrder` maths. |
| Card sort within column: `boardOrder` asc, then `modifiedAt` desc | ✅ | ✅ | ✅ | — |
| **Board Settings** — columns add/remove/reorder + 8-swatch palette; show-parent-title; swap-titles; default view; **"Show pages of type" limited to `boardableTypes` (types with a `state` property)**; persist via `PUT /pages` with **silent** failure | ✅ | `board-settings-panel.ts`: columns add/remove/reorder + 8-swatch ✅; toggles ✅; default view ✅; **target-type list is ALL page types, not filtered to state-bearing ones**; `page-detail.openBoardSettings` shows a **snackbar** on failure (not silent) | 🟠 | Filter the type list to boardable types. (Snackbar-on-failure is arguably an improvement — keep.) |
| **Card Summary dialog** — edit **title + properties inline** (text/number/date/tags w/ vocab); merge schema defaults on save; `PUT /pages/:cardGuid`; invalidate; **"Open full editor" → `window.open('/pages/:guid','_blank')`**; `Esc` close; Save disabled unless changed | ✅ | `card-summary-dialog.ts` is **read-only** (explicit "deferred to a polish pass"). Shows title/type/parent/properties; **"Open page" is a same-tab `routerLink`**, not a new tab; no editing, no Save. | 🔴 | Port the inline editing + save; make "Open full editor" a new tab. |
| "Add card" from the board | hooks exist, **no UI wired** | also none | ✅ | Both absent — parity. |

### 3.6 Search dialog

| Feature | React | Angular (`search-dialog.ts`, `search.ts`) | Impact | Needs |
|---|---|---|---|---|
| Semantic `/search` (Bedrock + S3 Vectors); input sanitised (≤500, strip `<>`, trim) | ✅ | ✅ (`search.ts` "ports ClientSearchService byte-for-byte") | ✅ | — |
| Debounce | 300 ms | 200 ms | ⚪ | Align if desired. |
| **Client rate-limit 60/min** ("Too many searches. Please wait a moment.") | ✅ | **absent** | 🟠 | Port the limiter. |
| Page size 10/25/50 via filter panel | ✅ | hardcoded 10, no filter panel | 🟠 | Add the page-size control. |
| Scope select | only "All pages" offered | `All / Titles / Content` toggle offered | ⚪ | Angular offers more — verify the backend honours `scope`. |
| Results — matched terms `<mark>`-highlighted in title + snippet; up to 3 tags; 2-line snippet clamp; folder path | ✅ | title + path + snippet (plain, **no highlight**, **no tags**, no clamp) | 🟠 | Add highlighting, tags, clamp. |
| **Infinite scroll + "Load more results (N of M)"** | ✅ | **none** — shows the first 10 only | 🔴 | Add pagination. |
| **Keyboard nav** — `↑/↓` move, `Home/End` jump, `Enter` open, `Ctrl/Cmd+Enter` open in **new tab**, `Esc` close, hover sets selection, selected row scrolls into view, `aria-activedescendant` | ✅ | **none** — mouse click only; `Esc` closes (Material). `aria-selected` hardcoded `false`. | 🔴 | Implement full keyboard navigation. |
| **Recent searches** (localStorage; shown when query empty; per-item remove; "Clear all"; recorded on selection) | ✅ | **absent** | 🟠 | Port `recentSearches`. |
| `aria-live` region ("Searching…" / "N results found" / "No results") | ✅ | **absent** | 🟠 | Add the live region. |
| Result count + timing footer | ✅ | ✅ ("N result(s) in Xms") | ✅ | — |
| Focus returns to trigger on close | ✅ | ✅ (Material) | ✅ | — |
| Open affordance | `Ctrl/Cmd+K` **or** 🔍 button (sidebar + mobile bar) | `Ctrl/Cmd+K` **only** — no visible button anywhere | 🟠 | Add a search button (see 3.1). |

### 3.7 AI assistant sidebar

| Feature | React (`AiService` + `useAi`) | Angular (`ai.ts`, `ai-sidebar.ts`, …) | Impact | Needs |
|---|---|---|---|---|
| Engine — Chrome on-device Prompt API (Gemini Nano), `window.LanguageModel`; availability `unsupported / downloadable / downloading / available`; `UnavailableState` setup instructions | ✅ | ✅ (`ai.ts` `isAvailable`, `unavailable-state.ts` covers downloading/downloadable/unavailable with Chrome 138+, flags, components, disk/VRAM). Note: `canChat` includes `downloadable`, so first send triggers the download. | ✅ | — |
| Response contract — one JSON `{ message, action }` via `responseConstraint`; `action.type ∈ none / create_page / update_page / fetch_url / fetch_imdb_show` (+ `delete_page / move_page` unless disabled by `VITE_AI_ALLOW_DESTRUCTIVE=false`) | ✅ | ✅ (`buildResponseSchema`, `ALLOW_DESTRUCTIVE` gate = `environment.aiAllowDestructive`), system prompt ported | ✅ | — |
| Per-turn RAG context (`AiContextLoader.buildRagContext`) — current page (title, tags, content ≤1200) + ≤4 semantic hits + page-type list only on create/update phrasing + skip wiki search & add IMDb hint for TV phrasing | ✅ | ✅ (`ai-context-loader.ts`) — close parity | ✅ | — |
| **Auto fetch-tool loop** — `fetch_url` (`POST /fetch-url`) and `fetch_imdb_show` (`GET /imdb/show-details`) executed **automatically**, results fed back as the next user turn, cap **3/turn**, duplicate-fetch detection + anti-loop nudge; tool results render as grey rows | ✅ | **not implemented** (class comment: "not in Phase 7's scope"). The model can *propose* these actions; nothing runs them. `ChatRole` has no `'tool'` value. | 🔴 | Port the tool loop, the endpoints, the cap, and the tool message role/rendering. |
| **Proposed actions** (`ActionPreview`) — preview card per create/update/delete/move; **Apply / Discard**; resolves referenced GUIDs → page titles (with links); delete card red + recursive warning; **Apply → the REST call (`POST /pages` / `PUT` / `DELETE` / `PUT …/move`) then `invalidateQueries(['pages'])`**; per-message status pending→applying→applied/failed/discarded | Card renders per type ✅; Apply/Discard buttons ✅; delete card styled destructive ✅ | **Apply does nothing** — `ActionPreview.onAccept()` calls `ai.acceptAction()` which only flips the message status to `applied`; **no HTTP mutation is ever dispatched** (the comment says "the sidebar wires this through the action runner" but `AiSidebar` has no such wiring). GUIDs shown raw (`<code>`), not resolved to titles. `chat-message.ts` does not render `actionStatus`, so the outcome leaves no trace in the log. | 🔴 | Wire an action runner: on Apply, dispatch the matching `Pages`/`Attachments` call, bump versions, and reflect applying/applied/failed on the message. Resolve GUIDs to titles. |
| **Instruction picker** — attach saved "instruction" pages; `listInstructions()`; once injected into the session it is locked ("In context") until "New chat"; **"Create"** makes a child under an "AI Instructions" root page and navigates to its editor | `AiInstructions` service is fully ported (`listInstructions`, `getInstructionContent`, `createInstruction` with lazy root creation) | `instruction-picker.ts` is a plain `mat-select multiple` — **it never calls `getInstructionContent`, `AiSidebar` never reads `getSelected()`, and nothing injects instruction text into the session.** Selecting instructions has **no effect on the chat.** No "In context" lock. **No "Create" button.** | 🔴 | Inject selected instruction content into the session/system turn; add the lock semantics; add a Create button that calls `createInstruction` and routes to the editor. |
| Context meter — `inputUsage / inputQuota` %, colour-coded blue/amber/red | ✅ | ✅ (`context-meter.ts`, primary/accent/warn at 60/85 %) | ✅ | — |
| Message roles — user (blue right) / assistant (grey left) / system (red) / **tool (grey info row)**; markdown-rendered assistant text; auto-scroll to bottom; "Thinking…" pulse | user/assistant/system ✅ + assistant markdown ✅ + "Thinking…" ✅ | **no tool role**; **no auto-scroll to bottom** | 🟠 | Add tool rows (with the loop) + auto-scroll. |
| Input — textarea, `Enter` send / `Shift+Enter` newline, disabled while thinking/unavailable | ✅ | ✅ | ✅ | — |
| Session lifecycle — persists across re-renders (`useRef`), destroyed on unmount; "New chat" resets messages/usage/loaded instructions but keeps the *selection* | ✅ | `Ai` is a root singleton — session persists even after the sidebar closes (arguably better); `reset()` clears messages/usage/action; instruction picker state is separate and survives | ⚪ | Acceptable; confirm intended. |
| Placement | fixed right overlay `w-96`, full-width on mobile, `z-40` | 400 px flex pane (F4) | ⚪ | Revisit for mobile. |
| Debug logging behind `VITE_AI_DEBUG` / `localStorage.aiDebug` | ✅ | ✅ (`ai-debug.ts`) | ✅ | — |

**Net:** the Angular AI sidebar can hold a conversation with RAG context and render action previews, but **applying actions, the fetch-tool loop, and instruction attachment are all non-functional.** It is largely a display shell today.

### 3.8 Navigation summary

- Angular uses real routes everywhere (F1), so Back/forward now walk page history — a deliberate change from React.
- Profile is now reachable (user menu). Settings is in the user menu (Admin-only item). Sign out is in the user menu **and** on the Profile page — React had sign out only under Settings.
- No 403 route for non-admins (see §10).

---

## 4. `/settings` — Settings hub

| Aspect | React | Angular (`settings-page.ts`) | Impact | Needs |
|---|---|---|---|---|
| Route guard | `PermissionGuard requiredRole="Admin"` (non-admins get 403) | `authGuard` only; tiles filtered by role (non-admin sees just "Profile") | 🟠 | Add `adminGuard`, or accept the filtered-tile behaviour and document it. |
| Back-chevron → `/pages` | ✅ | **none** (just an `<h1>`) — same for every admin page | 🟠 | Add a back affordance to each admin screen. |
| Items | Members / Invitations / Page Types / Rebuild Page Index / **Sign out** (red, separated) | Page Types / User Management / Invitations / Rebuild Page Index / **Profile** — **no Sign out here** (moved to the user menu + Profile page) | ⚪ | Intentional relocation; fine. |
| Layout | `max-w-2xl` vertical stack | `max-width:900px` card grid | ⚪ | — |

---

## 5. `/admin/users` — Members

| Aspect | React | Angular (`user-management.ts`) | Impact | Needs |
|---|---|---|---|---|
| Table columns | Name (+avatar +"(You)") · Email · Role badge · Status badge · **Joined** · Actions | Name (+"(You)") · Email · Role · Status · **Last Login** · Actions | ⚪ | Column choice differs; badges below. |
| **Role / Status badges** (status: active green / suspended red / pending yellow / deleted grey; role: Admin purple / Standard blue) | ✅ | plain text | ⚪ | Add coloured badges if desired. |
| Search on name/email (client-side) | ✅ | ✅ | ✅ | — |
| Self row highlight (`bg-blue-50/50`) | ✅ | "(You)" text only, no row bg | ⚪ | — |
| Edit dialog — Display Name + Role select; role **disabled for self**; Save disabled if name blank; **Edit disabled for `deleted`** | ✅ | `UserEditDialog` (name + role, role disabled for self); Save gating in the dialog; **Edit button always shown, even for `deleted`** | 🟠 | Disable Edit for deleted users. |
| Suspend / Activate / Delete hidden for self and `deleted` | ✅ | ✅ | ✅ | — |
| Delete confirm — "…Activity history will be preserved for audit." | ✅ | `ConfirmDialog`, "Activity history will be preserved." | ✅ | — |
| Business rule — cannot change/remove own account | ✅ | ✅ (`isSelf`) | ✅ | — |
| Load error | red banner + **Retry** | "Failed to load members." text, **no Retry** | 🟠 | Add Retry (`resource.reload()`). |
| Mutation error | `alert()` | `MatSnackBar` | ⚪ | Improvement — keep. |

---

## 6. `/admin/invitations` — Invitations

| Aspect | React | Angular (`invitation-management.ts`) | Impact | Needs |
|---|---|---|---|---|
| Table | Code · Email · Role badge · Status badge · Created (+"by <name>") · Expires · Actions; used rows show "Used by <name>" | Code · Email · Role · Status · Created · Expires · Actions; **no "by <name>", no "Used by <name>"** | ⚪ | Add attribution columns. |
| **Status filter pills** (all / pending / used / expired / revoked) | ✅ | **absent** | 🟠 | Add the filter (backend supports `?status=`). |
| Create — **inline expanding form**; Email (optional), Role, **Expires days number 1–30, default 7** | ✅ | `InvitationCreateDialog` **modal** instead of inline; fields role/email/expiryDays (verify the 1–30 + default-7 rules are enforced in the dialog) | 🟠 | Confirm/port the `expiryDays` validation. |
| **Green "Invitation created: <code>" confirmation** with the new code shown | ✅ | **absent** — list just refreshes; the new code is not surfaced | 🟠 | Show the created code. |
| Status badges coloured | ✅ | plain text | ⚪ | — |
| Revoke only when `status==='pending'` → `DELETE …/:code` | ✅ | ✅ | ✅ | — |
| Failure | `alert()` | snackbar | ⚪ | — |

---

## 7. `/admin/page-types` — Page Types

Closest parity of all the admin screens.

| Aspect | React | Angular (`page-types-admin.ts`) | Impact | Needs |
|---|---|---|---|---|
| Icon (`maxLength 4`, default 📄) + Name (required) | ✅ | ✅ (`canSave` needs both; name 1–50) | ✅ | — |
| Property schema builder — add row (kebab name, dedupe, type Text/Number/Date/Tags, Required, Default parsed per type), edit default inline, remove, **reorder (^/v)** | ✅ | add / edit-default / remove ✅; **no reorder** | ⚪ | Add row reorder. |
| Allowed Child Types / Allow untyped wiki children / Allowed Parent Types / Allow under untyped wiki pages | ✅ | ✅ | ✅ | — |
| Delete | inline "Delete?" → "Yes/No" on the row | `ConfirmDialog` modal | ⚪ | — |
| Save label "Create" / "Update" / "Saving…" | ✅ | "Save" + spinner (no create/update wording) | ⚪ | — |
| Validation — name+icon required, property names non-empty + unique after kebab | ✅ | ✅ | ✅ | — |
| Empty state | ✅ | "No page types defined yet." | ✅ | — |
| Layout | form-then-list stacked | master-detail (list + editor pane) | ⚪ | — |
| Back-chevron | ✅ | none | 🟠 | §4. |

These definitions feed the New Page modal, tree DnD constraints, inspector schema merge, and board eligibility — several of which are currently **not wired to consume them** (see 3.2, 3.3, 3.5).

---

## 8. `/admin/rebuild-page-index`

| Aspect | React | Angular (`rebuild-page-index.ts`) | Impact | Needs |
|---|---|---|---|---|
| Explanatory card | ✅ | ✅ | ✅ | — |
| **Confirm gate** — "Rebuild now" → inline confirm block ("scan the entire pages bucket and overwrite every row… Continue?") → "Yes, rebuild" | ✅ | **none** — "Rebuild now" fires immediately | 🟠 | Add a confirm step (`ConfirmDialog` or inline). |
| In-progress — spinner + "Rebuild in progress — please don't close this page." | ✅ | ✅ | ✅ | — |
| Result card — Pages discovered / Rows written / Orphan rows deleted / Failed / Duration; collapsible error list; **collapsible deleted-orphan-GUID list**; "Run again" | ✅ | dl with the 5 stats ✅; collapsible **errors** list ✅; **no orphan-GUID `<details>`**; "Rebuild now" stays available so re-run works | ⚪ | Add the orphan-GUID disclosure. |
| Error | red box + Dismiss | snackbar (6 s) | ⚪ | — |
| Back-chevron | ✅ | none | 🟠 | §4. |

---

## 9. `/profile` — Profile

| Aspect | React | Angular (`profile-page.ts`) | Impact | Needs |
|---|---|---|---|---|
| Card 1 — avatar, display name, email, role badge | ✅ | ✅ | ✅ | — |
| **Display Name form** — `PUT /auth/profile { displayName }`, success toast, `refreshUser()`, Save disabled if blank/unchanged | ✅ | **absent** — name is read-only | 🔴 | Port the form. |
| **Change Password form** — Current / New / Confirm, client match check ("New passwords do not match"), `POST /auth/change-password`, success message + clear fields, submit disabled until all three filled | ✅ | **absent entirely** | 🔴 | Port the form. |
| Sign out | React had it only under Settings | present here (red button) + user menu | ⚪ | — |
| Back-chevron → `/pages` | ✅ | none | 🟠 | §4. |

Angular's Profile page is effectively read-only identity + sign out.

---

## 10. Error / edge screens

| Screen | React | Angular | Impact | Needs |
|---|---|---|---|---|
| **404** | "404 / Page not found" + "Go Home" (`/`) | `NotFound` — "404 / Page not found. / Go home" | ✅ | — |
| **403** (non-admin hits `/admin/*` or `/settings`) | full-screen "403 / You don't have permission… / Go to Pages" | **does not exist** — `adminGuard` silently redirects to `/pages`; `/settings` isn't even admin-guarded | 🟠 | Add a 403 route/component; point `adminGuard` at it (`createUrlTree(['/403'])`). |
| **Redirecting to sign in…** | plain text while `redirectToLogin()` runs | `authGuard` returns `false` and redirects; no interstitial text (and see F10 race) | 🟠 | Add an interstitial; fix the race. |
| **Sign in failed** (`/callback`) | message + "Try again" | ✅ (`oauth-callback.ts`) | ✅ | — |
| **Editor Crashed** | `EditorErrorBoundary` card (Try Again / Reload Page + autosave reassurance); reset clears the active page | inline "The editor crashed: <msg>" + "Reload editor" (`editorError()` from `EditorErrorState`), edit mode only; **fires for any unhandled app error** (F11); no "Reload Page", no reassurance | 🟠 | Scope to real editor errors; restore copy + affordances. |
| **Failed to Load Page** | ⚠️ card + "Retry" (refetch) | "Failed to load page." + a bare `<button>Retry` (`resource.reload()`) | ✅ | Style polish only. |
| **Loading page…** | centered blue spinner | "Loading page..." text | ⚪ | — |

---

## 11. "Easy to lose in a rewrite" checklist — status

| Reference checklist item | Angular status |
|---|---|
| Caching stance (React never caches) | ⚠️ Different model (resource + global version bump). **Decide + document** (F2). |
| Draft/autosave triad (400 ms debounce, sync stash on switch, draft-before-save, "changes still here" retry, draft-vs-server split-view) | ✅ debounce + stash + draft-before-save. ❌ retry copy, ❌ split-view-on-diff (no Split mode). |
| 401 → silent refresh → retry once + coalescing | ⚠️ retries once but **no coalescing, no retry guard** (F6). |
| In-app nav doesn't use the router | ✅ **Intentionally reversed** — real routing now (F1). Re-map dependent behaviours. |
| Page-tree lazy loading + `ensureExpanded` after create | ✅ lazy load. ❌ `ensureExpanded`. |
| Tree DnD with type constraints (zones, amber warnings, `dropEffect='none'`, `alert()`, two-step cross-parent move) | ❌ **Reparent only.** No reorder, no positional zones, constraint map not wired, no warning/alert UI. |
| Board view (eligibility heuristic, deep fetch, gap `boardOrder` + renumber, optimistic DnD + rollback + toast, `boardConfig` frontmatter, silent persist fail, no add-card) | ⚠️ Partial: grouping/colours ✅, column-state DnD ✅ (no optimism). ❌ child-state eligibility, ❌ `boardOrder` reorder, ❌ pagination/Load-more, ❌ Card Summary editing. |
| Markdown feature set (GFM + `remark-breaks`, wiki links, broken-link → modal + source rewrite, attachment URL rewrite + authed images, `![alt\|WIDTH]` + drag-resize, Mermaid, heading slugs + smooth-scroll anchors, TOC) | ⚠️ GFM/breaks/wiki-links/image-size/Mermaid/slugs ✅. ❌ smooth-scroll anchors, ❌ broken-link source rewrite, ❌ attachment URL rewrite, ❌ authed image component, ❌ drag-to-resize, ❌ **TOC (absent)**. |
| `[[` autocomplete | ✅ (minor: no click-outside dismiss). |
| Inspector (3 tabs, title↔H1 sync, schema/property merge, tag vocab autocomplete, attachment delete perms, attachment backoff retry, backlinks badge) | ✅ **Phase 4 complete** — 3 tabs, delete perms, title↔H1 sync (4.3), union schema merge persisted on type change (4.4), tag vocab autocomplete (4.5), attachment backoff retry + Refresh (4.8), backlinks badge shown (4.2), collapsible ad-hoc custom props incl. on untyped pages (4.7), inspector open/width bound to `Layout` (4.1). Deferred to 1b.3: retry status text, tab-switch resource re-fetch. |
| Attachment upload (presign → S3 PUT progress → confirm; sequential; markdown auto-inserted) | ✅ pipeline + auto-insert of markdown (4.9). Manager Download / Copy Markdown / Drag Link / thumbnails / lightbox all done (4.8). |
| Admin gating (`PermissionGuard` 403 page; Delete hidden for non-admins; self-protection in Members) | ⚠️ Delete hidden ✅, self-protection ✅. ❌ 403 page, ❌ `/settings` admin guard. |
| AI sidebar (on-device Prompt API, availability/setup states, context meter, attachable instructions, per-turn RAG, auto fetch loop cap 3, Apply/Discard preview cards, `VITE_AI_ALLOW_DESTRUCTIVE`) | ⚠️ Prompt API + availability + meter + RAG + destructive gate ✅. ❌ **Apply does nothing**, ❌ **fetch-tool loop**, ❌ **instruction injection**. |
| Search (semantic `/search`, 300 ms debounce, 60/min limit, recent searches, infinite scroll + load more, `Ctrl+Enter` new tab, a11y/live region) | ⚠️ semantic + sanitise ✅. ❌ rate limit, ❌ recent searches, ❌ pagination/infinite scroll, ❌ **keyboard nav entirely**, ❌ live region, ❌ new-tab, ❌ visible open button. |
| Persisted layout prefs (tree width, inspector width/visibility, editor split, clamps) | ❌ **Store is dead** — nothing writes it, `ResizeDivider` unused (F5). |
| Dark-mode classes but no toggle | ⚪ Dropped entirely (F3) — accepted. |
| Dead-ish routes `/dashboard`, `/profile` | `/dashboard` removed; `/profile` exists but thin (§9). |

---

## Consolidated punch list

### 🔴 Functional gaps (capability missing or broken)

1. **Tree drag-and-drop**: no sibling reorder; no positional zones; type-constraint map not wired; no amber warning / `alert` (3.2).
2. **Rename modal** always pre-fills "Page" instead of the real title (3.3).
3. **New Page modal**: allowed-child-type scoping dead; no property inheritance (3.3).
4. **Create-Page-from-Link**: no source-markdown rewrite; no root/parent choice (3.3).
5. **Editor**: no Split view (3.4); no Refresh button (3.4).
6. **Markdown toolbar**: no Image, no Attachment buttons (3.4).
7. **Preview**: attachment-URL rewrite + authed images missing; image drag-resize missing; `#anchor` smooth-scroll broken (3.4).
8. **Table of Contents**: absent (3.4).
9. **Inspector**: no ad-hoc custom properties; no tag vocabulary; no attachment backoff-retry; Attachment manager missing Download / Copy Markdown / Drag Link / thumbnails / lightbox (3.4).
10. **Attachment upload**: markdown not auto-inserted after upload (3.4).
11. **Board**: no `boardOrder` reorder; no pagination/Load-more; Card Summary dialog read-only; child-state eligibility missing (3.5).
12. **Search**: no keyboard navigation; no pagination/infinite scroll (3.6).
13. **AI**: Apply on an action preview performs no mutation; fetch-tool loop absent; instruction attachment has no effect (3.7).
14. **Profile**: Display Name and Change Password forms absent (§9).
15. **Layout store dead**: nothing resizable; `ResizeDivider` unused (F5).
16. **No mobile / responsive layer** (F4).
17. **Auth bootstrap race** may bounce valid sessions to Hosted UI (F10).

### 🟠 UX / validation / guard gaps

- 401 refresh: no single-flight, no retry guard (F6).
- No local-dev username/password auth path (F8); no prod API-URL guard (F9).
- `/settings` not admin-guarded; no 403 page anywhere (§0.1, §10).
- No visible Search button; Search only via `Ctrl+K` (3.1/3.6).
- Editor keymaps for bold/italic/code/strike/link missing (§0.7).
- Tree arrow-key expand/collapse missing; `ensureExpanded` after create missing (3.2).
- New Page / modals: inline validation messages missing; new pages created with no `# Title` content (3.3).
- Delete page: native `confirm`, always-recursive, generic message (3.3).
- Save-status pill / dirty+saved indicator missing; save-failure reassurance copy missing (3.4).
- Breadcrumbs: no Home segment, no collapse/truncation (3.4).
- Inspector: title↔H1 sync, empty-title reset, backlinks badge, schema-default persistence, date formatting (3.4).
- Board: optimistic DnD + rollback; board-settings type list not filtered to boardable types; `showParentTitle` ignored on cards (3.5).
- Search: 60/min rate limit, recent searches, result highlighting, tags, `aria-live`, `Ctrl+Enter` new tab (3.6).
- AI: no tool message role, no auto-scroll, GUIDs not resolved to titles, action outcome not shown in the log (3.7).
- Admin screens: no back navigation; no coloured badges; Members no Retry / Edit enabled for deleted; Invitations no status filter / no created-code confirmation / no attribution; Rebuild has no confirm gate / no orphan-GUID list (§4–8).
- Global error handler is unscoped — any error shows an "editor crashed" panel (F11).

### ⚪ Cosmetic / accepted (no action unless desired)

Material vs Tailwind styling; no dark mode; empty-state copy; separator glyphs; `/callback` shows the shell toolbar; inline-vs-modal admin forms; snackbars instead of `alert()`; debounce 200 vs 300 ms; page-type property reorder; "(none)" vs "Wiki Page (no type)" labels.
