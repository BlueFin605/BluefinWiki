---
description: Plan for navigation aids — breadcrumbs, table of contents, and sitemap
tags: [bluefinwiki, plan, navigation, breadcrumbs, toc, sitemap]
audience: { human: 30, agent: 70 }
purpose: { plan: 95, design: 5 }
status: partially-completed
completed: 2026-04-01
---

# Plan: Navigation & Discovery

Implements: [Design](../design.md) — Frontend navigation, page hierarchy traversal

## Status

**Partially completed** — 2026-04-01

| Feature | Status | Notes |
|---------|--------|-------|
| Breadcrumbs | **Done** | Ancestor API, component in PageEditor, mobile collapse |
| Table of Contents | **Done** | Heading parser, IntersectionObserver active tracking, desktop sticky sidebar, mobile collapsible |
| Sitemap | **Dropped** | Redundant with existing page tree sidebar — adds no value for a small wiki |
| Recent Changes | Not started | P3 optional, requires activity_log table from User Management plan |

## Scope

**Covers:**
- Breadcrumb navigation component
- Table of contents (TOC) generator and component
- Sitemap API and full-page tree view
- Recent changes feed (P3 — optional)

**Does not cover:**
- Page tree sidebar (already built)
- Search (already built — see flow: search-discovery.md)
- Dashboard (Plan: Dashboard)

## Enables

Once navigation exists:
- **Members orient themselves** — breadcrumbs show where they are in the hierarchy
- **Members navigate within pages** — TOC for long pages with many sections
- **Members browse the full wiki** — sitemap shows everything in one view
- **Members see what's new** — recent changes feed (if built)

## Prerequisites

- Page hierarchy with parentGuid traversal — **done**
- Storage plugin listChildren — **done**
- Frontend page layout — **done**

## North Star

A family member should always know where they are, be able to see the structure of any page, and browse the entire wiki without using search.

## Done Criteria

### Breadcrumbs
- The breadcrumb component shall display: Home > Parent Page > Child Page > Current Page
- Each segment shall be a clickable link navigating to that page
- When page names exceed available width, the component shall truncate with ellipsis and tooltip
- On mobile, the component shall collapse middle segments: Home > ... > Current
- The breadcrumb shall use `<nav>` with `aria-label="Breadcrumb"` for accessibility
- The breadcrumb shall be positioned at the top of the content area, below the header
- The breadcrumb data shall be built by traversing parentGuid from current page to root

### Table of Contents
- The TOC generator shall parse Markdown content for h2-h6 headers
- The generator shall produce unique anchor IDs by slugifying header text
- The TOC component shall render a hierarchical nested list (ul/li)
- Each TOC entry shall be a clickable link that scrolls to the corresponding section
- The TOC shall highlight the active section based on scroll position
- On desktop, the TOC shall appear as a sticky sidebar on the right
- On mobile, the TOC shall be a collapsible section at the top, toggled by "On this page" button
- When a page has fewer than 3 headers, the TOC shall not be shown
- Smooth scrolling shall animate to the target section with offset for the fixed header
- Scrolling shall update the URL hash

### Sitemap
- The `sitemap-get` endpoint shall return all pages as a hierarchical JSON tree
- The tree shall be built from parentGuid relationships recursively
- The endpoint shall respect permissions: exclude draft pages not owned by the requesting user
- The sitemap page shall render a full-page expandable/collapsible tree
- Tree nodes shall show folder icon for pages with children, page icon for leaf pages
- The sitemap shall support filtering by keyword (expand and highlight matching nodes)
- The sitemap page shall be accessible via the main navigation menu

### Recent Changes (P3 — Optional)
- The `recent-changes` endpoint shall return recent page edits from the activity log
- The endpoint shall accept `limit` (default 20) and `days` (default 7) query parameters
- Each entry shall include page title, author, timestamp, and action type
- The recent changes widget shall be displayable on the dashboard

## Constraints

- **No caching in MVP** — breadcrumb data fetched by traversing parentGuid on each page load. Acceptable at <500 pages.
- **Recent changes requires activity_log table** — depends on Plan: User Management creating the table
- **TOC is frontend-only** — generated from rendered Markdown, no backend API needed

## References

- [Design](../design.md) — Page hierarchy, S3 storage paths
- [North Star](../north-star.md) — Organization and Linking & Discovery declarations
- Slugify algorithm: lowercase, replace spaces with hyphens, remove special characters, deduplicate

## Error Policy

Breadcrumb traversal failure (missing parent): show partial breadcrumb, log warning. Sitemap API timeout on large wikis: paginate or stream. TOC with duplicate header text: append numeric suffix to anchor IDs.
