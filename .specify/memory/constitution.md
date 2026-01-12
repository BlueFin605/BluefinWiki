# BlueFinWiki Constitution

**Vision**: A family-friendly wiki platform with hierarchical page organization, pluggable storage backends (S3/GitHub), and cost-effective serverless deployment on AWS (with cloud-agnostic design for future portability).

## Core Principles

### Non-Negotiables
The following requirements are **mandatory and immutable**. Any feature, architecture decision, or implementation must comply with these principles:

1. **Pluggable Module Architecture**: Core system must support pluggable modules for storage, search, authentication, and features
2. **Storage Plugin Architecture**: Must support both S3 and GitHub storage backends via pluggable interface (minimum requirement)
3. **Cost Target**: Monthly AWS costs must remain under $5 for typical family usage
4. **Hierarchical Page Structure**: Confluence-style parent-child page relationships are required
5. **Markdown File Format**: All pages must be stored as standard .md files with YAML frontmatter

### I. Pluggable Module Architecture (Pick'n'Mix)
- **Core principle**: Every major capability must be implemented as a pluggable module
- **Configuration-driven**: Users select which modules to enable via configuration file
- **Module independence**: Modules should not have hard dependencies on other modules
- **Standard interfaces**: All modules implement well-defined TypeScript interfaces
- **Hot-swappable**: Ability to change module implementations without code changes
- **Module categories**:
  - **Storage Modules**: S3, GitHub, Google Cloud Storage, Azure Blob, Local Filesystem
  - **Search Modules**: DynamoDB search, Algolia, ElasticSearch, MeiliSearch, Client-side only
  - **Authentication Modules**: AWS Cognito, Auth0, Firebase Auth, Custom OIDC
  - **Editor Modules**: Rich text editor, Markdown editor, WYSIWYG editor
  - **Feature Modules**: Comments, Page ratings, Page templates, Activity feed, Notifications
  - **Export Modules**: PDF export, Static site generator, Backup/restore

### II. Content-First Architecture
- Every feature must serve content creation, organization, or discovery
- Content stored as standard Markdown (.md) files with YAML frontmatter
- Hierarchical page structure (Confluence-style) with parent-child relationships
- Pluggable storage backends: S3 and GitHub as required minimum, others optional
- No vendor lock-in: users can migrate content between storage backends easily
- Content ownership remains with the family at all times

### III. Simplicity & Cost-Effectiveness
- **Serverless-first architecture**: Minimize always-on infrastructure costs
- Target: Monthly AWS costs under $5 for typical family usage with basic modules
- Pay-per-use pricing model: costs scale with actual usage, not capacity
- Optimize for cold starts and intermittent access patterns
- Simple deployment: single command to deploy entire stack with selected modules
- Minimal maintenance burden suitable for non-technical family members
- **Module costs transparent**: Each optional module documents its cost impact

### IV. Family-Friendly Experience
- Simple, intuitive interface suitable for all ages and tech skill levels
- WCAG 2.1 AA compliance for accessibility
- Mobile-responsive design (many family members access via phones/tablets)
- Rich media support: images, videos, documents as attachments
- Version history and "undo" capabilities for accidental changes
- User authentication with role-based access (admin, editor, viewer)
- **Module management UI**: Easy enable/disable of optional features without code changes

### V. Cloud-Agnostic & Portable Design
- **Primary platform**: AWS with serverless services (Lambda, API Gateway, S3, DynamoDB)
- **Cloud-agnostic abstractions**: All cloud services accessed via module interfaces
- Infrastructure-as-Code (Terraform/CloudFormation) for reproducible deployments
- Pluggable module interface architecture:
  - **Storage Modules**: S3, GitHub (required); Google Cloud, Azure, Local (optional)
  - **Search Modules**: DynamoDB, Algolia, ElasticSearch, MeiliSearch, Client-side
  - **Auth Modules**: AWS Cognito, Auth0, Firebase, Custom OIDC
  - Future modules possible without core system changes
