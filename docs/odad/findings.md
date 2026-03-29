---
description: Current state of BlueFinWiki — what's built, what's not, what decisions have been made
tags: [bluefinwiki, findings, current-state, migration]
audience: { human: 40, agent: 60 }
purpose: { findings: 90, reference: 10 }
---

# BlueFinWiki: Current State

**Question**: What is true about BlueFinWiki today — what exists, what doesn't, what decisions shape what comes next?

---

**Built foundation is solid**: Authentication, storage, page hierarchy, editor, links, attachments, and search all work end-to-end. The serverless architecture (Lambda + S3 + DynamoDB + Cognito) is deployed and tested. The remaining work is user management admin UI, versioning UI, navigation improvements, permissions enforcement, and several P2/P3 features (dashboard, export, comments, metadata, admin config, onboarding, error handling).

**Architecture is committed**: Pluggable storage (S3 first, GitHub possible), pluggable search (Fuse.js client-side default, DynamoDB and S3 Vectors optional), pages-as-folders in S3, YAML frontmatter for metadata, Cognito for auth, DynamoDB for relational data (links, invitations, profiles), Aspire for local dev orchestration.

**Solo developer with Claude**: The project was originally scoped for 2-3 developers over 12-16 weeks. It's now a solo project with Claude as implementation partner, which is why ODAD replaces the speckit approach — declarations guide agent implementation directly.

---

## What's Built

### Authentication (Spec 1) — Complete

Invite-only auth using AWS Cognito. Backend Lambda functions handle registration, login, password reset, and invitation management. Cognito triggers (pre-token-generation, post-confirmation, custom-message, forgot-password) extend the auth flow. Frontend has login, registration, and password reset pages with React Context for auth state. JWT tokens transported as Bearer tokens in Authorization header, stored in `localStorage`. Auth middleware (`aws-jwt-verify`) validates ID tokens and extracts user context (sub, email, role, displayName, status). Invitations carry a pre-assigned role (Admin/Standard) that flows through to the user profile.

**Security note**: Tokens in `localStorage` are accessible to any JavaScript on the page. If XSS is possible, tokens can be stolen. This makes Markdown output sanitization (DOMPurify/rehype-sanitize) critical — and it is currently **not implemented**.

> `backend/src/auth/` — Lambda handlers for all auth flows (individual functions per endpoint)
> `frontend/src/contexts/AuthContext.tsx` — Cognito integration via `amazon-cognito-identity-js`
> `frontend/src/config/api.ts` — Axios interceptor adds Bearer token
> `backend/src/middleware/auth.ts` — JWT validation, `withRole()` helper (exists but not applied to endpoints)

### Storage Plugin (Spec 2) — Complete

S3StoragePlugin implements a pluggable interface. Pages stored as markdown files with YAML frontmatter. Every page lives inside its own GUID-named folder — root pages at `{guid}/{guid}.md`, children at `{parent-guid}/{child-guid}/{child-guid}.md`. Versioning via S3 object versions. CRUD operations, hierarchy traversal, and move operations all tested including integration tests against LocalStack. Frontmatter includes `guid` and `folderId` fields in addition to the documented metadata fields.

> `backend/src/storage/` — StoragePlugin interface and S3 implementation
> `infrastructure/src/Infrastructure/Stacks/UnifiedStack.cs` — Single CDK stack with all resources

### Page Hierarchy (Spec 3) — Complete

Pages ARE folders. A page with children has a directory named after its GUID. Tree component with expand/collapse, drag-and-drop reparenting, context menu (rename, delete, move, new child). Circular reference prevention enforced server-side in both `BaseStoragePlugin.validateNoCircularReference()` and `pages-move.ts` API handler. No caching (Lambda ephemeral containers) — S3 sub-10ms latency is sufficient for 3-20 users.

> `frontend/src/components/` — Recursive tree component, drag-and-drop
> `backend/src/storage/BaseStoragePlugin.ts` — `validateNoCircularReference()` walks ancestor chain
> `backend/src/pages/pages-move.ts` — Second circular reference check at API boundary

### Page Editor (Spec 4) — Complete

