# BlueFinWiki - Implementation Tasks

**Project**: BlueFinWiki - Family Wiki Platform  
**Generated**: February 6, 2026  
**Total Duration**: 12-16 weeks (2-3 developers)  
**Status**: Ready for Execution

---

## 📋 Quick Reference

- **Total Tasks**: 160 actionable tasks across 7 phases
- **Critical Path**: Phase 1 → Phase 2 → Phase 3 (Foundation & Core Features)
- **MVP Completion**: End of Phase 5 (Week 12)
- **Full Feature Set**: End of Phase 7 (Week 16)
- **Local Development**: Microsoft Aspire for orchestration and observability

### Phase Overview
- **Phase 1**: Foundation (Weeks 1-3) - 35 tasks
- **Phase 2**: Core Features (Weeks 4-7) - 35 tasks
- **Phase 3**: Search & Users (Weeks 8-9) - 18 tasks
- **Phase 4**: History & Navigation (Weeks 10-11) - 19 tasks
- **Phase 5**: Permissions & Mobile (Week 12) - 13 tasks
- **Phase 6**: Advanced Features (Week 13) - 14 tasks
- **Phase 7**: Collaboration & Metadata (Week 14-16) - 26 tasks

---

## Phase 1: Foundation (Weeks 1-3)

### Week 1: Project Setup & Infrastructure

**Goal**: Establish development environment and AWS infrastructure

#### 1.1 Repository & CI/CD Setup
- [x] Initialize monorepo structure (frontend, backend, infrastructure, aspire)
- [ ] Create GitHub repository with branch protection rules
- [x] Configure Git hooks (pre-commit: lint, type-check)
- [x] Set up Microsoft Aspire AppHost project for local development
  - [x] Create Aspire AppHost project (`dotnet new aspire-apphost`)
  - [x] Configure service references for frontend and backend
  - [x] Set up service discovery and orchestration
  - [x] Configure Aspire Dashboard for local observability
