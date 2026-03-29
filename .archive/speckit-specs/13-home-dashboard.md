# Feature Specification: Home/Dashboard Page

**Feature Branch**: `13-home-dashboard`  
**Created**: 2026-01-12  
**Status**: Draft  
**Input**: User description: "Home/Dashboard Page - What users see when they first log in, Recent activity, quick links, favorite pages"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Default Landing Page with Recent Activity (Priority: P1)

A user logs into the wiki and lands on a dashboard page showing a welcoming overview with recent activity (last 10 changes), providing immediate visibility into what's happening in the family wiki.

**Why this priority**: First impression matters. Users need a clear starting point that shows them what's new and helps them jump into relevant content. Without a dashboard, users land on a blank or confusing page. Essential for user engagement and orientation.

**Independent Test**: Log into the wiki, verify the dashboard displays with welcome message, user name, and a "Recent Activity" section showing the last 10 page edits/creations with timestamps, page titles (linked), and author names.

**Acceptance Scenarios**:

1. **Given** a user successfully authenticates, **When** they log in, **Then** they are redirected to the dashboard page at `/` or `/dashboard`
2. **Given** the dashboard page loads, **When** displayed, **Then** it shows a welcome message "Welcome back, [User Name]!" personalized with the logged-in user's name
3. **Given** the dashboard, **When** loaded, **Then** a "Recent Activity" section displays the last 10 wiki changes (page edits/creations) across the entire wiki
4. **Given** each activity entry, **When** displayed, **Then** it shows: relative timestamp (e.g., "2 hours ago"), page title as clickable link, action type (created/edited), and author name
5. **Given** no recent activity (new wiki), **When** dashboard loads, **Then** it displays "No recent activity. Start by creating your first page!" with a "Create Page" button
6. **Given** activity entries, **When** a user clicks a page title link, **Then** they navigate directly to that page

---

### User Story 2 - Quick Links/Shortcuts (Priority: P1)

A user sees a "Quick Links" section on the dashboard with links to commonly accessed pages and actions (e.g., "Create New Page", "All Pages", "Recent Changes"), providing fast navigation without menu hunting.

**Why this priority**: Quick links reduce friction for common tasks. Users can accomplish frequent actions in one click from the dashboard. Essential for usability and efficiency, especially for non-technical family members.

**Independent Test**: Load dashboard, verify "Quick Links" section displays with at least 5 links including "Create New Page", "All Pages", "Recent Changes", "Search", and "My Profile", click each link and confirm correct navigation.

**Acceptance Scenarios**:

1. **Given** the dashboard page, **When** loaded, **Then** a "Quick Links" section displays with prominent action buttons/links
2. **Given** quick links, **When** displayed, **Then** they include at minimum: "Create New Page", "All Pages" (sitemap), "Recent Changes", "Search", and "My Profile"
3. **Given** the "Create New Page" link, **When** clicked, **Then** the user navigates to the page creation form/editor
4. **Given** the "All Pages" link, **When** clicked, **Then** the user navigates to the sitemap/page hierarchy view
5. **Given** the "Recent Changes" link, **When** clicked, **Then** the user navigates to the full activity feed page
6. **Given** quick links, **When** displayed, **Then** they use clear icons (e.g., "+" for create, search icon, list icon) alongside text labels for visual clarity
7. **Given** a user with viewer-only permissions, **When** viewing dashboard, **Then** "Create New Page" link is hidden/disabled since they cannot create pages

---

### User Story 3 - Favorite/Pinned Pages (Priority: P2)

A user pins/favorites specific pages (e.g., "Family Calendar", "Recipes", "Contacts") and sees them in a "Pinned Pages" section on the dashboard for instant access to frequently used content.

**Why this priority**: Favorites improve efficiency for power users who regularly access the same pages. Not essential for MVP since users can bookmark pages in their browser, but adds significant convenience for wiki-specific workflows.

**Independent Test**: Navigate to page "Family Recipes", click "Pin to Dashboard" button, return to dashboard, verify "Pinned Pages" section shows "Family Recipes" with link, unpin the page and verify it's removed from dashboard.

**Acceptance Scenarios**:

1. **Given** a user views any page, **When** a "Pin to Dashboard" button/icon is displayed in the page header, **Then** clicking it adds the page to the user's pinned pages list
2. **Given** a page already pinned, **When** viewing it, **Then** the button changes to "Unpin from Dashboard" allowing removal
3. **Given** the dashboard, **When** loaded and user has pinned pages, **Then** a "Pinned Pages" section displays above recent activity
4. **Given** pinned pages section, **When** displayed, **Then** each pinned page shows: page title (linked), folder path, and "Unpin" icon/button
5. **Given** pinned pages, **When** user has pinned more than 6 pages, **Then** display first 6 with "View All Pinned" link to dedicated page
6. **Given** no pinned pages, **When** dashboard loads, **Then** the "Pinned Pages" section shows "No pinned pages. Pin your favorite pages for quick access." with hint about pin button
7. **Given** pinned pages data, **When** stored, **Then** it's saved per-user in DynamoDB UserPreferences table with array of pageIds
8. **Given** pinned pages list, **When** displayed, **Then** user can drag-and-drop to reorder pins (optional enhancement)

---

### User Story 4 - My Recent Pages (Personal History) (Priority: P2)

A user sees a "My Recent Pages" section on the dashboard showing the last 5 pages THEY personally viewed or edited, providing quick access to their own work-in-progress or recently consulted content.

**Why this priority**: Personal history is convenient but less critical than global recent activity. Users can use browser history or search as workarounds. Adds personalization value but can be deferred post-MVP.

**Independent Test**: View 3 different pages and edit 1 page, return to dashboard, verify "My Recent Pages" section shows those 4 pages in reverse chronological order with timestamps.

**Acceptance Scenarios**:

1. **Given** the dashboard, **When** loaded, **Then** a "My Recent Pages" section displays the last 5 pages the current user viewed or edited
2. **Given** each entry in "My Recent Pages", **When** displayed, **Then** it shows: page title (linked), folder path, and relative timestamp (e.g., "Viewed 1 hour ago" or "Edited 3 days ago")
3. **Given** no personal history (new user or cleared history), **When** dashboard loads, **Then** section displays "You haven't visited any pages yet. Start exploring!"
4. **Given** personal history data, **When** tracked, **Then** the system records page views and edits in DynamoDB with userId, pageId, timestamp, and action type
5. **Given** personal history, **When** exceeding 5 entries, **Then** only the 5 most recent are shown with optional "View All History" link
6. **Given** privacy considerations, **When** storing history, **Then** data is per-user and not visible to other users (even admins)

---

### User Story 5 - Dashboard Customization/Widget Layout (Priority: P3)

A user customizes their dashboard by showing/hiding sections (e.g., hide "My Recent Pages", show "Pinned Pages" at top) or choosing widget layout to personalize their landing page experience.

**Why this priority**: Customization is a nice-to-have feature for power users but not essential for MVP. Default layout serves most users well. Can be added later based on user feedback.

**Independent Test**: Click "Customize Dashboard" button, drag "Pinned Pages" section to top position, hide "My Recent Pages" section, save settings, refresh page and verify layout persists according to preferences.

**Acceptance Scenarios**:

1. **Given** the dashboard, **When** a "Customize Dashboard" button is visible, **Then** clicking it enters edit mode showing drag handles and hide/show toggles for each section
2. **Given** customization mode, **When** user drags section headers, **Then** sections reorder in real-time preview
3. **Given** customization mode, **When** user toggles visibility switches, **Then** sections show/hide immediately
4. **Given** customization changes, **When** user clicks "Save" or "Done", **Then** preferences are saved to DynamoDB UserPreferences and persist across sessions
5. **Given** default dashboard, **When** no customization has been saved, **Then** all sections display in standard order: Quick Links, Pinned Pages, Recent Activity, My Recent Pages
6. **Given** customization preferences, **When** saved, **Then** they apply only to the current user and do not affect other users' dashboards

---

### User Story 6 - Wiki Statistics Summary (Priority: P3)

A user sees a summary widget on the dashboard showing basic wiki statistics (total pages, total users, pages created this week), providing a sense of wiki growth and activity level.

**Why this priority**: Statistics are interesting but not actionable for most users. Primarily valuable for admins to monitor wiki health. Low priority feature that can be added later if desired.

**Independent Test**: View dashboard, verify "Wiki Stats" widget displays "42 pages, 5 users, 7 pages created this week" with accurate counts based on wiki data.

**Acceptance Scenarios**:

1. **Given** the dashboard (admin users only or all users based on config), **When** loaded, **Then** a "Wiki Statistics" widget displays basic metrics
2. **Given** statistics widget, **When** displayed, **Then** it shows: total page count, total user count, pages created in last 7 days, and total attachments count
3. **Given** statistics data, **When** calculated, **Then** it queries DynamoDB aggregates or maintains cached counters updated on page create/delete events
4. **Given** statistics widget on mobile, **When** displayed, **Then** it shows in compact grid format (2x2 or horizontal scroll) to fit small screens
5. **Given** statistics calculations, **When** expensive to compute, **Then** results are cached for 1-hour intervals to avoid impacting dashboard load time

---

### User Story 7 - Empty State for New Wikis (Priority: P1)

A user logs into a brand new wiki with no pages yet and sees a welcoming empty state on the dashboard with clear call-to-action buttons to "Create Your First Page" or "Invite Family Members".

**Why this priority**: First-run experience is critical for adoption. Users must not be confused or blocked when starting fresh. Guiding them to first actions ensures successful wiki setup. Essential for onboarding.

**Independent Test**: Create fresh wiki instance with no pages or users except admin, log in as admin, verify dashboard displays empty state with welcome text, "Create Your First Page" button, and "Invite Users" button prominently displayed.

**Acceptance Scenarios**:

1. **Given** a wiki with zero pages, **When** dashboard loads, **Then** it displays empty state message "Welcome to your new family wiki! Let's get started."
2. **Given** empty state, **When** displayed, **Then** it shows prominent "Create Your First Page" button as primary call-to-action
3. **Given** empty state (admin user), **When** displayed, **Then** it also shows "Invite Family Members" button to guide admin toward user management
4. **Given** empty state, **When** user creates first page, **Then** subsequent dashboard loads show normal layout with that page in recent activity
5. **Given** empty state, **When** displayed, **Then** it includes brief helpful text like "Your wiki is empty. Start by creating pages to share family memories, recipes, calendars, and more!"
6. **Given** empty state for non-admin users, **When** displayed, **Then** "Invite Family Members" button is hidden (only admins can invite)

---

### Edge Cases

- **What happens when a pinned page is deleted?** The pin is automatically removed from the user's pinned list, and the page no longer appears on their dashboard.
- **How does the system handle very long page titles in dashboard sections?** Truncate to 50 characters with ellipsis, show full title on hover tooltip.
- **What if recent activity includes pages the current user doesn't have permission to view?** Filter activity feed to only show pages the user can access based on their role/permissions.
- **How does dashboard perform for users in wikis with thousands of pages?** Recent activity queries are limited to last 10 items with timestamp index, ensuring fast response. Personal history is user-specific and limited to 5 items.
- **What happens when a user pins the maximum number of pages?** Enforce limit of 20 pinned pages, show warning "Maximum 20 pinned pages. Unpin a page to add more."
- **How are deleted users handled in recent activity?** Display "[Deleted User]" or the user's name with "(inactive)" label if user account is removed but history preserved.
- **What if dashboard sections conflict on mobile (too much content)?** Prioritize Quick Links and Pinned Pages above the fold, Recent Activity scrolls below, My Recent Pages can be collapsed by default on mobile.
- **How does dashboard handle offline mode or API failures?** Show cached dashboard data if available, display friendly error message "Unable to load recent activity. Check your connection." with retry button.
- **What if multiple tabs are open and user pins a page in one tab?** Use localStorage or websocket to sync pinned pages state across tabs for same user (optional enhancement).
- **How does customization handle new dashboard features added later?** New sections appear at bottom of dashboard by default until user customizes layout.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST redirect authenticated users to dashboard page at `/dashboard` or `/` upon successful login
- **FR-002**: System MUST display personalized welcome message with current user's name on dashboard
- **FR-003**: System MUST display "Recent Activity" section showing last 10 wiki changes (page edits/creations) across entire wiki
- **FR-004**: System MUST provide "Quick Links" section with links to: Create Page, All Pages, Recent Changes, Search, and My Profile
- **FR-005**: System MUST filter quick links based on user permissions (e.g., hide "Create Page" for viewer-only users)
- **FR-006**: System MUST display empty state with "Create Your First Page" call-to-action when wiki has zero pages
- **FR-007**: System MUST show "Invite Family Members" button in empty state for admin users only
- **FR-008**: System MUST filter recent activity to show only pages the current user has permission to view
- **FR-009**: System MUST provide "Pin to Dashboard" action on page view allowing users to favorite pages
- **FR-010**: System MUST display "Pinned Pages" section on dashboard showing user's favorited pages (up to 6 visible)
- **FR-011**: System MUST store pinned pages per-user in DynamoDB UserPreferences table with array of pageIds
- **FR-012**: System MUST automatically remove deleted pages from users' pinned pages lists
- **FR-013**: System MUST enforce maximum limit of 20 pinned pages per user
- **FR-014**: System SHOULD display "My Recent Pages" section showing last 5 pages current user viewed or edited
- **FR-015**: System SHOULD track personal page history per-user with pageId, timestamp, and action type (view/edit)
- **FR-016**: System SHOULD cache dashboard data for 1-2 minutes to optimize repeated loads
- **FR-017**: System SHOULD provide responsive mobile layout for dashboard with prioritized sections above the fold
- **FR-018**: System MAY allow dashboard customization with drag-and-drop section reordering and visibility toggles
- **FR-019**: System MAY display wiki statistics widget (total pages, users, recent activity counts) for admin users
- **FR-020**: System MUST handle API failures gracefully with cached data fallback and user-friendly error messages

