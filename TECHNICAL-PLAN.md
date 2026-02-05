# BlueFinWiki - Technical Implementation Plan

**Project**: BlueFinWiki - Family Wiki Platform  
**Architecture**: Pluggable, serverless, AWS-based  
**Created**: February 6, 2026  
**Status**: Ready for Implementation

---

## 📋 Table of Contents

1. [Executive Summary](#executive-summary)
2. [Technology Stack](#technology-stack)
3. [Architecture Overview](#architecture-overview)
4. [Implementation Phases](#implementation-phases)
5. [Development Setup](#development-setup)
6. [Core Infrastructure](#core-infrastructure)
7. [Feature Implementation Order](#feature-implementation-order)
8. [Database Schema](#database-schema)
9. [API Design](#api-design)
10. [Security Implementation](#security-implementation)
11. [Testing Strategy](#testing-strategy)
12. [Deployment Pipeline](#deployment-pipeline)
13. [Cost Estimation](#cost-estimation)
14. [Risk Mitigation](#risk-mitigation)
15. [Post-MVP Roadmap](#post-mvp-roadmap)

---

## Executive Summary

BlueFinWiki is a family-focused wiki platform designed for 3-20 users with pluggable architecture, serverless deployment, and AWS-native storage. This plan outlines the technical implementation strategy for delivering the MVP (19 specifications) in **12-16 weeks** with a team of 2-3 developers.

### Key Metrics
- **Target Users**: 3-20 family members per wiki instance
- **Target Cost**: < $5/month for typical family usage
- **Performance**: < 200ms page load, < 1s search results
- **Uptime**: 99.9% (leveraging AWS infrastructure)

### Success Criteria
- ✅ All P1 features operational (Specs 1-11, 17-19 core)
- ✅ Mobile-responsive on iOS/Android
- ✅ WCAG 2.1 AA accessibility compliance
- ✅ Zero-knowledge deployment via Terraform/CloudFormation
- ✅ < $5/month operational cost for 5-user family

---

## Technology Stack

### Frontend
- **Framework**: React 18.x with TypeScript
- **Build Tool**: Vite 5.x
- **UI Library**: Tailwind CSS 3.x
- **State Management**: React Context API + React Query
- **Markdown Rendering**: react-markdown with remark plugins
- **Code Editor**: CodeMirror 6 (for Markdown editing)
- **PDF Export**: jsPDF or Puppeteer (Lambda)
- **Routing**: React Router v6

**Rationale**:
- React: Industry standard, large ecosystem, excellent TypeScript support
- Vite: Fast builds, modern tooling, better DX than CRA
- Tailwind: Utility-first, responsive design, consistent styling
- React Query: Server state management, caching, optimistic updates

### Backend
- **API**: AWS API Gateway (REST)
- **Compute**: AWS Lambda (Node.js 20.x)
- **Authentication**: Custom JWT implementation (no session tracking)
- **Storage**: 
  - AWS S3 (pages, folders, attachments)
  - AWS DynamoDB (metadata, user data, comments)
- **Search**: AWS CloudSearch or OpenSearch Serverless
- **Email**: AWS SES (invitations, password resets)

**Rationale**:
- Lambda: True serverless, pay-per-use, auto-scaling
- S3: Durable storage, GUID-based architecture, versioning support
- DynamoDB: Single-digit ms latency, serverless, predictable pricing
- CloudSearch: Managed search, lower cost than Elasticsearch for small datasets

### Infrastructure
- **IaC**: AWS CDK (C#) or Terraform
- **Hosting**: AWS S3 + CloudFront (static SPA)
- **CI/CD**: GitHub Actions
- **Monitoring**: AWS CloudWatch + X-Ray
- **Secrets**: AWS Secrets Manager

### Development Tools
- **Version Control**: Git + GitHub
- **Package Manager**: npm or pnpm
- **Linting**: ESLint + Prettier
- **Testing**:
  - Unit: Vitest
  - Integration: Vitest + MSW (Mock Service Worker)
  - E2E: Playwright
- **API Testing**: Bruno or Postman
- **Local Development**: Docker (optional, for DynamoDB Local)

---

## Architecture Overview

### Pluggable Architecture Pattern

```
┌─────────────────────────────────────────────────────────┐
│                   Frontend (React SPA)                   │
│  ┌─────────────┐  ┌────────────┐  ┌─────────────────┐  │
│  │  UI Layer   │  │  Business  │  │  Plugin System  │  │
│  │ (Components)│→ │   Logic    │→ │   (Storage)     │  │
│  └─────────────┘  └────────────┘  └─────────────────┘  │
└────────────────────────────┬────────────────────────────┘
                             │ REST API
┌────────────────────────────┴────────────────────────────┐
│              AWS API Gateway + Lambda                    │
│  ┌──────────────────┐  ┌────────────────────────────┐  │
│  │  Auth Service    │  │  Storage Plugin Interface  │  │
│  │  (JWT, Invites)  │  │  (Abstract)                │  │
│  └──────────────────┘  └────────────┬───────────────┘  │
│  ┌──────────────────┐               │                   │
│  │  DynamoDB        │               ▼                   │
│  │  (Users, Meta)   │  ┌──────────────────────────┐    │
│  └──────────────────┘  │  S3 Storage Plugin       │    │
│                        │  (Pages, Folders, Files)  │    │
│                        └──────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

### Request Flow Examples

**Page Load**:
1. User requests `/page/{guid}`
2. CloudFront serves React SPA
3. React app calls API Gateway `/api/pages/{guid}`
4. Lambda validates JWT, checks permissions
5. Lambda calls S3 Storage Plugin → retrieves page JSON
6. Lambda fetches metadata from DynamoDB
7. Response returned to frontend
8. React renders Markdown content

**Search Query**:
1. User types in search box (debounced)
2. API call to `/api/search?q={query}`
3. Lambda queries CloudSearch index
4. Results filtered by permissions
5. Ranked results returned with snippets
6. React displays results with highlighting

---

## Implementation Phases

### Phase 1: Foundation (Weeks 1-3)
**Goal**: Core infrastructure and authentication

#### Week 1: Project Setup
- [ ] Initialize monorepo structure (frontend + backend + infrastructure)
- [ ] Configure AWS CDK/Terraform for IaC
- [ ] Set up GitHub repository with branch protection
- [ ] Configure GitHub Actions CI/CD pipelines
- [ ] Create development, staging, and production environments
- [ ] Set up DynamoDB tables (users, metadata schema)
- [ ] Configure S3 buckets (pages, attachments, exports)
- [ ] Set up CloudFront distribution for frontend

**Deliverables**:
- Repository with README and contributing guidelines
- Working CI/CD pipeline (build, test, deploy)
- AWS infrastructure deployed to dev environment
- Environment variables and secrets management

#### Week 2: Authentication System (Spec #1)
- [ ] Implement JWT token generation/validation
- [ ] Create DynamoDB schema for users table
- [ ] Build Lambda functions:
  - `/auth/login` (email/password validation)
  - `/auth/register` (invite code validation)
  - `/auth/refresh` (token refresh)
  - `/auth/logout` (cookie clearing)
- [ ] Configure AWS SES for email sending
- [ ] Implement password reset flow with secure tokens
- [ ] Create invitation code generation system
- [ ] Build frontend login/registration UI
- [ ] Implement secure cookie handling (httpOnly, SameSite)

**Deliverables**:
- Working authentication system with invite codes
- Email templates (invitation, password reset)
- Protected API routes with JWT middleware
- Login/register forms with validation

#### Week 3: Storage Plugin Interface (Spec #2)
- [ ] Design storage plugin interface (TypeScript)
- [ ] Implement S3 Storage Plugin:
  - GUID generation for pages/folders
  - JSON serialization/deserialization
  - Versioning support (S3 object versions)
  - Metadata storage in object tags
- [ ] Create Lambda functions:
  - `savePage(guid, content)` → S3 PUT
  - `loadPage(guid)` → S3 GET
  - `deletePage(guid)` → S3 DELETE
  - `listVersions(guid)` → S3 list object versions
- [ ] Implement error handling for S3 operations
- [ ] Write integration tests for storage plugin

**Deliverables**:
- Storage plugin interface with S3 implementation
- Page/folder CRUD operations working end-to-end
- Unit + integration tests (80%+ coverage)

---

### Phase 2: Core Features (Weeks 4-7)
**Goal**: Folders, pages, editor, links

#### Week 4: Folder Management (Spec #3)
- [ ] Extend S3 Storage Plugin for folders
- [ ] Implement folder hierarchy in DynamoDB:
  - `folders` table: `{guid, name, parentGuid, createdBy, createdAt}`
  - GSI on `parentGuid` for tree traversal
- [ ] Build Lambda functions:
  - `/folders` POST (create folder)
  - `/folders/{guid}` GET (folder details + children)
  - `/folders/{guid}` PUT (rename)
  - `/folders/{guid}` DELETE (recursive delete with confirmation)
  - `/folders/{guid}/move` PUT (reparent folder)
- [ ] Create frontend folder tree component (recursive)
- [ ] Implement drag-and-drop folder reorganization
- [ ] Add folder context menu (rename, delete, move)

**Deliverables**:
- Working folder hierarchy with CRUD operations
- Sidebar folder tree with expand/collapse
- Drag-and-drop support for reorganization

#### Week 5: Page Editor (Spec #4)
- [ ] Integrate CodeMirror 6 with Markdown mode
- [ ] Build split-pane editor (Markdown | Preview)
- [ ] Implement live preview with react-markdown
- [ ] Add autosave with debounce (5s)
- [ ] Create page CRUD endpoints:
  - `/pages` POST (create page in folder)
  - `/pages/{guid}` GET (load page content)
  - `/pages/{guid}` PUT (save page)
  - `/pages/{guid}` DELETE (soft delete → archive)
- [ ] Build frontend editor component
- [ ] Add Markdown toolbar (bold, italic, headers, lists, links)
- [ ] Implement unsaved changes warning
- [ ] Add page title inline editing

**Deliverables**:
- Working Markdown editor with live preview
- Autosave functionality with loading indicators
- Page CRUD operations integrated

#### Week 6: Page Links (Spec #5)
- [ ] Implement wiki link syntax parser: `[[Page Title]]` or `[[guid]]`
- [ ] Build link resolution service:
  - Search by title across pages
  - Resolve GUIDs to page titles
  - Handle broken links (show warning)
- [ ] Create link suggestion dropdown (autocomplete)
- [ ] Implement "Create Page" from broken link
- [ ] Add external link support with icon indicator
- [ ] Build backlinks tracking:
  - DynamoDB table: `page_links` (sourceGuid, targetGuid)
  - Update on page save
- [ ] Create "Linked Pages" sidebar widget

**Deliverables**:
- Wiki-style internal links working
- Link autocomplete with fuzzy search
- Broken link indicators with quick-create
- Backlinks displayed on page view

#### Week 7: Page Attachments (Spec #6)
- [ ] Build file upload UI (drag-and-drop + file picker)
- [ ] Create multipart upload handler for large files
- [ ] Implement Lambda upload endpoint:
  - Generate presigned S3 URLs for direct upload
  - `/pages/{pageGuid}/attachments` POST
  - Validate file types/sizes (50MB limit MVP)
- [ ] Store attachment metadata in DynamoDB:
  - `attachments` table: `{guid, pageGuid, filename, size, mimeType, uploadedBy, uploadedAt}`
- [ ] Create attachment list component
- [ ] Implement download with presigned URLs
- [ ] Add attachment preview for images
- [ ] Build delete attachment functionality

**Deliverables**:
- File upload with progress indicator
- Attachment management (list, download, delete)
- Image preview thumbnails
- Presigned URL generation for secure downloads

---

### Phase 3: Search & Users (Weeks 8-9)
**Goal**: Full-text search, user management

#### Week 8: Wiki Search (Spec #7)
- [ ] Set up AWS CloudSearch domain:
  - Configure document schema (title, content, tags, metadata)
  - Define search fields and weights
  - Create IAM roles for Lambda access
- [ ] Build search indexer Lambda (triggered on page save):
  - Extract text from Markdown
  - Update CloudSearch document
  - Handle indexing failures
- [ ] Implement search API:
  - `/search?q={query}&folder={guid}` GET
  - Parse query, apply filters
  - Respect permissions (filter by user access)
  - Return ranked results with snippets
- [ ] Create search UI:
  - Global search bar with keyboard shortcut (Cmd/Ctrl+K)
  - Results page with highlighting
  - Faceted filters (folder, author, date range)
- [ ] Add search suggestions (autocomplete)

**Deliverables**:
- Full-text search across pages
- Search results with relevance ranking
- Folder-scoped search option
- Search indexing on page updates

#### Week 9: User Management (Spec #8)
- [ ] Build admin user management UI
- [ ] Create user CRUD endpoints:
  - `/admin/users` GET (list all users)
  - `/admin/users/{id}` GET (user details)
  - `/admin/users/{id}` PUT (update profile, role)
  - `/admin/users/{id}` DELETE (soft delete)
  - `/admin/users/{id}/suspend` POST (disable account)
- [ ] Implement invitation system:
  - `/admin/invitations` POST (generate invite code)
  - Email invitation with registration link
  - Invitation expiry (7 days default)
- [ ] Add user profile page (view-only for standard users)
- [ ] Create admin dashboard:
  - User list with search/filter
  - Recent activity log
  - Role assignment (Admin/Standard)

**Deliverables**:
- Admin user management interface
- Invitation code generation + email
- User suspension/reactivation
- User profile view

---

### Phase 4: History & Navigation (Weeks 10-11)
**Goal**: Page versioning, site navigation

#### Week 10: Page History (Spec #9)
- [ ] Enable S3 versioning on pages bucket
- [ ] Build version retrieval Lambda:
  - `/pages/{guid}/versions` GET (list versions)
  - `/pages/{guid}/versions/{versionId}` GET (retrieve version)
  - `/pages/{guid}/restore/{versionId}` POST (restore version)
- [ ] Create version comparison service:
  - Use `diff` library for text comparison
  - Generate side-by-side or inline diff view
  - `/pages/{guid}/compare?from={v1}&to={v2}` GET
- [ ] Implement history UI:
  - Version timeline with author + timestamp
  - Diff viewer with syntax highlighting
  - Restore button with confirmation
- [ ] Add change attribution (who edited what)
- [ ] Store version metadata in DynamoDB:
  - `page_versions` table: `{pageGuid, versionId, author, timestamp, changeDescription}`

**Deliverables**:
- Page version history with timeline
- Side-by-side diff viewer
- One-click version restore
- Change attribution tracking

#### Week 11: Navigation & Discovery (Spec #10)
- [ ] Implement breadcrumb navigation:
  - Traverse folder hierarchy from root
  - Display path: Home > Folder > Subfolder > Page
  - Clickable breadcrumb links
- [ ] Build table of contents generator:
  - Parse Markdown headers (h2-h6)
  - Generate anchor links
  - Sticky TOC sidebar (desktop)
  - Collapsible mobile TOC
- [ ] Create sitemap view:
  - Tree visualization of all folders/pages
  - Expandable/collapsible nodes
  - Search within sitemap
- [ ] Add "Recent Changes" feed (P3 - optional for MVP):
  - `/recent?limit={n}&days={d}` GET
  - Display recent page edits with diff links

**Deliverables**:
- Breadcrumb navigation on all pages
- Auto-generated table of contents
- Full sitemap view with search

---

### Phase 5: Permissions & Mobile (Week 12)
**Goal**: Role-based access, responsive design

#### Week 12: Permissions + Mobile
- [ ] **Page Permissions (Spec #11)**:
  - Implement role checking middleware (Admin vs. Standard)
  - Apply permission filters to search results
  - Hide admin routes from standard users
  - Add "Admin" badge in UI for admin users
  - Implement draft status visibility (author + admins only)
  
- [ ] **Mobile Experience (Spec #12)**:
  - Responsive breakpoints (mobile: < 768px, tablet: 768-1024px, desktop: > 1024px)
  - Mobile navigation (hamburger menu)
  - Touch-friendly buttons (min 44x44px)
  - Mobile-optimized editor:
    - Simplified toolbar
    - Bottom toolbar placement
    - Markdown shortcuts helper
  - Test on iOS Safari and Android Chrome
  - Implement swipe gestures (optional):
    - Swipe right: open sidebar
    - Swipe left: close sidebar

**Deliverables**:
- Two-role permission system enforced
- Mobile-responsive UI for all pages
- Touch-optimized editor
- Cross-browser mobile testing passed

---

### Phase 6: Advanced Features (Week 13)
**Goal**: Dashboard, exports, comments

#### Week 13A: Home/Dashboard (Spec #13)
- [ ] Build dashboard layout:
  - Welcome message with user name
  - Recent activity widget (last 10 edited pages)
  - Quick links section (editable by user)
  - "Favorite Pages" list (stored in user preferences)
- [ ] Create dashboard API:
  - `/dashboard` GET (recent activity, stats)
  - `/dashboard/favorites` POST/DELETE (manage favorites)
- [ ] Implement activity tracking:
  - Store page views/edits in DynamoDB
  - `activity_log` table: `{userId, pageGuid, action, timestamp}`

**Deliverables**:
- Dashboard as default landing page
- Recent activity feed
- Favorite pages management

#### Week 13B: Export Functionality (Spec #14)
- [ ] **PDF Export**:
  - Use Puppeteer in Lambda (headless Chrome)
  - `/pages/{guid}/export/pdf` GET
  - Render Markdown as HTML → PDF
  - Include page metadata (title, author, date)
  - Store temporary PDFs in S3 (expires in 1 hour)
  
- [ ] **HTML Export**:
  - `/folders/{guid}/export/html` GET (export folder tree)
  - Generate static HTML files with navigation
  - Bundle attachments in ZIP
  - CSS styling for offline viewing

**Deliverables**:
- Single-page PDF export
- Folder HTML export with bundled assets

---

### Phase 7: Collaboration & Metadata (Week 14)
**Goal**: Comments, tags, metadata

#### Week 14A: Page Comments (Spec #15)
- [ ] Create comments data model in DynamoDB:
  - `comments` table: `{guid, pageGuid, userId, content, parentGuid, createdAt, updatedAt}`
  - LSI on `pageGuid` + `createdAt` for chronological retrieval
- [ ] Build comments API:
  - `/pages/{pageGuid}/comments` GET/POST
  - `/comments/{guid}` PUT/DELETE (edit/delete own comments)
  - `/comments/{guid}/reply` POST (threaded replies)
- [ ] Implement comments UI:
  - Comment section below page content
  - Markdown support in comments (same renderer)
  - Reply button for threaded discussions
  - Edit/delete for comment authors + admins
- [ ] Add @mention parsing (optional P3):
  - Parse `@username` in comments
  - Store mentions for future notifications

**Deliverables**:
- Comment system with threading
- Edit/delete comments
- Markdown rendering in comments

#### Week 14B: Page Metadata (Spec #16)
- [ ] Extend page schema with metadata fields:
  - `pages_metadata` table: `{pageGuid, tags, category, status, customFields}`
  - Tags: array of strings (searchable)
  - Category: single value (from predefined list)
  - Status: draft | published | archived
- [ ] Build metadata API:
  - `/pages/{guid}/metadata` GET/PUT
  - `/tags` GET (list all tags with counts)
  - `/categories` GET (list categories)
- [ ] Create metadata UI:
  - Tag input with autocomplete
  - Category dropdown
  - Status selector (draft visible only to author + admins)
  - Custom metadata fields (key-value pairs)
- [ ] Update search indexer to include metadata
- [ ] Add tag cloud widget to dashboard

**Deliverables**:
- Tag management system
- Page status (draft/published/archived)
- Category organization
- Custom metadata fields

---

### Phase 8: Administration & UX (Week 15)
**Goal**: Admin panel, onboarding, help

#### Week 15A: Admin Configuration (Spec #17)
- [ ] Build admin configuration panel:
  - Site settings (wiki name, tagline, logo)
  - Theme customization (primary color, font family)
  - Module toggles (enable/disable features)
  - Email settings (SMTP config for SES)
- [ ] Create settings API:
  - `/admin/settings` GET/PUT
  - Store in DynamoDB `site_settings` table
  - Cache settings in CloudFront for performance
- [ ] Implement system health monitoring:
  - S3 connection test
  - DynamoDB read/write test
  - CloudSearch availability check
  - Display health status in admin dashboard
- [ ] Add usage statistics:
  - Total pages/folders
  - Storage used (S3 bucket size)
  - Active users count
  - Recent errors log

**Deliverables**:
- Admin settings interface
- Theme customization (color, logo)
- System health dashboard

#### Week 15B: Onboarding & Help (Spec #18)
- [ ] Create first-time user tour:
  - Guided walkthrough (library: react-joyride)
  - Highlight key UI elements (sidebar, editor, search)
  - "Skip Tour" and "Next" buttons
  - Mark tour as completed in user preferences
- [ ] Build Markdown help modal:
  - Cheat sheet for Markdown syntax
  - Live examples (type Markdown → see preview)
  - Keyboard shortcuts reference
  - Link to full Markdown guide
- [ ] Add contextual tooltips:
  - Hover tooltips for icon buttons
  - Help icon (?) next to complex fields
  - Status indicators with explanations
- [ ] Create help center page:
  - FAQ section
  - Video tutorials (optional)
  - Contact support form

**Deliverables**:
- First-time user onboarding tour
- Markdown help reference
- Contextual tooltips throughout UI

---

### Phase 9: Error Handling & Polish (Week 16)
**Goal**: Production-ready reliability

#### Week 16: Error Handling (Spec #19) + QA
- [ ] **Error Handling Implementation**:
  - AWS service failure handling:
    - S3 outage: Cache last known state, retry with exponential backoff
    - DynamoDB throttling: Implement retry logic with jitter
    - CloudSearch unavailable: Degrade gracefully (show cached results)
  - Concurrent edit conflict resolution:
    - Detect version mismatch on save
    - Show "Conflict Detected" modal with options:
      - View current version
      - Overwrite (with warning)
      - Save as new version
  - Network failure handling:
    - Offline detection (navigator.onLine)
    - Show "Offline" banner
    - Queue failed requests for retry
  - Form validation errors:
    - Client-side validation (Zod or Yup)
    - Server-side validation with detailed error messages
    - Display errors inline with field highlighting
  
- [ ] **Global Error Boundaries**:
  - React error boundary for unhandled exceptions
  - Fallback UI with "Something went wrong" message
  - Error logging to CloudWatch
  
- [ ] **QA & Testing**:
  - Run full E2E test suite (Playwright)
  - Cross-browser testing (Chrome, Firefox, Safari, Edge)
  - Mobile testing (iOS Safari, Android Chrome)
  - Accessibility audit (WAVE, axe DevTools)
  - Performance testing (Lighthouse, WebPageTest)
  - Security scan (OWASP ZAP, npm audit)
  - Load testing (Artillery.io or k6)

**Deliverables**:
- Robust error handling across all features
- Graceful degradation for service failures
- Full test suite passing (unit, integration, E2E)
- Accessibility WCAG 2.1 AA compliance
- Security vulnerabilities addressed

---

## Database Schema

### DynamoDB Tables

#### `users` Table
```typescript
interface User {
  userId: string;              // PK: GUID
  email: string;               // GSI: email-index
  passwordHash: string;        // bcrypt
  role: 'admin' | 'standard';
  displayName: string;
  invitedBy: string;           // userId of inviter
  inviteCode: string;          // Used during registration
  createdAt: string;           // ISO 8601
  lastLoginAt: string;
  isActive: boolean;           // For suspension
  preferences: {
    favoritePages: string[];   // Array of page GUIDs
    theme: 'light' | 'dark';
    tourCompleted: boolean;
  };
}

// Indexes:
// - PK: userId
// - GSI: email-index (email → userId)
```

#### `folders` Table
```typescript
interface Folder {
  folderGuid: string;          // PK: GUID
  name: string;
  parentGuid: string | null;   // GSI: parent-index
  createdBy: string;           // userId
  createdAt: string;
  updatedAt: string;
  isDeleted: boolean;
}

// Indexes:
// - PK: folderGuid
// - GSI: parent-index (parentGuid + createdAt → folderGuid)
```

#### `pages_metadata` Table
```typescript
interface PageMetadata {
  pageGuid: string;            // PK: GUID
  title: string;
  folderGuid: string;          // GSI: folder-index
  createdBy: string;           // userId
  createdAt: string;
  updatedAt: string;
  updatedBy: string;           // userId
  tags: string[];              // Array for search
  category: string;
  status: 'draft' | 'published' | 'archived';
  customFields: Record<string, string>;
  isDeleted: boolean;
}

// Indexes:
// - PK: pageGuid
// - GSI: folder-index (folderGuid + updatedAt → pageGuid)
// - GSI: status-index (status + updatedAt)
```

#### `attachments` Table
```typescript
interface Attachment {
  attachmentGuid: string;      // PK: GUID
  pageGuid: string;            // GSI: page-index
  filename: string;
  fileSize: number;            // Bytes
  mimeType: string;
  s3Key: string;               // S3 object key
  uploadedBy: string;          // userId
  uploadedAt: string;
}

// Indexes:
// - PK: attachmentGuid
// - GSI: page-index (pageGuid → attachmentGuid)
```

#### `comments` Table
```typescript
interface Comment {
  commentGuid: string;         // PK: GUID
  pageGuid: string;            // GSI: page-index
  userId: string;
  content: string;             // Markdown
  parentGuid: string | null;   // For threading
  createdAt: string;           // SK in page-index
  updatedAt: string;
  isDeleted: boolean;
}

// Indexes:
// - PK: commentGuid
// - GSI: page-index (pageGuid + createdAt → commentGuid)
```

#### `page_versions` Table
```typescript
interface PageVersion {
  pageGuid: string;            // PK
  versionId: string;           // SK: S3 version ID
  author: string;              // userId
  timestamp: string;
  changeDescription: string;   // Optional commit message
}

// Indexes:
// - PK: pageGuid, SK: versionId (sorted by timestamp)
```

#### `activity_log` Table
```typescript
interface ActivityLog {
  logId: string;               // PK: GUID
  userId: string;              // GSI: user-index
  pageGuid: string;
  action: 'view' | 'edit' | 'create' | 'delete';
  timestamp: string;           // SK in user-index
  details: Record<string, any>;
}

// Indexes:
// - PK: logId
// - GSI: user-index (userId + timestamp)
// TTL: 90 days (for data retention)
```

#### `site_settings` Table
```typescript
interface SiteSettings {
  settingKey: string;          // PK: e.g., 'site_name', 'theme_color'
  value: string | object;
  updatedBy: string;           // userId
  updatedAt: string;
}

// Indexes:
// - PK: settingKey
```

### S3 Bucket Structure

#### `{wiki-name}-pages` Bucket
```
/pages/
  /{pageGuid}.json              # Page content + metadata
  /{pageGuid}.json?versionId=x  # Previous versions

Structure of page JSON:
{
  "pageGuid": "abc-123",
  "title": "My Page",
  "content": "# Markdown content...",
  "folderGuid": "folder-456",
  "metadata": {
    "tags": ["family", "recipes"],
    "category": "cooking",
    "status": "published"
  }
}
```

#### `{wiki-name}-attachments` Bucket
```
/attachments/
  /{pageGuid}/
    /{attachmentGuid}/{filename}  # Original filename preserved
```

#### `{wiki-name}-exports` Bucket (temporary)
```
/exports/
  /{exportGuid}.pdf   # TTL: 1 hour
  /{exportGuid}.zip   # TTL: 1 hour
```

---

## API Design

### Authentication Endpoints

```typescript
// Login
POST /auth/login
Request: { email: string, password: string, rememberMe: boolean }
Response: { accessToken: string, user: User }
Sets cookie: authToken (httpOnly, secure, SameSite=Strict)

// Register (with invite code)
POST /auth/register
Request: { email: string, password: string, displayName: string, inviteCode: string }
Response: { accessToken: string, user: User }

// Refresh token
POST /auth/refresh
Request: (reads cookie)
Response: { accessToken: string }

// Logout
POST /auth/logout
Response: { success: true }
Clears cookie

// Request password reset
POST /auth/forgot-password
Request: { email: string }
Response: { message: "Reset email sent" }

// Reset password
POST /auth/reset-password
Request: { token: string, newPassword: string }
Response: { success: true }
```

### Page Endpoints

```typescript
// Create page
POST /pages
Request: { title: string, folderGuid: string, content: string }
Response: { pageGuid: string, page: Page }

// Get page
GET /pages/{pageGuid}
Response: { page: Page, metadata: PageMetadata }

// Update page
PUT /pages/{pageGuid}
Request: { title: string, content: string, metadata: PageMetadata }
Response: { page: Page, versionId: string }

// Delete page
DELETE /pages/{pageGuid}
Response: { success: true }

// List pages in folder
GET /folders/{folderGuid}/pages
Query: ?status=published&limit=50&offset=0
Response: { pages: Page[], total: number }

// Get page versions
GET /pages/{pageGuid}/versions
Response: { versions: PageVersion[] }

// Compare versions
GET /pages/{pageGuid}/compare?from={v1}&to={v2}
Response: { diff: DiffResult, v1: Page, v2: Page }

// Restore version
POST /pages/{pageGuid}/restore/{versionId}
Response: { page: Page, newVersionId: string }
```

### Folder Endpoints

```typescript
// Create folder
POST /folders
Request: { name: string, parentGuid: string | null }
Response: { folderGuid: string, folder: Folder }

// Get folder
GET /folders/{folderGuid}
Response: { folder: Folder, children: Folder[], pages: Page[] }

// Update folder
PUT /folders/{folderGuid}
Request: { name: string }
Response: { folder: Folder }

// Move folder
PUT /folders/{folderGuid}/move
Request: { newParentGuid: string | null }
Response: { folder: Folder }

// Delete folder
DELETE /folders/{folderGuid}?recursive=true
Response: { success: true, deletedCount: number }

// Get folder tree
GET /folders/tree
Response: { root: FolderNode[] }
```

### Search Endpoints

```typescript
// Search pages
GET /search?q={query}&folder={guid}&tags={tag1,tag2}&limit=20
Response: { results: SearchResult[], total: number, took: number }

interface SearchResult {
  pageGuid: string;
  title: string;
  snippet: string;      // Highlighted excerpt
  folderPath: string;
  updatedAt: string;
  score: number;        // Relevance score
}

// Search suggestions (autocomplete)
GET /search/suggest?q={partial}
Response: { suggestions: string[] }
```

### Attachment Endpoints

```typescript
// Upload attachment
POST /pages/{pageGuid}/attachments/upload
Request: multipart/form-data (file)
Response: { attachmentGuid: string, presignedUrl: string }

// Or get presigned upload URL
POST /pages/{pageGuid}/attachments/upload-url
Request: { filename: string, mimeType: string, fileSize: number }
Response: { uploadUrl: string, attachmentGuid: string }

// List attachments
GET /pages/{pageGuid}/attachments
Response: { attachments: Attachment[] }

// Get download URL
GET /attachments/{attachmentGuid}/download
Response: { downloadUrl: string, expiresIn: number }

// Delete attachment
DELETE /attachments/{attachmentGuid}
Response: { success: true }
```

### Comment Endpoints

```typescript
// List comments
GET /pages/{pageGuid}/comments
Response: { comments: Comment[] }  // Includes nested replies

// Add comment
POST /pages/{pageGuid}/comments
Request: { content: string, parentGuid: string | null }
Response: { comment: Comment }

// Edit comment
PUT /comments/{commentGuid}
Request: { content: string }
Response: { comment: Comment }

// Delete comment
DELETE /comments/{commentGuid}
Response: { success: true }
```

### User Management Endpoints

```typescript
// List users (admin only)
GET /admin/users?role={admin|standard}&limit=50
Response: { users: User[], total: number }

// Get user
GET /admin/users/{userId}
Response: { user: User, stats: UserStats }

// Update user
PUT /admin/users/{userId}
Request: { displayName: string, role: string }
Response: { user: User }

// Suspend user
POST /admin/users/{userId}/suspend
Response: { success: true }

// Reactivate user
POST /admin/users/{userId}/activate
Response: { success: true }

// Generate invitation
POST /admin/invitations
Request: { email: string, role: string }
Response: { inviteCode: string, inviteUrl: string }
```

### Export Endpoints

```typescript
// Export page to PDF
POST /pages/{pageGuid}/export/pdf
Response: { exportUrl: string, expiresIn: 3600 }

// Export folder to HTML
POST /folders/{folderGuid}/export/html
Response: { exportUrl: string, expiresIn: 3600 }
```

### Admin Endpoints

```typescript
// Get settings
GET /admin/settings
Response: { settings: SiteSettings }

// Update settings
PUT /admin/settings
Request: { siteName: string, theme: object, emailConfig: object }
Response: { settings: SiteSettings }

// System health check
GET /admin/health
Response: {
  s3: { status: 'healthy', latency: 45 },
  dynamodb: { status: 'healthy', latency: 12 },
  cloudsearch: { status: 'degraded', error: 'timeout' }
}

// Usage statistics
GET /admin/stats
Response: {
  totalPages: 523,
  totalFolders: 87,
  totalUsers: 12,
  storageUsed: '145 MB',
  activeUsers30d: 8
}
```

---

## Security Implementation

### Authentication & Authorization

#### JWT Token Structure
```typescript
interface JWTPayload {
  userId: string;
  email: string;
  role: 'admin' | 'standard';
  iat: number;      // Issued at
  exp: number;      // Expiration (7 or 30 days)
}

// Signing algorithm: HS256 (symmetric)
// Secret stored in AWS Secrets Manager
// Token delivered via httpOnly cookie (not localStorage)
```

#### Cookie Configuration
```typescript
{
  name: 'authToken',
  httpOnly: true,              // Prevent XSS access
  secure: true,                // HTTPS only
  sameSite: 'Strict',          // CSRF protection
  maxAge: 7 * 24 * 60 * 60,    // 7 days (or 30 with rememberMe)
  path: '/'
}
```

#### Password Security
- **Hashing**: bcrypt with salt rounds = 12
- **Requirements**:
  - Minimum 8 characters
  - At least 1 uppercase, 1 lowercase, 1 digit
  - Check against common password list (Have I Been Pwned API optional)
- **Reset Tokens**: 
  - Crypto-random 32-byte token
  - Stored in DynamoDB with 1-hour TTL
  - Single-use (deleted after successful reset)

#### Permission Middleware
```typescript
// Lambda middleware pattern
async function requireAuth(event: APIGatewayEvent) {
  const token = parseCookie(event.headers.cookie, 'authToken');
  if (!token) throw new UnauthorizedError();
  
  const payload = verifyJWT(token);
  if (!payload) throw new UnauthorizedError();
  
  const user = await getUser(payload.userId);
  if (!user.isActive) throw new ForbiddenError('Account suspended');
  
  return { user, payload };
}

async function requireAdmin(event: APIGatewayEvent) {
  const { user } = await requireAuth(event);
  if (user.role !== 'admin') throw new ForbiddenError('Admin access required');
  return { user };
}
```

### API Security

#### Rate Limiting
- **AWS API Gateway Usage Plans**:
  - Burst limit: 50 requests
  - Rate limit: 100 requests/second per IP
  - Throttle after limit: 429 Too Many Requests

#### Input Validation
```typescript
// Use Zod for runtime validation
import { z } from 'zod';

const CreatePageSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().max(1_000_000),  // 1MB max
  folderGuid: z.string().uuid()
});

// Validate in Lambda
const input = CreatePageSchema.parse(event.body);
```

#### CORS Configuration
```typescript
{
  'Access-Control-Allow-Origin': 'https://mywiki.example.com',  // Specific domain
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Credentials': 'true',  // For cookies
  'Access-Control-Max-Age': '86400'  // 24 hours
}
```

#### Content Security Policy
```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self' 'unsafe-inline' 'unsafe-eval';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https://*.amazonaws.com;
  font-src 'self';
  connect-src 'self' https://*.execute-api.*.amazonaws.com;
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';
">
```

### Data Security

#### Encryption at Rest
- **S3**: Server-side encryption (SSE-S3 or SSE-KMS)
- **DynamoDB**: Encryption enabled by default (AWS-managed keys)
- **Secrets Manager**: Automatic encryption with KMS

#### Encryption in Transit
- **All traffic over HTTPS** (TLS 1.2+)
- CloudFront enforces HTTPS (redirect HTTP → HTTPS)
- API Gateway requires TLS 1.2+

#### S3 Bucket Security
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DenyInsecureTransport",
      "Effect": "Deny",
      "Principal": "*",
      "Action": "s3:*",
      "Resource": "arn:aws:s3:::bluefinwiki-pages/*",
      "Condition": {
        "Bool": { "aws:SecureTransport": "false" }
      }
    },
    {
      "Sid": "AllowLambdaAccess",
      "Effect": "Allow",
      "Principal": { "Service": "lambda.amazonaws.com" },
      "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::bluefinwiki-pages/*"
    }
  ]
}
```

### Vulnerability Prevention

#### XSS Protection
- **Markdown sanitization**: Use DOMPurify to sanitize HTML output
- **React auto-escaping**: Leverage React's built-in XSS protection
- **CSP headers**: Block inline scripts from unknown sources

#### SQL/NoSQL Injection
- **Parameterized queries**: Always use DynamoDB SDK's built-in escaping
- **No raw query strings**: Never concatenate user input into queries

#### CSRF Protection
- **SameSite cookies**: `Strict` mode prevents cross-site requests
- **CSRF tokens**: Not needed with proper SameSite + httpOnly cookies

#### Dependency Security
- **npm audit**: Run on every CI build
- **Dependabot**: Enable automated security updates
- **Lock files**: Commit `package-lock.json` or `pnpm-lock.yaml`

---

## Testing Strategy

### Unit Tests (80% coverage target)
**Framework**: Vitest

**Coverage**:
- All utility functions (GUID generation, Markdown parsing, date formatting)
- Storage plugin interface
- JWT token generation/validation
- Permission checking logic
- Input validation schemas

**Example**:
```typescript
// storage-plugin.test.ts
describe('S3StoragePlugin', () => {
  it('should generate unique GUIDs', () => {
    const guid1 = generateGuid();
    const guid2 = generateGuid();
    expect(guid1).not.toBe(guid2);
    expect(guid1).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('should serialize page to JSON', () => {
    const page = { title: 'Test', content: 'Hello' };
    const json = serializePage(page);
    expect(JSON.parse(json)).toEqual(page);
  });
});
```

### Integration Tests (Key workflows)
**Framework**: Vitest + MSW (Mock Service Worker)

**Coverage**:
- API endpoint flows (create page → save → retrieve)
- Authentication flow (login → JWT → refresh → logout)
- Search indexing (save page → index → search → find result)
- File upload (presigned URL → upload → retrieve)

**Example**:
```typescript
// pages.integration.test.ts
describe('Page API', () => {
  it('should create and retrieve a page', async () => {
    const token = await login('user@example.com', 'password');
    
    const createResp = await createPage(token, {
      title: 'Test Page',
      content: '# Hello',
      folderGuid: 'root'
    });
    expect(createResp.pageGuid).toBeDefined();
    
    const getResp = await getPage(token, createResp.pageGuid);
    expect(getResp.page.title).toBe('Test Page');
  });
});
```

### End-to-End Tests (Critical user journeys)
**Framework**: Playwright

**Scenarios**:
1. **User Registration & Login**:
   - Admin generates invite code
   - New user registers with code
   - User logs in successfully
   - User sees dashboard

2. **Create & Edit Page**:
   - Create folder
   - Create page in folder
   - Edit page content (Markdown)
   - Preview renders correctly
   - Autosave works
   - Page appears in folder tree

3. **Search Flow**:
   - Create multiple pages with distinct content
   - Search for keyword
   - Results show correct pages
   - Click result → navigates to page

4. **Version History**:
   - Edit page multiple times
   - View version history
   - Compare two versions (diff visible)
   - Restore previous version

5. **Mobile Experience**:
   - Open on mobile viewport
   - Hamburger menu works
   - Edit page on mobile
   - Upload attachment

**Example**:
```typescript
// e2e/create-page.spec.ts
import { test, expect } from '@playwright/test';

test('create and edit a page', async ({ page }) => {
  await page.goto('http://localhost:5173');
  await page.fill('[name="email"]', 'admin@test.com');
  await page.fill('[name="password"]', 'Password123');
  await page.click('button:has-text("Login")');
  
  await expect(page).toHaveURL('/dashboard');
  
  await page.click('button:has-text("New Page")');
  await page.fill('[name="title"]', 'E2E Test Page');
  await page.fill('.markdown-editor', '# Hello World');
  await page.click('button:has-text("Save")');
  
  await expect(page.locator('.preview')).toContainText('Hello World');
});
```

### Accessibility Testing
**Tools**: 
- axe DevTools (browser extension)
- Playwright axe integration
- Manual keyboard navigation testing

**Checkpoints**:
- All interactive elements keyboard-accessible
- Proper ARIA labels and roles
- Sufficient color contrast (WCAG AA: 4.5:1)
- Screen reader compatibility (NVDA, JAWS, VoiceOver)
- Focus indicators visible
- No keyboard traps

### Performance Testing
**Tools**: Lighthouse, WebPageTest, k6

**Metrics**:
- First Contentful Paint (FCP) < 1.5s
- Largest Contentful Paint (LCP) < 2.5s
- Time to Interactive (TTI) < 3.5s
- Cumulative Layout Shift (CLS) < 0.1

**Load Testing**:
- Simulate 10 concurrent users
- 100 requests/min for 10 minutes
- Monitor Lambda cold starts
- Check DynamoDB throttling

### Security Testing
**Tools**: 
- npm audit
- OWASP ZAP
- Snyk

**Checks**:
- Dependency vulnerabilities (critical/high = 0)
- XSS injection attempts blocked
- SQL injection attempts blocked
- CSRF protection active
- Rate limiting working
- Sensitive data not logged

---

## Deployment Pipeline

### CI/CD Workflow (GitHub Actions)

#### **Pull Request Workflow**
```yaml
name: PR Checks
on: [pull_request]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run test:unit
      - run: npm run test:integration
      - name: Upload coverage
        uses: codecov/codecov-action@v3

  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run build
      - name: Check bundle size
        run: npm run analyze-bundle
```

#### **Deployment Workflow**
```yaml
name: Deploy
on:
  push:
    branches: [main, staging]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run tests
        run: npm run test:all
      
      - name: Build frontend
        run: npm run build
      
      - name: Deploy infrastructure (CDK)
        run: |
          npm run cdk:synth
          npm run cdk:deploy -- --require-approval never
      
      - name: Deploy frontend to S3
        run: aws s3 sync dist/ s3://bluefinwiki-frontend/ --delete
      
      - name: Invalidate CloudFront cache
        run: |
          aws cloudfront create-invalidation \
            --distribution-id ${{ secrets.CLOUDFRONT_DIST_ID }} \
            --paths "/*"
      
      - name: Run smoke tests
        run: npm run test:smoke
```

### Environment Strategy

#### **Development**
- Deployed on every commit to `develop` branch
- Separate AWS account or isolated resources
- Debug logging enabled
- No rate limiting
- Synthetic test data

#### **Staging**
- Deployed on every commit to `staging` branch
- Production-like environment
- Production logging levels
- Rate limiting enabled
- E2E tests run automatically
- Manual QA testing

#### **Production**
- Deployed on every merge to `main` branch
- Requires approval from maintainer
- Smoke tests run post-deploy
- Rollback plan available
- Health monitoring active

### Deployment Checklist

**Pre-Deployment**:
- [ ] All tests passing (unit, integration, E2E)
- [ ] Code review approved
- [ ] Changelog updated
- [ ] Database migrations scripted (if any)
- [ ] Environment variables configured
- [ ] Secrets rotated (if needed)

**Deployment**:
- [ ] Infrastructure changes deployed (CDK/Terraform)
- [ ] Lambda functions updated
- [ ] Frontend deployed to S3
- [ ] CloudFront cache invalidated
- [ ] Database migrations run (if any)

**Post-Deployment**:
- [ ] Smoke tests passed
- [ ] Health checks green
- [ ] Error rates normal (CloudWatch)
- [ ] User-facing validation (manual login test)
- [ ] Rollback plan confirmed ready

### Rollback Strategy

**Automated Rollback**:
- If smoke tests fail → automatic rollback to previous version
- Lambda versioning: Revert to previous alias
- S3 frontend: Versioning enabled, restore previous version
- DynamoDB: Point-in-time recovery (PITR) enabled

**Manual Rollback**:
```bash
# Revert Lambda functions
aws lambda update-alias --function-name PageService --name live --function-version $PREVIOUS_VERSION

# Revert frontend
aws s3 sync s3://bluefinwiki-frontend-backup/v1.2.3/ s3://bluefinwiki-frontend/ --delete

# Invalidate CloudFront
aws cloudfront create-invalidation --distribution-id $DIST_ID --paths "/*"
```

---

## Cost Estimation

### Monthly Cost Breakdown (5-user family, moderate usage)

#### **Compute** (AWS Lambda)
- **Invocations**: ~50,000/month
- **Duration**: Avg 200ms, 512MB memory
- **Cost**: $0.00 (within free tier: 1M requests/month)

#### **Storage** (S3)
- **Pages**: 500 pages × 10KB = 5MB
- **Attachments**: 200 files × 1MB = 200MB
- **Total**: 205MB
- **Cost**: $0.005/month (Standard storage)

#### **Database** (DynamoDB)
- **Storage**: 50MB metadata
- **Reads**: 100,000 RCU/month (on-demand)
- **Writes**: 20,000 WCU/month (on-demand)
- **Cost**: $0.25/month (mostly free tier)

#### **Search** (CloudSearch)
- **Instance**: search.small (0.1 search instances)
- **Cost**: $0.00 (free tier covers small usage)
- Alternative: OpenSearch Serverless: ~$700/month → **NOT RECOMMENDED** for MVP

#### **CDN** (CloudFront)
- **Data Transfer**: 10GB/month
- **Requests**: 100,000/month
- **Cost**: $0.85/month (within free tier for first 12 months)

#### **Email** (SES)
- **Emails**: 50/month (invites, password resets)
- **Cost**: $0.00 (within free tier: 62,000 emails/month via EC2/Lambda)

#### **Secrets** (Secrets Manager)
- **Secrets**: 3 (JWT secret, admin password, API keys)
- **Cost**: $1.20/month ($0.40 per secret)

#### **Total Monthly Cost**: ~$2.30/month (first year with free tiers)
#### **Total Monthly Cost**: ~$5-7/month (after free tier expires)

### Cost Scaling (20-user family, high usage)
- Lambda: $1.50/month (200K invocations)
- S3: $0.50/month (2GB storage)
- DynamoDB: $3.00/month (500K reads, 100K writes)
- CloudFront: $5.00/month (50GB transfer)
- Search: $10/month (if using OpenSearch Serverless - consider CloudSearch)
- **Total**: ~$20/month

### Cost Optimization Strategies
1. **Use S3 Intelligent-Tiering** for infrequently accessed pages
2. **Enable DynamoDB auto-scaling** (not needed for small wikis)
3. **Cache API responses** in CloudFront to reduce Lambda invocations
4. **Compress S3 objects** (gzip) to reduce storage/transfer costs
5. **Use S3 lifecycle policies** to delete temporary exports after 1 hour
6. **Consider CloudSearch over OpenSearch** (10x cheaper for small datasets)

---

## Risk Mitigation

### Technical Risks

#### **Risk: S3 Outage**
- **Impact**: Pages cannot be loaded or saved
- **Likelihood**: Low (S3 has 99.99% SLA)
- **Mitigation**:
  - Implement retry logic with exponential backoff
  - Cache recently viewed pages in localStorage
  - Display "Service Unavailable" message with retry button
  - Enable S3 Cross-Region Replication (optional, adds cost)

#### **Risk: Lambda Cold Starts**
- **Impact**: Slow first request (2-5s delay)
- **Likelihood**: High for infrequently used functions
- **Mitigation**:
  - Provision 1-2 concurrent executions for critical functions (adds cost)
  - Use Lambda SnapStart (Java only, not applicable)
  - Implement lightweight Lambda handlers (< 10MB)
  - Consider CloudFront caching for frequently accessed pages

#### **Risk: Concurrent Edit Conflicts**
- **Impact**: Users overwrite each other's changes
- **Likelihood**: Medium for family wikis (2-3 users editing same page)
- **Mitigation**:
  - Implement optimistic locking with version checks
  - Detect conflicts on save (compare last modified timestamp)
  - Show conflict resolution UI with diff view
  - Auto-save drafts to prevent data loss

#### **Risk: Search Service Downtime**
- **Impact**: Search functionality unavailable
- **Likelihood**: Low (CloudSearch has 99.9% SLA)
- **Mitigation**:
  - Degrade gracefully: show cached results or "Search temporarily unavailable"
  - Implement fallback: basic text search via DynamoDB scan (slow but works)
  - Display recent pages as alternative navigation

#### **Risk: JWT Secret Leak**
- **Impact**: Attackers can forge authentication tokens
- **Likelihood**: Very Low (stored in Secrets Manager)
- **Mitigation**:
  - Rotate JWT secret quarterly
  - Monitor Secrets Manager access logs (CloudTrail)
  - Implement token blacklist if leak detected (emergency measure)
  - Use short token expiration (7 days) to limit damage window

### Operational Risks

#### **Risk: Accidental Data Deletion**
- **Impact**: Pages or folders permanently lost
- **Likelihood**: Medium (human error)
- **Mitigation**:
  - Enable S3 versioning for all buckets
  - Implement soft-delete (mark as deleted, purge after 30 days)
  - Require confirmation for delete operations
  - Enable DynamoDB Point-in-Time Recovery (PITR)
  - Daily backups to separate S3 bucket (optional)

#### **Risk: Cost Overrun**
- **Impact**: Unexpected AWS bill
- **Likelihood**: Low for family wikis
- **Mitigation**:
  - Set AWS Budgets alerts ($10, $20, $50 thresholds)
  - Monitor CloudWatch metrics for unusual traffic
  - Implement rate limiting to prevent abuse
  - Use DynamoDB on-demand pricing (predictable)
  - Add cost dashboard in admin panel

#### **Risk: Poor Performance at Scale**
- **Impact**: Slow page loads, search timeouts
- **Likelihood**: Low (family wikis are small)
- **Mitigation**:
  - Paginate API responses (50 items max)
  - Lazy-load folder trees (expand on demand)
  - Compress API responses (gzip)
  - Optimize DynamoDB queries (use GSIs effectively)
  - Implement CloudFront caching (1-hour TTL for static pages)

### Security Risks

#### **Risk: Brute Force Login Attempts**
- **Impact**: Account compromise
- **Likelihood**: Medium (if exposed to internet)
- **Mitigation**:
  - Implement rate limiting (5 attempts per 15 minutes)
  - Lock account after 10 failed attempts (requires admin unlock)
  - Add CAPTCHA after 3 failed attempts (optional)
  - Log failed login attempts to CloudWatch

#### **Risk: XSS via Markdown**
- **Impact**: Malicious scripts in page content
- **Likelihood**: Low (trusted family users)
- **Mitigation**:
  - Sanitize Markdown output with DOMPurify
  - Use React's auto-escaping for user input
  - Implement Content Security Policy (CSP) headers
  - Disable dangerous Markdown features (raw HTML)

#### **Risk: Privilege Escalation**
- **Impact**: Standard user gains admin access
- **Likelihood**: Very Low (simple two-role system)
- **Mitigation**:
  - Validate user role on every API request (server-side)
  - Never trust client-side role checks
  - Audit admin actions (log to CloudWatch)
  - Regular permission testing in QA

---

## Post-MVP Roadmap

### Phase 10: Notification System (Weeks 17-18)
**Dependencies**: User Management, Comments, Permissions

**Features**:
- [ ] Email notifications for @mentions
- [ ] Comment reply notifications
- [ ] Page watch/subscribe functionality
- [ ] Notification preferences (per-user settings)
- [ ] In-app notification center
- [ ] Digest emails (daily/weekly summary)

**Implementation**:
- DynamoDB `notifications` table
- Lambda function triggered by comment creation
- SES integration for email delivery
- Frontend notification bell icon with unread count

---

### Phase 11: Page Templates (Week 19)
**Dependencies**: Page Editor, Folder Management

**Features**:
- [ ] Create reusable page templates
- [ ] Template gallery (Meeting Notes, Project Page, Recipe, etc.)
- [ ] Custom template creation (admin only)
- [ ] Apply template on page creation
- [ ] Template variables ({{date}}, {{author}}, etc.)

**Implementation**:
- DynamoDB `templates` table
- Template variable substitution in backend
- Template picker in "New Page" modal

---

### Phase 12: Advanced Search (Week 20)
**Dependencies**: Search, Metadata

**Features**:
- [ ] Backlinks ("What links here")
- [ ] Graph visualization of page relationships
- [ ] Saved searches
- [ ] Search within specific folder trees
- [ ] Advanced filters (date range, author, file type)

**Implementation**:
- Extend CloudSearch schema for backlinks
- React Flow for graph visualization
- Store saved searches in user preferences

---

### Phase 13: Enhanced Exports (Week 21)
**Dependencies**: Export Functionality, Page History

**Features**:
- [ ] Export with custom styling (CSS templates)
- [ ] Export specific version of page
- [ ] Bulk export (entire wiki as ZIP)
- [ ] Scheduled exports (weekly backup)
- [ ] Export to Markdown (raw files)

**Implementation**:
- Lambda function for ZIP generation
- S3 lifecycle policies for export cleanup
- EventBridge scheduled rule for automated backups

---

### Phase 14: Collaboration Enhancements (Week 22)
**Dependencies**: Page Editor, Comments, User Management

**Features**:
- [ ] Real-time collaborative editing (Operational Transform or CRDT)
- [ ] Presence indicators (who's viewing/editing)
- [ ] Page locking (prevent concurrent edits)
- [ ] Inline comments (comment on specific paragraphs)
- [ ] Mentions in page content (not just comments)

**Implementation**:
- WebSocket API (AWS API Gateway WebSocket)
- DynamoDB Streams for real-time updates
- CRDT library (e.g., Yjs) for conflict-free editing

---

### Phase 15: Mobile App (Weeks 23-28)
**Dependencies**: All MVP features

**Features**:
- [ ] Native iOS/Android apps (React Native or Flutter)
- [ ] Offline mode with sync
- [ ] Push notifications
- [ ] Biometric authentication (Touch ID, Face ID)
- [ ] Camera integration (attach photos directly)

**Implementation**:
- React Native + Expo for cross-platform
- SQLite for offline storage
- AWS AppSync for real-time sync
- AWS SNS for push notifications

---

### Phase 16: Advanced Admin Tools (Week 29)
**Dependencies**: Admin Configuration, User Management

**Features**:
- [ ] Audit log viewer (all user actions)
- [ ] Data export/import (backup/restore)
- [ ] Custom CSS/JavaScript injection
- [ ] Webhook integrations (Zapier, IFTTT)
- [ ] API access for external tools

**Implementation**:
- CloudTrail for audit logs
- Lambda for data export/import
- DynamoDB for webhook configurations

---

## Success Metrics (KPIs)

### User Engagement
- **Daily Active Users (DAU)**: Target 60% of total users
- **Pages Created**: Target 50+ pages in first month
- **Average Session Duration**: Target 10+ minutes
- **Return Rate**: Target 80% weekly return rate

### Performance
- **Page Load Time**: < 200ms (P95)
- **Search Response Time**: < 500ms (P95)
- **API Error Rate**: < 0.1%
- **Uptime**: > 99.9%

### Cost Efficiency
- **Cost per User**: < $1/month
- **Total Operational Cost**: < $5/month for 5-user wiki

### Quality
- **Bug Reports**: < 5 bugs per 100 user sessions
- **Accessibility Score**: > 95 (Lighthouse)
- **Security Vulnerabilities**: 0 critical/high

---

## Conclusion

This technical implementation plan provides a comprehensive roadmap for building BlueFinWiki from foundation to production-ready MVP. The phased approach ensures steady progress with clear deliverables at each stage.

**Key Takeaways**:
1. **16-week timeline** for MVP with all P1 features
2. **AWS-native serverless architecture** for cost efficiency (< $5/month)
3. **Pluggable design** enables future storage backend swaps
4. **Security-first** approach with JWT, encryption, and proper IAM
5. **Comprehensive testing** strategy (unit, integration, E2E, accessibility)
6. **Clear post-MVP roadmap** for enhanced features

**Next Steps**:
1. Review and approve this plan
2. Set up development environment (Week 1)
3. Begin Phase 1 implementation
4. Schedule weekly progress reviews
5. Adjust timeline based on team capacity

**Questions or Feedback?**  
Refer to [SPECIFICATIONS.md](SPECIFICATIONS.md) for detailed feature requirements or [CLARIFICATIONS.md](CLARIFICATIONS.md) for design decisions.

---

**Document Version**: 1.0  
**Last Updated**: February 6, 2026  
**Status**: ✅ Ready for Implementation
