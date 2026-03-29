---
description: Plan for error handling — error boundaries, conflict resolution, retry logic, monitoring
tags: [bluefinwiki, plan, errors, reliability, monitoring]
audience: { human: 30, agent: 70 }
purpose: { plan: 95, design: 5 }
---

# Plan: Error Handling & Reliability

Implements: [Design](../design.md) — Cross-cutting error handling, AWS service resilience

## Scope

**Covers:**
- React error boundaries (global and per-component)
- Concurrent edit conflict resolution UI
- Input validation (client + server)
- API rate limiting
- Retry logic with exponential backoff
- Basic monitoring and alerting

**Does not cover:**
- Offline mode with write queuing (post-MVP)
- Graceful degradation per AWS service (post-MVP — complex to implement well)
- Automated incident response

## Enables

Once error handling exists:
- **Users never see blank screens** — error boundaries catch crashes
- **Concurrent edits don't silently overwrite** — conflict UI shows diff and resolution options
- **Transient failures recover automatically** — retry logic handles network blips
- **Admins know when things break** — monitoring and alerting

## Prerequisites

- All feature APIs built — error handling wraps existing functionality
- CloudWatch access — for monitoring setup

## North Star

The wiki should handle every error with a clear message and a path forward. No blank screens, no silent data loss, no mystery failures.

## Done Criteria

### React Error Boundaries
- A global error boundary shall catch uncaught component errors and display a user-friendly error page
- The error page shall show: "Something went wrong", a "Try again" button (refresh), and optionally a "Report Issue" link
- The error boundary shall log the error details to the console (and CloudWatch if available)
- Individual feature areas (editor, search, comments) shall have their own error boundaries that degrade gracefully without crashing the whole page

### Concurrent Edit Conflict Resolution
- When saving a page, the API shall check the page's ETag/version against the version the editor loaded
- If a conflict is detected (version mismatch), the API shall return 409 with the current version content
- The frontend shall show a conflict dialog with: "This page was edited by [user] while you were editing"
- The dialog shall offer: "Overwrite with my changes", "Discard my changes", or "View diff"
- If "View diff" is selected, show a side-by-side comparison of their version vs the server version

### Input Validation
- Client-side: form validation before submit (required fields, format checks, length limits)
- Server-side: all inputs validated in Lambda handlers (never trust client)
- Validation errors shall return 400 with field-specific error messages
- All user content displayed shall be sanitized against XSS (DOMPurify or rehype-sanitize in the Markdown rendering pipeline)
- Page content should warn at 50,000 characters and consider a hard limit at 200,000 characters

### CSRF Protection
- JWT is transported via Bearer tokens in the Authorization header — CSRF protection is not required
- **XSS is the primary threat vector** since tokens are in `localStorage`. Markdown output sanitization (rehype-sanitize) is the critical mitigation.

### API Rate Limiting
- API Gateway throttling is already configured: 50 req/s sustained, burst 100 (stage-level, all routes)
- Lambda concurrency limits shall prevent runaway invocations
- When rate limited, the API returns 429 — the frontend shall show "Too many requests — please try again shortly"
- Per-endpoint rate limiting (e.g., 5 login attempts/15min, 10 comments/hour) is not yet implemented — consider adding per-route throttling

### Retry Logic
- API calls from the frontend shall retry on 5xx errors with exponential backoff
- Maximum 3 retries per request (initial + 2 retries)
- Backoff schedule: 1s, 2s, 4s
- After all retries exhausted, show error message to user with "Try again" button
- Retries shall NOT apply to 4xx errors (client errors are not transient)

### Monitoring and Alerting
- CloudWatch alarms shall be configured for: Lambda error rate > 1% sustained 5 minutes, API Gateway 5xx rate > 5%
- Alarms shall notify admin via SNS email
- A basic error summary shall be visible in the admin health dashboard (Plan: Admin Config)

## Constraints

- **No offline mode in MVP** — if the network is down, show "You appear to be offline" but don't queue writes
- **ETag-based conflict detection** — use S3 ETag or a version counter in frontmatter, not database locks
- **Rate limiting at API Gateway level** — no per-endpoint custom limits in MVP

## References

- [Design](../design.md) — Cross-cutting concerns, error handling
- [North Star](../north-star.md) — Reliability declarations
- AWS API Gateway throttling: per-stage and per-method limits

## Error Policy

This plan IS the error policy. All other plans reference this for error handling patterns.