- No hard dependencies on AWS-specific APIs in business logic
- Module registry for discovery and installation

### VI. Privacy & Security
- Family data is private by default (not public internet access without authentication)
- User authentication required for all access (AWS Cognito or similar)
- Role-based access control: Admin, Editor, Viewer roles
- All user inputs sanitized to prevent XSS/injection attacks
- HTTPS/TLS mandatory for all connections
- Regular security audits and dependency updates
- No third-party analytics or tracking (family privacy is paramount)

## Technical Standards

### Technology Stack
- **Frontend**: React SPA (Single Page Application)
  - Hosted in S3 bucket with static website hosting
  - Delivered via CloudFront CDN for global performance
  - Build tool: Vite or Create React App
  - State management: React Context or lightweight library (Zustand/Jotai)
  - Progressive enhancement for core features
- **Backend**: Node.js serverless functions (AWS Lambda)
  - API Gateway for HTTP routing and REST API endpoints
  - Cold start optimization mandatory (keep bundle sizes small)
  - TypeScript strongly recommended for type safety
- **Storage Plugins**:
  - **S3 Plugin**: Store .md files and attachments in S3 buckets
  - **GitHub Plugin**: Store .md files in GitHub repo with commit history
  - Interface abstraction: `IStorageBackend` for future plugins
- **Database**: DynamoDB (serverless) for metadata, page hierarchy, and search index
  - On-demand pricing mode for cost optimization
  - Single-table design pattern for efficiency
  - Global Secondary Indexes (GSI) for hierarchy queries
- **Search**: Pluggable search modules
  - **DynamoDB Search Module** (default): Basic search via DynamoDB queries + client-side filtering
  - **Algolia Module** (optional): Advanced search with typo tolerance, faceting
  - **MeiliSearch Module** (optional): Self-hosted search, privacy-focused
  - **OpenSearch Module** (optional): Full-text search for large wikis
  - Interface: `ISearchProvider` for adding new search backends
- **Authentication**: Pluggable authentication modules
  - **AWS Cognito Module** (default): User management and JWT tokens
  - **Auth0 Module** (optional): Multi-cloud authentication
  - **Firebase Auth Module** (optional): Google ecosystem integration
  - Interface: `IAuthProvider` for custom authentication
- **Deployment**: AWS SAM (Serverless Application Model) or Serverless Framework
- **CDN**: CloudFront for S3-hosted React app and static assets

### Hierarchical Page Structure
- Confluence-style parent-child page relationships
- Pages stored as `.md` files with YAML frontmatter:
  ```yaml
  ---
  title: "Page Title"
  parent: "/path/to/parent-page"
  created: "2026-01-12T10:00:00Z"
  modified: "2026-01-12T15:30:00Z"
  author: "username"
  ---
  ```
- URL structure reflects hierarchy: `/wiki/parent/child/grandchild`
- Breadcrumb navigation automatically generated from hierarchy
- Move/rename operations update all child references

### Code Quality Gates
- Minimum 70% test coverage for business logic (adjusted for small team/solo dev)
- No critical or high-severity security vulnerabilities
- Linting and formatting enforced (ESLint/Prettier for JavaScript/TypeScript)
- Storage plugin interface thoroughly tested with contract tests
- All storage backends must pass the same test suite
- Performance benchmarks: Cold start < 2s, Warm request < 500ms

### Testing Philosophy (Pragmatic Approach)
**Strict TDD Required For:**
- Storage module implementations (S3, GitHub, and any new storage backends)
- Search module implementations (contract tests for ISearchProvider)
- Authentication module implementations (security-critical)
- API endpoints and business logic (CRUD operations, hierarchy management)
- Module loading and initialization system
- Data migration and integrity operations

**Tests Recommended But Flexible For:**
- UI components (test complex components, skip trivial ones)
- Presentational React components with no business logic
- Feature modules (test core functionality, skip simple UI)
- Styling and layout components
- Simple utility functions

