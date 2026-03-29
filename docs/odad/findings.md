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

Invite-only auth using AWS Cognito. Backend Lambda functions handle registration, login, password reset, and invitation management. Cognito triggers (pre-token-generation, post-confirmation, custom-message) extend the auth flow. Frontend has login, registration, and password reset pages with React Context for auth state. JWT validation middleware protects API endpoints.

> `backend/src/auth/` — Lambda handlers for all auth flows
> `frontend/src/contexts/` — AuthContext with Cognito integration
> `backend/src/middleware/` — JWT validation

### Storage Plugin (Spec 2) — Complete

S3StoragePlugin implements a pluggable interface. Pages stored as markdown files with YAML frontmatter. Hierarchy expressed through S3 paths: root pages at `{guid}.md`, children at `{parent-guid}/{child-guid}.md`. Versioning via S3 object versions. CRUD operations, hierarchy traversal, and move operations all tested including integration tests against LocalStack.

> `backend/src/storage/` — StoragePlugin interface and S3 implementation
> `infrastructure/` — CDK stacks (C#) for S3, DynamoDB, Lambda, CloudFront

### Page Hierarchy (Spec 3) — Complete

Pages ARE folders. A page with children has a directory named after its GUID. Tree component with expand/collapse, drag-and-drop reparenting, context menu (rename, delete, move, new child), and circular reference prevention. No caching (Lambda ephemeral containers) — S3 sub-10ms latency is sufficient for 3-20 users.

> `frontend/src/components/` — Recursive tree component, drag-and-drop
> `backend/src/storage/` — Hierarchy traversal, ancestor path, descendant checks

### Page Editor (Spec 4) — Complete

CodeMirror 6 with markdown mode. Split-pane layout (edit | preview) with resizable divider. Markdown toolbar (bold, italic, headers, lists, links, images, code). react-markdown with remark-gfm, remark-breaks, rehype-highlight. Mermaid diagram support. **Manual save only** — autosave deferred to post-MVP. No unsaved changes warning on navigation.

> `frontend/src/components/` — Editor component, toolbar, preview
> `frontend/src/plugins/` — Remark plugins for wiki links, images

### Page Links (Spec 5) — Complete

Wiki link syntax `[[Page Title]]` and `[[guid|Display Text]]`. Custom remark plugin converts wiki links to React components. Link resolution with fuzzy matching. Broken link detection with "Create Page" quick action. Link autocomplete triggered on `[[` input. Backlinks tracked in DynamoDB `page_links` table with GSI for reverse lookups.

> `frontend/src/plugins/` — Wiki link remark plugin
> `backend/src/storage/` — Link resolution and backlinks

### Page Attachments (Spec 6) — Complete

Attachments stored in pages bucket at `{pageGuid}/{pageGuid}/_attachments/`. Sidecar `.meta.json` files for metadata (no DynamoDB table). Upload via multipart/form-data with type validation (images, PDFs, docs) and size limits (10MB images, 50MB documents). Presigned URLs for download. Frontend has drag-and-drop upload, progress bars, image previews, and editor toolbar integration.

> `backend/src/storage/` — Attachment methods on S3StoragePlugin
> `frontend/src/components/` — Upload UI, attachment list, image preview

### Client-Side Search (Spec 7) — Complete

Fuse.js in browser. Lambda builds `search-index.json` on S3 events (page create/update/delete). Frontend fetches index, initializes Fuse.js, executes searches client-side. Search dialog (Cmd/Ctrl+K), result snippets with highlighting, keyboard navigation, folder-scoped search, title-only toggle, recent searches in localStorage. Accessibility (ARIA, screen reader announcements, focus management). Cost: $0/month.

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

Basic error boundaries likely exist in React. No structured offline mode, no conflict resolution UI, no rate limiting beyond search debounce, no retry logic, no monitoring/alerting.

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
| No frontend caching (MVP) | React Query caching deferred; fresh fetches acceptable at low user count |
| Sidecar .meta.json for attachments | Simpler than DynamoDB table; metadata lives with the file |
| Aspire for local dev | Orchestrates frontend, backend, LocalStack, MailHog in one command |
| CDK with C# for IaC | Type-safe infrastructure, multi-stack (network, storage, database, compute, CDN) |

---

## MVP Simplifications In Effect

1. **No autosave** — Manual save only. Changes lost on navigation. Post-MVP: debounced autosave with localStorage backup.
2. **No client caching** — Every request fetches fresh. Post-MVP: React Query with 5-min TTL, CloudFront API caching.
3. **No CloudFront cache invalidation** — Search index may be stale until CDN TTL expires.

---

## Infrastructure State

| Component | Status |
|-----------|--------|
| CDK stacks (C#) | Deployed: Network, Storage, Database, Compute, CDN |
| Auth stack (Cognito) | **Not in CDK** — task unchecked; Cognito may be manually configured |
| S3 pages bucket | Deployed with versioning |
| DynamoDB tables | user_profiles, invitations, page_links deployed |
| Lambda functions | Auth, pages CRUD, links, attachments, search index builder |
| API Gateway | REST API with Cognito authorizer |
| GitHub Actions | Frontend build/test, backend build/test, CDK synth, deploy to dev |
| Aspire | Local orchestration working |
| LocalStack | S3, DynamoDB, SES emulation |
| MailHog | Local email testing |

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

## What This Means for ODAD

The speckit produced 19 feature specifications with user stories, functional requirements, and technical implementation notes. These map to ODAD layers:

- **User stories** become **north star declarations** — what family members should be able to do
- **Process descriptions** (auth flows, editing, search) become **flows** — stages, actors, failure modes
- **Technical plan + database schema + architecture** become **design** — the committed architecture
- **Unchecked tasks for unbuilt features** become **plans** — EARS truth statements for what agents build next

Built features need no plans — the code is the truth. Plans are only needed for the gap between the declaration and current reality.