CodeMirror 6 with markdown mode. Split-pane layout (edit | preview) with resizable divider. Markdown toolbar (bold, italic, headers, lists, links, images, code). react-markdown with remark-gfm, remark-breaks, rehype-highlight. Mermaid diagram support. Image resizing via Obsidian-style syntax (`![alt|300](url)`, `![alt|300x200](url)`, `![alt|50%](url)`) implemented as a custom remark plugin. **Manual save only** — autosave deferred to post-MVP. No unsaved changes warning on navigation.

> `frontend/src/components/` — Editor component, toolbar, preview
> `frontend/src/plugins/` — Remark plugins for wiki links, image sizing

### Page Links (Spec 5) — Complete

Wiki link syntax `[[Page Title]]` and `[[guid|Display Text]]`. Custom remark plugin converts wiki links to React components. Link resolution with fuzzy matching. Broken link detection with "Create Page" quick action. Link autocomplete triggered on `[[` input. Backlinks tracked in DynamoDB `page_links` table with GSI for reverse lookups. Links updated on page create and update.

**Internal link storage format**: Wiki links are stored as text in Markdown. The frontend parser (`wikiLinkParser.ts`) handles `[[Page Title]]` (type: `page-title`) and `[[guid|Display Text]]` (type: `page-guid`). At render time, the remark plugin resolves them.

**Known bug**: The backend link extractor (`link-extraction.ts`) uses a different syntax — `[[guid:abc-123]]` with a `guid:` prefix — which is incompatible with the frontend's `[[guid|Display Text]]` format. GUID-style links written by the editor will not be correctly tracked for backlinks by the backend.

**Known bug**: `pages-delete.ts` does not call `removePageLinks()`. Deleting a page leaves orphaned records in `page_links` — both outbound links from the deleted page and inbound backlink references to it.

> `frontend/src/plugins/` — Wiki link remark plugin
> `frontend/src/utils/wikiLinkParser.ts` — Link syntax parsing
> `backend/src/pages/link-extraction.ts` — Backend link extractor (different syntax)

### Page Attachments (Spec 6) — Complete