### Key Entities

- **Dashboard**: Landing page view shown after login
  - Sections: Array of {sectionId, title, content, order, visibility}
  - WelcomeMessage: Personalized string with user name
  - RecentActivity: Array of ActivityEntry (last 10)
  - QuickLinks: Array of {label, url, icon, requiredPermission}
  - PinnedPages: Array of user's pinned pages
  - MyRecentPages: Array of user's personal history

- **PinnedPage**: User's favorited page for quick access
  - UserId: GUID of user who pinned the page
  - PageId: GUID of pinned page
  - PageTitle: Display name
  - PagePath: Hierarchical path
  - PinnedAt: Timestamp when pinned
  - Order: Integer for custom sort order (if drag-and-drop enabled)

- **PersonalHistory**: User's page view/edit history
  - UserId: GUID of user
  - PageId: GUID of viewed/edited page
  - PageTitle: Display name
  - PagePath: Hierarchical path
  - Timestamp: ISO datetime of action
  - ActionType: Enum (viewed, edited)
  - TTL: Auto-expire after 90 days to limit data growth

- **DashboardPreferences**: User's customization settings
  - UserId: GUID of user (PK)
  - Layout: Array of {sectionId, order, isVisible}
  - PinnedPageIds: Array of pageId GUIDs (max 20)
  - ShowStatistics: Boolean
  - DefaultView: String (dashboard, last-viewed-page, etc.)

- **QuickLink**: Shortcut to common action or page
  - Label: Display text
  - Url: Target route
  - Icon: Icon identifier (e.g., "plus", "search", "list")
  - RequiredPermission: Enum (none, editor, admin) - who can see this link
  - IsExternal: Boolean (false for internal routes)

## Technical Implementation Notes

### Data Storage

**DynamoDB Tables/Schema**:

- **UserPreferences table**:
  - PK: `userId` (GUID)
  - Attributes: 
    - `pinnedPages`: StringSet or JSON array of pageId GUIDs (max 20)
    - `dashboardLayout`: JSON object with section visibility/order settings
    - `lastUpdated`: Timestamp
  - Used for: Pinned pages, dashboard customization preferences

- **PersonalHistory table** (optional, for "My Recent Pages"):
  - PK: `userId` (GUID)
  - SK: `timestamp#pageId` (compound sort key for chronological queries)
  - Attributes: `pageId`, `pageTitle`, `pagePath`, `actionType` (view/edit)
  - GSI: `pageId-timestamp-index` (to query history for a specific page)
  - TTL attribute: `expiresAt` (set to 90 days from timestamp for auto-cleanup)
  - Used for: Personal page history tracking

- **ActivityLog table**: Reuse from spec #10 (Recent Changes)
  - Queries: Last 10 entries for dashboard recent activity section
  - Filter by user permissions to exclude pages user cannot access

**Caching Strategy**:
- Cache dashboard data structure in CloudFront or API Gateway cache for 1-2 minutes
- Cache pinned pages per-user in browser localStorage for instant load on repeat visits
- Recent activity: Cache in Lambda memory for 1 minute to avoid repeated DynamoDB queries for concurrent requests

### API Endpoints

**GET /api/dashboard**
- Returns: Complete dashboard data including welcome message, recent activity, quick links, pinned pages, personal history
- Query params: `userId` (from auth token)
- Response filtering: Only include pages user has permission to view
- Caching: 1-minute edge cache

**POST /api/pages/{pageId}/pin**
- Adds page to user's pinned pages list in UserPreferences table
- Validation: Check max 20 pins, page exists, user has access to page
- Returns: Updated pinned pages list

