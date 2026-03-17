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
- [x] Set up Aspire AppHost project structure
  - [x] Create `aspire/BlueFinWiki.AppHost` directory
  - [x] Initialize with `dotnet new aspire-apphost -n BlueFinWiki.AppHost`
  - [x] Create `aspire/BlueFinWiki.ServiceDefaults` for shared configuration
  - [x] Initialize with `dotnet new aspire-servicedefaults -n BlueFinWiki.ServiceDefaults`
- [x] Configure Aspire service orchestration
  - [x] Add Node.js project reference for backend (Lambda functions running locally)
  - [x] Add Node.js project reference for frontend (Vite dev server)
  - [x] Configure port mappings and environment variables
  - [x] Set up service-to-service communication
- [x] Configure local AWS service emulation
  - [x] Add LocalStack container resource to Aspire
  - [x] Configure S3, DynamoDB, and SES emulation
  - [x] Set up automatic container startup with Aspire
- [x] Set up Aspire Dashboard
  - [x] Configure telemetry collection (OpenTelemetry)
  - [x] Enable distributed tracing between services
  - [x] Configure structured logging
  - [x] Set up metrics collection
- [x] Create local environment configuration
  - [x] Define appsettings.Development.json for Aspire
  - [x] Configure connection strings and service endpoints
  - [x] Set up local secrets management

