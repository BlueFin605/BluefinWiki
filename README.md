# BlueFinWiki

A private, serverless family wiki with a built-in Kanban board system — designed for small groups (3–20 users), running on AWS for under $5/month.

## What Is BlueFinWiki?

BlueFinWiki is a wiki platform where families and small teams can capture, organize, and find shared knowledge. It runs entirely on AWS serverless infrastructure, requires no server maintenance, and stores content as portable Markdown files in S3 — never locked into a proprietary format.

Create a page about the family holiday, drag photos into the editor, link it to the trip planning page, and nest it under "Holidays." Search for a recipe Grandma wrote last month and find it instantly. Define page types with custom properties, then view your TV watchlist or project tasks as a Kanban board — cards grouped by state, draggable between columns. The admin invites a new family member with one click. Nobody thinks about servers, backups, or AWS bills.

<!-- TODO: Add screenshots
![Editor](docs/screenshots/editor.png)
![Kanban Board](docs/screenshots/kanban.png)
![Page Tree](docs/screenshots/page-tree.png)
-->

## Features

### Kanban Boards

BlueFinWiki's standout feature: any page with typed children becomes a Kanban board. Define a page type with a `state` property (e.g. "To Watch", "Watching", "Watched"), assign it to child pages, and the parent page gains a board view where children appear as cards grouped into columns by state.

This isn't a bolt-on task tracker — it's built directly on the wiki's page type system. A TV show tracker, a project task board, and a recipe collection pipeline all work the same way: define the type, set the states, switch to board view.

- **Drag-and-drop** cards between columns to change state, or reorder within a column
- **Deep boards** — aggregate pages from an entire subtree (e.g. see all episodes across all seasons of all TV shows), not just direct children, with configurable depth up to 10 levels
- **Configurable columns** — custom order, custom colors, auto-generated color palette for new states, plus an "Uncategorised" column for untyped pages
- **Card detail dialog** — view and edit tags and custom properties inline without leaving the board
- **Board settings** — configure target page type, subtree depth, default view (content or board), column layout, and whether to show parent titles on cards
- **Add cards** directly from a column to create a new child page pre-set to that state

### Content Creation

- **Markdown editor** with live side-by-side preview (split view on desktop, toggle on mobile)
- **Formatting toolbar** — bold, italic, headings, lists, task lists, code blocks, links, images — no Markdown knowledge required
- **Keyboard shortcuts** — Ctrl+S to save, Ctrl+B for bold, Ctrl+I for italic
- **Mermaid diagrams** rendered in preview
- **Draft persistence** — unsaved edits are stashed when navigating away and restored when you return
- **Syntax highlighting** in code blocks

### File Attachments

- Upload files via toolbar button or the Inspector panel (up to 60 MB per file)
- Uploaded images show thumbnails; inserting from the inspector adds the Markdown link at cursor position
- Secure presigned-URL upload flow — files go directly to S3
- Delete attachments (author or admin)

### Page Organization

- **Hierarchical page tree** in a resizable sidebar — nest pages like folders
- **Drag-and-drop** to reorder pages within a level or reparent to a different location
- **Page type constraints** enforced on drag — invalid moves are blocked with a warning
- **Breadcrumb navigation** showing full ancestor path
- **Table of contents** auto-generated from headings (sticky sidebar on desktop, collapsible on mobile)
- **Right-click context menu** — rename, create child page, delete (admin only)

### Wiki Linking & Search

- **`[[double bracket]]` wiki links** with autocomplete suggestions as you type
- **Backlinks** — the Inspector shows all pages that link to the current page
- **Broken link creation** — click a red broken link in preview to create the missing page; the link auto-updates
- **Full-text search** (Ctrl/Cmd+K) — client-side search index with debounced input, scope filtering, title-only mode, and recent search history

### Page Types & Custom Properties

- Admins define page type schemas — each with a name, icon, and typed properties (`string`, `number`, `date`, `tags`)
- Properties can have default values and be marked required
- **Hierarchy rules** — control which page types can be children or parents of other types
- Assign a type to any page; its custom properties become editable in the Inspector
- Tags use a shared global vocabulary with autocomplete, scoped per property name

### Page Status & Tags

- Three statuses: **draft**, **published**, **archived** — selectable per page
- Draft pages visible only to the author and admins; archived pages excluded from search
- Global tag registry with autocomplete across the wiki

### Access Control

- **Invite-only** — admins generate single-use invitation codes; new members register with a code
- **AWS Cognito** authentication (OAuth 2.0 with PKCE) with optional Google login
- **Role-based access** — Admin and Standard roles
- Admin panel for user management (view, update roles, suspend, activate, delete users)
- Invitation management (create, list, revoke codes)
- User profiles with display name and change password

### Mobile Responsive