**DELETE /api/pages/{pageId}/pin**
- Removes page from user's pinned pages list
- Returns: Updated pinned pages list

**PUT /api/dashboard/preferences**
- Updates user's dashboard layout preferences (section order/visibility)
- Body: JSON object with layout configuration
- Returns: Updated preferences

**GET /api/dashboard/stats** (admin only)
- Returns: Wiki statistics (total pages, users, recent activity counts)
- Caching: 1-hour cache

### Component Structure (React)

```
<Dashboard>
  <WelcomeHeader userName={currentUser.name} />
  <QuickLinksSection links={quickLinks} userRole={currentUser.role} />
  <PinnedPagesSection pages={pinnedPages} onUnpin={handleUnpin} />
  <RecentActivitySection activities={recentActivity} maxItems={10} />
  <MyRecentPagesSection history={personalHistory} maxItems={5} />
  <WikiStatsWidget stats={wikiStats} isAdmin={currentUser.isAdmin} />
  <EmptyState show={totalPages === 0} userRole={currentUser.role} />
</Dashboard>
```

### Performance Considerations

- **Dashboard load time target**: < 500ms for cached, < 1.5s for uncached
- **Recent activity query optimization**: Use DynamoDB query with `timestamp` sort key descending, limit 10
- **Pinned pages query**: Single GetItem on UserPreferences table, then batch GetItem for page metadata
- **Personal history**: Query with `userId` partition key and `timestamp` descending, limit 5
- **Mobile optimization**: Lazy-load "My Recent Pages" section below the fold, prioritize above-the-fold content

### Security & Permissions

- **Authentication required**: Dashboard is only accessible to authenticated users
- **Permission filtering**: All content sections (recent activity, pinned pages) filter by user's role-based permissions
- **Personal data isolation**: Pinned pages and personal history are user-specific and not visible to other users (even admins)
- **Quick links authorization**: Show only links for actions user has permission to perform

### Alignment with Constitution

- **Family-Friendly Experience**: Simple, intuitive dashboard that welcomes users and guides them to next actions. Suitable for all ages and tech skill levels.
- **Content-First Architecture**: Dashboard prioritizes recent content and quick access to pages, supporting content discovery.
- **Simplicity**: No unnecessary complexity. Default layout works for everyone, optional customization for power users.
- **Pluggable Architecture**: Dashboard can integrate with any storage plugin to fetch page metadata. Activity feed works with storage-agnostic ActivityLog table.
- **Privacy**: Personal history and pinned pages are private per-user, not shared across family members.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can view dashboard and access recent activity within 1.5 seconds of page load (95th percentile)
- **SC-002**: 80% of users successfully navigate to a page from dashboard quick links or recent activity on first visit (measured via analytics)
- **SC-003**: Users with pinned pages access those pages from dashboard in 1 click (no navigation required)
- **SC-004**: Empty state guides 90% of new wiki admins to create their first page within 2 minutes of login (measured by time-to-first-page metric)
- **SC-005**: Dashboard mobile layout loads and is fully interactive within 2 seconds on 3G connection
- **SC-006**: Zero errors or exceptions when loading dashboard with missing/deleted pages in pinned list or recent activity (system handles gracefully)
- **SC-007**: User customization preferences (if implemented) persist correctly across sessions and devices for 95% of save actions

### User Satisfaction Metrics

- **SC-008**: Post-MVP survey shows 85% of users find dashboard "helpful" or "very helpful" for starting their wiki session
- **SC-009**: Dashboard quick links reduce average time-to-common-action (create page, search) by 30% compared to menu navigation
- **SC-010**: Pinned pages feature adoption rate of 60% among active users within first month (measured by users with 1+ pinned pages)

---

## Open Questions / Needs Clarification

1. **Default pinned pages**: Should the system create default pinned pages for new users (e.g., "Welcome", "Help")? Or start with empty pinned list?
2. **Admin-specific dashboard**: Should admins see different dashboard with additional admin tools/stats, or same dashboard for all users?
3. **Homepage vs Dashboard**: Should `/` route be dashboard, or should there be a separate "wiki homepage" (content page) with dashboard at `/dashboard`?
4. **Customization scope**: If dashboard customization is implemented, should users be able to add/remove sections entirely, or only reorder/hide existing sections?
5. **Personal history tracking**: Should system track page views automatically, or only explicit actions (edits)? Privacy implications of tracking all page views.
6. **Mobile app considerations**: If mobile app is planned, should dashboard have app-specific layout/features, or web-responsive design suffice?
