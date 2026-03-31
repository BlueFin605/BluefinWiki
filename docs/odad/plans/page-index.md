---
description: Plan for GUID-to-path index — eliminate full S3 bucket scans when loading pages by GUID
tags: [bluefinwiki, plan, index, performance, s3, dynamodb]
audience: { human: 30, agent: 70 }
purpose: { plan: 95, design: 5 }
status: completed
completed: 2026-04-01
---

# Plan: Page Index

Implements: [Design](../design.md) — Storage architecture, performance

## Status

**Completed** — 2026-04-01

All done criteria met: DynamoDB `page_index` table created, index maintained on create/move/delete, `findPageKey` uses index lookup with S3 scan fallback, rebuild utility available.

## Scope

**Covers:**
- A GUID-to-S3-path index that eliminates full bucket scans
- Index maintenance on page create, move, and delete
- Migration of `findPageKey` from ListObjects scan to index lookup

**Does not cover:**
- Search index (separate concern — `search-index.json` for Fuse.js)
- Display-path-to-GUID resolution (e.g., `/wiki/holidays/trip-2026` → GUID). If human-readable URLs are needed, a separate `displayPath` lookup is required — the `title` field in this index could support it, but the full hierarchical path resolution is a different problem.
- Page metadata caching (post-MVP)

## Enables

Once the page index exists:
- **Every page load is O(1)** — direct lookup instead of scanning every object in the bucket
- **Move and delete are O(1) for path resolution** — no scan to find the page first
- **The wiki scales beyond tens of pages** — current approach degrades linearly with page count
- **All downstream plans benefit** — versioning, navigation, metadata, comments all call loadPage

This is a foundational improvement. Every plan that reads or writes pages depends on `findPageKey`, which currently scans the entire bucket for non-root pages.

## Prerequisites

- S3StoragePlugin operational — **done**
- DynamoDB access from Lambda — **done** (already used for user_profiles, invitations, page_links)

## North Star

Loading a page by GUID should take one lookup, not a scan of every object in the bucket. The index is invisible to users — they just experience fast pages.

## The Problem

`S3StoragePlugin.findPageKey()` (backend/src/storage/S3StoragePlugin.ts:468) resolves a GUID to an S3 key by:

1. Trying `{guid}/{guid}.md` (root page) via HeadObject — O(1), good
2. If not found: **listing the entire bucket** via ListObjectsV2 and scanning for `*/{guid}/{guid}.md` — O(n) where n is total objects

Every `loadPage`, `deletePage`, `movePage`, and attachment operation calls `findPageKey`. For a wiki with 100 pages and attachments, this means listing potentially hundreds of S3 objects on every single page load.

## Done Criteria

### Index Storage
- A DynamoDB table `page_index` shall be created with PK: `guid` (page GUID)
- Attributes: `s3Key` (the full S3 path to the .md file), `parentGuid`, `title`, `updatedAt`
- The table shall use on-demand capacity (pay-per-request)

### Index Writes
- When a page is created via `savePage`, the index shall be updated with the new GUID → S3 key mapping
- When a page is moved via `movePage`, the index shall be updated with the new S3 key for the moved page and all its descendants
- When a page is deleted via `deletePage`, the index entry shall be removed (and descendants if recursive)
- When a page title changes, the index `title` field shall be updated

### Index Reads
- `findPageKey` shall query the `page_index` table by GUID instead of listing S3 objects
- If the index returns a key, use it directly
- If the index has no entry (orphaned page or index not yet built), fall back to the current ListObjects scan and repair the index

### Index Rebuild
- A `rebuild-page-index` utility shall scan all S3 objects and populate the index table
- This shall be runnable as a one-time migration and as an admin recovery tool
- The rebuild shall handle the index being empty (fresh start) or stale (repair)

### Fallback Behaviour
- If DynamoDB is unavailable, `findPageKey` shall fall back to the current S3 scan behaviour
- The fallback shall log a warning so the issue is visible
- The wiki remains functional (slower) even if the index is down

## Constraints

- **DynamoDB is the index, S3 is the source of truth** — if they disagree, S3 wins. The fallback scan + repair handles this.
- **Index must be maintained atomically with S3 writes** — update index in the same Lambda invocation as the S3 write. Not eventually consistent via events.
- **No breaking changes to StoragePlugin interface** — the index is an internal implementation detail of S3StoragePlugin

## References

- [Design](../design.md) — DynamoDB tables, S3 storage architecture
- `backend/src/storage/S3StoragePlugin.ts:468` — current `findPageKey` implementation
- TASKS.md line 271: "Build S3 path from GUID (need to search if parent unknown, or track in index)"

## Error Policy

Index read failure: fall back to S3 scan, log warning. Index write failure: page operation succeeds (S3 write is primary), log error, index becomes stale until next write or rebuild. Index rebuild failure: partial rebuild is acceptable — next page operations will repair individual entries.
