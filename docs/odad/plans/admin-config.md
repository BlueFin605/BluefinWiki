---
description: Plan for admin configuration — site settings, feature toggles, system health
tags: [bluefinwiki, plan, admin, configuration, settings]
audience: { human: 30, agent: 70 }
purpose: { plan: 95, design: 5 }
---

# Plan: Admin Configuration

Implements: [Design](../design.md) — DynamoDB site_config, admin UI

## Scope

**Covers:**
- DynamoDB `site_config` table creation
- Config get/update APIs
- Admin settings UI: site settings, feature toggles
- Basic system health display

**Does not cover:**
- Theme customization beyond color scheme (post-MVP)
- CloudWatch alarm configuration (ops task, not app feature)
- Module enable/disable runtime enforcement (just stores preferences — enforcement integrated per feature)

## Enables

Once admin config exists:
- **Admin controls the wiki name and appearance** — without code changes
- **Admin can disable features** — turn off comments or exports if not wanted
- **Admin sees system health** — storage usage and basic metrics

## Prerequisites

- Authentication with admin role — **done**
- Permission enforcement — depends on **Plan: Permissions**
- Settings page shell — **done** (`/settings` route with sidebar gear icon, links to admin features)

## North Star

An admin should be able to configure the wiki through a settings page, not through environment variables or code deployments.

## Done Criteria

### DynamoDB Table
- The `site_config` table shall be created with PK: `configKey`
- Attributes: value (JSON), updatedBy, updatedAt

### Config API
- The `config-get` endpoint (GET /admin/config) shall return all config key-value pairs
- The `config-update` endpoint (PUT /admin/config) shall validate and update config values
- Both endpoints shall require admin role
- Default config values shall be returned when no custom value is set

### Site Settings
- Configurable settings: wiki name, wiki description
- The wiki name shall appear in the header and page titles
- The wiki description shall appear on the login page

### Feature Toggles
- Configurable toggles: comments enabled (boolean), exports enabled (boolean)
- When a feature is disabled, its UI elements shall be hidden and its API endpoints shall return 403
- Default: all features enabled

### System Health Display
- The admin settings page shall show: S3 storage used (approximate), number of pages, number of users, number of invitations (pending/total)
- Health data shall be fetched from S3 (bucket size), storage plugin (page count), and Cognito (user count)

### Admin Settings UI
- The `/settings` page already exists as a shell with navigation to admin features (gear icon in sidebar). Site settings, feature toggles, and system health sections shall be added as cards on this page alongside the existing Page Types link.
- Each settings section shall show form fields for its configurable settings
- Changes shall be saved with a single "Save" button per section
- The page shall show who last updated settings and when
- Feature toggles shall use switch/toggle UI elements

## Constraints

- **Simple key-value store** — no nested config, no config versioning
- **No config change events** — features check config on each request, no pub/sub
- **Approximate storage metrics** — S3 bucket size estimation via CloudWatch or ListObjects, not real-time

## References

- [Design](../design.md) — DynamoDB tables, admin architecture
- [North Star](../north-star.md) — Access & Identity declarations (admin controls)
- [Permissions Plan](permissions.md) — admin route protection

## Error Policy

Invalid config value: return 400 with validation message. Config read failure: return defaults (wiki keeps working). Health metrics unavailable: show "Unavailable" per metric, don't fail the page.