Attachments stored in pages bucket at `{pageGuid}/_attachments/` (derived from the page's S3 key by stripping the `.md` filename and appending `_attachments/`). For a root page at `{guid}/{guid}.md`, attachments go to `{guid}/_attachments/`. Sidecar `.meta.json` files for metadata (filename, contentType, size, uploadedAt, uploadedBy, optional dimensions/duration/checksum — no DynamoDB table). Upload via multipart/form-data with type validation (images, PDFs, docs) and size limits (10MB images, 50MB documents). Presigned URLs for download. Frontend has drag-and-drop upload, progress bars, image previews, and editor toolbar integration.

> `backend/src/storage/S3StoragePlugin.ts` — `buildAttachmentPath()`, attachment CRUD methods
> `frontend/src/components/` — Upload UI, attachment list, image preview

### Client-Side Search (Spec 7) — Complete

Fuse.js in browser. Lambda builds `search-index.json` on S3 events (page create/update/delete). **Only pages with `status === 'published'` are indexed** — drafts and archived pages are excluded from search. Index served with `Cache-Control: public, max-age=60`. Frontend fetches index, initializes Fuse.js, executes searches client-side. Search dialog (Cmd/Ctrl+K), result snippets with highlighting, keyboard navigation, folder-scoped search, title-only toggle, recent searches in localStorage. Accessibility (ARIA, screen reader announcements, focus management). Cost: $0/month.

> `frontend/src/components/` — SearchDialog component
> `frontend/src/utils/` — Search utilities, Fuse.js integration
> `backend/src/search/` — Search index builder, ISearchProvider interface

---

## What's Not Built

### User Management Admin UI (Spec 8) — Not Started

Backend invitation CRUD exists (create, list, revoke) but the admin dashboard UI for managing users does not. Missing: user list page, user detail modal, invitation management page, user edit form, profile page, activity logging. The Cognito integration APIs (list users, get user, update user, suspend, activate, delete) are not implemented.

### Page History & Versioning UI (Spec 9) — Not Started

S3 versioning is enabled and the storage plugin has `listVersions`. But no UI exists: no version history timeline, no diff viewer, no version comparison API, no restore functionality, no version metadata tracking beyond what S3 provides.

### Navigation & Discovery (Spec 10) — Not Started

No breadcrumbs, no table of contents, no sitemap view, no recent changes feed. The page tree sidebar exists but these complementary navigation aids do not.

### Permissions Enforcement (Spec 11) — Not Started

JWT contains role claims but no permission middleware enforces them on API endpoints. No draft visibility filtering. No UI role-based element visibility. The two-role model (Admin/Standard) is defined in Cognito but not enforced beyond basic auth.

### Mobile Optimization (Spec 12) — Not Started

Tailwind is configured but no responsive breakpoints defined. No hamburger menu, no collapsible navigation drawer, no mobile-optimized editor toolbar, no touch-friendly sizing.

### Dashboard (Spec 13) — Not Started

No landing page, no recent activity widget, no favorites, no stats.

### Export (Spec 14) — Not Started

No PDF or HTML export. Would need Puppeteer in Lambda for PDF generation.

### Comments (Spec 15) — Not Started

No comments DynamoDB table, no APIs, no UI.

### Page Metadata (Spec 16) — Partially Done

Tags, status, and category fields exist in page frontmatter and the editor has a properties panel. But no dedicated metadata API, no tag aggregation endpoint, no category listing, no metadata-based filtering in search.

### Admin Configuration (Spec 17) — Not Started

No site_config table, no config API, no admin settings UI, no system health dashboard.

### Onboarding & Help (Spec 18) — Not Started

No first-time tour, no contextual tooltips. Markdown help may partially exist via the editor toolbar.

### Error Handling (Spec 19) — Partial

Basic error boundaries likely exist in React. No structured offline mode, no conflict resolution UI, no retry logic, no monitoring/alerting. API Gateway throttling is configured (50 req/s sustained, burst 100) — returns 429 when exceeded. No per-endpoint rate limiting.

---

## Key Decisions Already Made

| Decision | Rationale |
|----------|-----------|
| Attachment download via URL redirect | API Gateway binary proxying failed three ways (isBase64Encoded + BinaryMediaTypes, BinaryMediaTypes: */*, base64 JSON envelope with fetch UTF-8 corruption). Current approach: Lambda returns presigned URL in JSON, frontend loads binary directly from S3. Storage-plugin-agnostic via `getAttachmentUrl()`. See `docs/attachment-download-architecture.md` for full investigation. |
| Pages-as-folders in S3 | No separate folder entity; hierarchy from S3 paths. Simple, avoids data model complexity |
| YAML frontmatter for metadata | Self-contained pages; no external metadata store needed for page-level data |
| Cognito for auth | Managed service, invite-only via custom invitation flow |
| DynamoDB for relational data | Links, invitations, profiles — access-pattern-driven design |
| Client-side search default | $0/month, sufficient for 3-20 users and <500 pages |
| Manual save only (MVP) | Autosave complexity deferred; manual save + dirty state indicator |
| No frontend caching (MVP) | `@tanstack/react-query` is installed but caching behaviour deferred; fresh fetches acceptable at low user count |
| Sidecar .meta.json for attachments | Simpler than DynamoDB table; metadata lives with the file |
| Aspire for local dev | Orchestrates frontend, backend, LocalStack, MailHog in one command |
| CDK with C# for IaC | Type-safe infrastructure, single unified stack containing all resources |

---

## Known Performance Issue — Resolved

`S3StoragePlugin.findPageKey()` previously resolved a page GUID to an S3 key by listing the entire bucket (O(n)) for non-root pages. **This is now resolved** by the Page Index — a DynamoDB table (`page_index`) providing O(1) GUID-to-S3-key lookups. The index is maintained atomically with S3 writes (save, move, delete) and self-repairs on cache miss by falling back to S3 scan and writing the result back to the index. A `rebuild-page-index` utility handles initial migration and recovery. See [Plan: Page Index](plans/page-index.md).

---

## MVP Simplifications In Effect

1. **No autosave** — Manual save only. Changes lost on navigation. Post-MVP: debounced autosave with localStorage backup.
2. **No client caching** — Every request fetches fresh. Post-MVP: React Query with 5-min TTL, CloudFront API caching.
3. **No CloudFront cache invalidation** — Search index may be stale until CDN TTL expires.

---

## Infrastructure State

| Component | Status |
|-----------|--------|
| CDK (C#) | Single `UnifiedStack` containing all resources (auth, storage, database, compute, CDN) |
| Cognito | **Fully in CDK** — UserPool, clients, identity pool, domain, 4 trigger Lambdas |
| S3 buckets | Two: `bluefinwiki-pages-{env}` (versioning on), `bluefinwiki-frontend-{env}` (versioning off) |
| DynamoDB tables | user_profiles, invitations, page_links, activity_log — all deployed |
| Lambda functions | Individual functions per endpoint (~14 for pages + 4 auth triggers + search index builder) |
| API Gateway | REST API (v1) with Cognito authorizer on all routes. Throttling: 50 req/s, burst 100 |
| GitHub Actions | Frontend build/test, backend build/test active. CDK synth **disabled** (.old). Deploy is **production-only, manual trigger** |
| Aspire | Local orchestration: LocalStack, cognito-local, MailHog, backend, frontend |
| Frontend state | React Context (auth) + hand-rolled stores (drafts, layout) + `@tanstack/react-query` installed |

---

## Cost Profile

Target: <$5/month for a 5-user family wiki.

| Service | Estimated Cost |
|---------|---------------|
| S3 | <$0.10/month (small storage, infrequent access) |
| DynamoDB | <$0.50/month (on-demand, low traffic) |
| Lambda | <$0.50/month (low invocation count) |
| Cognito | Free tier (first 50,000 MAU) |
| CloudFront | <$1.00/month (low bandwidth) |
| API Gateway | <$0.50/month (low request count) |
| **Total** | **~$2-3/month** |

---

## Stale Source Documents

TECHNICAL-PLAN.md contains database schemas that contradict the committed architecture. An agent reading it would try to create tables that shouldn't exist:

| TECHNICAL-PLAN.md says | Actual decision |
|------------------------|-----------------|
| `folders` DynamoDB table | Pages-as-folders in S3, no separate folder entity |
| `pages_metadata` DynamoDB table | Metadata in YAML frontmatter inside S3 .md files |
| `attachments` DynamoDB table | Sidecar `.meta.json` files in S3 |
| CloudSearch for full-text search | Client-side Fuse.js ($0/month) |

TECHNICAL-PLAN.md also references JWT delivery via httpOnly cookies — the actual implementation uses Bearer tokens in the Authorization header with `localStorage` storage.

**These old documents should not be used for new work.** The ODAD documents (`docs/odad/`) are the source of truth.

---

## Unresolved Design Questions

1. **Deletion strategy** — Page deletion is hard-delete (remove S3 objects). No trash/restore mechanism exists. Recoverability only via S3 versioning.
2. **Move operation atomicity** — `movePage` does S3 copy + delete. If copy succeeds but delete fails, duplicates exist. No detection or cleanup mechanism.
3. **Display path resolution** — GUIDs are used for internal references, but human-readable URLs need a `displayPath→GUID` mapping. The `page_index` table solves GUID→S3 key, not display path→GUID.
4. **Wiki link format mismatch** — Frontend uses `[[guid|Display Text]]`, backend extractor uses `[[guid:abc-123]]`. Backlinks for GUID-style links are not tracked correctly.
5. **Markdown sanitization** — No DOMPurify or rehype-sanitize in the rendering pipeline. Tokens stored in `localStorage` are vulnerable to XSS. This is a real security gap.

---

## What This Means for ODAD

The speckit produced 19 feature specifications with user stories, functional requirements, and technical implementation notes. These map to ODAD layers:

- **User stories** become **north star declarations** — what family members should be able to do
- **Process descriptions** (auth flows, editing, search) become **flows** — stages, actors, failure modes
- **Technical plan + database schema + architecture** become **design** — the committed architecture
- **Unchecked tasks for unbuilt features** become **plans** — EARS truth statements for what agents build next

Built features need no plans — the code is the truth. Plans are only needed for the gap between the declaration and current reality.
