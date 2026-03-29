---
description: Plan for page metadata APIs — tag aggregation, category listing, metadata-based filtering
tags: [bluefinwiki, plan, metadata, tags, categories]
audience: { human: 30, agent: 70 }
purpose: { plan: 95, design: 5 }
---

# Plan: Page Metadata APIs

Implements: [Design](../design.md) — Page frontmatter, search integration

## Scope

**Covers:**
- Metadata update API (PUT /pages/{guid}/metadata)
- Tag aggregation API (GET /tags)
- Category listing API (GET /categories)
- Frontend metadata filtering in search and page views

**Does not cover:**
- Custom metadata fields (P3)
- Metadata in YAML frontmatter (already implemented — tags, status, category fields exist)
- Editor metadata panel (already built — properties panel with tag input, status dropdown)

## Enables

Once metadata APIs exist:
- **Members can discover content by tag** — click a tag to see all tagged pages
- **Members can browse by category** — category pages listing all members
- **Search integrates with metadata** — filter results by tag, category, status

## Prerequisites

- Page frontmatter includes tags, status, category fields — **done**
- Editor metadata panel — **done**
- Search index includes metadata fields — **done** (search-index.json includes tags)

## North Star

A family member should be able to tag pages, browse by category, and filter search results by metadata — making the wiki self-organizing.

## Done Criteria

### Metadata Update API
- The `metadata-update` endpoint (PUT /pages/{guid}/metadata) shall load the page from storage, update tags/category/status, and save
- The endpoint shall validate status transitions: Draft > Published > Archived (no skipping back without admin role)
- The endpoint shall trigger search index rebuild after metadata changes

### Tag Aggregation API
- The `tags-list` endpoint (GET /tags) shall list all pages from storage, extract unique tags, and return with usage count per tag
- Tags shall be sorted by usage count (most popular first), with alphabetical as tiebreaker
- The response shall include: tag name, count, and list of page GUIDs using it

### Category Listing API
- The `categories-list` endpoint (GET /categories) shall aggregate unique categories from all pages
- The response shall include: category name, page count
- Categories shall be sorted alphabetically

### Frontend Tag Badges
- Tags on page views shall render as clickable badge pills
- Clicking a tag shall open search pre-filtered to that tag
- Tag badges shall use consistent colors (hash-based color assignment for visual distinction)

### Frontend Category Indicator
- Pages shall display their category with an icon
- Clicking a category shall show a list of all pages in that category

### Search Metadata Filtering
- The search dialog shall include optional filters: tag dropdown, category dropdown, status dropdown
- Client-side Fuse.js search shall apply metadata filters after text matching
- Tag and category dropdowns shall be populated from the tags and categories APIs

## Constraints

- **No DynamoDB table for metadata** — all metadata lives in page YAML frontmatter. APIs aggregate by scanning all pages.
- **Scan performance** — aggregating tags/categories requires loading all pages. Acceptable at <500 pages. If performance becomes an issue, add a DynamoDB metadata cache.
- **Status transition rules** — Standard users: Draft > Published. Admins: any transition including back to Draft or Published from Archived.

## References

- [Design](../design.md) — Page frontmatter format, S3 storage
- [North Star](../north-star.md) — Collaboration declarations (tags, categories, status)
- [Search Flow](../flows/search-discovery.md) — search index includes metadata

## Error Policy

Invalid status transition: return 400 with allowed transitions. Tag/category aggregation timeout: return partial results with warning header. Page not found on metadata update: return 404.