#### 1.3 AWS Cloud Infrastructure as Code
- [X] Choose IaC tool (AWS CDK with C# recommended)
- [X] Initialize CDK project with C# (`cdk init app --language csharp`)
- [X] Configure C# project structure (Program.cs, Stack classes)
- [X] Define three environments: dev, staging, production
- [X] Create CloudFormation stacks:
  - [X] Network stack (VPC, subnets - if needed)
  - [X] Storage stack (S3 buckets: pages, exports) ⚠️ Remove attachments bucket - per spec #6, attachments stored in pages bucket
  - [X] Database stack (DynamoDB tables)
  - [ ] Auth stack (Cognito User Pool, User Pool Client, Identity Pool if needed)
  - [X] Compute stack (Lambda functions, API Gateway)
  - [X] CDN stack (CloudFront distribution)
- [X] Configure environment variables per stack
- [X] Set up AWS Secrets Manager for sensitive data
- [ ] Deploy dev environment infrastructure
- [X] Document differences between Aspire local setup and AWS cloud deployment

#### 1.4 Database Schema Design
- [X] Create AWS Cognito User Pool
  - [X] Configure user attributes: email (required, unique), name, custom:role (Standard/Admin)
  - [X] Set up password policy (min 8 chars, uppercase, lowercase, numbers, symbols)
  - [X] Enable email verification and MFA (optional for MVP)
  - [X] Configure password recovery flow
- [X] Create Cognito User Pool Client
  - [X] Configure OAuth flows (authorization code + implicit)
  - [X] Set token expiration (access: 1 hour, refresh: 30 days)
  - [X] Enable SRP (Secure Remote Password) authentication
- [X] Create DynamoDB table: `user_profiles`
  - PK: `cognitoUserId` (Cognito sub claim)
  - Attributes: email, displayName, role, inviteCode (for tracking), status, createdAt, lastLogin
  - GSI: `email-index` for profile lookups
  - Note: Core auth data in Cognito, extended profile data in DynamoDB
- [X] Configure Cognito for local development
  - [X] Add Cognito Local container resource in AppHost (use cognito-local or mock)
  - [X] Configure test user pool and seed development users
  - [X] Set up local environment variables for Cognito endpoints
- [X] Note: Folders and metadata are stored via storage plugin (S3/GitHub), not DynamoDB
- [ ] Configure billing alarms for Cognito, DynamoDB and S3 (cloud only)
- [X] Document Cognito integration and local vs. cloud authentication differences

---

### Week 2: Authentication System (Spec #1)

**Goal**: Implement secure invite-only authentication

#### 2.1 Backend Authentication Services (Cognito Integration)
- [X] Create Lambda function: `auth-register`
  - [X] Validate invitation code against `invitations` table
  - [X] Call Cognito AdminCreateUser API to create user
  - [X] Set initial password (temporary, user must change on first login)
  - [X] Set user attributes: email, name, custom:role
  - [X] Create user profile in DynamoDB `user_profiles` table
  - [X] Mark invitation code as used
  - [X] Send welcome email via Cognito or SES
- [X] Create Lambda function: `auth-post-confirmation` (Cognito trigger)
  - [X] Triggered after user confirms email or changes initial password
  - [X] Update user profile in DynamoDB (status: active)
  - [X] Log first login timestamp
- [X] Create Lambda function: `auth-pre-token-generation` (Cognito trigger)
  - [X] Add custom claims to JWT token (role, preferences)
  - [X] Load user profile from DynamoDB
  - [X] Inject custom:role into access token claims
- [X] Implement JWT validation middleware for API Gateway
  - [X] Configure Cognito User Pool as authorizer
  - [X] Verify JWT signature using Cognito public keys (JWKS)
  - [X] Extract user claims from token (sub, email, custom:role)
  - [X] Attach user context to Lambda event
- [X] Configure Aspire for local Cognito development
  - [X] Use cognito-local Docker container or mock service
  - [X] Set up local user pool with test users
  - [X] Configure local OAuth endpoints

#### 2.2 Password Reset Flow (Cognito Managed)
- [X] Configure Cognito email settings
  - [X] Use Cognito default email (development) or configure custom SES
  - [X] Customize password reset email template in Cognito console
  - [X] Set up email verification code expiry (1 hour default)
  - [X] Configure SMTP container or mock email service in Aspire for local testing
    - [X] Add MailHog or similar SMTP container to AppHost
    - [X] Configure Cognito to use local SMTP for development
    - [X] Configure email viewing at http://localhost:8025
- [X] Create Lambda function: `auth-forgot-password-trigger` (optional)
  - [X] Cognito pre-password-reset trigger for custom logic
  - [X] Log password reset requests for security monitoring
  - [X] Apply rate limiting (prevent abuse)
- [X] Create Lambda function: `auth-custom-message` (Cognito trigger, optional)
  - [X] Customize password reset email content
  - [X] Add branding and custom links
  - [X] Use SES templates for rich HTML emails
- [X] Frontend integration
  - [X] Use Cognito SDK to trigger forgotPassword flow
  - [X] No custom backend endpoints needed (Cognito handles it)
  - [X] Handle verification code submission via confirmPassword API

#### 2.3 Invitation System (Cognito Compatible)
- [X] Create DynamoDB table: `invitations`
  - PK: `inviteCode` (8-char alphanumeric)
  - Attributes: email (optional), role, createdBy, createdAt, expiresAt, status (pending/used/revoked), usedBy, usedAt
  - TTL: expiresAt (auto-delete after 30 days)
- [X] Create Lambda function: `admin-create-invitation`
  - [X] Generate unique invite code (8-character alphanumeric)
  - [X] Store in DynamoDB `invitations` table
  - [X] Set expiry (7 days default)
  - [X] Optional: pre-assign email (for targeted invites)
  - [X] Send invitation email with registration link (includes invite code)
  - [X] Link format: https://wiki.example.com/register?invite={code}
- [X] Create Lambda function: `admin-list-invitations`
  - [X] Query all invitations from DynamoDB
  - [X] Return pending, used, expired, and revoked invitations
  - [X] Include usage status and expiry
- [X] Create Lambda function: `admin-revoke-invitation`
  - [X] Mark invitation as revoked in DynamoDB
  - [X] Prevent future use in registration flow
- [X] Update `auth-register` Lambda to validate invitation
  - [X] Check invite code exists and is valid (not used/revoked/expired)
  - [X] Verify email matches (if pre-assigned)
  - [X] Mark invitation as used after Cognito user creation

#### 2.4 Frontend Authentication UI (Cognito Integration)
- [X] Install AWS Amplify or amazon-cognito-identity-js SDK
  - [X] Configure Cognito User Pool ID and Client ID
  - [X] Set up Amplify Auth module or Cognito SDK
  - [X] Configure OAuth redirect URIs (for hosted UI if used)
- [X] Build login page component
  - [X] Email/password form with validation
  - [X] Use Cognito signIn API (Auth.signIn)
  - [X] "Remember me" option (device tracking)
  - [X] "Forgot password" link
  - [X] Handle Cognito errors (UserNotConfirmedException, NotAuthorizedException, etc.)
  - [X] Error handling and display
- [X] Build registration page component
  - [X] Invite code input (validated against backend API)
  - [X] Call backend `auth-register` Lambda (which creates Cognito user)
  - [X] Handle temporary password flow (user changes on first login)
  - [X] Or use Cognito signUp API if allowing self-registration
  - [X] Password strength indicator (Cognito enforces policy)
  - [X] Terms acceptance checkbox
- [X] Build password reset flow
  - [X] Request reset page: call Cognito forgotPassword API
  - [X] Reset confirmation page: submit verification code via forgotPasswordSubmit
  - [X] Success/error messaging
  - [X] Cognito handles token generation and email sending
- [X] Implement authentication context (React Context API)
  - [X] Store user state from Cognito (userId=sub, email, custom:role)
  - [X] Use Cognito currentAuthenticatedUser API to check session
  - [X] Provide login/logout methods (Auth.signIn, Auth.signOut)
  - [X] Handle automatic token refresh (Cognito SDK does this)
  - [X] Listen for Cognito Hub events (signIn, signOut, tokenRefresh)
- [X] Create protected route wrapper component
  - [X] Check Cognito session on route access
  - [X] Redirect to login if unauthenticated
  - [X] Show loading state during auth check
  - [X] Extract user claims from Cognito tokens

---

### Week 3: Storage Plugin Interface (Spec #2)

**Goal**: Implement pluggable S3 storage backend

#### 3.1 Storage Plugin Architecture
- [X] Define storage plugin TypeScript interface (for backend Lambda functions):
  ```typescript
  interface StoragePlugin {
    savePage(guid: string, parentGuid: string | null, content: PageContent): Promise<void>;
    loadPage(guid: string): Promise<PageContent>;
    deletePage(guid: string, recursive?: boolean): Promise<void>;
    listVersions(guid: string): Promise<Version[]>;
    listChildren(parentGuid: string | null): Promise<PageSummary[]>;
    movePage(guid: string, newParentGuid: string | null): Promise<void>;
  }
  ```
  Note: Pages ARE folders. A page is a .md file, and if it has children, they are stored in a directory named `{page-guid}/`
- [X] Create abstract base class for storage plugins
- [X] Document plugin interface and extension points
- [X] Create plugin registry/loader mechanism

#### 3.2 S3 Storage Plugin Implementation
- [X] Implement `S3StoragePlugin` class
  - [X] Initialize S3 client with AWS SDK v3
  - [X] Configure bucket names from environment
  - [X] Implement error handling wrapper
- [X] Implement `savePage` method
  - [X] Generate GUID if not provided (uuid v4)
  - [X] Determine S3 path based on parent: root pages at `{guid}.md`, children at `{parent-guid}/{guid}.md`
  - [X] Build markdown file with YAML frontmatter containing metadata (title, tags, status, createdBy, modifiedBy, timestamps, parentGuid)
  - [X] PageContent body is markdown content
  - [X] Upload to S3 at calculated path
  - [X] Enable versioning on S3 bucket
- [X] Implement `loadPage` method
  - [X] Build S3 path from GUID (need to search if parent unknown, or track in index)
  - [X] Fetch markdown file from S3
  - [X] Parse YAML frontmatter for metadata
  - [X] Extract markdown content body
  - [X] Handle 404 errors gracefully
  - [X] Return page content with metadata
- [X] Implement `deletePage` method
  - [X] If recursive=true: delete page and all children (recursively delete S3 directory)
  - [X] If recursive=false: only delete if page has no children
  - [X] Remove S3 object(s)
  - [X] Or soft delete: add `deleted=true` to frontmatter
- [X] Implement `listVersions` method
  - [X] Query S3 object versions API for the page's .md file
  - [X] Return sorted list (newest first)
  - [X] Include version metadata
- [X] Implement `listChildren` method
  - [X] If parentGuid is null: list root-level .md files (exclude directories)
  - [X] If parentGuid provided: list .md files within `{parent-guid}/` directory
  - [X] Parse frontmatter of each child to get display name and metadata
  - [X] Return array of PageSummary objects
- [X] Implement `movePage` method
  - [X] Move page file from old path to new path
  - [X] If page has children (directory exists), move entire directory
  - [X] Update parentGuid in page frontmatter
  - [X] Handle S3 copy and delete operations

#### 3.3 Lambda API Endpoints
- [X] Create API Gateway REST API resource: `/pages`
- [X] Implement Lambda: `pages-create` (POST /pages)
  - [X] Validate request body (title, content, parentGuid - optional)
  - [X] Build PageContent object with metadata (title, tags, status, author, timestamps, parentGuid)
  - [X] Call storage plugin `savePage(guid, parentGuid, content)`
  - [X] Return page GUID and creation timestamp
- [X] Implement Lambda: `pages-get` (GET /pages/{guid})
  - [X] Extract GUID from path parameters
  - [X] Call storage plugin `loadPage`
  - [X] Return complete page data with metadata (including parentGuid for breadcrumbs)
- [X] Implement Lambda: `pages-update` (PUT /pages/{guid})
  - [X] Validate request body
  - [X] Load existing page from storage
  - [X] Update content and metadata (modifiedBy, modifiedAt)
  - [X] Preserve parentGuid unless explicitly moving page
  - [X] Call storage plugin `savePage` (creates new version)
  - [X] Return success response
- [X] Implement Lambda: `pages-delete` (DELETE /pages/{guid})
  - [X] Verify user permissions
  - [X] Query parameter: `recursive=true|false` (default: false)
  - [X] Call storage plugin `deletePage(guid, recursive)`
  - [X] Return confirmation with count of deleted items
- [X] Implement Lambda: `pages-list-children` (GET /pages/{guid}/children)
  - [X] Extract parent GUID from path (or null for root pages)
  - [X] Call storage plugin `listChildren(parentGuid)`
  - [X] Return array of child page summaries
- [X] Implement Lambda: `pages-move` (PUT /pages/{guid}/move)
  - [X] Request body: `{ newParentGuid: string | null }`
  - [X] Validate target parent exists (if not null)
  - [X] Prevent circular references (page cannot be moved under its own descendant)
  - [X] Call storage plugin `movePage(guid, newParentGuid)`
  - [X] Return success response

#### 3.4 Testing & Documentation
- [X] Write unit tests for storage plugin interface
  - [X] Mock S3 client
  - [X] Test CRUD operations
  - [X] Test error scenarios (network, permissions)
- [X] Write integration tests
  - [X] Use LocalStack (via Aspire) or S3 test bucket
  - [X] Test end-to-end page lifecycle
  - [X] Verify versioning behavior
  - [X] Test page hierarchy (parent-child relationships)
  - [X] Test page movement between parents
  - [X] Use Aspire Dashboard to monitor test execution and trace issues
- [X] Document S3 bucket structure and naming conventions
  - [X] Explain page-as-folder architecture: `{guid}.md` for root, `{parent-guid}/{child-guid}.md` for children
  - [X] Document frontmatter metadata format
  - [X] Explain how hierarchy is derived from S3 path structure
- [X] Create plugin developer guide for future extensions
- [X] Document Aspire local development workflow for testing

---

## Phase 2: Core Features (Weeks 4-7)

### Week 4: Page Hierarchy & Navigation (Spec #3)

**Goal**: Implement hierarchical page organization (pages ARE folders)

**Architecture Note**: There is no separate "folder" entity. A page IS a folder if it has children. The S3 structure is:
- Root page: `{guid}.md`
- Child page: `{parent-guid}/{child-guid}.md`
- Grandchild: `{parent-guid}/{child-guid}/{grandchild-guid}.md`

Display names are stored in YAML frontmatter within each `.md` file. This enables renaming without breaking references.

#### 4.1 Page Hierarchy Support
- [X] Update page data model in storage plugin
  - [X] Add `parentGuid` field to page frontmatter (null for root pages)
  - [X] Add `hasChildren` computed field (true if S3 directory exists)
  - [X] Add `description` field to page frontmatter (optional metadata)
  - [X] Metadata in frontmatter: title, parentGuid, tags, status, createdBy, modifiedBy, timestamps, description
- [X] Implement hierarchy traversal utilities
  - [X] Build page tree from S3 structure (recursive listing)
  - [X] Function to get ancestors of a page (for breadcrumbs)
  - [X] Function to check if page is descendant of another (circular reference check)
  - [X] Note: In-memory caching NOT implemented - Lambda containers are ephemeral with frequent cold starts
  - [X] For low-traffic family wikis (3-20 users), S3's sub-10ms latency is sufficient
  - [X] If caching needed in future, use DynamoDB or ElastiCache for shared persistent state
- [X] Handle root-level pages
  - [X] Root pages have parentGuid = null
  - [X] Stored directly in bucket root: `{guid}.md`

#### 4.2 Page Hierarchy API Endpoints (No separate /folders endpoints needed)
- [X] Enhance existing `pages-create` Lambda
  - [X] Accept optional `parentGuid` in request body
  - [X] Validate parent page exists if parentGuid provided
  - [ ] Prevent duplicate titles under same parent (optional business rule)
  - [X] Store page at correct S3 path based on parent
- [X] Implement `pages-list-children` Lambda (already in 3.3)
  - [X] List all pages under a given parent (or root if null)
  - [X] Return page summaries: guid, title, hasChildren, createdAt, modifiedAt
  - [X] Sort by title (alphabetically)
- [X] Implement `pages-move` Lambda (already in 3.3)
  - [X] Move page (and its children) to new parent
  - [X] Update parentGuid in page frontmatter
  - [X] Move S3 objects from old path to new path
  - [X] Validate circular reference prevention
- [X] Enhance `pages-delete` Lambda
  - [X] Support `recursive=true` query parameter
  - [X] If recursive=false and page has children, return error "Page has children"
  - [X] If recursive=true, delete page and all descendants
  - [X] Return count of deleted pages
- [X] Enhance `pages-update` Lambda
  - [X] Allow updating title (display name in frontmatter) without changing GUID
  - [X] Allow updating description and other metadata
  - [X] Moving page is separate operation (use `pages-move`)
- [X] Fix Integration Test Mocks (Task 4.2 completion)
  - [X] Debug GetObjectCommand mock setup - use callsFake for multiple calls
  - [X] Fix isDescendantOf implementation test expectations - mock HeadObjectCommand and ListObjectsV2Command
  - [X] Implement proper delete protection - mock child page loading in listChildren
- [X] Consider Real Integration Tests (Priority: LOW)
  - [X] Tests against LocalStack for true S3 behavior validation
  - [X] Performance tests with large datasets
  - [X] Enable S3StoragePlugin.integration.test.ts for LocalStack testing
  - [X] Add 8 comprehensive performance test scenarios:
    - [X] Bulk operations (100+ pages creation and listing)
    - [X] Large content handling (5MB page files)
    - [X] Deep hierarchy stress test (10 nested levels)
    - [X] Wide hierarchy test (100 children under one parent)
    - [X] Bulk deletion performance (50 pages recursive)
    - [X] Concurrent operations (50 simultaneous read/write)
    - [X] Versioning stress (20+ rapid updates)
  - [X] Document integration test setup and execution in storage README
  - [X] Add performance benchmarks and monitoring guidelines

#### 4.3 Frontend Page Tree Components
- [X] Build recursive page tree component
  - [X] Display pages in hierarchical tree structure
  - [X] Show expand/collapse icons for pages with children
  - [X] Use page icon for leaf pages, folder icon for pages with children
  - [X] Highlight active page
  - [X] Support keyboard navigation (arrows, enter)
- [X] Implement page context menu
  - [X] Right-click menu: Rename, Delete, Move, New Child Page
  - [X] "New Child Page" creates page with current page as parent
  - [X] Keyboard shortcut support
  - [X] Confirmation dialog for destructive actions
- [X] Build drag-and-drop functionality
  - [X] Drag pages to reparent (move under different parent)
  - [X] Visual drop indicators (show valid drop targets)
  - [X] Prevent dropping page under its own descendants
  - [X] Optimistic UI updates
- [X] Create "New Page" modal
  - [X] Title input with validation
  - [X] Parent page selection (tree dropdown)
  - [X] Optional description field
  - [X] "Create as root page" checkbox (sets parentGuid = null)
- [X] Implement "Rename Page" inline editing
  - [X] Click page title to edit
  - [X] Save updates title in frontmatter, not GUID
  - [X] Update happens via `pages-update` API

#### 4.4 Page Hierarchy Testing
- [X] Unit tests for hierarchy traversal logic
  - [X] Test ancestor path calculation
  - [X] Test circular reference detection
  - [X] Test tree building from flat list
- [X] Integration tests for page operations
  - [X] Create child pages at various depths
  - [X] Move pages between parents
  - [X] Delete pages with children (recursive)
  - [X] Rename pages and verify children remain linked
- [X] Test S3 storage structure
  - [X] Verify correct paths for nested pages
  - [X] Test moving page with children (directory rename in S3)
  - [X] Verify frontmatter parsing and metadata extraction
- [X] Test edge cases
  - [X] Prevent circular references
  - [X] Handle concurrent moves (race conditions)
  - [X] Deep nesting (10+ levels)

---

### Week 5: Page Editor (Spec #4)

**Goal**: Build Markdown editor with live preview

#### 5.1 Editor Component Setup
- [X] Install CodeMirror 6 dependencies
  - [X] @codemirror/state, @codemirror/view
  - [X] @codemirror/lang-markdown
  - [X] @codemirror/commands (undo/redo, search)
- [X] Configure Markdown language mode
  - [X] Syntax highlighting
  - [X] Auto-indentation
  - [X] Bracket matching
- [X] Set up split-pane layout (edit | preview)
  - [X] Resizable divider
  - [X] Synchronized scrolling (optional)
  - [X] Toggle preview pane button

#### 5.2 Markdown Preview
- [X] Install react-markdown and remark plugins
  - [X] remark-gfm (GitHub Flavored Markdown)
  - [X] remark-breaks (line breaks)
  - [X] rehype-highlight (code syntax highlighting)
- [X] Build preview component
  - [X] Render Markdown in real-time
  - [X] Apply CSS styling for readability
  - [X] Support tables, task lists, footnotes
- [X] Implement preview theming (light/dark)

#### 5.3 Editor Features
- [X] Build Markdown toolbar
  - [X] Buttons: Bold, Italic, Strikethrough
  - [X] Headers (H1-H6 dropdown)
  - [X] Lists (unordered, ordered, task)
  - [X] Links, images, code blocks
  - [X] Keyboard shortcuts (Ctrl+B, Ctrl+I, etc.)
- [X] Implement autosave mechanism **→ REMOVED FOR MVP (deferred to post-MVP)**
  - [X] ~~Debounce save (5 seconds after last edit)~~ REMOVED
  - [X] ~~Show "Saving..." indicator~~ NOW shows manual save status
  - [X] ~~Display last saved timestamp~~ REMOVED
  - [X] ~~Handle save errors gracefully~~ Still implemented for manual save
- [X] Add unsaved changes warning **→ SIMPLIFIED FOR MVP**
  - [X] Detect dirty state (still implemented)
  - [X] ~~Show prompt on navigation/close~~ REMOVED - changes lost on navigation (to be revisited post-MVP)
  - [X] ~~Offer save or discard options~~ REMOVED
  
**Note**: Editor now uses manual save only with simple change indicator. Autosave and advanced unsaved changes handling deferred to post-MVP.

#### 5.4 Page Metadata Editing
- [X] Create page properties panel
  - [X] Inline title editing (H1 header sync)
  - [X] Tag input (multi-select dropdown)
  - [X] Status dropdown (Draft, Published, Archived)
  - [X] Author display (read-only)
  - [X] Created/modified timestamps
- [X] Implement metadata save
  - [X] Update metadata fields in page data
  - [X] Save entire page (content + metadata) via storage plugin
  - [X] Metadata is part of PageContent JSON in storage

#### 5.5 Page API Integration
- [X] Connect editor to backend APIs
  - [X] Load page content on mount
  - [X] Save content on autosave trigger
  - [X] Handle 409 conflicts (concurrent edits)
  - [X] Implement optimistic updates
- [X] Add loading states and error handling
  - [X] Skeleton loader while fetching
  - [X] Error boundaries for component crashes
  - [X] Retry mechanism for failed saves

---

### Week 6: Page Links (Spec #5)

**Goal**: Enable wiki-style internal linking

#### 6.1 Link Syntax Parsing
- [X] Implement wiki link parser
  - [X] Regex for `[[Page Title]]` syntax
  - [X] Support `[[guid|Display Text]]` format
  - [X] Parse external links with icon indicator
- [X] Create remark plugin for link rendering
  - [X] Convert wiki links to React components
  - [X] Apply styling (color, underline)
  - [X] Mark broken links with red color

#### 6.2 Link Resolution Service
- [X] Build link resolver Lambda: `links-resolve`
  - [X] Input: page title or GUID
  - [X] Search through storage plugin (list all pages, filter by title)
  - [X] Implement fuzzy matching on page titles
  - [X] Return best match with confidence score
  - [X] Handle ambiguous titles (multiple matches)
  - [X] Consider caching page index for performance
- [X] Implement broken link detection
  - [X] Query storage plugin for page existence
  - [X] Mark links with `?` icon
  - [X] Provide "Create Page" quick action

#### 6.3 Link Autocomplete
- [X] Build link suggestion component
  - [X] Trigger on `[[` input in editor
  - [X] Show dropdown with matching pages
  - [X] Fuzzy search by title
  - [X] Display page hierarchy path for context (e.g., "Parent > Child")
  - [X] Insert full wiki link on selection
- [X] Optimize suggestion queries
  - [X] Debounce input (200ms)
  - [X] Limit results to 10 items
  - [X] Cache recent searches

#### 6.4 Backlinks Tracking
- [X] Create DynamoDB table: `page_links`
  - [X] PK: `sourceGuid`, SK: `targetGuid`
  - [X] GSI: `targetGuid-index` for backlinks query
- [X] Build link extraction service
  - [X] Parse page content on save
  - [X] Extract all `[[]]` links
  - [X] Update `page_links` table
  - [X] Remove stale links
- [X] Implement Lambda: `pages-backlinks` (GET /pages/{guid}/backlinks)
  - [X] Query GSI by targetGuid
  - [X] Return list of pages linking to this page
- [X] Build "Linked Pages" sidebar widget
  - [X] Show backlinks count
  - [X] Display list of linking pages
  - [X] Open page on click

#### 6.5 Create Page from Link
- [X] Detect broken link click
- [X] Open "Create Page" modal
  - [X] Pre-fill title from link text
  - [X] Select folder (default to current folder)
  - [X] Option to create as draft
- [X] Create page and update link
  - [X] Generate new page GUID
  - [X] Replace broken link with valid link
  - [X] Save updated source page

---

### Week 7: Page Attachments (Spec #6)

**Goal**: Enable file uploads and management

#### 7.0 Infrastructure Cleanup (Align with Spec)
- [X] Remove separate attachments bucket from infrastructure
  - [X] Update `StorageStack.cs`: Remove `AttachmentsBucket` property and creation
  - [X] Update `ComputeStack.cs`: Remove references to `AttachmentsBucket`
  - [X] Update environment configs: Remove `S3_ATTACHMENTS_BUCKET` / `ATTACHMENTS_BUCKET` variables
  - [X] Update local Aspire setup: Remove attachments bucket from LocalStack
  - [X] Update documentation: Note attachments stored in pages bucket at `{pageGuid}/{pageGuid}/_attachments/` (same folder as .md file)
- [X] Remove DynamoDB attachments table (metadata in sidecar .meta.json files instead)
  - [X] Update `DatabaseStack.cs`: Remove attachments table definition
  - [X] Update `DATABASE-SCHEMA.md`: Document that attachments use sidecar JSON, not DynamoDB
  - [X] Note: Keep table if already deployed for now; just don't use it in new code

#### 7.1 Upload Infrastructure (using Pages Bucket)
- [X] Implement storage plugin attachment methods
  - [X] Storage path: `{pageGuid}/{pageGuid}/_attachments/` within pages bucket (same folder as .md file)
  - [X] `uploadAttachment(pageGuid, file)`: Upload to S3 at `{pageGuid}/{pageGuid}/_attachments/{attachmentGuid}.{ext}`
  - [X] `deleteAttachment(pageGuid, attachmentGuid)`: Remove file from S3
  - [X] `getAttachmentUrl(pageGuid, attachmentGuid)`: Generate temporary download URL
  - [X] Generate unique attachment GUIDs to avoid collisions
  - [X] API: `POST /pages/{pageGuid}/attachments` (multipart upload)
  - [X] Accept file via multipart/form-data streaming
  - [X] Validate file type during upload (whitelist: images, PDFs, docs per FR-003, FR-004)
  - [X] Enforce size limits: 10MB images, 50MB documents (FR-007)
  - [X] Stream to storage plugin's `uploadAttachment()` method
  - [X] Create .meta.json sidecar file with metadata
  - [X] Return: attachmentGuid, filename, size, url
  - [X] API: `GET /pages/{pageGuid}/attachments/{attachmentGuid}`
  - [X] Proxy download from storage plugin
  - [X] Set proper Content-Type and Content-Disposition headers
  - [X] Stream file to client (don't load fully into memory)
  - [X] Write unit tests for attachment utilities
    - [X] Test multipart file parsing (various formats, boundaries, encodings)
    - [X] Test file validation (type whitelist, size limits)
    - [X] Test header extraction and body decoding
    - [X] Test error cases (missing boundary, unsupported types, oversized files)
  - [X] Write unit tests for S3StoragePlugin attachment methods
    - [X] Test uploadAttachment with various file types and extensions
    - [X] Test deleteAttachment with valid and invalid GUIDs
    - [X] Test getAttachmentUrl presigned URL generation
    - [X] Test saveAttachmentMetadata and getAttachmentMetadata
    - [X] Test listAttachments with sorting and filtering
    - [X] Test error scenarios (invalid GUIDs, missing pages, missing attachments)
  - [X] Write integration tests for complete attachment lifecycle
    - [X] Test upload → save metadata → list → download → delete flow
    - [X] Test multiple attachments per page
    - [X] Test various file types (images, PDFs, Office docs)
    - [X] Test size validation at 10MB/50MB boundaries
    - [X] Test error handling (non-existent pages, invalid GUIDs)
    - [X] Test metadata persistence and retrieval

#### 7.2 Attachment Metadata & Listing (Sidecar JSON Files)
- [X] Metadata file creation (part of upload endpoint above)
  - [X] Storage path: `{pageGuid}/{pageGuid}/_attachments/{attachmentGuid}.meta.json`
  - [X] Metadata structure: `{ attachmentId, originalFilename, contentType, size, uploadedAt, uploadedBy, dimensions?, duration?, checksum }`
  - [X] Create metadata file atomically with attachment upload
  - [X] Extract image dimensions during upload if applicable
- [X] Implement list attachments endpoint
  - [X] API: `GET /pages/{pageGuid}/attachments`
  - [X] List S3 objects in `{pageGuid}/{pageGuid}/_attachments/` folder
  - [X] Read `.meta.json` files for each attachment
  - [X] Return sorted list (newest first by uploadedAt)
- [X] Implement delete attachment endpoint
  - [X] API: `DELETE /pages/{pageGuid}/attachments/{attachmentGuid}`
  - [X] Use storage plugin's `deleteAttachment()` method
  - [X] Remove both attachment file and .meta.json file
  - [X] Return success/error status

#### 7.3 Frontend Upload UI
- [X] Build file upload component
  - [X] Drag-and-drop zone
  - [X] File picker button (fallback)
  - [X] Multi-file upload support
  - [X] Progress bar per file
- [X] Implement upload flow (multipart/form-data to REST API)
  - [X] 1. Create FormData with file
  - [X] 2. POST to `/pages/{pageGuid}/attachments` with file
  - [X] 3. Track upload progress with XMLHttpRequest progress events
  - [X] 4. Receive response with attachmentGuid and metadata
  - [X] 5. Insert markdown reference and display in list
- [X] Add upload validation
  - [X] Check file size before upload (client-side, 10MB images / 50MB docs)
  - [X] Validate MIME type client-side
  - [X] Show error messages for invalid files
  - [X] Handle server-side validation errors

#### 7.4 Attachment Display & Management
- [X] Build attachment list component
  - [X] Show filename, size, upload date
  - [X] Display file type icon
  - [X] Download link to `/pages/{pageGuid}/attachments/{attachmentGuid}` (proxied through API)
  - [X] Delete button (admin + author only)
- [X] Implement image preview
  - [X] Inline thumbnail for images
  - [X] Lightbox/modal for full-size view
  - [X] Support for common formats (JPEG, PNG, GIF, WebP)
  - [X] Image URLs use API endpoint: `/pages/{pageGuid}/attachments/{attachmentGuid}`
- [X] Implement delete attachment UI
  - [X] Verify permissions client-side (author or admin)
  - [X] Call DELETE endpoint via API
  - [X] Update UI to remove deleted attachment
  - [X] Handle errors gracefully

#### 7.5 Editor Integration
- [X] Add attachment button to editor toolbar
  - [X] Open file picker
  - [X] Upload and insert link
  - [X] Insert Markdown image syntax: `![alt](url)`
- [X] Display attachment panel below editor
  - [X] List all page attachments
  - [X] Quick-copy Markdown link
  - [X] Drag-and-drop link into editor

---

## Phase 3: Search & Users (Weeks 8-9)

### Week 8: Wiki Search (Spec #7)

**Goal**: Implement pluggable search with client-side MVP ($0/month), optional DynamoDB and S3 Vectors providers

#### 8.1 Search Plugin Interface & Architecture
- [X] Define `ISearchProvider` interface
  - [X] Methods: `indexPage()`, `search()`, `deletePage()`, `reindexAll()`
  - [X] `getCapabilities()` returning fuzzySearch, faceting, highlighting, estimatedMonthlyCost
  - [X] `SearchQuery` type: text, scope, titleOnly, tags, limit, offset
  - [X] `SearchResult` type: pageId, shortCode, title, snippet, relevanceScore, matchCount, path, tags
  - [X] `SearchResultSet` type: results array, totalResults, executionTime
- [X] Implement search provider plugin loader
  - [X] Read provider config from environment (`SEARCH_PROVIDER_TYPE`, defaults to 'client-side')
  - [X] Load and initialize the configured provider
  - [X] Fallback to client-side provider if configured provider fails
- [X] Define `ClientSearchIndex` JSON schema
  - [X] Fields: id, shortCode, title, content (stripped markdown), tags, path, modifiedDate, author
  - [X] Version number for cache invalidation

#### 8.2 Client-Side Search Provider (MVP Default — $0/month)
- [X] Install and configure Fuse.js
  - [X] Add fuse.js dependency to frontend
  - [X] Configure search keys with weights (title: 10x, tags: 5x, content: 1x)
  - [X] Set fuzzy threshold (0.3), minMatchCharLength (2)
- [X] Build search index builder Lambda: `search-build-index`
  - [X] Triggered by S3 event on page create/update/delete
  - [X] Fetch all page metadata + content from storage plugin
  - [X] Strip markdown formatting from content (remove code blocks, special syntax)
  - [X] Build `ClientSearchIndex` JSON structure
  - [X] Upload `search-index.json` to S3 static assets bucket
  - [ ] Invalidate CloudFront cache for `/search-index.json`
- [X] Implement client-side search service
  - [X] Fetch and cache `search-index.json` (service worker or in-memory)
  - [X] Initialize Fuse.js instance with downloaded index
  - [X] Execute search queries entirely in browser
  - [X] Generate snippets with context around first match (200-300 chars)
  - [X] Rank results: title match (10x) > tag match (5x) > content match (1x)
  - [X] Support folder-scoped search (filter by path prefix)
  - [X] Refresh index on visibility change or periodic poll

#### 8.3 Frontend Search UI
- [ ] Build search dialog component (modal overlay)
  - [ ] Keyboard shortcut: Cmd/Ctrl+K to open
  - [ ] Search input with placeholder "Search wiki..."
  - [ ] Escape to close, focus trap within dialog
- [ ] Build search results display
  - [ ] Display results with page title + snippet (first match with context)
  - [ ] Highlight matching terms in snippets (bold)
  - [ ] Show folder path for each result
  - [ ] Click result to navigate to page (`/pages/{shortCode}/Title`)
  - [ ] "No results found for 'query'" message when empty
- [ ] Implement keyboard navigation
  - [ ] Up/Down arrows to navigate results
  - [ ] Enter to open selected result
  - [ ] Ctrl+Enter to open in new tab
  - [ ] Home/End to jump to first/last result
- [ ] Implement search filters (P2)
  - [ ] Scope dropdown: "All pages" / "Current folder" / "Current folder + subfolders"
  - [ ] Persist scope preference for session
  - [ ] Title-only toggle
- [ ] Implement infinite scroll for results
  - [ ] Load 10 results initially
  - [ ] "Load more" on scroll, user-selectable page size (10, 25, 50)
- [ ] Implement recent searches (P3)
  - [ ] Store last 10 searches in localStorage (`bluefin_recent_searches`)
  - [ ] Show in dropdown when search input is focused and empty
  - [ ] Click to re-run, "X" to remove individual items
  - [ ] "Clear recent searches" link
  - [ ] Auto-cleanup searches older than 30 days
- [ ] Accessibility (WCAG 2.1 AA)
  - [ ] ARIA labels for search input, results, filters
  - [ ] Screen reader announcements: "X results found for 'query'"
  - [ ] Visible focus indicators, logical tab order
  - [ ] Return focus to trigger element on dialog close
  - [ ] Works at 200% zoom, respects prefers-reduced-motion

#### 8.4 Search Security & Input Validation
- [ ] Sanitize search queries
  - [ ] Max query length: 500 characters
  - [ ] Strip/escape characters that could cause XSS
  - [ ] HTML-encode all user content in result snippets
- [ ] Rate limiting (client-side)
  - [ ] Debounce search input (300ms)
  - [ ] Max 60 searches per minute

#### 8.5 Optional Provider: DynamoDB Search **→ OPTIONAL, POST-MVP**
- [ ] Implement DynamoDB search provider (implements `ISearchProvider`)
  - [ ] Create DynamoDB table `WikiSearchIndex` (on-demand pricing)
  - [ ] Table schema: PK `SEARCH#<pageId>`, SK `INDEX`, titleLower, contentLower, tags, path, author, modifiedDate
  - [ ] `indexPage()`: Store tokenized page data in DynamoDB on page save
  - [ ] `search()`: Scan with FilterExpression `contains(titleLower, :q) OR contains(contentLower, :q)`
  - [ ] `deletePage()`: Delete item from DynamoDB
  - [ ] `reindexAll()`: Batch write all pages to DynamoDB table
  - [ ] Rank results in Lambda (title match weighted higher)
- [ ] Set up IAM roles for Lambda access to DynamoDB search table
- [ ] Test provider hot-swap from client-side to DynamoDB without data loss

#### 8.6 Optional Provider: S3 Vectors Semantic Search **→ OPTIONAL, POST-MVP**
- [ ] Implement S3 Vectors search provider (implements `ISearchProvider`)
  - [ ] Create S3 vector bucket: `wiki-search-vectors`
  - [ ] Create vector index: dimension 1024, cosine distance, float32
  - [ ] Configure filterable metadata: folder, author, tags
- [ ] Integrate Amazon Bedrock Titan Text Embeddings V2
  - [ ] `indexPage()`: Generate 1024-dim embedding via Bedrock, store in S3 Vectors with page metadata
  - [ ] `search()`: Embed query via Bedrock, call `QueryVectors` for top-K nearest neighbors
  - [ ] `deletePage()`: Remove vector by page ID key
  - [ ] `reindexAll()`: Batch embed and store all pages
- [ ] Set up IAM roles for Lambda access to S3 Vectors and Bedrock
- [ ] Handle regional availability (S3 Vectors not in all regions)
- [ ] Optional: Implement hybrid search mode
  - [ ] Run S3 Vectors + client-side provider in parallel
  - [ ] Merge and deduplicate results
  - [ ] Weight keyword matches higher for short/exact queries
  - [ ] Weight semantic matches higher for natural language queries
- [ ] Document cost implications (~$0.02-0.15/month) and setup requirements

---

### Week 9: User Management (Spec #8)

**Goal**: Build admin tools for user management

#### 9.1 User Management API (Cognito Integration)
- [ ] Implement Lambda: `admin-users-list` (GET /admin/users)
  - [ ] Call Cognito ListUsers API to get all users
  - [ ] Query user_profiles table for extended profile data
  - [ ] Merge Cognito data (email, status) with DynamoDB data (role, preferences)
  - [ ] Support pagination using Cognito PaginationToken
  - [ ] Filter by role, status (enabled/disabled)
  - [ ] Return combined user profiles
- [ ] Implement Lambda: `admin-users-get` (GET /admin/users/{userId})
  - [ ] Call Cognito AdminGetUser API for auth data
  - [ ] Fetch user profile from DynamoDB user_profiles table
  - [ ] Include activity summary (page edits, comments) from activity_log
  - [ ] Return last login from Cognito user attributes
- [ ] Implement Lambda: `admin-users-update` (PUT /admin/users/{userId})
  - [ ] Allow role change in DynamoDB user_profiles (update custom:role attribute)
  - [ ] Update Cognito user attributes via AdminUpdateUserAttributes
  - [ ] Update email in Cognito (requires verification)
  - [ ] Reset password via AdminSetUserPassword (send temp password)
  - [ ] Cannot modify own admin role (safety check)
- [ ] Implement Lambda: `admin-users-suspend` (POST /admin/users/{userId}/suspend)
  - [ ] Call Cognito AdminDisableUser API
  - [ ] Update user profile status in DynamoDB to 'suspended'
  - [ ] Invalidate active sessions (Cognito handles this)
  - [ ] Send suspension notification email via SES
- [ ] Implement Lambda: `admin-users-activate` (POST /admin/users/{userId}/activate)
  - [ ] Call Cognito AdminEnableUser API
  - [ ] Update user profile status in DynamoDB to 'active'
  - [ ] Send reactivation email
- [ ] Implement Lambda: `admin-users-delete` (DELETE /admin/users/{userId})
  - [ ] Soft delete in DynamoDB: mark profile as deleted, anonymize data
  - [ ] Call Cognito AdminDeleteUser API (hard delete from Cognito)
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
  - [ ] PK: `userId` (Cognito sub), SK: `timestamp` (sortable)
  - [ ] Attributes: action, resourceType, resourceGuid, details
  - [ ] Note: userId references Cognito sub (UUID from Cognito tokens)
- [ ] Implement activity tracking
  - [ ] Log page creates/edits/deletes
  - [ ] Log user logins/logouts (from Cognito triggers or frontend events)
  - [ ] Log admin actions (role changes, suspensions)
  - [ ] Extract userId from JWT token (Cognito sub claim)
  - [ ] Retention: 90 days (DynamoDB TTL)
- [ ] Build activity viewer (admin only)
  - [ ] Filter by user (Cognito sub), action type, date range
  - [ ] Join with user_profiles for display names
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
  - [ ] Display: Home > Parent Page > Child Page > Current Page
  - [ ] Each segment is clickable link (navigates to that page)
  - [ ] Truncate long page names (ellipsis + tooltip)
  - [ ] Collapse middle segments on mobile (Home > ... > Current)
- [ ] Implement breadcrumb data fetching
  - [ ] Traverse page hierarchy from current page using parentGuid
  - [ ] Build path array: [root, parent, ..., current]
  - [ ] ~~Cache page hierarchy (React Query)~~ **→ DEFERRED TO POST-MVP**
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
  - [ ] Fetch all pages via storage plugin
  - [ ] Build tree structure from parentGuid relationships (recursive)
  - [ ] Respect permissions (exclude drafts not owned by user)
  - [ ] Return hierarchical JSON
- [ ] Build sitemap tree component
  - [ ] Recursive tree rendering (pages can have child pages)
  - [ ] Expandable/collapsible nodes
  - [ ] Click to navigate to page
  - [ ] Visual indicators: folder icon for pages with children, page icon for leaf pages
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
  - [ ] Future: Hide pages in restricted hierarchies (page-level permissions)
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
- [ ] Adapt page tree for mobile
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
  - [ ] ~~Cache rendered PDFs (1 hour)~~ **→ DEFERRED TO POST-MVP**
  - [ ] Queue exports for large pages (SQS)
  - [ ] Timeout: 30 seconds (Lambda limit)

#### 14.2 HTML Export
- [ ] Implement Lambda: `export-html` (GET /pages/{guid}/export/html)
  - [ ] Fetch page and all descendant pages recursively via storage plugin
  - [ ] Render each page as static HTML
  - [ ] Generate navigation links (TOC based on page hierarchy)
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
  - [ ] Dropdown: "Export as PDF", "Export as HTML (with children)"
  - [ ] Show progress indicator during export
  - [ ] Download automatically on completion
- [ ] For HTML export with children
  - [ ] Show export progress (X of Y pages)
  - [ ] Notify on completion
  - [ ] Option to export single page or include all descendants

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
  - [ ] Trigger search index rebuild (regenerate search-index.json)
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
  - [ ] Page tree view: filter pages by metadata
  - [ ] Hierarchy view: show/hide based on metadata filters

#### 14.4 Custom Metadata Fields (P3 - Optional)
- [ ] Define custom field types
  - [ ] Text, number, date, boolean, dropdown
- [ ] Build custom field editor
  - [ ] Add/remove fields dynamically
  - [ ] Validate field types
  - [ ] Store in `customFields` JSON column
- [ ] Enable search on custom fields
  - [ ] Include custom fields in search index JSON (client-side) or provider-specific index
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
- [ ] Search provider costs (if using optional DynamoDB or S3 Vectors providers)
  - Mitigation: Default client-side search is $0/month; monitor optional provider costs; hot-swap back to client-side if needed
- [ ] Lambda cold start latency
  - Mitigation: Provisioned concurrency for critical functions, optimize bundle size

### Timeline Risks
- [ ] Scope creep
  - Mitigation: Strict prioritization (P1 → P2 → P3), defer non-MVP features
- [ ] Underestimated complexity
  - Mitigation: Add 20% buffer to each phase, weekly progress reviews
- [ ] Dependency delays (AWS services)
  - Mitigation: Client-side search has no AWS dependency; optional providers fall back to client-side on failure

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