**Testing Guidelines:**
- Write tests first for critical features (Test → Approve → Implement)
- Test coverage enforced by CI/CD, but quality over quantity
- **Module contract tests**: All modules implementing same interface must pass same test suite
- Integration tests for module interactions more valuable than 100% unit coverage
- Each module must include its own test suite
- Use tools like Jest, React Testing Library for frontend; Jest/Mocha for backend

### Data & Content Standards
- **Content format**: Markdown (.md) files with CommonMark compliance
- **Frontmatter**: YAML for metadata (title, parent, dates, author, tags)
- **Attachments**: Stored alongside pages or in `/attachments/{page-id}/` structure
- **File naming**: URL-safe slugs (lowercase, hyphens, no special chars)
- **Hierarchy encoding**: 
  - Option A: Nested folders matching hierarchy (`/parent/child/page.md`)
  - Option B: Flat structure with parent references in frontmatter
- **Version control**: GitHub plugin provides native git history; S3 plugin uses versioning
- **Backup strategy**: 
  - S3: Versioning enabled + lifecycle policies
  - GitHub: Natural git history + branch protection
  - Weekly full backups to separate bucket/repo

### Storage Plugin Architecture
All storage backends must implement the `IStorageBackend` interface:

```typescript
interface IStorageBackend {
  // Core CRUD operations
  createPage(path: string, content: string, metadata: PageMetadata): Promise<Page>
  readPage(path: string): Promise<Page>
  updatePage(path: string, content: string, metadata: PageMetadata): Promise<Page>
  deletePage(path: string): Promise<void>
  
  // Hierarchy operations
  listChildren(parentPath: string): Promise<Page[]>
  movePage(oldPath: string, newPath: string): Promise<void>
  
  // Attachment operations
  uploadAttachment(pagePath: string, file: File): Promise<Attachment>
  getAttachment(pagePath: string, attachmentId: string): Promise<Attachment>
  deleteAttachment(pagePath: string, attachmentId: string): Promise<void>
  
  // Version history (optional, best-effort)
  getPageHistory(path: string): Promise<PageVersion[]>
}
```

**S3 Storage Module** (required):
- Store pages as `.md` files with S3 object metadata
- Use S3 versioning for history
- Attachments stored with page-specific prefixes
- Cost: ~$0.50-2/month depending on storage size

**GitHub Storage Module** (required):
- Pages stored in repo with folder structure matching hierarchy
- Commits include meaningful messages (author, timestamp)
- Attachments stored in `/attachments/` or Git LFS for large files
- Branch protection and PR workflow optional for advanced users
- Cost: Free for public/private repos within GitHub limits

### Module Architecture & Interfaces

**Core Module Interface Pattern:**
```typescript
interface IModule {
  name: string
  version: string
  initialize(config: ModuleConfig): Promise<void>
  getCapabilities(): string[]
  healthCheck(): Promise<boolean>
}
```

**Search Provider Interface:**
```typescript
interface ISearchProvider extends IModule {
  indexPage(page: Page): Promise<void>
  search(query: string, filters?: SearchFilters): Promise<SearchResult[]>
  deletePage(pageId: string): Promise<void>
  reindexAll(): Promise<void>
}
```

**Authentication Provider Interface:**
```typescript
interface IAuthProvider extends IModule {
  signIn(credentials: Credentials): Promise<AuthToken>
  signOut(token: AuthToken): Promise<void>
  verifyToken(token: string): Promise<UserInfo>
  refreshToken(token: string): Promise<AuthToken>
  getUsersByRole(role: string): Promise<UserInfo[]>
}
```

**Feature Module Interface:**
```typescript
interface IFeatureModule extends IModule {
  getRoutes(): RouteDefinition[]
  getUIComponents(): ComponentDefinition[]
  onPageLoad?(page: Page): Promise<void>
  onPageSave?(page: Page): Promise<void>
}
```