- Sidebar becomes a slide-in drawer on mobile
- Editor toolbar switches to a compact fixed bottom bar
- Inspector opens as a bottom sheet
- Table of contents collapses to an accordion
- Touch-friendly throughout

## Architecture

BlueFinWiki is a monorepo with four packages:

```
bluefinwiki/
├── frontend/         React 18 + TypeScript + Vite + Tailwind CSS
├── backend/          AWS Lambda functions (Node.js 20, TypeScript)
├── infrastructure/   AWS CDK (C#) — Infrastructure as Code
└── aspire/           Microsoft Aspire for local dev orchestration
```

### Production Stack

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│  CloudFront │────▶│  S3 (static) │     │   API Gateway    │
│    (CDN)    │     │  React SPA   │     │   REST API       │
└─────────────┘     └──────────────┘     └────────┬────────┘
                                                   │
                                          ┌────────▼────────┐
                                          │  Lambda (Node)   │
                                          │  Backend Logic   │
                                          └──┬─────┬─────┬──┘
                                             │     │     │
                                    ┌────────▼┐ ┌──▼──┐ ┌▼────────┐
                                    │ DynamoDB │ │ S3  │ │ Cognito │
                                    │ Metadata │ │Pages│ │  Auth   │
                                    └─────────┘ └─────┘ └─────────┘
```

- **Frontend**: React SPA served via CloudFront CDN
- **Backend**: Lambda functions behind API Gateway — each endpoint is a separate handler
- **Storage**: S3 for page content (Markdown + YAML frontmatter), DynamoDB for metadata, indexes, page types, tags, user profiles, invitations, and activity logs
- **Auth**: AWS Cognito with invite-only registration and optional Google login
- **Search**: Client-side full-text index built from backend data, with background refresh

### Local Development

Microsoft Aspire orchestrates the full local stack with a single command:
- **LocalStack** emulates S3, DynamoDB, and SES
- **MailHog** captures emails for testing
- **Aspire Dashboard** provides OpenTelemetry traces, logs, and metrics

No AWS account needed for local development.

## Pluggable Storage

The application never talks to S3 directly — it talks to the `StoragePlugin` interface:

```
┌─────────────────────────────────────────┐
│   Application Layer (Lambda Functions)  │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│      StoragePlugin Interface            │
│  (savePage, loadPage, deletePage, etc.) │
└──────────────┬──────────────────────────┘
               │
      ┌────────┴────────┬──────────┐
      ▼                 ▼          ▼
┌───────────┐   ┌─────────────┐  ┌────────────┐
│ S3Storage │   │  Your Own   │  │  Your Own  │
│  Plugin   │   │   Plugin    │  │   Plugin   │
└───────────┘   └─────────────┘  └────────────┘
```

The S3 plugin ships production-ready. To add a new backend (GitHub, Azure Blob, local filesystem), implement the `StoragePlugin` interface and register it — no changes to the rest of the system. Pages are stored as Markdown with YAML frontmatter using GUID-based paths, so hierarchy and metadata work identically regardless of backend.

See the [Plugin Developer Guide](backend/src/storage/PLUGIN-DEVELOPER-GUIDE.md) for details.

## Cost

Expected AWS costs for typical family usage:

| Users | Monthly Cost |
|-------|-------------|
| 5 users, 500 pages | ~$5/month |
| 20 users, moderate usage | ~$20/month |

Entirely pay-as-you-go — Lambda, DynamoDB, S3, CloudFront, Cognito. No always-on infrastructure.

## Getting Started

**Local development** — get running in 3 steps:

> See **[QUICKSTART.md](QUICKSTART.md)** for the full guide

```powershell
# 1. First-time setup (one time only)
.\setup-aspire.ps1

# 2. Start everything
dotnet run --project aspire/BlueFinWiki.AppHost

# 3. Open http://localhost:5173
```

**Deploy to AWS** — get your wiki live:

> See **[DEPLOY-AWS.md](DEPLOY-AWS.md)** for the full deployment guide

```bash
cp config.example.json config.json  # Edit with your prefix, region, environment
cd infrastructure
cdk bootstrap                       # First time only
cdk deploy --all
```

## Documentation

| Document | Purpose |
|----------|---------|
| [QUICKSTART.md](QUICKSTART.md) | Local development setup and common commands |
| [DEPLOY-AWS.md](DEPLOY-AWS.md) | Deploy to AWS step-by-step |
| [ASPIRE-SETUP.md](ASPIRE-SETUP.md) | Detailed Aspire configuration |
| [INFRASTRUCTURE.md](infrastructure/INFRASTRUCTURE.md) | AWS infrastructure details |
| [Plugin Developer Guide](backend/src/storage/PLUGIN-DEVELOPER-GUIDE.md) | Build custom storage plugins |

## License

MIT
