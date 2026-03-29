---
description: Plan for user management admin UI and APIs — listing, editing, suspending members and managing invitations
tags: [bluefinwiki, plan, user-management, admin, cognito]
audience: { human: 30, agent: 70 }
purpose: { plan: 95, design: 5 }
---

# Plan: User Management

Implements: [Design](../design.md) — User management, Cognito integration, DynamoDB user_profiles

## Scope

**Covers:**
- Admin user list API (Cognito + DynamoDB merge)
- User detail, update, suspend, activate, and delete APIs
- Invitation management APIs (create, list, revoke)
- Admin dashboard UI: user list, user detail modal, invitation management
- User profile page (self-service)
- Activity logging table and basic tracking

**Does not cover:**
- Authentication flows (already built — see flow: authentication.md)
- Permission enforcement middleware (Plan: Permissions)
- @mentions or notifications (post-MVP)

## Enables

Once user management exists:
- **Admins can manage membership** — see who's in the wiki, change roles, suspend bad actors
- **Invitation workflow is visible** — admins can track pending invites, revoke unused ones
- **Activity tracking feeds other features** — dashboard recent activity, history attribution
- **Plan: Permissions** can proceed — needs role management to enforce

## Prerequisites

- Authentication system operational (Cognito + DynamoDB user_profiles) — **done**
- DynamoDB `invitations` table exists — **done**
- Backend auth middleware extracts role from JWT — **done**

## North Star

An admin should be able to see all family members, manage their roles, and control access — without touching AWS console. A member should be able to update their own display name and password.

## Done Criteria

### User List API
- The `admin-users-list` endpoint shall return all users by merging Cognito ListUsers with DynamoDB user_profiles
- The endpoint shall support pagination using Cognito PaginationToken
- The endpoint shall support filtering by role and status
- When called by a non-admin, the endpoint shall return 403 Forbidden

### User Detail API
- The `admin-users-get` endpoint shall return combined Cognito + DynamoDB data for a single user
- The response shall include last login timestamp from Cognito attributes

### User Update API
- The `admin-users-update` endpoint shall update role in both DynamoDB and Cognito custom attributes
- The endpoint shall update email via Cognito AdminUpdateUserAttributes (triggers verification)
- The endpoint shall support password reset via AdminSetUserPassword
- If an admin attempts to modify their own role, the endpoint shall return 400 with "Cannot change your own role"

### User Suspend / Activate
- The `admin-users-suspend` endpoint shall call Cognito AdminDisableUser and update DynamoDB status to 'suspended'
- The `admin-users-activate` endpoint shall call Cognito AdminEnableUser and update DynamoDB status to 'active'
- If an admin attempts to suspend themselves, the endpoint shall return 400

### User Delete
- The `admin-users-delete` endpoint shall soft-delete in DynamoDB (anonymize data, mark deleted)
- The endpoint shall hard-delete from Cognito via AdminDeleteUser
- The endpoint shall preserve activity logs for audit

### Invitation Management
- The `admin-invitations-create` endpoint shall generate an 8-character invite code with 7-day TTL
- The endpoint shall send an invitation email via SES with registration link
- The `admin-invitations-list` endpoint shall return all invitations with status
- The `admin-invitations-revoke` endpoint shall mark an invitation as revoked

### Admin Dashboard UI
- The user list page shall display a sortable table with Name, Email, Role, Status, Last Active columns
- The user list shall support search/filter and pagination
- The user detail modal shall display full profile with edit and suspend/activate actions
- The invitation management page shall show pending/used/expired invitations with create and revoke actions

### User Profile (Self-Service)
- A member shall be able to view their own profile (display name, email, role, contributions)
- A member shall be able to update their display name
- A member shall be able to change their password (requiring current password)
- A member shall not be able to change their own role

### Activity Logging
- The `activity_log` DynamoDB table shall be created with PK: userId, SK: timestamp, TTL: 90 days
- The system shall log page creates, edits, and deletes with userId extracted from JWT
- The system shall log admin actions (role changes, suspensions)

## Constraints

- **Cognito is the source of truth for auth state** — user enabled/disabled status must be set in Cognito, not just DynamoDB
- **Two-role model only** — Admin and Standard. No custom roles.
- **Soft delete for profiles** — DynamoDB profile anonymized but retained for audit. Cognito user hard-deleted.
- **No notification system** — suspension/activation emails sent via SES but no in-app notifications

## References

- [Design](../design.md) — DynamoDB tables, Cognito configuration
- [Authentication Flow](../flows/authentication.md) — invitation → registration process
- [User Management Flow](../flows/user-management.md) — detailed stage descriptions
- [AWS Cognito Admin API](https://docs.aws.amazon.com/cognito-user-identity-pools/latest/APIReference/) — ListUsers, AdminGetUser, AdminUpdateUserAttributes, AdminDisableUser, AdminEnableUser, AdminDeleteUser

## Error Policy

API errors return structured JSON with status code, error type, and human-readable message. Cognito rate limits handled with exponential backoff. DynamoDB write failures for activity logging should not block the primary action — log and continue.