**Module Configuration Example:**
```yaml
# config/modules.yml
storage:
  provider: s3  # or 'github', 'azure', 'gcs'
  config:
    bucket: my-wiki-content
    region: us-east-1

search:
  provider: dynamodb  # or 'algolia', 'meilisearch', 'opensearch', 'client-only'
  config:
    tableName: wiki-search-index

authentication:
  provider: cognito  # or 'auth0', 'firebase', 'custom'
  config:
    userPoolId: us-east-1_xxxxx
    clientId: xxxxxxxxxxxx

features:
  - name: comments
    enabled: true
  - name: page-ratings
    enabled: false
  - name: activity-feed
    enabled: true
  - name: pdf-export
    enabled: false
```

**Module Discovery & Loading:**
- Modules stored in `/modules/{category}/{provider}/` directory structure
- Each module has `module.json` manifest with metadata and dependencies
- Core system scans configured modules at startup
- Lazy loading for feature modules to reduce cold start time
- Module registry for browsing and installing community modules

### Cost Optimization Requirements
- **Target budget**: $5/month or less for typical family usage
- **Free tier maximization**: Use AWS free tier services where possible
- **No always-on servers**: Pure serverless (Lambda, API Gateway, S3, DynamoDB)
- **Efficient caching**: CloudFront CDN for static assets, aggressive browser caching
- **DynamoDB on-demand pricing**: Pay only for reads/writes, not provisioned capacity
- **S3 Intelligent-Tiering**: Automatic cost optimization for infrequently accessed pages
- **Lambda memory optimization**: Use smallest memory setting that meets performance SLAs
- **Monitoring**: CloudWatch alarms for unexpected cost spikes

## Development Workflow
### Feature Development Process
1. **Specification**: Create spec document in `.specify/memory/specs/`
2. **Planning**: Generate technical plan with `/speckit.plan`
3. **Task Breakdown**: Create actionable tasks with `/speckit.tasks`
4. **Test First**: Write tests before implementation (especially for storage plugins)
5. **Implementation**: Develop feature following TDD cycle
6. **Plugin Testing**: Verify feature works with BOTH S3 and GitHub storage backends
7. **Documentation**: Update user docs and API references
8. **Deploy**: Use IaC to deploy to AWS (or test environment)

### Quality Checklist
- [ ] All tests passing (unit, integration, module contract tests)
- [ ] Tested with both S3 and GitHub storage modules
- [ ] If module added/changed: Contract tests passing for module interface
- [ ] Security scan completed (npm audit, Snyk)
- [ ] Cold start performance acceptable (< 2s)
- [ ] Cost impact estimated and acceptable (documented for new modules)
- [ ] Module configuration documented
- [ ] User documentation updated
- [ ] Accessibility checked (basic WCAG 2.1 AA compliance)

### Review Requirements
**Solo Developer Mode** (current):
- Self-review with checklist before merging
- Test coverage and quality gates enforced by CI/CD

**Future Team Mode** (if expanded):
- One approval required for documentation changes
- One approval required for code changes
- Storage plugin changes require testing by reviewer

## Governance

### Constitution Authority
This constitution supersedes all other development practices and guides. Any conflicts between this document and other guidelines must be resolved in favor of this constitution.

### Amendment Process
1. Propose amendment with rationale and impact analysis
2. Discussion period: minimum 7 days for team feedback
3. Approval: requires consensus from core team
4. Migration plan: document steps to comply with new amendment
5. Update version number and last amended date

### Enforcement
- All pull requests must verify constitutional compliance
- Code reviews must reference specific principles when requesting changes
- Architectural decisions must be justified against core principles
- Use `.specify/memory/guidance.md` for runtime development guidance and patterns

### Conflict Resolution
When principles conflict, prioritize in this order:
1. **Privacy & Security** (family data protection is non-negotiable)
2. **Simplicity & Cost-Effectiveness** (must remain affordable and maintainable)
3. **Content-First Architecture** (data portability and standard formats)
4. **Cloud-Agnostic & Portable Design** (avoid vendor lock-in)
5. **Family-Friendly Experience** (usability for all skill levels)

**Version**: 1.0.0 | **Ratified**: 2026-01-12 | **Last Amended**: 2026-01-12
