# BlueFinWiki — React Frontend Page Reference

Reference snapshot of the **React** frontend on `master` (commit `a9f17a7`), written so the
`feat/angular-rewrite` branch can be checked feature-for-feature against it. Every route,
screen, panel, modal and the behaviours behind them are documented below.

Source: `frontend/src` (React 18 + React Router 6 + TanStack Query 5 + Tailwind + CodeMirror 6 +
`react-markdown`). Backend is the same REST API in both frontends.

---

## 0. Global / cross-cutting behaviour

### 0.1 Route map (`App.tsx`)

| Route | Component | Guard | Notes |
|---|---|---|---|
| `/callback` | `OAuthCallbackPage` | none | Cognito Hosted-UI redirect target |
| `/` | — | `AuthGate` | `<Navigate to="/pages" replace>` |
| `/dashboard` | `Dashboard` | `AuthGate` | Placeholder screen, no nav points to it |
| `/pages` | `PagesView` | `AuthGate` | Main app — no page selected |
| `/pages/*` | `PagesView` | `AuthGate` | `*` = page GUID (`/pages/:guid`), regex `^/pages/([a-f0-9-]+)` |
| `/settings` | `SettingsPage` | `AuthGate` + `PermissionGuard requiredRole="Admin"` | |
| `/admin/page-types` | `PageTypesAdmin` | AuthGate + Admin | |
| `/admin/users` | `UserManagement` | AuthGate + Admin | |
| `/admin/invitations` | `InvitationManagement` | AuthGate + Admin | |
| `/admin/rebuild-page-index` | `RebuildPageIndex` | AuthGate + Admin | |
| `/profile` | `ProfilePage` | `AuthGate` | any authenticated user |
| `*` | inline 404 | none | "404 / Page not found" + "Go Home" link |

- **Router**: `BrowserRouter` (HTML5 history, no hash). Deep links to `/pages/:guid` work on reload.
- **Provider order**: `QueryClientProvider` → `BrowserRouter` → `AuthProvider` → `Routes`.
- **TanStack Query is configured with caching fully disabled**: `staleTime: 0`, `gcTime: 0`,
  `refetchOnMount: true`, `refetchOnWindowFocus: false`. Every mount refetches. This is a
  deliberate "always fresh" stance and explains a lot of the perceived latency.

### 0.2 Authentication (`contexts/AuthContext.tsx`, `utils/cognitoAuth.ts`, `config/api.ts`)

- **Two auth flows**:
  - **Production**: Cognito **Hosted UI** authorization-code flow. `AuthGate` calls
    `redirectToLogin()` which builds `https://{VITE_COGNITO_DOMAIN}/oauth2/authorize?...`
    with a random 32-char `state` saved in `sessionStorage.oauth_state` (CSRF guard). After
    login Cognito redirects to `/callback`, which exchanges the `code` at `/oauth2/token`,
    stores tokens, and `navigate('/pages', { replace: true })`.
  - **Local dev**: `USER_PASSWORD_AUTH` via `@aws-sdk/client-cognito-identity-provider` against
    `cognito-local`; there's app-client auto-discovery fallback (`ListUserPools` /
    `ListUserPoolClients`) for when `VITE_COGNITO_CLIENT_ID` is stale.
  - `VITE_DISABLE_AUTH=true` (dev only) bypasses everything with a mock **Admin** user.
- **Session bootstrapping**: on mount, `AuthProvider` reads `userPool.getCurrentUser()`,
  calls `getSession()` (which silently refreshes via the refresh token), and on a valid
  session populates `user` from the **ID token payload**:
  - `userId = sub`, `email`, `displayName = name || cognito:username`,
    `role = custom:role || 'Standard'`, `emailVerified`.
- **Roles**: `'Admin'` | `'Standard'`. `isAdmin = user?.role === 'Admin'`.
- **Token storage**: `localStorage.idToken` + `localStorage.accessToken`.
- **API client** (`apiClient`, axios):
  - Request interceptor attaches `Authorization: Bearer <idToken || accessToken>`.
  - Response interceptor: on **401**, coalesces concurrent refreshes into one
    `refreshIdToken()` call, updates stored token, retries the original request **once**
    (`_retried` flag). If refresh fails → `signOut()` and reject. This is what keeps a
    long editing session alive across token expiry without bouncing the user.
  - `API_BASE_URL` from `VITE_API_BASE_URL`; prod build throws if missing or if it points at
    localhost (unless `VITE_ALLOW_LOCAL_API_IN_PROD=true`).
- **`AuthGate`**: while `isLoading` shows nothing; if unauthenticated it fires
  `redirectToLogin()` in an effect and renders "Redirecting to sign in…". If authenticated,
  renders children.
