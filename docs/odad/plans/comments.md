---
description: Plan for page comments — threaded discussions, markdown rendering, CRUD
tags: [bluefinwiki, plan, comments, collaboration, discussion]
audience: { human: 30, agent: 70 }
purpose: { plan: 95, design: 5 }
---

# Plan: Page Comments

Implements: [Design](../design.md) — DynamoDB comments table, frontend components

## Scope

**Covers:**
- DynamoDB `comments` table creation
- Comments CRUD APIs (list, create, update, delete, reply)
- Frontend: comments section, comment cards, composer, threaded replies
- Markdown rendering in comments

**Does not cover:**
- @mentions and mention notifications (P3)
- Real-time comment updates / websockets (post-MVP)
- Comment moderation tools beyond delete (post-MVP)

## Enables

Once comments exist:
- **Members can discuss pages** — ask questions, add context, suggest changes
- **Conversations are preserved** — threaded replies create useful discussion history
- **Collaboration beyond editing** — not everyone wants to edit the page itself

## Prerequisites

- Authentication with user context — **done**
- Permission enforcement — depends on **Plan: Permissions** for role-based delete
- Markdown rendering pipeline — **done** (reuse same react-markdown config as editor preview)

## North Star

A family member should be able to leave a comment on any page and have a threaded conversation — as naturally as texting.

## Done Criteria

### DynamoDB Table
- The `comments` table shall be created with PK: `guid` (comment ID, UUID)
- The table shall have GSI: `pageGuid-createdAt-index` for listing comments by page
- Attributes: pageGuid, userId, content (Markdown), parentGuid (null for root comments, comment GUID for replies), createdAt, updatedAt, edited (boolean), deleted (boolean)

### Comments List API
- The `comments-list` endpoint (GET /pages/{pageGuid}/comments) shall return all comments for a page
- Comments shall be sorted chronologically (oldest first)
- Each comment shall include author details (display name, role) joined from user_profiles
- The endpoint shall support pagination (50 comments per page)
- Deleted comments shall be returned with content replaced: "[Comment deleted]"

### Comment Create API
- The `comments-create` endpoint (POST /pages/{pageGuid}/comments) shall validate content (1-5000 characters)
- The endpoint shall store the comment in DynamoDB with userId from JWT
- The endpoint shall return the created comment with generated GUID

### Comment Reply API
- The `comments-reply` endpoint (POST /comments/{guid}/reply) shall create a comment with parentGuid set to the target comment
- The maximum thread depth shall be 3 levels (root > reply > reply)
- If a reply would exceed max depth, the endpoint shall return 400

### Comment Update API
- The `comments-update` endpoint (PUT /comments/{guid}) shall verify the caller is the comment author or an admin
- The endpoint shall update content and set updatedAt timestamp and edited flag to true
- If the caller is not authorized, the endpoint shall return 403

### Comment Delete API
- The `comments-delete` endpoint (DELETE /comments/{guid}) shall verify the caller is the comment author or an admin
- The endpoint shall soft-delete: set deleted flag to true, preserve record for audit
- Replies to a deleted comment shall remain visible

### Frontend Comments Section
- The comments section shall appear below page content
- The section header shall show comment count
- The section shall be collapsible (expanded by default)

### Comment Card Component
- Each comment shall display: author name (with initials avatar), role badge if admin, timestamp, Markdown-rendered content
- Action buttons: Reply, Edit (if author), Delete (if author or admin)
- Edited comments shall show "(edited)" tag

### Comment Composer
- The composer shall have a textarea with basic Markdown toolbar (bold, italic, link, code)
- The composer shall show a character counter (0/5000)
- The composer shall have a Submit button (disabled when empty)
- Optionally: live preview toggle

### Threaded Replies
- Replies shall be visually indented under their parent comment
- "Reply" button shall open a nested composer below the comment
- Reply threads shall be collapsible ("Show N replies" / "Hide replies")
- Thread depth visually indicated by indentation (max 3 levels)

## Constraints

- **Soft delete only** — deleted comments retain their record for audit and to preserve thread structure
- **Max thread depth: 3** — prevents deeply nested unreadable threads
- **Same Markdown renderer** — comments use the same react-markdown pipeline as the page editor preview
- **No real-time updates** — comments loaded on page view, no push notifications or polling

## References

- [Design](../design.md) — DynamoDB tables, frontend architecture
- [North Star](../north-star.md) — Collaboration declarations
- [Permissions Plan](permissions.md) — role-based delete authorization

## Error Policy

Content too long: return 400 with "Comments must be under 5000 characters." Thread too deep: return 400 with "Maximum reply depth reached." Auth failure: return 403. DynamoDB write failure: return 500 with retry suggestion.