- [x] Set up GitHub Actions workflows:
  - [x] Frontend build and test
  - [x] Backend build and test
  - [x] Infrastructure validation (CDK synth with C#)
  - [x] Deploy to dev environment on main branch
  - [x] Aspire validation (build and test AppHost)
- [x] Create README.md with setup instructions
  - [x] Add Aspire local development setup instructions
  - [x] Document how to run with `dotnet run --project aspire/BlueFinWiki.AppHost`
- [x] Document contributing guidelines and PR template

#### 1.2 Local Development with Aspire
- [ ] Set up Aspire AppHost project structure
  - [ ] Create `aspire/BlueFinWiki.AppHost` directory
  - [ ] Initialize with `dotnet new aspire-apphost -n BlueFinWiki.AppHost`
  - [ ] Create `aspire/BlueFinWiki.ServiceDefaults` for shared configuration
  - [ ] Initialize with `dotnet new aspire-servicedefaults -n BlueFinWiki.ServiceDefaults`
- [ ] Configure Aspire service orchestration
  - [ ] Add Node.js project reference for backend (Lambda functions running locally)
  - [ ] Add Node.js project reference for frontend (Vite dev server)
  - [ ] Configure port mappings and environment variables
  - [ ] Set up service-to-service communication
- [ ] Configure local AWS service emulation
  - [ ] Add LocalStack container resource to Aspire
  - [ ] Configure S3, DynamoDB, and SES emulation
  - [ ] Set up automatic container startup with Aspire
- [ ] Set up Aspire Dashboard
  - [ ] Configure telemetry collection (OpenTelemetry)
  - [ ] Enable distributed tracing between services
  - [ ] Configure structured logging
  - [ ] Set up metrics collection
- [ ] Create local environment configuration
  - [ ] Define appsettings.Development.json for Aspire
  - [ ] Configure connection strings and service endpoints
  - [ ] Set up local secrets management

#### 1.3 AWS Cloud Infrastructure as Code
- [ ] Choose IaC tool (AWS CDK with C# recommended)
- [ ] Initialize CDK project with C# (`cdk init app --language csharp`)
- [ ] Configure C# project structure (Program.cs, Stack classes)
- [ ] Define three environments: dev, staging, production
- [ ] Create CloudFormation stacks:
  - [ ] Network stack (VPC, subnets - if needed)
  - [ ] Storage stack (S3 buckets: pages, attachments, exports)
  - [ ] Database stack (DynamoDB tables)
  - [ ] Compute stack (Lambda functions, API Gateway)
  - [ ] CDN stack (CloudFront distribution)
- [ ] Configure environment variables per stack
- [ ] Set up AWS Secrets Manager for sensitive data
- [ ] Deploy dev environment infrastructure
- [ ] Document differences between Aspire local setup and AWS cloud deployment

#### 1.4 Database Schema Design
- [ ] Create DynamoDB table: `users`
  - PK: `userId` (GUID)
  - Attributes: email, passwordHash, role, inviteCode, status, createdAt
  - GSI: `email-index` for login lookups
- [ ] Configure LocalStack DynamoDB for local development via Aspire
  - [ ] Add DynamoDB Local container resource in AppHost
  - [ ] Configure table auto-creation on startup
  - [ ] Seed development data for testing
- [ ] Note: Folders and metadata are stored via storage plugin (S3/GitHub), not DynamoDB
- [ ] Configure billing alarms for DynamoDB and S3 (cloud only)
- [ ] Document schema design decisions and local vs. cloud differences

---

### Week 2: Authentication System (Spec #1)

**Goal**: Implement secure invite-only authentication

#### 2.1 Backend Authentication Services
- [ ] Create Lambda function: `auth-login` (runs as Node.js service in Aspire locally)
  - [ ] Validate email/password against DynamoDB (LocalStack in Aspire)
  - [ ] Generate JWT token (30-day expiry)
  - [ ] Return access token and refresh token
  - [ ] Set httpOnly secure cookies
  - [ ] Configure Aspire service discovery for local development
- [ ] Create Lambda function: `auth-register`
  - [ ] Validate invitation code
  - [ ] Check email uniqueness
  - [ ] Hash password with bcrypt (10 rounds)
  - [ ] Create user record in DynamoDB
  - [ ] Mark invitation code as used
- [ ] Create Lambda function: `auth-refresh`
  - [ ] Validate refresh token
  - [ ] Issue new access token
  - [ ] Rotate refresh token
- [ ] Create Lambda function: `auth-logout`
  - [ ] Clear authentication cookies
  - [ ] Blacklist refresh token (optional)
- [ ] Implement JWT validation middleware
  - [ ] Verify token signature
  - [ ] Check expiration
  - [ ] Extract user claims (userId, role)

#### 2.2 Password Reset Flow
- [ ] Configure AWS SES for email sending
  - [ ] Verify sender email domain
  - [ ] Create email templates (HTML + text)
  - [ ] Set up sandbox exit request (for production)
  - [ ] Configure SMTP container or mock email service in Aspire for local testing
    - [ ] Add MailHog or similar SMTP container to AppHost
    - [ ] Configure email viewing at http://localhost:8025
- [ ] Create Lambda function: `auth-request-reset`
  - [ ] Generate secure reset token (32 bytes)
  - [ ] Store token in DynamoDB with 1-hour TTL
  - [ ] Send password reset email via SES
- [ ] Create Lambda function: `auth-reset-password`
  - [ ] Validate reset token
  - [ ] Hash new password
  - [ ] Update user record
  - [ ] Invalidate reset token
  - [ ] Send confirmation email

#### 2.3 Invitation System
- [ ] Create Lambda function: `admin-create-invitation`
  - [ ] Generate unique invite code (8-character alphanumeric)
  - [ ] Store in DynamoDB: `invitations` table
  - [ ] Set expiry (7 days default)
  - [ ] Send invitation email with registration link
- [ ] Create Lambda function: `admin-list-invitations`
  - [ ] Return all pending invitations
  - [ ] Include usage status and expiry
- [ ] Create Lambda function: `admin-revoke-invitation`
  - [ ] Mark invitation as revoked
  - [ ] Prevent future use

#### 2.4 Frontend Authentication UI
- [ ] Build login page component
  - [ ] Email/password form with validation
  - [ ] "Remember me" checkbox (extends token expiry)
  - [ ] "Forgot password" link
  - [ ] Error handling and display
- [ ] Build registration page component
  - [ ] Invite code input
  - [ ] Email, password, confirm password fields
  - [ ] Password strength indicator
  - [ ] Terms acceptance checkbox
- [ ] Build password reset flow
  - [ ] Request reset page (email input)
  - [ ] Reset confirmation page (new password form)
  - [ ] Success/error messaging
- [ ] Implement authentication context (React Context API)
  - [ ] Store user state (userId, email, role)
  - [ ] Provide login/logout/refresh methods
  - [ ] Handle token expiration and refresh
- [ ] Create protected route wrapper component
  - [ ] Redirect to login if unauthenticated
  - [ ] Show loading state during auth check

---

### Week 3: Storage Plugin Interface (Spec #2)

**Goal**: Implement pluggable S3 storage backend

#### 3.1 Storage Plugin Architecture
- [ ] Define storage plugin TypeScript interface (for backend Lambda functions):
  ```typescript
  interface StoragePlugin {
    savePage(guid: string, content: PageContent): Promise<void>;
    loadPage(guid: string): Promise<PageContent>;
    deletePage(guid: string): Promise<void>;
    listVersions(guid: string): Promise<Version[]>;
    saveFolder(guid: string, data: FolderData): Promise<void>;
    loadFolder(guid: string): Promise<FolderData>;
  }
  ```
- [ ] Create abstract base class for storage plugins
- [ ] Document plugin interface and extension points
- [ ] Create plugin registry/loader mechanism

#### 3.2 S3 Storage Plugin Implementation
- [ ] Implement `S3StoragePlugin` class
  - [ ] Initialize S3 client with AWS SDK v3
  - [ ] Configure bucket names from environment
  - [ ] Implement error handling wrapper
- [ ] Implement `savePage` method
  - [ ] Generate GUID if not provided (uuid v4)
  - [ ] Serialize page content and metadata to JSON
  - [ ] PageContent includes: guid, title, content, tags, status, createdBy, modifiedBy, timestamps
  - [ ] Upload to S3: `pages/{guid}.json`
  - [ ] Enable versioning on S3 bucket
- [ ] Implement `loadPage` method
  - [ ] Fetch object from S3 by GUID
  - [ ] Deserialize JSON content
  - [ ] Handle 404 errors gracefully
  - [ ] Return page content with metadata
- [ ] Implement `deletePage` method
  - [ ] Soft delete: add `deleted=true` flag in page data
  - [ ] Or hard delete: remove S3 object
  - [ ] Update page data via save
- [ ] Implement `listVersions` method
  - [ ] Query S3 object versions API
  - [ ] Return sorted list (newest first)
  - [ ] Include version metadata
- [ ] Implement `saveFolder` method
  - [ ] Serialize folder data to JSON
  - [ ] Upload to S3: `folders/{guid}.json`
  - [ ] Update folder index/cache
- [ ] Implement `loadFolder` method
  - [ ] Fetch folder object from S3 by GUID
  - [ ] Deserialize JSON
  - [ ] Return folder data

#### 3.3 Lambda API Endpoints
- [ ] Create API Gateway REST API resource: `/pages`
- [ ] Implement Lambda: `pages-create` (POST /pages)
  - [ ] Validate request body (title, content, folderId)
  - [ ] Build PageContent object with metadata (title, tags, status, author, timestamps)
  - [ ] Call storage plugin `savePage`
  - [ ] Return page GUID and creation timestamp
- [ ] Implement Lambda: `pages-get` (GET /pages/{guid})
  - [ ] Extract GUID from path parameters
  - [ ] Call storage plugin `loadPage`
  - [ ] Return complete page data with metadata
- [ ] Implement Lambda: `pages-update` (PUT /pages/{guid})
  - [ ] Validate request body
  - [ ] Load existing page from storage
  - [ ] Update content and metadata (modifiedBy, modifiedAt)
  - [ ] Call storage plugin `savePage` (creates new version)
  - [ ] Return success response
- [ ] Implement Lambda: `pages-delete` (DELETE /pages/{guid})
  - [ ] Verify user permissions
  - [ ] Call storage plugin `deletePage`
  - [ ] Return confirmation

#### 3.4 Testing & Documentation
- [ ] Write unit tests for storage plugin interface
  - [ ] Mock S3 client
  - [ ] Test CRUD operations
  - [ ] Test error scenarios (network, permissions)
- [ ] Write integration tests
  - [ ] Use LocalStack (via Aspire) or S3 test bucket
  - [ ] Test end-to-end page lifecycle
  - [ ] Verify versioning behavior
  - [ ] Use Aspire Dashboard to monitor test execution and trace issues
- [ ] Document S3 bucket structure and naming conventions
- [ ] Create plugin developer guide for future extensions
- [ ] Document Aspire local development workflow for testing

---

## Phase 2: Core Features (Weeks 4-7)

### Week 4: Folder Management (Spec #3)

**Goal**: Implement hierarchical folder organization

#### 4.1 Folder Data Model
- [ ] Define folder data structure in storage plugin
  - [ ] FolderData: guid, name, parentGuid, description, color, createdBy, createdAt, updatedAt
  - [ ] Store as JSON in S3: `folders/{guid}.json`
  - [ ] Store parent-child relationships within folder data
- [ ] Implement folder hierarchy traversal in storage plugin
  - [ ] Cache folder tree in memory for performance
  - [ ] Build index of all folders on startup
- [ ] Create root folder during wiki initialization

#### 4.2 Folder API Endpoints
- [ ] Implement Lambda: `folders-create` (POST /folders)
  - [ ] Generate folder GUID
  - [ ] Validate parent folder exists via storage plugin
  - [ ] Prevent duplicate names in same parent
  - [ ] Call storage plugin `saveFolder` method
- [ ] Implement Lambda: `folders-get` (GET /folders/{guid})
  - [ ] Call storage plugin `loadFolder` method
  - [ ] Fetch immediate children (subfolders + pages) from storage
  - [ ] Return folder tree node
- [ ] Implement Lambda: `folders-update` (PUT /folders/{guid})
  - [ ] Load folder via storage plugin
  - [ ] Allow rename and description update
  - [ ] Prevent name conflicts
  - [ ] Update modification timestamp
  - [ ] Save via storage plugin `saveFolder` method
- [ ] Implement Lambda: `folders-delete` (DELETE /folders/{guid})
  - [ ] Check if folder is empty via storage plugin
  - [ ] Implement recursive delete (with confirmation flag)
  - [ ] Move pages to archive folder (soft delete option)
  - [ ] Delete via storage plugin
  - [ ] Return count of affected items
- [ ] Implement Lambda: `folders-move` (PUT /folders/{guid}/move)
  - [ ] Load folder via storage plugin
  - [ ] Validate target parent folder exists
  - [ ] Prevent circular references
  - [ ] Update parentGuid in folder data
  - [ ] Save via storage plugin `saveFolder` method

#### 4.3 Frontend Folder Components
- [ ] Build recursive folder tree component
  - [ ] Display folders with expand/collapse icons
  - [ ] Show page count per folder
  - [ ] Highlight active folder/page
  - [ ] Support keyboard navigation (arrows, enter)
- [ ] Implement folder context menu
  - [ ] Right-click menu: Rename, Delete, Move, New Page
  - [ ] Keyboard shortcut support
  - [ ] Confirmation dialog for destructive actions
- [ ] Build drag-and-drop functionality
  - [ ] Drag pages between folders
  - [ ] Drag folders to reorder or reparent
  - [ ] Visual drop indicators
  - [ ] Optimistic UI updates
- [ ] Create "New Folder" modal
  - [ ] Name input with validation
  - [ ] Parent folder selection dropdown
  - [ ] Optional description field

#### 4.4 Folder Operations Testing
- [ ] Unit tests for folder hierarchy logic
- [ ] Integration tests for folder CRUD operations
- [ ] Test circular reference prevention
- [ ] Test concurrent folder moves (race conditions)

---

### Week 5: Page Editor (Spec #4)

**Goal**: Build Markdown editor with live preview

#### 5.1 Editor Component Setup
- [ ] Install CodeMirror 6 dependencies
  - [ ] @codemirror/state, @codemirror/view
  - [ ] @codemirror/lang-markdown
  - [ ] @codemirror/commands (undo/redo, search)
- [ ] Configure Markdown language mode
  - [ ] Syntax highlighting
  - [ ] Auto-indentation
  - [ ] Bracket matching
- [ ] Set up split-pane layout (edit | preview)
  - [ ] Resizable divider
  - [ ] Synchronized scrolling (optional)
  - [ ] Toggle preview pane button

#### 5.2 Markdown Preview
- [ ] Install react-markdown and remark plugins
  - [ ] remark-gfm (GitHub Flavored Markdown)
  - [ ] remark-breaks (line breaks)
  - [ ] rehype-highlight (code syntax highlighting)
- [ ] Build preview component
  - [ ] Render Markdown in real-time
  - [ ] Apply CSS styling for readability
  - [ ] Support tables, task lists, footnotes
- [ ] Implement preview theming (light/dark)

#### 5.3 Editor Features
- [ ] Build Markdown toolbar
  - [ ] Buttons: Bold, Italic, Strikethrough
  - [ ] Headers (H1-H6 dropdown)
  - [ ] Lists (unordered, ordered, task)
  - [ ] Links, images, code blocks
  - [ ] Keyboard shortcuts (Ctrl+B, Ctrl+I, etc.)
- [ ] Implement autosave mechanism
  - [ ] Debounce save (5 seconds after last edit)
  - [ ] Show "Saving..." indicator
  - [ ] Display last saved timestamp
  - [ ] Handle save errors gracefully
- [ ] Add unsaved changes warning
  - [ ] Detect dirty state
  - [ ] Show prompt on navigation/close
  - [ ] Offer save or discard options

#### 5.4 Page Metadata Editing
- [ ] Create page properties panel
  - [ ] Inline title editing (H1 header sync)
  - [ ] Tag input (multi-select dropdown)
  - [ ] Status dropdown (Draft, Published, Archived)
  - [ ] Author display (read-only)
  - [ ] Created/modified timestamps
- [ ] Implement metadata save
  - [ ] Update metadata fields in page data
  - [ ] Save entire page (content + metadata) via storage plugin
  - [ ] Metadata is part of PageContent JSON in storage

#### 5.5 Page API Integration
- [ ] Connect editor to backend APIs
  - [ ] Load page content on mount
  - [ ] Save content on autosave trigger
  - [ ] Handle 409 conflicts (concurrent edits)
  - [ ] Implement optimistic updates
- [ ] Add loading states and error handling
  - [ ] Skeleton loader while fetching
  - [ ] Error boundaries for component crashes
  - [ ] Retry mechanism for failed saves

---

### Week 6: Page Links (Spec #5)

**Goal**: Enable wiki-style internal linking

#### 6.1 Link Syntax Parsing
- [ ] Implement wiki link parser
  - [ ] Regex for `[[Page Title]]` syntax
  - [ ] Support `[[guid|Display Text]]` format
  - [ ] Parse external links with icon indicator
- [ ] Create remark plugin for link rendering
  - [ ] Convert wiki links to React components
  - [ ] Apply styling (color, underline)
  - [ ] Mark broken links with red color

#### 6.2 Link Resolution Service
- [ ] Build link resolver Lambda: `links-resolve`
  - [ ] Input: page title or GUID
  - [ ] Search through storage plugin (list all pages, filter by title)
  - [ ] Implement fuzzy matching on page titles
  - [ ] Return best match with confidence score
  - [ ] Handle ambiguous titles (multiple matches)
  - [ ] Consider caching page index for performance
- [ ] Implement broken link detection
  - [ ] Query storage plugin for page existence
  - [ ] Mark links with `?` icon
  - [ ] Provide "Create Page" quick action

#### 6.3 Link Autocomplete
- [ ] Build link suggestion component
  - [ ] Trigger on `[[` input in editor
  - [ ] Show dropdown with matching pages
  - [ ] Fuzzy search by title
  - [ ] Display folder path for context
  - [ ] Insert full wiki link on selection
- [ ] Optimize suggestion queries
  - [ ] Debounce input (200ms)
  - [ ] Limit results to 10 items
  - [ ] Cache recent searches

#### 6.4 Backlinks Tracking
- [ ] Create DynamoDB table: `page_links`
  - [ ] PK: `sourceGuid`, SK: `targetGuid`
  - [ ] GSI: `targetGuid-index` for backlinks query
- [ ] Build link extraction service
  - [ ] Parse page content on save
  - [ ] Extract all `[[]]` links
  - [ ] Update `page_links` table
  - [ ] Remove stale links
- [ ] Implement Lambda: `pages-backlinks` (GET /pages/{guid}/backlinks)
  - [ ] Query GSI by targetGuid
  - [ ] Return list of pages linking to this page
- [ ] Build "Linked Pages" sidebar widget
  - [ ] Show backlinks count
  - [ ] Display list of linking pages
  - [ ] Open page on click

#### 6.5 Create Page from Link
- [ ] Detect broken link click
- [ ] Open "Create Page" modal
  - [ ] Pre-fill title from link text
  - [ ] Select folder (default to current folder)
  - [ ] Option to create as draft
- [ ] Create page and update link
  - [ ] Generate new page GUID
  - [ ] Replace broken link with valid link
  - [ ] Save updated source page

---

### Week 7: Page Attachments (Spec #6)

**Goal**: Enable file uploads and management

#### 7.1 Upload Infrastructure
- [ ] Configure S3 bucket for attachments
  - [ ] Separate bucket or prefix: `attachments/`
  - [ ] Enable CORS for direct uploads
  - [ ] Set lifecycle policy (delete after 90 days for orphans)
- [ ] Implement presigned URL generation
  - [ ] Lambda: `attachments-get-upload-url` (POST /attachments/upload-url)
  - [ ] Input: filename, mimeType, pageGuid
  - [ ] Validate file type (whitelist: images, PDFs, docs)
  - [ ] Enforce size limit (50MB for MVP)
  - [ ] Return presigned PUT URL (15-minute expiry)

#### 7.2 Attachment Metadata
- [ ] Create DynamoDB table: `attachments`
  - [ ] PK: `guid`, GSI: `pageGuid-index`
  - [ ] Attributes: filename, size, mimeType, uploadedBy, uploadedAt, s3Key
- [ ] Implement Lambda: `attachments-create` (POST /attachments)
  - [ ] Called after S3 upload completes
  - [ ] Store attachment metadata in DynamoDB
  - [ ] Link attachment to page
- [ ] Implement Lambda: `attachments-list` (GET /pages/{pageGuid}/attachments)
  - [ ] Query attachments by pageGuid
  - [ ] Return sorted list (newest first)

#### 7.3 Frontend Upload UI
- [ ] Build file upload component
  - [ ] Drag-and-drop zone
  - [ ] File picker button (fallback)
  - [ ] Multi-file upload support
  - [ ] Progress bar per file
- [ ] Implement upload flow
  - [ ] 1. Request presigned URL
  - [ ] 2. Upload file directly to S3 (XMLHttpRequest/fetch)
  - [ ] 3. Track upload progress
  - [ ] 4. Call metadata API on completion
  - [ ] 5. Display attachment in list
- [ ] Add upload validation
  - [ ] Check file size before upload
  - [ ] Validate MIME type
  - [ ] Show error messages for invalid files

#### 7.4 Attachment Display & Management
- [ ] Build attachment list component
  - [ ] Show filename, size, upload date
  - [ ] Display file type icon
  - [ ] Download button (presigned GET URL)
  - [ ] Delete button (admin + author only)
- [ ] Implement image preview
  - [ ] Inline thumbnail for images
  - [ ] Lightbox/modal for full-size view
  - [ ] Support for common formats (JPEG, PNG, GIF, WebP)
- [ ] Implement Lambda: `attachments-download` (GET /attachments/{guid}/download)
  - [ ] Generate presigned S3 GET URL
  - [ ] Set Content-Disposition header (download vs. inline)
  - [ ] Return redirect or presigned URL
- [ ] Implement Lambda: `attachments-delete` (DELETE /attachments/{guid})
  - [ ] Verify permissions (author or admin)
  - [ ] Delete S3 object
  - [ ] Remove DynamoDB record
  - [ ] Return confirmation

#### 7.5 Editor Integration
- [ ] Add attachment button to editor toolbar
  - [ ] Open file picker
  - [ ] Upload and insert link
  - [ ] Insert Markdown image syntax: `![alt](url)`
- [ ] Display attachment panel below editor
  - [ ] List all page attachments
  - [ ] Quick-copy Markdown link
  - [ ] Drag-and-drop link into editor

---

## Phase 3: Search & Users (Weeks 8-9)

### Week 8: Wiki Search (Spec #7)

**Goal**: Implement full-text search across content

#### 8.1 Search Infrastructure Setup
- [ ] Provision AWS CloudSearch domain
  - [ ] Choose instance type (small.search for MVP)
  - [ ] Configure scaling (manual for cost control)
  - [ ] Set up VPC access (optional)
- [ ] Define CloudSearch document schema
  - [ ] Fields: `guid` (id), `title` (text), `content` (text), `tags` (text-array), `author` (literal), `modifiedAt` (date)
  - [ ] Configure field weights (title: 3x, content: 1x)
  - [ ] Enable stemming for English language
  - [ ] Configure result highlighting
- [ ] Set up IAM roles for Lambda access to CloudSearch

#### 8.2 Search Indexing
- [ ] Build search indexer Lambda: `search-index-page`
  - [ ] Triggered by S3 event (page save)
  - [ ] Or triggered by SQS queue (decoupled)
  - [ ] Load page via storage plugin `loadPage`
  - [ ] Extract plain text from Markdown content
  - [ ] Remove code blocks and special syntax
  - [ ] Extract metadata from PageContent (title, tags, author, etc.)
  - [ ] Submit document to CloudSearch
- [ ] Implement batch indexing
  - [ ] Lambda: `search-reindex-all` (admin operation)
  - [ ] Paginate through all pages
  - [ ] Batch submit to CloudSearch (100 docs/request)
  - [ ] Track indexing progress
- [ ] Handle indexing failures
  - [ ] Retry with exponential backoff
  - [ ] Dead-letter queue for failed documents
  - [ ] Admin alert on repeated failures

#### 8.3 Search API
- [ ] Implement Lambda: `search-query` (GET /search)
  - [ ] Query parameters: `q` (query), `folder` (GUID), `tags`, `author`, `dateFrom`, `dateTo`
  - [ ] Build CloudSearch query syntax
  - [ ] Apply permissions filter (exclude drafts for non-authors)
  - [ ] Execute search request
  - [ ] Parse and format results
  - [ ] Return ranked results with snippets
- [ ] Implement advanced search features
  - [ ] Phrase search: `"exact phrase"`
  - [ ] Exclusion: `-word`
  - [ ] Field search: `title:keyword`
  - [ ] Folder-scoped search (filter by folder hierarchy)
- [ ] Add pagination support
  - [ ] Default: 10 results per page
  - [ ] Max: 50 results per page
  - [ ] Return total count and next page cursor

#### 8.4 Frontend Search UI
- [ ] Build global search bar component
  - [ ] Keyboard shortcut: Cmd/Ctrl+K
  - [ ] Autocomplete dropdown (top 5 results)
  - [ ] Navigate to full results page on Enter
- [ ] Build search results page
  - [ ] Display results with title + snippet
  - [ ] Highlight matching keywords
  - [ ] Show page metadata (folder, author, date)
  - [ ] Click to open page
- [ ] Implement search filters
  - [ ] Folder selector (tree dropdown)
  - [ ] Tag multi-select
  - [ ] Author dropdown
  - [ ] Date range picker
- [ ] Add search suggestions
  - [ ] Track popular searches
  - [ ] Show "Did you mean?" for typos
  - [ ] Display "No results" with suggestions

#### 8.5 Search Performance Optimization
- [ ] Implement client-side caching
  - [ ] Cache search results (React Query)
  - [ ] 5-minute cache TTL
  - [ ] Invalidate on page edits
- [ ] Add search analytics
  - [ ] Log search queries (DynamoDB)
  - [ ] Track zero-result queries
  - [ ] Identify popular search terms

---

### Week 9: User Management (Spec #8)

**Goal**: Build admin tools for user management

#### 9.1 User Management API
- [ ] Implement Lambda: `admin-users-list` (GET /admin/users)
  - [ ] Scan users table (or GSI if large dataset)
  - [ ] Support pagination (lastKey cursor)
  - [ ] Filter by role, status (active/suspended)
  - [ ] Return user profiles (exclude passwordHash)
- [ ] Implement Lambda: `admin-users-get` (GET /admin/users/{userId})
  - [ ] Fetch user details
  - [ ] Include activity summary (page edits, comments)
  - [ ] Return last login timestamp
- [ ] Implement Lambda: `admin-users-update` (PUT /admin/users/{userId})
  - [ ] Allow role change (Standard ↔ Admin)
  - [ ] Update email (with verification)
  - [ ] Reset password (send reset email)
  - [ ] Cannot modify own admin role (safety)
- [ ] Implement Lambda: `admin-users-suspend` (POST /admin/users/{userId}/suspend)
  - [ ] Set user status to 'suspended'
  - [ ] Invalidate active sessions (optional)
  - [ ] Send suspension notification email
- [ ] Implement Lambda: `admin-users-activate` (POST /admin/users/{userId}/activate)
  - [ ] Reactivate suspended user
  - [ ] Send reactivation email
- [ ] Implement Lambda: `admin-users-delete` (DELETE /admin/users/{userId})
  - [ ] Soft delete: mark as deleted, anonymize data
  - [ ] Reassign owned pages to admin or archive
  - [ ] Preserve activity logs for audit

#### 9.2 Invitation Management
- [ ] Implement Lambda: `admin-invitations-create` (POST /admin/invitations)
  - [ ] Generate unique 8-char invite code
  - [ ] Store in `invitations` table with expiry (7 days)
  - [ ] Optional: specify role (default: Standard)
  - [ ] Send email via SES with registration link
- [ ] Implement Lambda: `admin-invitations-list` (GET /admin/invitations)
  - [ ] Return all invitations (pending, used, expired)
  - [ ] Show invitation status and expiry
  - [ ] Filter by status
- [ ] Implement Lambda: `admin-invitations-revoke` (DELETE /admin/invitations/{code})
  - [ ] Mark invitation as revoked
  - [ ] Prevent future use
- [ ] Add invitation email template
  - [ ] Personalized greeting
  - [ ] Registration link with embedded code
  - [ ] Expiry notice
  - [ ] Branding and styling

#### 9.3 Admin Dashboard UI
- [ ] Build user list page
  - [ ] Table with columns: Name, Email, Role, Status, Last Active, Actions
  - [ ] Sortable columns
  - [ ] Search/filter input
  - [ ] Pagination controls
- [ ] Build user detail modal
  - [ ] Display full profile
  - [ ] Show activity timeline (recent pages, comments)
  - [ ] Edit button for admins
  - [ ] Suspend/Activate toggle
- [ ] Build invitation management page
  - [ ] "Create Invitation" button
  - [ ] Invitation list table
  - [ ] Copy invite link button
  - [ ] Revoke button
- [ ] Build user edit form
  - [ ] Email input (with verification flow)
  - [ ] Role selector (Admin/Standard radio buttons)
  - [ ] "Send Password Reset" button
  - [ ] Save/Cancel actions

#### 9.4 User Profile Page
- [ ] Build public user profile view
  - [ ] Display name, email, role badge
  - [ ] Show user's recent contributions
  - [ ] List authored pages (if public)
  - [ ] Activity stats (pages edited, comments posted)
- [ ] Implement profile edit (self-service)
  - [ ] Update display name
  - [ ] Change password (require current password)
  - [ ] Update notification preferences
  - [ ] Cannot change own role

#### 9.5 Activity Logging
- [ ] Create DynamoDB table: `activity_log`
  - [ ] PK: `userId`, SK: `timestamp` (sortable)
  - [ ] Attributes: action, resourceType, resourceGuid, details
- [ ] Implement activity tracking
  - [ ] Log page creates/edits/deletes
  - [ ] Log user logins/logouts
  - [ ] Log admin actions (role changes, suspensions)
  - [ ] Retention: 90 days (DynamoDB TTL)
- [ ] Build activity viewer (admin only)
  - [ ] Filter by user, action type, date range
  - [ ] Export to CSV

---

## Phase 4: History & Navigation (Weeks 10-11)

### Week 10: Page History & Versioning (Spec #9)

**Goal**: Implement version control for pages

#### 10.1 S3 Versioning Setup
- [ ] Enable versioning on S3 pages bucket
  - [ ] Verify versioning is enabled
  - [ ] Configure lifecycle policy (retain 50 versions)
  - [ ] Set up MFA delete (optional, for production)
- [ ] Test version creation
  - [ ] Create page, edit multiple times
  - [ ] Verify each save creates new version
  - [ ] Check version ID format

#### 10.2 Version Retrieval API
- [ ] Implement Lambda: `pages-versions-list` (GET /pages/{guid}/versions)
  - [ ] Call storage plugin `listVersions` method
  - [ ] For each version, load page data to get metadata (author, timestamp, title)
  - [ ] Return chronological list (newest first) with metadata
- [ ] Implement Lambda: `pages-versions-get` (GET /pages/{guid}/versions/{versionId})
  - [ ] Retrieve specific version from S3
  - [ ] Deserialize page content
  - [ ] Fetch version metadata
  - [ ] Return full version data
- [ ] Implement Lambda: `pages-versions-restore` (POST /pages/{guid}/restore/{versionId})
  - [ ] Fetch historical version content
  - [ ] Create new version with restored content
  - [ ] Update metadata: add "Restored from version X" note
  - [ ] Return new current version

#### 10.3 Version Comparison
- [ ] Install diff library (e.g., `diff` or `jsdiff`)
- [ ] Implement Lambda: `pages-versions-compare` (GET /pages/{guid}/compare)
  - [ ] Query params: `from={versionId}&to={versionId}`
  - [ ] Fetch both version contents
  - [ ] Generate text diff (line-by-line or word-by-word)
  - [ ] Return diff data (additions, deletions, unchanged)
- [ ] Optimize diff performance
  - [ ] Limit diff to first 10,000 lines
  - [ ] Show warning for very large diffs
  - [ ] Use streaming for large content

#### 10.4 Frontend History UI
- [ ] Build version history timeline
  - [ ] Vertical timeline with version nodes
  - [ ] Show version timestamp and author
  - [ ] Display change summary (chars added/removed)
  - [ ] "View" and "Restore" buttons per version
- [ ] Build version viewer modal
  - [ ] Read-only Markdown preview
  - [ ] Show version metadata in header
  - [ ] "Restore This Version" button
  - [ ] "Compare with Current" link
- [ ] Build diff viewer component
  - [ ] Side-by-side or inline view toggle
  - [ ] Color-code additions (green) and deletions (red)
  - [ ] Syntax highlighting for Markdown
  - [ ] Line numbers for reference
  - [ ] "Apply Changes" button (for merge conflicts)
- [ ] Add "History" button to page editor
  - [ ] Opens history sidebar
  - [ ] Quick access to recent versions
  - [ ] Compare any two versions

#### 10.5 Version Metadata Tracking
- [ ] Enhance page data to track version metadata
  - [ ] Store version history in separate S3 objects or within page metadata
  - [ ] Track: versionId (from S3), author, timestamp, changeDescription
  - [ ] Option: Create `page-versions/{pageGuid}/{versionId}.json` for version metadata
- [ ] Update page save flow to record version metadata
  - [ ] On every save, capture author from JWT
  - [ ] Store modifiedBy and modifiedAt in page data
  - [ ] Optional: prompt for change description and store with version
- [ ] Implement change attribution
  - [ ] Show "Last edited by [User] on [Date]" from page metadata
  - [ ] Link to version history
- [ ] Add cleanup for old versions
  - [ ] Use S3 lifecycle policies for versions older than 1 year
  - [ ] Or manual archive process for old wikis

---

### Week 11: Navigation & Discovery (Spec #10)

**Goal**: Improve site navigation and discoverability

#### 11.1 Breadcrumb Navigation
- [ ] Build breadcrumb component
  - [ ] Display: Home > Folder > Subfolder > Page
  - [ ] Each segment is clickable link
  - [ ] Truncate long folder names (ellipsis + tooltip)
  - [ ] Collapse middle segments on mobile (Home > ... > Current)
- [ ] Implement breadcrumb data fetching
  - [ ] Traverse folder hierarchy from current page
  - [ ] Build path array: [root, parent, ..., current]
  - [ ] Cache folder hierarchy (React Query)
- [ ] Integrate breadcrumbs into page layout
  - [ ] Position: top of content area, below header
  - [ ] Sticky on scroll (optional)
  - [ ] Accessible: use `<nav>` with aria-label

#### 11.2 Table of Contents
- [ ] Build TOC generator
  - [ ] Parse Markdown content for headers (h2-h6)
  - [ ] Extract header text and level
  - [ ] Generate unique anchor IDs (slugify)
  - [ ] Build nested TOC structure
- [ ] Implement TOC component
  - [ ] Hierarchical list (nested ul/li)
  - [ ] Clickable links scroll to section
  - [ ] Highlight active section on scroll
  - [ ] Collapsible sections for long TOCs
- [ ] Integrate TOC into page layout
  - [ ] Desktop: sticky sidebar on right
  - [ ] Mobile: collapsible section at top
  - [ ] Toggle button: "On this page"
- [ ] Add smooth scrolling
  - [ ] Animate scroll to target section
  - [ ] Offset for fixed header
  - [ ] Update URL hash on scroll

#### 11.3 Sitemap View
- [ ] Implement Lambda: `sitemap-get` (GET /sitemap)
  - [ ] Fetch all folders and pages
  - [ ] Build tree structure (recursive)
  - [ ] Respect permissions (exclude drafts)
  - [ ] Return hierarchical JSON
- [ ] Build sitemap tree component
  - [ ] Recursive tree rendering
  - [ ] Expandable/collapsible nodes
  - [ ] Click to navigate to page
  - [ ] Visual indicators (folder icons, page icons)
- [ ] Add sitemap search
  - [ ] Filter tree by keyword
  - [ ] Expand matching nodes
  - [ ] Highlight matched text
- [ ] Create sitemap page
  - [ ] Full-page tree view
  - [ ] Accessible via navigation menu
  - [ ] Print-friendly CSS for tree view

#### 11.4 Recent Changes Feed (P3 - Optional)
- [ ] Implement Lambda: `recent-changes` (GET /recent)
  - [ ] Query params: `limit={n}` (default: 20), `days={d}` (default: 7)
  - [ ] Fetch recent page edits from activity log
  - [ ] Include author, timestamp, change summary
  - [ ] Return chronological list
- [ ] Build recent changes widget
  - [ ] Display on dashboard
  - [ ] Show: Page Title, Author, Timestamp, "View Changes" link
  - [ ] Filter by folder or author
- [ ] Add RSS feed (optional)
  - [ ] Generate RSS XML for recent changes
  - [ ] Subscribe via feed reader

---

## Phase 5: Permissions & Mobile (Week 12)

### Week 12: Role-Based Access & Mobile Optimization

**Goal**: Enforce permissions and optimize for mobile devices

#### 12.1 Permission Enforcement (Spec #11)
- [ ] Implement permission middleware
  - [ ] Extract user role from JWT
  - [ ] Check required role for endpoint
  - [ ] Return 403 Forbidden if insufficient permissions
- [ ] Apply permissions to APIs
  - [ ] Admin-only: User management, invitations, configuration
  - [ ] Standard: Read all published pages, edit own drafts
  - [ ] Draft visibility: author + admins only
- [ ] Filter search results by permissions
  - [ ] Exclude drafts authored by others
  - [ ] Hide pages in restricted folders (future feature)
- [ ] Update UI based on role
  - [ ] Show/hide admin menu items
  - [ ] Display "Admin" badge for admin users
  - [ ] Disable edit controls for non-authors
- [ ] Add permission checks to frontend
  - [ ] Wrap admin routes in PermissionGuard component
  - [ ] Show 403 error page for unauthorized access
  - [ ] Redirect to login if not authenticated

#### 12.2 Mobile-Responsive Design (Spec #12)
- [ ] Define responsive breakpoints in Tailwind
  - [ ] Mobile: 0-767px
  - [ ] Tablet: 768-1023px
  - [ ] Desktop: 1024px+
- [ ] Optimize header for mobile
  - [ ] Hamburger menu icon
  - [ ] Collapsible navigation drawer
  - [ ] Search icon (opens search overlay)
- [ ] Adapt folder tree for mobile
  - [ ] Collapsible drawer (swipe from left)
  - [ ] Overlay when open (dim background)
  - [ ] Close on navigation
- [ ] Optimize editor for mobile
  - [ ] Simplified toolbar (essential buttons only)
  - [ ] Bottom toolbar placement (thumb-friendly)
  - [ ] Hide preview by default (toggle button)
  - [ ] Markdown shortcuts cheat sheet
- [ ] Ensure touch-friendly UI
  - [ ] Button min size: 44x44px
  - [ ] Adequate spacing between interactive elements
  - [ ] Large tap targets for links
  - [ ] Swipe gestures (optional):
    - [ ] Swipe right: open sidebar
    - [ ] Swipe left: close sidebar

#### 12.3 Mobile Testing
- [ ] Test on iOS Safari
  - [ ] iPhone SE, iPhone 12/13, iPhone 14 Pro
  - [ ] iPad (both orientations)
- [ ] Test on Android Chrome
  - [ ] Pixel 5, Samsung Galaxy S21
  - [ ] Tablet (7" and 10")
- [ ] Test responsive layouts
  - [ ] Breakpoint transitions
  - [ ] Orientation changes
  - [ ] Text readability (font sizes)
  - [ ] Form usability (input fields, dropdowns)
- [ ] Accessibility on mobile
  - [ ] Screen reader compatibility (VoiceOver, TalkBack)
  - [ ] Focus indicators for keyboard navigation
  - [ ] Zoom support (up to 200%)

---

## Phase 6: Advanced Features (Week 13)

### Week 13A: Home/Dashboard (Spec #13)

**Goal**: Create personalized landing page

#### 13.1 Dashboard API
- [ ] Implement Lambda: `dashboard-get` (GET /dashboard)
  - [ ] Fetch user's recent activity (last 10 pages viewed/edited)
  - [ ] Retrieve favorite pages from user preferences
  - [ ] Get global stats: total pages, total users, wiki age
  - [ ] Return dashboard data bundle
- [ ] Implement Lambda: `dashboard-favorites` (POST/DELETE /dashboard/favorites)
  - [ ] Add/remove page from favorites
  - [ ] Store in DynamoDB: `user_preferences` table
  - [ ] Return updated favorites list

#### 13.2 Dashboard UI Components
- [ ] Build welcome banner
  - [ ] Greeting: "Welcome, [Name]!"
  - [ ] Random tip or help link
  - [ ] Quick action buttons: New Page, Search, Admin
- [ ] Build recent activity widget
  - [ ] List last 10 pages user interacted with
  - [ ] Show page title, timestamp, action (viewed, edited)
  - [ ] Click to open page
- [ ] Build favorites section
  - [ ] Display favorite pages as cards or list
  - [ ] Star icon to add/remove favorites
  - [ ] Drag to reorder (optional)
- [ ] Build quick stats widget
  - [ ] Total pages in wiki
  - [ ] Your contributions (pages created/edited)
  - [ ] Recent contributors this week
- [ ] Assemble dashboard layout
  - [ ] Responsive grid (1 col mobile, 2-3 cols desktop)
  - [ ] Widgets: Welcome, Recent Activity, Favorites, Stats
  - [ ] Customization: allow users to rearrange widgets (P3)

#### 13.3 Dashboard Personalization (P3 - Optional)
- [ ] Allow widget customization
  - [ ] Show/hide widgets
  - [ ] Reorder widgets via drag-and-drop
  - [ ] Save layout in user preferences
- [ ] Add custom quick links
  - [ ] User-defined shortcuts to important pages
  - [ ] Editable list with URL input

---

### Week 13B: Export Functionality (Spec #14)

**Goal**: Enable PDF and HTML exports

#### 14.1 PDF Export
- [ ] Set up Puppeteer in Lambda
  - [ ] Use Lambda layer for Chromium binary
  - [ ] Or use Puppeteer Serverless package
  - [ ] Allocate sufficient Lambda memory (1024MB+)
- [ ] Implement Lambda: `export-pdf` (GET /pages/{guid}/export/pdf)
  - [ ] Render page content as HTML
  - [ ] Apply print-friendly CSS
  - [ ] Use Puppeteer to generate PDF
  - [ ] Upload PDF to S3 exports bucket
  - [ ] Generate presigned URL (1-hour expiry)
  - [ ] Return download URL
- [ ] Customize PDF styling
  - [ ] Header: Page title, author, date
  - [ ] Footer: Page number, wiki name
  - [ ] Table of contents (if multiple pages)
  - [ ] Syntax highlighting for code blocks
- [ ] Optimize PDF generation
  - [ ] Cache rendered PDFs (1 hour)
  - [ ] Queue exports for large pages (SQS)
  - [ ] Timeout: 30 seconds (Lambda limit)

#### 14.2 HTML Export
- [ ] Implement Lambda: `export-html` (GET /folders/{guid}/export/html)
  - [ ] Fetch all pages in folder (recursive)
  - [ ] Render each page as static HTML
  - [ ] Generate navigation links (TOC)
  - [ ] Bundle CSS and assets
  - [ ] Create ZIP archive
  - [ ] Upload to S3 exports bucket
  - [ ] Return download URL
- [ ] Include attachments in export
  - [ ] Copy attachments to export bundle
  - [ ] Update links to relative paths
- [ ] Add offline viewing support
  - [ ] Embed CSS inline
  - [ ] Include Markdown in HTML comments (optional)
  - [ ] Service worker for offline access (P3)

#### 14.3 Export UI
- [ ] Add "Export" button to page actions
  - [ ] Dropdown: "Export as PDF", "Export as HTML"
  - [ ] Show progress indicator during export
  - [ ] Download automatically on completion
- [ ] Add folder export option
  - [ ] Right-click folder: "Export as HTML"
  - [ ] Show export progress (X of Y pages)
  - [ ] Notify on completion

---

## Phase 7: Collaboration & Metadata (Weeks 14-16)

### Week 14A: Page Comments (Spec #15)

**Goal**: Enable discussions on pages

#### 14.1 Comments Data Model
- [ ] Create DynamoDB table: `comments`
  - [ ] PK: `guid` (comment ID)
  - [ ] GSI: `pageGuid-createdAt-index` for retrieval
  - [ ] Attributes: pageGuid, userId, content, parentGuid (for replies), createdAt, updatedAt
- [ ] Design threaded comment structure
  - [ ] Root comments: parentGuid is null
  - [ ] Replies: parentGuid references root or another reply
  - [ ] Max depth: 3 levels (root → reply → reply)

#### 14.2 Comments API
- [ ] Implement Lambda: `comments-list` (GET /pages/{pageGuid}/comments)
  - [ ] Query comments by pageGuid
  - [ ] Sort chronologically (oldest first)
  - [ ] Include author details (name, role)
  - [ ] Support pagination (50 comments per page)
- [ ] Implement Lambda: `comments-create` (POST /pages/{pageGuid}/comments)
  - [ ] Validate content (1-5000 characters)
  - [ ] Store comment in DynamoDB
  - [ ] Return created comment with ID
- [ ] Implement Lambda: `comments-update` (PUT /comments/{guid})
  - [ ] Verify user is comment author or admin
  - [ ] Update content and timestamp
  - [ ] Mark as edited
- [ ] Implement Lambda: `comments-delete` (DELETE /comments/{guid})
  - [ ] Verify permissions
  - [ ] Soft delete: mark as deleted, keep for audit
  - [ ] Or hard delete: remove from DynamoDB
  - [ ] Handle nested replies (cascade or orphan)
- [ ] Implement Lambda: `comments-reply` (POST /comments/{guid}/reply)
  - [ ] Create reply with parentGuid set
  - [ ] Link to original comment

#### 14.3 Frontend Comments UI
- [ ] Build comments section component
  - [ ] Display below page content
  - [ ] Show comment count in header
  - [ ] Collapsible section
- [ ] Build comment card component
  - [ ] Author name, avatar (gravatar or initials), timestamp
  - [ ] Markdown-rendered comment content
  - [ ] Actions: Reply, Edit (if author), Delete (if author/admin)
  - [ ] Show "Edited" tag if modified
- [ ] Implement comment composer
  - [ ] Textarea with Markdown toolbar
  - [ ] Live preview (optional)
  - [ ] Character counter (0/5000)
  - [ ] Submit button
- [ ] Implement threaded replies
  - [ ] Indent nested replies
  - [ ] "Reply" button opens nested composer
  - [ ] Collapse/expand reply threads
- [ ] Add edit/delete functionality
  - [ ] Inline edit mode (replace content with textarea)
  - [ ] Delete confirmation dialog
  - [ ] Optimistic UI updates

#### 14.4 @Mentions (P3 - Optional)
- [ ] Parse @username in comment content
  - [ ] Use regex to detect @mentions
  - [ ] Link to user profile
  - [ ] Highlight mentioned user
- [ ] Implement mention notifications
  - [ ] Store mention in DynamoDB: `notifications` table
  - [ ] Send email notification to mentioned user
  - [ ] In-app notification badge

---

### Week 14B: Page Metadata (Spec #16)

**Goal**: Add tags, categories, and custom fields

#### 14.1 Metadata Data Model
- [ ] Extend PageContent structure in storage plugin
  - [ ] Add fields: tags (array), category (string), status (Draft/Published/Archived), customFields (object)
  - [ ] All metadata stored within page JSON in storage
- [ ] Define status values
  - [ ] Draft: Visible to author + admins
  - [ ] Published: Visible to all users
  - [ ] Archived: Read-only, visible to all

#### 14.2 Metadata API
- [ ] Implement Lambda: `metadata-update` (PUT /pages/{guid}/metadata)
  - [ ] Load page from storage plugin
  - [ ] Allow updates to tags, category, status, customFields
  - [ ] Validate status transitions (Draft → Published → Archived)
  - [ ] Update page data and save via storage plugin
  - [ ] Trigger search reindex
- [ ] Implement Lambda: `tags-list` (GET /tags)
  - [ ] List all pages from storage plugin
  - [ ] Extract and aggregate unique tags
  - [ ] Include usage count per tag
  - [ ] Sort by popularity or alphabetically
  - [ ] Consider caching this data
- [ ] Implement Lambda: `categories-list` (GET /categories)
  - [ ] List all pages from storage plugin
  - [ ] Extract and aggregate unique categories
  - [ ] Include page count per category
  - [ ] Consider caching this data

#### 14.3 Frontend Metadata UI
- [ ] Build metadata panel in editor
  - [ ] Tags input (multi-select autocomplete)
  - [ ] Category dropdown (or create new)
  - [ ] Status selector (Draft/Published/Archived)
  - [ ] Custom fields editor (key-value pairs)
- [ ] Build tag badge component
  - [ ] Display tags as colored pills
  - [ ] Click tag to view tagged pages
- [ ] Build category indicator
  - [ ] Show category icon + name
  - [ ] Link to category page (list of pages)
- [ ] Add filtering by metadata
  - [ ] Search page: filter by tags, category, status
  - [ ] Folder view: filter pages by metadata

#### 14.4 Custom Metadata Fields (P3 - Optional)
- [ ] Define custom field types
  - [ ] Text, number, date, boolean, dropdown
- [ ] Build custom field editor
  - [ ] Add/remove fields dynamically
  - [ ] Validate field types
  - [ ] Store in `customFields` JSON column
- [ ] Enable search on custom fields
  - [ ] Index custom fields in CloudSearch
  - [ ] Query by field name and value

---

### Week 15-16: Admin Configuration & Onboarding (Specs #17-19)

**Goal**: Complete admin tools, onboarding, and error handling

#### 15.1 Admin Configuration (Spec #17)
- [ ] Create DynamoDB table: `site_config`
  - [ ] PK: `configKey`
  - [ ] Attributes: value (JSON), updatedBy, updatedAt
- [ ] Implement Lambda: `config-get` (GET /admin/config)
  - [ ] Fetch all configuration settings
  - [ ] Return as key-value pairs
- [ ] Implement Lambda: `config-update` (PUT /admin/config)
  - [ ] Validate configuration values
  - [ ] Update in DynamoDB
  - [ ] Apply changes (e.g., restart services if needed)
- [ ] Build admin configuration UI
  - [ ] Site settings: wiki name, description, logo
  - [ ] Theme settings: color scheme, fonts
  - [ ] Module toggles: enable/disable comments, exports
  - [ ] System health: storage usage, API metrics
- [ ] Add system health dashboard
  - [ ] S3 storage used / available
  - [ ] DynamoDB read/write capacity
  - [ ] Lambda invocations and errors
  - [ ] CloudWatch alarms status

#### 15.2 Onboarding & Help (Spec #18)
- [ ] Build first-time user tour
  - [ ] Step-by-step walkthrough (5-7 steps)
  - [ ] Highlight key features: Editor, Folders, Search
  - [ ] Use library like Intro.js or React Joyride
  - [ ] Track completion in user preferences
- [ ] Create Markdown help modal
  - [ ] Syntax cheat sheet (headers, lists, links, etc.)
  - [ ] Interactive examples with preview
  - [ ] Accessible via "?" icon in editor
- [ ] Add contextual tooltips
  - [ ] Hover tooltips for icon buttons
  - [ ] Inline help text for complex forms
  - [ ] "Learn more" links to documentation
- [ ] Build documentation site (optional)
  - [ ] Static site with guides and FAQs
  - [ ] Host on S3 + CloudFront
  - [ ] Link from app footer

#### 15.3 Error Handling & Edge Cases (Spec #19)
- [ ] Implement global error boundaries
  - [ ] React error boundary component
  - [ ] Display user-friendly error page
  - [ ] Log errors to CloudWatch
  - [ ] "Report Issue" button (optional)
- [ ] Handle AWS service outages
  - [ ] Detect S3/DynamoDB errors
  - [ ] Show offline mode banner
  - [ ] Queue writes for retry (local storage)
  - [ ] Graceful degradation (disable features)
- [ ] Implement conflict resolution
  - [ ] Detect concurrent edits (version mismatch)
  - [ ] Show conflict dialog with diff
  - [ ] Allow user to merge or overwrite
- [ ] Add input validation
  - [ ] Client-side validation (forms)
  - [ ] Server-side validation (Lambda)
  - [ ] Display field-specific errors
  - [ ] Prevent XSS and injection attacks
- [ ] Implement rate limiting
  - [ ] API Gateway throttling (100 req/sec per user)
  - [ ] Lambda concurrency limits
  - [ ] Display "Too many requests" error
- [ ] Add retry logic
  - [ ] Exponential backoff for transient errors
  - [ ] Max 3 retries per request
  - [ ] User notification on repeated failures
- [ ] Build monitoring and alerts
  - [ ] CloudWatch alarms for errors
  - [ ] SNS notifications to admins
  - [ ] Daily error summary email

---

## Post-Implementation Tasks

### Testing & Quality Assurance
- [ ] Write unit tests (target: 80% coverage)
  - [ ] Frontend: Components, hooks, utils
  - [ ] Backend: Lambda functions, services
- [ ] Write integration tests
  - [ ] API endpoint flows
  - [ ] Database operations
  - [ ] S3 storage plugin
- [ ] Write E2E tests with Playwright
  - [ ] User authentication flow
  - [ ] Page creation and editing
  - [ ] Search functionality
  - [ ] Admin operations
- [ ] Perform accessibility audit
  - [ ] Use Axe DevTools or Lighthouse
  - [ ] Test with screen reader (NVDA, JAWS, VoiceOver)
  - [ ] Fix WCAG 2.1 AA violations
- [ ] Conduct security audit
  - [ ] OWASP Top 10 checklist
  - [ ] Penetration testing (optional)
  - [ ] Dependency vulnerability scan (npm audit)
- [ ] Load testing
  - [ ] Simulate 100 concurrent users
  - [ ] Test search performance under load
  - [ ] Verify Lambda auto-scaling

### Documentation
- [ ] Write user documentation
  - [ ] Getting started guide
  - [ ] Feature tutorials (editor, search, etc.)
  - [ ] FAQs
- [ ] Write developer documentation
  - [ ] Architecture overview
  - [ ] API reference
  - [ ] Deployment guide
  - [ ] Plugin development guide
- [ ] Create video tutorials (optional)
  - [ ] Screen recordings of key features
  - [ ] Upload to YouTube or embed in docs

### Deployment
- [ ] Validate local development with Aspire
  - [ ] Ensure all services run correctly in Aspire
  - [ ] Test service-to-service communication
  - [ ] Verify observability and telemetry
  - [ ] Review Aspire Dashboard for performance insights
- [ ] Set up production environment
  - [ ] Deploy infrastructure via CDK
  - [ ] Configure custom domain and SSL
  - [ ] Set up monitoring and alarms
  - [ ] Note: Aspire is for local dev only; production uses AWS native services
- [ ] Perform blue-green deployment
  - [ ] Deploy to staging environment
  - [ ] Run smoke tests
  - [ ] Switch traffic to new version
  - [ ] Rollback plan in case of issues
- [ ] Configure backups
  - [ ] Enable S3 versioning and replication
  - [ ] DynamoDB on-demand backups
  - [ ] Automated daily backups
- [ ] Set up disaster recovery
  - [ ] Multi-region replication (optional)
  - [ ] Recovery time objective (RTO): 4 hours
  - [ ] Recovery point objective (RPO): 24 hours

### Launch & Onboarding
- [ ] Conduct beta testing with 3-5 families
  - [ ] Collect feedback on usability
  - [ ] Identify bugs and edge cases
  - [ ] Iterate on features
- [ ] Create launch announcement
  - [ ] Blog post or email to beta users
  - [ ] Feature highlights and demo
  - [ ] Invitation to provide feedback
- [ ] Onboard first production users
  - [ ] Send invitations
  - [ ] Provide setup assistance
  - [ ] Monitor for issues during first week

---

## Risk Mitigation Tasks

### Technical Risks
- [ ] S3 latency issues
  - Mitigation: Use CloudFront for caching
- [ ] DynamoDB throttling
  - Mitigation: Enable auto-scaling, use exponential backoff
- [ ] CloudSearch cost overruns
  - Mitigation: Monitor spend, consider OpenSearch Serverless or Algolia
- [ ] Lambda cold start latency
  - Mitigation: Provisioned concurrency for critical functions, optimize bundle size

### Timeline Risks
- [ ] Scope creep
  - Mitigation: Strict prioritization (P1 → P2 → P3), defer non-MVP features
- [ ] Underestimated complexity
  - Mitigation: Add 20% buffer to each phase, weekly progress reviews
- [ ] Dependency delays (AWS services)
  - Mitigation: Have fallback options (e.g., local search if CloudSearch unavailable)

### Security Risks
- [ ] Data breach
  - Mitigation: Encrypt data at rest (S3, DynamoDB), use IAM least privilege
- [ ] Authentication bypass
  - Mitigation: Regular security audits, JWT token validation
- [ ] DDoS attacks
  - Mitigation: AWS Shield, rate limiting, CloudFront WAF

---

## Success Metrics & KPIs

### Post-Launch Metrics to Track
- [ ] User engagement
  - [ ] Daily active users (DAU)
  - [ ] Pages created per user per week
  - [ ] Search queries per day
- [ ] Performance metrics
  - [ ] Average page load time (target: < 200ms)
  - [ ] Search response time (target: < 1s)
  - [ ] Lambda error rate (target: < 0.1%)
- [ ] Cost metrics
  - [ ] Monthly AWS bill (target: < $5 for 5-user wiki)
  - [ ] Cost per user
  - [ ] Storage growth rate
- [ ] User satisfaction
  - [ ] Net Promoter Score (NPS)
  - [ ] Feature usage statistics
  - [ ] Support ticket volume

---

## Conclusion

This task list represents a comprehensive implementation plan for BlueFinWiki based on the 19 specifications. Tasks are organized by phase and week, with clear deliverables and acceptance criteria. The total effort is estimated at 12-16 weeks with a team of 2-3 developers.

**Next Steps**:
1. Review and prioritize tasks
2. Assign tasks to team members
3. Set up project tracking (Jira, Linear, or GitHub Projects)
4. Begin Phase 1: Foundation

**Questions or clarifications?** Refer to the individual specification files (1-19) for detailed requirements.

---

**Document Version**: 1.0  
**Last Updated**: February 6, 2026  
**Maintained By**: Development Team