- **`PermissionGuard requiredRole="Admin"`**: unauthenticated → `null` (AuthGate covers it);
  authenticated non-Admin → full-screen **403** page ("You don't have permission…" + "Go to
  Pages" link); Admin → children.
- **Sign-out**: only reachable from **Settings → Sign out**. Calls `cognitoUser.signOut()`,
  clears tokens, `navigate('/', { replace: true })`.

### 0.3 Save model (applies to page editing — see §3.4)

Three layers protect edits:

1. **Local draft store** (`stores/draftsStore.ts`) — `localStorage` key
   `bluefinwiki:draft:<guid>`, fronted by an in-memory `Map`. Holds `{ content, metadata }`.
2. **Debounced autosave** — 400 ms after the last keystroke/metadata change, the current
   editor state is written to the draft store. Also stashed **synchronously** on unmount /
   page-switch (covers navigating away before the debounce fires).
3. **Explicit Save** — `PUT /pages/:guid`. The draft is written **before** the API call;
   `clearDraft()` runs only on confirmed success. On failure the draft stays and the error
   banner says *"Your changes are still here — click Save again to retry."*

- **Draft precedence**: on load, `draft?.content ?? server.content`. If a draft differs from
  server content the editor opens in **split** view (so you see your draft vs. preview);
  otherwise **preview**.
- **"Refresh" button** discards the draft (`clearDraft`), refetches from server, resets the
  editor baseline, bumps `reloadVersion`.
- **No optimistic concurrency / conflict detection** on page content — last write wins.
  (The board view *does* do optimistic updates with rollback — see §3.5.)
- **Dirty detection** in `EditorPane` compares `content` and metadata
  (`title`, `status`, `tags`, `properties`) against a server baseline ref.

### 0.4 Layout & persisted UI prefs (`stores/layoutStore.ts`)

`localStorage` key `bluefinwiki-layout`, cached in module memory. Fields + defaults:

| Key | Default | Meaning |
|---|---|---|
| `treeWidth` | 320 | Sidebar (page tree) width, px. Clamp 200–600. |
| `inspectorWidth` | 320 | Inspector panel width, px. Clamp 250–600. |
| `inspectorVisible` | `false` | Inspector shown by default on desktop. |
| `editorSplitPosition` | 50 | Editor/preview split, %. Clamp 20–80. |

### 0.5 Responsive breakpoints (`hooks/useMediaQuery.ts`)

- `MOBILE` `(max-width:767px)`, `TABLET` `768–1023px`, `DESKTOP` `(min-width:1024px)`.
- Sidebar is a fixed column at `lg`+ (`isDesktop`); below that it becomes a slide-in
  `MobileDrawer` opened from a hamburger in a mobile top bar.
- Editor forces **edit** or **preview** on mobile — never split.
- Inspector is a right-hand resizable panel on desktop; a bottom-sheet `MobileDrawer`
  (`side="bottom"`, 75vh) on mobile.

### 0.6 Look & feel (global)

- Tailwind utility classes throughout; **no component library**. Ad-hoc inline SVG icons
  (Heroicons-style paths).
- Light theme is primary. **Dark mode classes exist pervasively** (`dark:…`) in the editor,
  preview, inspector, modals, AI — but there is **no theme toggle UI**; dark styling only
  engages if `document.documentElement` has `.dark` (also read by Mermaid). Admin pages and
  the page-tree sidebar are light-only.
- Accent colour: blue-600. Danger: red-600. Warning/dirty: yellow/amber. Success: green.
- Rounded corners (`rounded-md`/`rounded-lg`), subtle shadows (`shadow-sm`/`shadow-xl` for
  modals), `transition-colors` on interactive elements.
- Modals: fixed full-screen `bg-black bg-opacity-50` backdrop, centered white card,
  click-backdrop-to-close, `role="dialog"`/`aria-modal`.
- Loading: blue spinner ring (`animate-spin` border trick) or skeleton `animate-pulse` bars.
- Toasts: only the board view has a real toast (top-right red box, 3 s). Elsewhere failures
  use `window.alert()` or inline red banners.

### 0.7 Global keyboard shortcuts

| Keys | Where | Action |
|---|---|---|
| `Ctrl/Cmd+K` | anywhere in `PagesView` | Open Search dialog |
| `Ctrl/Cmd+S` | editor | Save page |
| `Ctrl/Cmd+B` / `I` / `` ` `` | editor | Bold / Italic / inline code |
| `Ctrl/Cmd+Shift+X` | editor | Strikethrough |
| `Ctrl/Cmd+K` | editor (CodeMirror) | Insert link markdown (note: same chord also opens Search at the `PagesView` level — the editor keymap wins when focused) |
| `Esc` | modals, drawers, context menu, search, AI trigger element | Close |
| `↑ / ↓ / Enter / Home / End` | Search dialog | Navigate results |
| `Ctrl/Cmd+Enter` | Search dialog | Open result in new tab |
| `↑ / ↓ / Enter / Esc` | `[[` link autocomplete | Navigate / pick / dismiss |
| `Enter` / `Esc` | inline rename, title edit | Save / cancel |
| `ArrowRight / ArrowLeft` | page tree item (focused) | Expand / collapse |
| `F2`, `Ctrl+N`, `Ctrl+M`, `Del` | shown as hints in the page context menu (labels only — not globally bound) |

---

## 1. `/callback` — OAuth callback page

- **Layout**: full-screen centered. Normally just "Completing sign in…". On error: a card
  with "Sign in failed", the message, and a "Try again" button (`redirectToLogin()`).
- **Navigation**: entered only via Cognito redirect. On success → `/pages` (`replace: true`)
  so back-button doesn't return here. No chrome, no way back except retry.
- **Save**: n/a. Persists `idToken`/`accessToken` to `localStorage`, sets the Cognito user
  session.
- **Validation**: requires `code` **and** `state` query params (throws "Missing authorization
  code or state" otherwise). `handleOAuthCallback` verifies `state` against
  `sessionStorage.oauth_state` — mismatch throws "State mismatch. Possible CSRF attack."
- **Business rules**: username resolved from ID token `cognito:username || email || sub`.
- **Other**: purely an effect on mount; no user interaction in the happy path.

---

## 2. `/dashboard` — placeholder

- **Layout**: `min-h-screen bg-gray-50 p-8`, an `<h1>Dashboard`, "Welcome to BlueFinWiki!",
  and a blue "Go to Pages" button linking to `/pages`.
- **Navigation**: **nothing links here.** Only reachable by typing the URL. One-way link out
  to `/pages`.
- **Save / validation / rules**: none.
- **Other**: effectively dead code kept behind `AuthGate`. If the Angular app has no
  equivalent, that's fine — but note it exists.

---

## 3. `/pages` and `/pages/:guid` — main application (`PagesView`)

This is the whole wiki. `PagesView` is a persistent shell; navigation between pages does
**not** change the route in most cases — it updates local `activePageGuid` state. (Route only
carries the initial GUID on first load / deep link; `SearchDialog`'s "open in new tab" and
`CardSummaryDialog`'s "open full editor" use real `/pages/:guid` URLs.)

### 3.1 Overall layout

Desktop (`lg+`):

```
┌───────────────┬─┬────────────────────────────────────────────────┐
│  Sidebar      │▚│  Main content area                              │
│  (treeWidth)  │ │  ┌──────────────────────────────────────────┐  │
│  ┌─────────┐  │ │  │ Breadcrumbs                               │  │
│  │ "Pages" │  │ │  ├──────────────────────────────────────────┤  │
│  │ 🔍 ✨ +  │  │ │  │ [save status] Refresh Save | Inspector  ▸ │  │
│  ├─────────┤  │ │  │ [Content | Board] toggle (if board-eligible)│
│  │ Page    │  │ │  ├──────────────┬──────────┬────────────────┤  │
│  │ tree    │  │ │  │ MarkdownEditor│  Preview │ Inspector      │  │
│  │ (scroll)│  │ │  │ + toolbar     │  + TOC   │ (Props/Attach/ │  │
│  │         │  │ │  │               │          │  Links tabs)   │  │
│  ├─────────┤  │ │  └──────────────┴──────────┴────────────────┘  │
│  │⚙ Settings│ │ │                                                │
│  │(admin)  │  │▚│                                                │
│  └─────────┘  │ │                                                │
└───────────────┴─┴────────────────────────────────────────────────┘
       ▚ = ResizeDivider (drag to resize)
```

- Overall container: `flex flex-col h-screen bg-gray-50 lg:flex-row`.
- **No page selected**: main area shows a centered empty state — document icon, "No page
  selected", "Select a page from the tree or create a new one".
- **AI sidebar** (§3.7) slides in from the right as a fixed overlay `w-96` (full-width on
  mobile), `z-40`.
- **Search dialog** (§3.6) is a centered modal overlay, `z-50`.

Mobile (`<lg`): a white top bar with a hamburger (opens sidebar drawer), centered
"BlueFinWiki" title, and 🔍 / ✨ / + buttons. Sidebar content renders inside a left
`MobileDrawer`.

### 3.2 Sidebar / page tree (`PageTree`, `PageTreeItem`, `PageContextMenu`)

**Header**: "Pages" + three icon buttons — Search (`Ctrl+K` tooltip), AI assistant (`AiButton`),
"New page" (creates a **root** page). Below `lg`, the same buttons live in the mobile top bar.

**Tree body** (`PageTree`):
- Root pages from `GET /pages/root/children`. Each expanded node lazily fetches
  `GET /pages/:guid/children` (only when expanded — `usePageChildren(isExpanded ? guid : null)`).
- Expansion state is component-local `Set<string>` (not persisted). `ensureExpanded` prop
  lets `PagesView` force-expand a parent after creating a child under it.
- **Row** (`PageTreeItem`): indent = `level*16 + 8` px; chevron (rotates 90° when open) or
  spacer; **icon** = page-type emoji if typed, else yellow folder (has children) or grey
  document; title (bold + blue left-border bar when active); on hover a "+" appears to add a
  child.
- **Active page** highlight: `bg-blue-50 border-l-4 border-blue-600`, bold title.
- **Selecting a page**: `onPageSelect(guid)` → sets `activePageGuid`, clears edit-mode flag,
  closes mobile drawer. **Does not touch the URL.**
- **Keyboard**: row is `tabIndex=0`, `role="treeitem"`; `Enter` selects, `→`/`←` expand/collapse.
- **Empty / loading / error**: "No pages yet / Create your first page…"; "Loading pages…"
  pulse; red "Error loading pages" with message.

**Drag & drop** (tree): HTML5 DnD. Drop zones per row computed by cursor Y within the row —
top 25% = **before**, bottom 25% = **after**, middle = **onto** (reparent).
- **before/after, same parent** → reorder: fetches the sibling list, splices the dragged GUID
  into the new index, `PUT /pages/reorder { parentGuid, orderedGuids }`, then invalidates.
- **onto** → reparent: `PUT /pages/:guid/move { newParentGuid }`.
- **before/after, different parent** → move to the target's parent **then** reorder (two API
  calls).
- **Type-constraint enforcement** (`checkTypeConstraints`): before a reparent (or a
  cross-parent reorder) it checks, using the page-type map:
  - Parent's `allowedChildTypes` (if non-empty) must include the dragged page's type;
    untyped pages need the parent's `allowWikiPageChildren`.
  - Child's `allowedParentTypes` (if non-empty) must include the parent's type; under an
    untyped parent the child needs `allowAnyParent`.
  - Violations → the drop indicator turns **amber** with a warning triangle (tooltip lists
    reasons), `dropEffect='none'`, and on drop a `window.alert("Cannot move here:\n\n…")`.
- Dropping onto self is a no-op.

**Context menu** (`PageContextMenu`, right-click a row): fixed popover, repositions to stay
in viewport, closes on outside-click / `Esc`. Items:

| Item | Condition | Action | Shortcut hint |
|---|---|---|---|
| Rename | always | opens rename modal (§3.3) | F2 |
| New Child Page | always | opens New Page modal with `parentGuid` | Ctrl+N |
| Sort Children A–Z / Z–A | only if `hasChildren` | fetch children, sort by title (ignoring leading "the/a/an"), `PUT /pages/reorder` | — |
| Move | always | **stub** — `alert('Move functionality coming soon! For now, use drag-and-drop.')` | Ctrl+M |
| Delete | **Admin only** (`isAdmin`) | opens delete confirm (§3.3) | Del |

### 3.3 Page CRUD flows (modals owned by `PagesView`)

**New Page modal** (`NewPageModal`) — title "Create New Page" (root) or "Create Child Page":
- Fields: **Title** (required), **Description** (optional textarea), **Page Type** select.
- **Page-type options** depend on parent:
  - Root / untyped parent → all page types + "Wiki Page (no type)".
  - Typed parent → `GET /page-types/:parentType/allowed-children` gives the allowed child
    types and whether untyped wiki pages are allowed. If exactly one type is allowed and
    wiki pages are not, it auto-selects that type.
- **Property inheritance**: when a type is chosen, default properties are built from the type
  schema; for each property, if the parent page has a property of the **same name and type**,
  the parent's value is inherited, else the type's `defaultValue` (or a per-type zero-value).
- **Validation**: title required; trimmed length **3–100** chars; messages inline in red;
  submit disabled while `createPage.isPending` ("Creating…").
- **Submit**: `POST /pages` with `content = "# {title}\n\nStart writing your page content
  here..."`. On success: modal closes, new page is **selected and opened in edit mode**, and
  the parent is force-expanded in the tree.
- Close: X button, backdrop click, Cancel — all reset the form.

**Create Page from Link modal** (`CreatePageFromLinkModal`) — opened from a **broken wiki
link** in the preview (§3.4):
- Title pre-filled from the link text. "Create as root page" checkbox; otherwise "Will be
  created under the current page" (parent = current page). A `<select>` for arbitrary parent
  exists but is a **TODO stub** (no options loaded) — only usable when there's a current page.
- Validation: same 3–100 char title rule; "Please select a parent page or create as root
  page" if neither.
- Submit: `POST /pages` (same boilerplate content). On success the **source page's markdown
  is rewritten** — `[[target]]` / `[[target|text]]` → `[[newGuid|text]]` — and the user must
  **save manually** afterwards.

**Rename** (`PageRenameInline`, shown in a small centered modal "Rename Page"):
- Single text input, auto-focused + all-selected. Save on `Enter` or blur; cancel on `Esc`.
- Validation: non-empty, trimmed 3–100 chars; unchanged title just cancels.
- `PUT /pages/:guid { title }`; failure → inline "Failed to rename page. Please try again."

**Delete** (`ConfirmDialog`, `isDangerous`):
- Message differs if the page has children ("…and all its child pages? This action cannot be
  undone.").
- `DELETE /pages/:guid { recursive: hasChildren }`. On success clears `activePageGuid`.
- Failure → `alert(server error || 'Failed to delete page.')`.
- **Admin-gated** in the UI (menu item hidden for non-admins); backend also enforces.

### 3.4 Content view — the editor (`PageEditor` → `EditorPane`)

Wrapped in an `EditorErrorBoundary` (catches editor crashes → "Editor Crashed" card with
"Try Again" / "Reload Page" and a reassurance that autosave protected the work; on reset it
clears the active page).

**Breadcrumbs** (`Breadcrumbs`, top of editor): `Home ▸ …ancestors… ▸ Current`.
`GET /pages/:guid/ancestors`. Home + ancestors are buttons (Home → clear selection;
ancestor → select that page). Current segment is bold, non-clickable. On mobile, if >3
segments it collapses to `Home ▸ … ▸ Current`. Truncates at 200px per segment with title
tooltip.

**Save/status bar** (`EditorPane` top toolbar):
- Left: **save-status pill** — one of `Read-only` (grey), `Saving…` (blue, spinner),
  `● Unsaved changes` (yellow), `✓ All changes saved` (green).
- **Refresh** button (disabled while refreshing/saving) — reload from server, discards draft.
- **Save** button (disabled unless dirty; label "Saving…" while pending).
- Right: **Inspector** toggle (desktop: "Inspector"/"Hide Inspector"; mobile: an info icon
  opening the bottom sheet) and the **view-mode** segmented control: `Edit | Split | Preview`
  (Split hidden on mobile).
- A save error renders a dismissible red banner above the toolbar.

**Markdown toolbar** (`MarkdownToolbar`, shown in Edit/Split): grouped buttons — Bold,
Italic, Strikethrough | Heading dropdown (H1–H6; H1–H3 only in compact/mobile) | UL, OL,
Task list (OL/Task hidden in compact) | Link, Image, Attachment | Inline code, Code block
(code block hidden in compact). On mobile the toolbar is **fixed to the bottom** of the
screen (`safe-bottom`, horizontally scrollable) and the heading menu opens upward.
- Actions insert markdown at the cursor via CodeMirror; if text is selected it's wrapped
  (e.g. `**selected**`), else placeholder text (`bold text`, `Heading 1`, …).
- **Attachment** button: if the page isn't saved yet → inline error "Save the page before
  uploading attachments."; else opens a hidden multi-file `<input>`.

**Editor pane** (`MarkdownEditor`, CodeMirror 6):
- Markdown syntax highlighting, line numbers, active-line highlight, undo/redo history,
  monospace (`JetBrains Mono` stack), 14px.
- **`[[` autocomplete** (`LinkAutocomplete`): typing `[[` (with no closing `]]` before the
  cursor) opens a dropdown positioned at the caret. Debounced 200 ms, `GET /pages/search?q=…&limit=10`.
  Shows title + hierarchy path. `↑/↓/Enter` pick (inserts `[[Page Title]]`), `Esc` / click
  outside dismiss.
- **Programmatic-update guard** so external `initialValue` changes don't echo back as user
  edits.
- Note: there is a lot of `console.log` instrumentation in this component (`[MarkdownEditor]
  docChanged …`) — expected noise, not a bug.

**Preview pane** (`MarkdownPreview`, `react-markdown`):
- Plugins: `remark-gfm` (tables, strikethrough, task lists, footnotes), `remark-breaks`
  (single newline → `<br>`), `remarkWikiLinks`, `remarkImageSize`; `rehype-highlight` for
  code.
- **Headings** get slug `id`s (GitHub-style `slugify`) so in-page `#anchor` links smooth-scroll.
- **Wiki links** `[[…]]`:
  - `[[Page Title]]` or `[[guid|Display Text]]`. Rendered as styled links via data attributes.
  - In preview mode, valid wiki links are **inert** (clicking just `console.log`s "disabled
    in preview") — you navigate via the tree/search/breadcrumbs, not by clicking links in
    the rendered page.
  - **Broken** wiki links render **red** with a trailing `?` and tooltip "Page not found: X.
    Click to create." — clicking opens the *Create Page from Link* modal.
  - Broken-link detection relies on a `pageExists` callback that the app **does not wire up**
    here, so in practice `remarkWikiLinks` treats all links as valid unless the plugin is
    given a checker. (Behaviour to verify in Angular — the styling/hooks exist but the
    resolver isn't connected in this component.)
- **Images / attachments**:
  - Bare filename in `![alt](name.png)` → rewritten to `/pages/:guid/attachments/name.png`;
    legacy `guid/filename` form also handled. Absolute URLs and `#anchors` pass through.
  - API-backed images are fetched with auth via `AsyncImage` (axios → `{ url }` → `<img>`),
    with loading / "Failed to load image" states.
  - `![alt|WIDTH](src)` sizing via `remarkImageSize`. In editable preview each image gets a
    **drag handle** (bottom-right) — dragging resizes and **rewrites the markdown**
    (`![alt|<px>](src)`).
  - External images render directly.
- **Mermaid**: ```` ```mermaid ```` blocks render as SVG (`securityLevel:'strict'`, theme
  follows `.dark`). Errors show the source + "Mermaid error: …". "Rendering diagram…"
  placeholder while pending.
- **Code blocks**: `rehype-highlight`, `font-mono text-sm`, horizontal scroll.
- Empty content shows *"No content yet. Start writing…"* (italic).
- Full Tailwind `prose` typography; tables scroll horizontally; blockquotes get a left bar.

**Table of contents** (`TableOfContents`): parses `##`–`######` (skips fenced code). Only
shows if **≥3** headings. Desktop: sticky 224px right rail inside the preview pane ("On this
page"), active heading tracked by `IntersectionObserver`, click smooth-scrolls and sets the
hash. Mobile: a collapsible "On this page" bar above the preview.

**Inspector panel** (`InspectorPanel`, desktop right side / mobile bottom sheet) — tabbed:

1. **Properties** (`PagePropertiesPanel`):
   - **Title** — click-to-edit inline; typing updates metadata live; if line 1 of the
     content is an `# H1`, editing the title **also rewrites that H1**. Empty title on blur
     resets to the previous value.
   - **Page Type** select — "None (Wiki Page)" + each type (`icon name`). Hidden entirely if
     no types exist. Changing type merges the type's property schema in.
   - **Tags** — chips; type + `Enter` or `,` to add (lower-cased, deduped); `Backspace` on
     empty input removes the last; autocomplete suggestions from the `page-tags` vocabulary
     (`useTags`), top 5.
   - **Author** (read-only): "Created by / Modified by".
   - **Timestamps** (read-only): localized "Created / Modified".
   - **Custom Properties** (`CustomPropertiesEditor`): collapsible. Type-schema properties
     are merged with saved values so new schema fields appear automatically. Per-type
     inputs: text / number / date / tags (tags with vocabulary autocomplete). Can add ad-hoc
     properties (name kebab-cased, choose type) and remove them.
   - **Page ID** (read-only mono, "for debugging").
2. **Attachments** (`AttachmentManager`):
   - `GET /pages/:guid/attachments`. **Exponential-backoff auto-retry** on load failure
     (1s→30s, up to 10 attempts) with status text; manual "Refresh".
   - Sorted newest-first. Per item: type emoji, filename, size + uploaded date, image
     thumbnail (fetched via presigned URL) opening a full-screen lightbox.
   - Actions per attachment: **Download** (presigned URL), **Copy Markdown**, **Drag Link**
     (drags markdown text), **Insert** (into editor at cursor), **Delete**.
   - **Delete permission** (`canDeleteAttachment`): Admin **or** page author **or** the
     attachment's uploader. `window.confirm` first.
   - Markdown built for images = `![name](encoded)`, else `[name](encoded)`.
3. **Links** (`LinkedPagesPanel`): backlinks from `GET /pages/:guid/backlinks`. Badge count
   on the tab. List of linking pages (title + optional "via: link text"); click navigates.
   Loading skeleton; empty = "No pages link to this page".

**Attachment upload flow** (`useAttachments`): client-side `validateFile` →
`POST /pages/:guid/attachments/presign` → `PUT` straight to S3 (progress 10–90%) →
`POST …/confirm` (saves metadata). Files upload **sequentially**. On success the returned
markdown (`![…]` / `[…]`) is inserted at the cursor and the attachments list refreshes.
Partial failures surface the first error inline.

### 3.5 Board view (`BoardView`, `BoardColumn`, `BoardCard`, `BoardSettingsPanel`, `CardSummaryDialog`)

**Eligibility** (`PageEditor.boardEligible`): true if the page's `boardConfig.targetTypeGuid`
is set, **or** any direct child has a page type whose schema includes a `state` property and
that child actually has a `state` value. When eligible, a **`Content | Board`** toggle appears
above the editor; when `boardConfig.defaultView === 'board'` the page opens on the board.

**Data**: `GET /pages/:guid/children?include=properties` (with `&type=` + `&depth=` for deep
boards driven by `targetTypeGuid`, default depth 10, cap 10). Cursor-paginated,
`BOARD_PAGE_SIZE = 200`, "Load more cards" button.

**Columns**: cards grouped by their `state` property value; `Uncategorised` for missing state.
Column order = `boardConfig.columns` first (configured columns always shown even if empty),
then any other states alphabetically, `Uncategorised` last. Column colour: `boardConfig.colors[name]`
→ built-in default map (Backlog/To Do grey, In Progress/Watching blue, Review amber,
Done/Completed green, Archived) → hashed HSL from the name.

**Cards** (`BoardCard`): type icon + title; parent title as subtitle when
`showParentTitle`; `swapTitles` flips which is primary. Up to 3 non-`state` properties shown
as `name: value`. Draggable; click opens the **Card Summary dialog**.

**Drag & drop**:
- **Column-to-column** (drop on column, no precise card target) → change `state`. Optimistic
  cache patch; `PUT /pages/:cardGuid { properties: { …, state } }`; on failure **rollback +
  toast** "Failed to update state. Please try again."
- **Reorder within/into a column at a position** (`onCardReorder`) → gap-based `boardOrder`
  (midpoint between neighbours; `±1000` at the ends). If the gap is exhausted it **renumbers
  the whole column** (`i*1000`) and PUTs every affected card. Cross-column reorder also sets
  `state` in the same PUT. Optimistic + rollback + toast.
- Card sort within a column: `boardOrder` asc, then `modifiedAt` desc as a tiebreak.

**Board Settings** (`BoardSettingsPanel`, gear button when board tab active): popover form —
- "Show pages of type" (`targetTypeGuid`; "Direct children" = none). Only page types that
  have a `state` property are offered (`boardableTypes`).
- "Show parent title on cards" + "Use parent as primary title" (`swapTitles`).
- "Open in board view by default" (`defaultView`).
- **Columns editor**: add/remove/reorder named columns, per-column colour from an 8-swatch
  palette.
- Save → `PUT /pages/:guid { boardConfig }` (stored as a first-class frontmatter field).
  Persist failures are swallowed silently ("the board still works, just won't persist").

**Card Summary dialog** (`CardSummaryDialog`): edit **title** + **properties** inline
(text/number/date/tags, tags with vocabulary autocomplete). Type-schema defaults are merged
on save so new fields persist. `PUT /pages/:cardGuid { title, properties }`; invalidates
children + detail queries. "Open full editor" → `window.open('/pages/:guid', '_blank')`.
`Esc` closes; Save disabled unless changed; title required.

**"Add card"** hooks (`onAddCard`) exist in `BoardColumn` but `BoardView` does not pass one
in this build — **no add-card-from-board UI** currently.

### 3.6 Search dialog (`SearchDialog`, `useSearch`, `ClientSearchService`)

- **Open**: `Ctrl/Cmd+K`, or the 🔍 button (sidebar / mobile bar).
- **Layout**: centered modal (`md:max-w-2xl md:max-h-[70vh]`; full-screen on mobile). Search
  input with icon + spinner + filter toggle + `Esc` kbd hint. Results list. Footer with
  result count, timing (ms), and key hints.
- **Search**: semantic search via the backend `/search` endpoint (Bedrock embeddings + S3
  Vectors server-side). Query debounced **300 ms**; client rate-limit **60/min** ("Too many
  searches. Please wait a moment."). Page size 10/25/50 (filter panel). `scope` select
  exists but only "All pages" is offered.
- **Results**: title (matched terms `<mark>`-highlighted), up to 3 tags, snippet (2-line
  clamp, highlighted), folder path. Infinite scroll (loads more within 100px of bottom) plus
  an explicit "Load more results (N of M)".
- **Keyboard**: `↑/↓` move, `Home/End` jump, `Enter` open (navigates + closes),
  `Ctrl/Cmd+Enter` open in new tab (`/pages/:id`), `Esc` close. Mouse hover also sets
  selection. Selected row scrolls into view.
- **Recent searches**: stored client-side (`utils/recentSearches`), shown when the query is
  empty; per-item remove, "Clear all". A search is recorded on result selection.
- **Navigation on select**: `onNavigate(pageId)` → sets `activePageGuid`, closes dialog.
- **A11y**: `role="dialog"`/`combobox`/`listbox`/`option`, `aria-activedescendant`, an
  `aria-live` region announcing "Searching…" / "N results found" / "No results".
- **Errors**: red centered message; "No results found for …" empty state.
- Focus returns to the triggering element on close.

### 3.7 AI assistant sidebar (`AiSidebar`, `useAi`, `AiService`)

- **Open**: the ✨ `AiButton` (sidebar / mobile bar). Fixed right overlay, `w-96` (full-width
  on mobile), header "AI assistant" with "New chat" (reset) and close.
- **Engine**: **Chrome's on-device Prompt API (Gemini Nano)** — `window.LanguageModel`.
  Nothing leaves the browser. Availability states: `unsupported` / `downloadable` /
  `downloading` / `available`. `UnavailableState` renders setup instructions (Chrome 138+,
  two `chrome://flags`, `chrome://components`, disk/VRAM needs) when not available.
- **Context meter** (`ContextMeter`): shows `inputUsage / inputQuota` (%), colour-coded
  blue/amber/red — Nano's window is ~4–6k tokens so this matters.
- **Instruction picker** (`InstructionPicker`): attach saved "instruction" pages to the
  chat. `listInstructions()`; toggling selects/deselects; once injected into the session
  ("In context") it can't be removed without "New chat". "Create" makes a child page under
  an "AI Instructions" page and navigates you to its editor.
- **Per-turn RAG context** (`AiContextLoader.buildRagContext`): current page (title, tags,
  content truncated to 1200 chars) + up to 4 semantic-search hits for the message; page-type
  list only when the message looks like a create/update ("create/add/new/make…"); skips
  wiki search and hints toward IMDb for TV-lookup phrasing. Shoved into the **user** turn
  (Prompt API rejects a second system message).
- **Response contract** (`AiService`): one JSON object `{ message, action }` via
  `responseConstraint`. `action.type` ∈ `none | create_page | update_page | fetch_url |
  fetch_imdb_show` (+ `delete_page | move_page` unless `VITE_AI_ALLOW_DESTRUCTIVE=false`).
- **Tool loop** (`useAi`): `fetch_url` (`POST /fetch-url`) and `fetch_imdb_show`
  (`GET /imdb/show-details`) are executed **automatically**, results fed back as the next
  user turn, capped at **3 fetches/turn**, with duplicate-fetch detection and a nudge to
  stop looping. Tool results render as grey rows with size/truncation.
- **Proposed actions** (`ActionPreview`): every create/update/delete/move is shown as a
  **preview card** the user must **Apply** or **Discard**. Shows title/tags/type/properties/
  parent/content diff-ish preview; resolves referenced GUIDs to page titles (with links);
  delete is red ("destructive", warns about recursive child deletion). Apply → the
  corresponding REST call (`POST /pages`, `PUT /pages/:guid`, `DELETE`, `PUT …/move`), then
  `queryClient.invalidateQueries(['pages'])`. Status: pending → applying → applied / failed
  (with error) / discarded.
- **Message roles**: user (blue, right), assistant (grey, left), system (red error box),
  tool (grey info row). Auto-scrolls to bottom. "Thinking…" pulse while awaiting the model.
- Input: textarea, `Enter` sends / `Shift+Enter` newline; disabled while thinking or when AI
  unavailable.
- Session persists across re-renders (`useRef`), destroyed on unmount; "New chat" resets
  messages, usage, and loaded instructions (but keeps the *selection*).
- Debug logging behind `VITE_AI_DEBUG` / `localStorage.aiDebug`.

### 3.8 `/pages` navigation summary

- **Between wiki pages**: page tree click, breadcrumb click, search result, backlink click,
  AI "open full editor", "New page" (creates + opens in edit mode). Most of these mutate
  `activePageGuid` **without changing the URL**; only initial load / deep link / new-tab
  opens use `/pages/:guid`.
- **Back button**: because in-app navigation doesn't push history, the browser Back button
  does **not** walk your page history inside `/pages` — it exits to whatever was before. (Key
  difference to watch for vs. Angular if the rewrite uses real routing.)
- **Out to admin**: only the "⚙ Settings" link at the bottom of the sidebar, and only for
  Admins. Standard users have no visible route off `/pages` except the AI/search overlays.
- **To profile**: **no UI link anywhere** — `/profile` is reachable only by typing the URL
  (or from wherever a future menu would point). Worth confirming whether this is intended.

---

## 4. `/settings` — Settings hub (`SettingsPage`, Admin only)

- **Layout**: `max-w-2xl` centered, light. Back-chevron → `/pages`, "Settings" `<h1>`. A
  vertical stack of large card-buttons, each: coloured icon tile, title, description, right
  chevron.
- **Items** (each `navigate(...)`):
  - **Members** → `/admin/users` — "Manage users, roles, and account status".
  - **Invitations** → `/admin/invitations` — "Create and manage invitation codes".
  - **Page Types** → `/admin/page-types` — "Define structured page schemas…".
  - **Rebuild Page Index** → `/admin/rebuild-page-index` — "Recover from a stale or corrupt
    DynamoDB page index by rescanning S3".
  - **Sign out** (separated, red hover) → `signOut()` then `/` (`replace`).
- **Save / validation / rules**: none — pure navigation hub. Whole route is behind
  `PermissionGuard requiredRole="Admin"` (non-admins get the 403 page).

---

## 5. `/admin/users` — Members (`UserManagement`, Admin only)

- **Layout**: `max-w-5xl` centered. Back-chevron → `/settings`, "Members (N)". Search box
  ("Search by name or email…"). Table: Name (avatar initial + "(You)" tag) · Email · Role
  badge · Status badge · Joined date · Actions.
- **Data**: `GET /admin/users`. Client-side filter on name/email. Loading = "Loading
  members…"; error = red banner + "Retry".
- **Badges**: status — active (green) / suspended (red) / pending (yellow) / deleted (grey).
  Role — Admin (purple) / Standard (blue).
- **Row actions**:
  - **Edit** (disabled for `deleted`): modal with **Display Name** + **Role** select
    (`Admin`/`Standard`). Role select is **disabled for yourself** ("You cannot change your
    own role"). Save → `PUT /admin/users/:id { role, displayName }`; error shown inline; Save
    disabled if display name blank.
  - **Suspend / Activate** (hidden for self and `deleted`): `POST /admin/users/:id/{suspend|activate}`;
    failures `alert()`.
  - **Delete** (hidden for self and `deleted`): confirm modal — "…remove their access…
    Activity history will be preserved for audit." → `DELETE /admin/users/:id`.
- **Validation**: display name required (trim) to enable Save. No other client validation;
  server errors surface (`error.response.data.error`).
- **Business rules**: cannot change or remove your own account (role select disabled;
  suspend/delete hidden). Self row highlighted `bg-blue-50/50`.
- **Refresh**: every mutation calls `fetchUsers()` again (no query cache — raw `useState`).

---

## 6. `/admin/invitations` — Invitations (`InvitationManagement`, Admin only)

- **Layout**: `max-w-5xl` centered. Back-chevron → `/settings`, "Invitations". "Create
  Invitation" button expands an inline form. Status filter pills. Table: Code (mono) · Email ·
  Role badge · Status badge · Created (+ "by <name>") · Expires · Actions.
- **Data**: `GET /admin/invitations` (`?status=` unless "all"). Loading / error+Retry as above.
- **Create form**: Email (optional), Role select (Standard/Admin), Expires days (number,
  **1–30**, default 7). Submit → `POST /admin/invitations { role, expiryDays, email? }`. On
  success: green "Invitation created: <code>", form fields reset, list refreshes. Error →
  red inline.
- **Filter pills**: all / pending / used / expired / revoked (active pill blue).
- **Status badges**: pending (yellow) / used (green) / revoked (red) / expired (grey).
- **Row actions**:
  - **Revoke** — only when `status === 'pending'` → `DELETE /admin/invitations/:code`;
    failures `alert()`; shows "…" while in flight.
  - Used rows show "Used by <name>" instead.
- **Validation**: `expiryDays` coerced, falls back to 7 on non-numeric; `min=1 max=30` on the
  input. Email is a plain `type="email"` field, no explicit validation before submit.

---

## 7. `/admin/page-types` — Page Types (`PageTypesAdmin`, Admin only)

- **Layout**: `max-w-3xl` centered. Back-chevron → `/settings`, "Page Types", "+ New Type"
  button (hidden while a form is open). Below: create/edit form (when active) then the list
  of existing types (icon, name, "`N` properties | `N` child types | `N` parent types",
  Edit / Delete).
- **Data**: `usePageTypes()` → `GET /page-types` (5-min `staleTime` — one of the few cached
  queries). Mutations: `POST /page-types`, `PUT /page-types/:guid`, `DELETE /page-types/:guid`.
- **Form** (`PageTypeForm`):
  - **Icon** (text, `maxLength 4`, default 📄) + **Name** (required).
  - **Property Schema builder** (`PropertySchemaBuilder`): add rows with name (kebab-cased,
    deduped), type (`Text`/`Number`/`Date`/`Tags`), Required checkbox, and a Default value
    (parsed per type — number → `Number`, tags → comma-split, else string). Existing rows
    can be reordered (^/v), have their default edited inline, or be removed.
  - **Allowed Child Types**: checkbox list of all other types.
  - **Allow untyped wiki pages as children** (checkbox).
  - **Allowed Parent Types**: checkbox list ("Leave all unchecked to allow any parent").
  - **Allow placement under untyped wiki pages** (`allowAnyParent`, checkbox).
  - Save disabled if name blank or while saving; label "Create" / "Update" / "Saving…".
- **Delete**: inline "Delete?" → "Yes / No" confirmation on the row (no modal). `deletePageType`.
- **Validation**: name + icon required (trimmed) to submit; property names must be non-empty
  and unique after kebab-casing.
- **Business rules**: these type definitions drive: the New Page modal's type options &
  property inheritance, the page-tree drag-and-drop constraint checks
  (`allowedChildTypes` / `allowWikiPageChildren` / `allowedParentTypes` / `allowAnyParent`),
  the Inspector property schema merge, and the board's `state`-property eligibility.
- **Empty state**: "No page types defined yet" + explanation.

---

## 8. `/admin/rebuild-page-index` — Rebuild Page Index (`RebuildPageIndex`, Admin only)

- **Layout**: `max-w-3xl` centered. Back-chevron → `/settings`, "Rebuild Page Index". A card
  explaining what the DynamoDB page index is and when to rebuild (pages edited/deleted
  directly in S3, stale index, post-recovery; reads may be slower during rebuild).
- **Flow**: "Rebuild now" → inline confirm block ("scan the entire pages bucket and
  overwrite every row… then delete any orphan rows… may take several minutes. Continue?") →
  "Yes, rebuild". While running: spinner + "Rebuild in progress — please don't close this
  page."
- **API**: `POST /admin/rebuild-page-index` → `{ totalPages, indexed, failed, errors[],
  durationMs, deletedOrphans, orphanGuids[] }`.
- **Result card** (green): a `<dl>` of Pages discovered / Rows written / Orphan rows deleted /
  Failed / Duration (s); collapsible `<details>` for the error list and for deleted orphan
  GUIDs; "Run again".
- **Error**: red box with message (`error || message || generic`) + "Dismiss".
- **Save / validation**: none — single action button with a confirm gate.

---

## 9. `/profile` — Profile (`ProfilePage`, any authenticated user)

- **Layout**: `max-w-lg` centered. Back-chevron → `/pages`, "Profile". Card 1: avatar
  initial, display name, email, role badge, + **Display Name** form. Card 2: **Change
  Password** form.
- **Display name**: `PUT /auth/profile { displayName }`; on success shows "Display name
  updated!" and calls `refreshUser()` (best-effort) so the app picks up the new name. Save
  disabled if blank or unchanged.
- **Change password**: Current / New / Confirm password fields (`autoComplete` hints).
  Client check: New must equal Confirm ("New passwords do not match"). Then
  `POST /auth/change-password { currentPassword, newPassword }` → "Password changed
  successfully!" and clears the fields. Submit disabled until all three filled.
- **Validation**: display name required (trim); password match check client-side; everything
  else is server-side (`error.response.data.error` surfaced inline).
- **Navigation**: no link points here in the current UI (see §3.8) — reachable by URL only.

---

## 10. Error / edge screens

| Screen | Trigger | Content |
|---|---|---|
| 404 | any unmatched route | "404 / Page not found" + "Go Home" (`href="/"`) |
| 403 | non-Admin hits an `/admin/*` or `/settings` route | "403 / You don't have permission…" + "Go to Pages" |
| Redirecting to sign in… | unauthenticated behind `AuthGate` | plain text while `redirectToLogin()` runs |
| Sign in failed | `/callback` with bad/missing `code`/`state` | message + "Try again" |
| Editor Crashed | React error inside the editor subtree | `EditorErrorBoundary` card, "Try Again" / "Reload Page", autosave reassurance |
| Failed to Load Page | `GET /pages/:guid` error | ⚠️ card + "Retry" (refetch) |
| Loading page… | `GET /pages/:guid` pending | centered blue spinner |

---

## 11. Things easy to lose in a rewrite (checklist)

- **Caching stance**: React Query is set to *never* cache (`staleTime:0`, `gcTime:0`).
  Angular's `HttpClient` + any store will behave differently; decide deliberately.
- **Draft/autosave triad** (§0.3): 400 ms debounced localStorage draft, synchronous stash on
  page-switch/unmount, draft written before every save API call and only cleared on success,
  "your changes are still here" retry messaging, draft-vs-server opening in split view.
- **401 → silent refresh → retry once** in the API layer, with concurrent-request coalescing.
- **In-app page navigation doesn't use the router** — no history entries, Back button
  doesn't retrace page visits. If Angular uses real routes this is a UX change (probably an
  improvement, but breakpoints like "new page opens in edit mode", breadcrumb "Home" =
  clear-selection, etc. need re-mapping).
- **Page-tree lazy loading** — children fetched only on expand; `ensureExpanded` after
  child-create.
- **Drag-and-drop with type constraints** in the tree (before/after/onto zones, amber
  warnings, `dropEffect='none'`, `alert()` on drop) — and the two-step "move then reorder"
  for cross-parent drops.
- **Board view**: eligibility heuristic, deep-fetch by target type + depth, gap-based
  `boardOrder` with full-column renumber fallback, optimistic DnD with rollback + toast,
  `boardConfig` persisted as frontmatter, silent persist-failure, no add-card UI wired.
- **Markdown feature set**: GFM + `remark-breaks` (single newline = `<br>`), wiki links
  (`[[title]]`, `[[guid|text]]`), broken-link → create-page modal + source rewrite (needs
  manual save), attachment URL rewriting (bare filename + legacy `guid/file`), auth'd async
  images, `![alt|WIDTH]` sizing + **drag-to-resize rewriting the markdown**, Mermaid,
  heading slugs + smooth-scroll anchors, TOC (≥3 headings, IntersectionObserver active
  tracking).
- **`[[` autocomplete** in the editor (debounced page search, keyboard nav).
- **Inspector**: 3 tabs (Properties/Attachments/Links), title↔H1 sync, type-schema/property
  merge, tag vocabulary autocomplete, attachment delete permissions (admin/author/uploader),
  attachment list exponential-backoff retry, backlinks badge.
- **Attachment upload**: presign → direct-to-S3 PUT with progress → confirm; sequential;
  markdown auto-inserted.
- **Admin gating**: `PermissionGuard` 403 page; Delete hidden for non-admins in the tree
  context menu; self-protection in Members (can't change own role / suspend / delete self).
- **AI sidebar**: on-device Prompt API, availability/setup states, context-window meter,
  attachable instruction pages, per-turn RAG context assembly, auto fetch-tool loop (cap 3),
  Apply/Discard preview cards for every mutation, `VITE_AI_ALLOW_DESTRUCTIVE` gate.
- **Search**: semantic `/search`, 300 ms debounce, 60/min client rate-limit, recent searches
  (localStorage), infinite scroll + "load more", `Ctrl+Enter` new tab, full a11y/live-region.
- **Persisted layout prefs**: tree width, inspector width/visibility, editor split — all
  `localStorage`, all with clamps.
- **Dark-mode classes exist but no toggle** — decide whether Angular ships the toggle or
  drops the classes.
- **Dead-ish routes**: `/dashboard` (nothing links to it), `/profile` (no link to it) —
  confirm intent.
