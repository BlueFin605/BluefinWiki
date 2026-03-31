---
description: Plan for home dashboard — recent activity, favorites, stats, welcome banner
tags: [bluefinwiki, plan, dashboard, home, activity]
audience: { human: 30, agent: 70 }
purpose: { plan: 95, design: 5 }
---

# Plan: Home Dashboard

Implements: [Design](../design.md) — Frontend, DynamoDB user_preferences

## Scope

**Covers:**
- Dashboard API (GET /dashboard)
- Favorites API (POST/DELETE /dashboard/favorites)
- Frontend: welcome banner, recent activity widget, favorites section, stats widget
- Responsive dashboard layout

**Does not cover:**
- Widget customization / reorder (P3)
- Custom quick links (P3)
- Recent changes feed (Plan: Navigation — optional P3)

## Enables

Once the dashboard exists:
- **Members have a landing page** — not dumped into an empty page tree
- **Members see what's changed** — recent activity without hunting
- **Members bookmark important pages** — favorites for quick access

## Prerequisites

- Authentication operational — **done**
- Activity logging in DynamoDB — depends on **Plan: User Management** (activity_log table)
- Page APIs operational — **done**

## North Star

A family member opens the wiki and immediately sees what matters — what's new, what they care about, and a quick way to start writing.

## Done Criteria

### Dashboard API
- The `dashboard-get` endpoint shall return: user's recent activity (last 10 pages viewed/edited), favorite page list, and global stats (total pages, total users, wiki age)
- The endpoint shall fetch favorites from DynamoDB `user_preferences` (keyed by cognitoUserId)
- The endpoint shall fetch recent activity from `activity_log` table
- The endpoint shall fetch page count from storage plugin and user count from Cognito

### Favorites API
- The `dashboard-favorites` POST endpoint shall add a page GUID to the user's favorites list
- The `dashboard-favorites` DELETE endpoint shall remove a page GUID from favorites
- Favorites shall be stored in DynamoDB `user_preferences` table (PK: userId, SK: preferenceKey) with preferenceKey `favorites`
- The favorites list shall be limited to 20 items
- When a favorited page is deleted, it shall be automatically removed from the favorites list

### Welcome Banner
- The dashboard shall show "Welcome, [Display Name]!" at the top
- The banner shall include quick action buttons: New Page, Search
- If the user has admin role, the banner shall also show an Admin button

### Recent Activity Widget
- The widget shall show the last 10 pages the user interacted with
- Each entry shall show: page title, action (viewed/edited), timestamp
- Each entry shall be a clickable link to the page
- If activity_log is empty (new user), show "Start by creating your first page"

### Favorites Section
- The section shall display favorite pages as a list with page title and star icon
- Clicking a favorite shall navigate to that page
- The star icon shall toggle favorite status (add/remove)
- If no favorites, show "Star pages to add them here"

### Stats Widget
- The widget shall show: total pages in wiki, user's contribution count (pages created/edited), number of active members
- Stats shall update on each dashboard load (no caching)

### Responsive Layout
- On desktop, the dashboard shall use a 2-3 column grid: welcome (full width), activity + favorites (side by side), stats (below)
- On mobile, the dashboard shall stack all widgets in a single column

## Constraints

- **No widget customization in MVP** — fixed layout, all widgets shown
- **Activity depends on activity_log** — if Plan: User Management hasn't created the table, show "Recent activity coming soon" placeholder
- **No real-time updates** — dashboard data is fetched on load, not pushed

## References

- [Design](../design.md) — DynamoDB tables, frontend architecture
- [North Star](../north-star.md) — Collaboration declarations (recent activity, dashboard)
- [User Management Plan](user-management.md) — activity_log table dependency

## Error Policy

Missing activity_log table: degrade gracefully, hide recent activity widget. DynamoDB read failure: show "Could not load dashboard" with retry button. Individual widget failure should not break the entire dashboard.
