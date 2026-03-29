---
description: Plan for page history UI — version list, diff viewer, and restore functionality
tags: [bluefinwiki, plan, versioning, history, diff]
audience: { human: 30, agent: 70 }
purpose: { plan: 95, design: 5 }
---

# Plan: Page History & Versioning UI

Implements: [Design](../design.md) — S3 versioning, version retrieval, diff comparison

## Scope

**Covers:**
- Version list API (GET /pages/{guid}/versions)
- Version detail API (GET /pages/{guid}/versions/{versionId})
- Version comparison API (GET /pages/{guid}/compare)
- Version restore API (POST /pages/{guid}/restore/{versionId})
- Frontend: history timeline, version viewer, diff viewer, restore confirmation

**Does not cover:**
- S3 versioning configuration (already enabled)
- Storage plugin `listVersions` method (already implemented)
- Version metadata beyond what's in YAML frontmatter and S3 version info

## Enables

Once versioning UI exists:
- **Members can see edit history** — who changed what, when
- **Members can compare versions** — visual diff of any two versions
- **Members can undo mistakes** — restore any previous version
- **Confidence to edit** — knowing nothing is permanently lost

## Prerequisites

- S3 bucket versioning enabled — **done**
- Storage plugin `listVersions` method — **done**
- Page editor with save functionality — **done**
- A diff library available — install `diff` or `jsdiff` npm package

## North Star

A family member should be able to see every previous version, compare any two versions side by side, and restore a past version with one click — all without technical knowledge.

## Done Criteria

### Version List API
- The `pages-versions-list` endpoint shall return all versions of a page by calling S3 ListObjectVersions
- For each version, the endpoint shall load the page content to extract author (from frontmatter `modifiedBy`) and timestamp (from frontmatter `modifiedAt`). This is necessary because S3 version metadata alone does not store author information.
- Each version in the response shall include: versionId, author, timestamp, title
- The first version shall be labelled "Page created"
- The list shall be sorted newest first with pagination at 20 versions per page
- When a page has no versions (newly created), the endpoint shall return a single-item list with the current version

### Version Detail API
- The `pages-versions-get` endpoint shall retrieve a specific version by S3 versionId
- The response shall include full page content and metadata for that version

### Version Comparison API
- The `pages-versions-compare` endpoint shall accept `from` and `to` version IDs as query parameters
- The endpoint shall fetch both versions and generate a line-by-line diff
- The diff response shall include additions, deletions, and unchanged sections with line numbers
- If either version is not found, the endpoint shall return 404

### Version Restore API
- The `pages-versions-restore` endpoint shall fetch the specified historical version
- The endpoint shall verify the page's current ETag/version matches the version loaded by the client (prevent concurrent edit conflicts during restore)
- If the ETag does not match, the endpoint shall return 409 with the current version info
- The endpoint shall create a new current version with the historical content
- The new version's frontmatter shall include a "Restored from version {versionId}" note in a `restoreNote` field
- The endpoint shall set `modifiedBy` to the restoring user, not the original author
- Restore shall NOT affect attachments — only page content and metadata are restored
- Restore shall trigger search index rebuild (same as a normal save)

### Frontend History Timeline
- The page editor shall have a "History" button that opens a history panel
- The history panel shall display a vertical timeline with version nodes
- Each node shall show: timestamp, author name, and change summary (characters added/removed if available)
- Each node shall have "View" and "Restore" action buttons

### Frontend Version Viewer
- Clicking "View" shall open a read-only Markdown preview of that version
- The viewer shall show version metadata in a header (author, date, version ID)
- The viewer shall have a "Restore This Version" button and a "Compare with Current" link

### Frontend Diff Viewer
- The diff viewer shall support side-by-side and inline view toggle
- Additions shall be highlighted in green, deletions in red
- The diff shall show line numbers for reference
- When the diff exceeds 10,000 lines, the viewer shall show a truncation warning

### Restore Confirmation
- Clicking "Restore" shall show a confirmation dialog: "Restore to version from [date] by [author]? Attachments will not be affected."
- On confirmation, the page content shall update to the restored version
- If a concurrent edit conflict is detected (409), the dialog shall warn and offer to reload
- The history timeline shall show the restore as a new version entry

## Constraints

- **S3 lifecycle policy**: Design specifies retaining 50 versions. Older versions may be deleted. Handle "version not found" gracefully.
- **No custom version metadata store**: Version info comes from S3 version metadata + page YAML frontmatter. No separate version tracking table.
- **Diff is server-side**: Computing diff in Lambda, not in the browser. Keeps frontend simple and handles large pages.

## References

- [Design](../design.md) — S3 versioning strategy, storage architecture
- [Versioning Flow](../flows/versioning.md) — detailed stage descriptions
- [jsdiff](https://github.com/kpdecker/jsdiff) — `diff` npm package for text comparison
- S3 ListObjectVersions — returns all versions of an object with versionId and metadata

## Error Policy

Version not found returns 404 with "This version is no longer available." Diff computation timeout at 10 seconds (Lambda). Large diffs truncated at 10,000 lines with warning. Restore failures return 500 and do not modify the current version.
