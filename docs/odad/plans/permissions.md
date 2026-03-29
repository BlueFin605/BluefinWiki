---
description: Plan for role-based permission enforcement — middleware, draft visibility, UI role gating
tags: [bluefinwiki, plan, permissions, roles, authorization]
audience: { human: 30, agent: 70 }
purpose: { plan: 95, design: 5 }
---

# Plan: Permission Enforcement

Implements: [Design](../design.md) — Two-role model (Admin/Standard), JWT claims

## Scope

**Covers:**
- Backend permission middleware (role-based endpoint access)
- Draft page visibility filtering
- Frontend UI gating by role
- PermissionGuard route wrapper

**Does not cover:**
- Authentication (already built)
- Page-level permissions (post-MVP — only role-based for now)
- User management APIs (Plan: User Management — but this plan enforces the roles those APIs set)

## Enables

Once permissions exist:
- **Admin endpoints are protected** — only admins can manage users, invitations, configuration
- **Drafts are private** — only the author and admins see draft pages
- **UI reflects role** — admin menu items hidden for standard users
- **Security model is complete** — auth verifies identity, permissions enforce authorization

## Prerequisites

- JWT contains `custom:role` claim (Admin/Standard) — **done**
- Auth middleware extracts user context from JWT — **done**
- Page metadata includes `status` and `createdBy` fields — **done**

## North Star

The right people see the right things. Admins manage, standards contribute. Drafts are private until published. No security through obscurity — enforcement at every layer.

## Done Criteria

### Backend Permission Middleware
- The permission middleware shall extract `custom:role` from JWT claims
- The middleware shall accept a required role parameter per endpoint
- When a user lacks the required role, the middleware shall return 403 Forbidden with message "Insufficient permissions"
- The middleware shall be applied to all admin endpoints: user management, invitations, configuration

### Endpoint Role Requirements
- The following endpoints shall require Admin role: all `/admin/*` routes
- The following endpoints shall require authentication (any role): all `/pages/*`, `/search/*`, `/dashboard/*` routes
- The following endpoints shall be public: health check only

### Draft Visibility
- When listing pages (listChildren, sitemap, search), draft pages shall be excluded unless the requesting user is the author or an admin
- When loading a draft page directly, the API shall return 403 if the user is not the author or an admin
- The search index builder shall include a `status` and `createdBy` field so client-side search can filter drafts

### Frontend UI Gating
- Admin menu items (User Management, Configuration) shall be hidden for standard users
- The "Admin" badge shall be displayed next to admin user names
- Edit controls on pages authored by others shall be shown (all authenticated users can edit published pages)
- Delete buttons shall be shown only for the page author and admins

### PermissionGuard Component
- A `PermissionGuard` React component shall wrap admin routes
- When a non-admin navigates to a guarded route, the component shall show a 403 error page
- When an unauthenticated user navigates to any protected route, the component shall redirect to login

## Constraints

- **Two roles only** — Admin and Standard. No custom roles, no page-level ACLs.
- **Backend is the enforcement layer** — frontend hides UI elements but does not provide security. The API enforces permissions regardless of client.
- **Draft filtering in search** — client-side Fuse.js search must filter drafts locally using status + createdBy from the index. The server doesn't filter search results (the index is pre-built).

## References

- [Design](../design.md) — Role model, JWT claims, auth middleware
- [Authentication Flow](../flows/authentication.md) — how roles are assigned
- [User Management Flow](../flows/user-management.md) — how roles are changed

## Error Policy

403 responses include a human-readable message. No information leakage — a 403 on a draft page says "Page not found" not "You don't have permission" (prevents confirming existence of draft content).
