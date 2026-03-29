# Clarification Questions: Home/Dashboard Page

**Feature**: Home/Dashboard Page  
**Generated**: 2026-01-13  
**Updated**: 2026-02-06  
**Status**: ✅ Completed for MVP

---

## 🔴 Critical Priority - Must Answer Before Implementation

### 1. Dashboard as Default Landing Page
**Question**: Should ALL users land on dashboard, or only when explicitly navigating to it?

**Current spec says**: "User logs in and lands on dashboard page"

**ANSWER (MVP)**:
- Simple approach: Login redirects to dashboard at `/`
- Deep links preserved: If user clicks link to specific page while logged out, after login redirect to that page (not dashboard)
- No "remember last page" - adds complexity and requires tracking
- No user preference for landing page - adds complexity
- Dashboard is home page (`/`) for simplicity

---

### 2. Dashboard Data Source Overlap
**Question**: How does dashboard relate to navigation/discovery spec (#10)?

**Why this matters**: Both specs mention "recent activity" and "recent changes".

**ANSWER (MVP)**:
- Dashboard's "Recent Activity" and spec #10's "Recent Changes" are THE SAME data
- Single backend implementation querying PageHistory table
- Dashboard shows last 10 entries (no pagination)
- Recent Changes page (spec #10) shows same data with pagination
- Reuse same query/function - DRY principle

---

### 3. Personal History Tracking Storage
**Question**: Where and how is personal page history stored?

**Current spec says**: "System records page views and edits in DynamoDB with userId, pageId, timestamp, and action type"

**ANSWER (MVP)**:
- **NOT IMPLEMENTED FOR MVP** - No user activity tracking to keep costs low and simplicity high
- No page view tracking (only page edits tracked via PageHistory)
- No "Recently Viewed" section on dashboard
- Significant cost savings: No writes for every page view, no storage for user activity
- Future enhancement if needed
- Dashboard focuses on global recent changes only

---

### 4. Pinned Pages Storage
**Question**: Where are pinned pages stored?

**Current spec says**: "Saved per-user in DynamoDB UserPreferences table"

**ANSWER (MVP)**:
```json
{
  "userId": "user-guid-123",
  "pinnedPages": [
    "page-guid-456",
    "page-guid-789"
  ]
}
```
- Simple array of pageIds (simpler than objects with metadata)
- Order preserved by array index
- Maximum: 10 pinned pages (reasonable limit)
- No dashboardLayout customization for MVP - fixed layout
- One item per user in UserPreferences table - minimal cost

---

### 5. Dashboard Performance for Large Wikis
**Question**: How does dashboard perform with large datasets?

**ANSWER (MVP)**:
- PageHistory table has GSI on timestamp for efficient queries
- Query: Get last 10 items sorted by timestamp descending - always fast regardless of total items
- No personal view history to query - removed that complexity
- Simple caching: CloudFront caches dashboard API response for 30 seconds (stale-while-revalidate)
- Target: <500ms dashboard load
- For 10-user family wiki, performance is not a concern
- If scaling needed later, can add DynamoDB DAX caching

---

## 🟡 High Priority - Important for User Experience

### 6. Welcome Message Personalization
**Question**: How personalized is the welcome message?

**Current spec says**: "Welcome back, [User Name]!"

**ANSWER (MVP)**:
- Simple: "Welcome back, [First Name]!" (extract first name from full name)
- No time-based greeting - unnecessary complexity
- No last login tracking - would require additional storage/tracking
- No personalized tips - no activity tracking means no "unread" concept
- Keep it simple and friendly

---

### 7. Quick Links Customization
**Question**: Can users customize which quick links appear?

**Current spec lists**: "Create New Page, All Pages, Recent Changes, Search, My Profile"

**ANSWER (MVP)**:
- Fixed set - no customization
- All users see: Create New Page, All Pages, Recent Changes, Search
- Admins additionally see: User Management, Configuration
- No show/hide options - adds complexity
- No custom links - use pinned pages for that
- Simple, role-based visibility

---

### 8. Activity Entry Click Behavior
**Question**: What happens when clicking an activity entry?

**Current spec says**: "Navigate directly to that page"

**ANSWER (MVP)**:
- Click opens page in same tab (standard web behavior)
- Always goes to current version of page (not historical version)
- No "view diff" on dashboard - keep it simple
- No context menu for MVP
- Users can Ctrl+Click or middle-click for new tab (browser standard)
- View history/diff from page view itself if needed

---

### 9. Empty Dashboard Experience
**Question**: What does dashboard look like for brand new user?

**Current spec mentions**: Empty state for "No recent activity"

**ANSWER (MVP)**:
- Simple empty state: "No pages yet. Get started by creating your first page!"
- Large "Create New Page" button
- No onboarding wizard - over-engineered for family wiki
- No tutorial - wiki should be intuitive
- No sample pages - they can create what they need
- Keep it simple and inviting

---

### 10. Pinned Pages Display Format
**Question**: How are pinned pages displayed?

**Current spec says**: "Shows page title, folder path, and 'Unpin' icon"

**ANSWER (MVP)**:
- Simple list layout (most space-efficient)
- Shows: page title, folder path/breadcrumb, unpin icon
- No preview/description - would require additional queries
- No last modified date - keep it simple
- No thumbnails - adds complexity and storage
- No drag-to-reorder for MVP - manual order via unpin/repin
- Clean, functional, fast

---

### 11. Recent Activity Time Display
**Question**: How are activity timestamps formatted?

**Current spec says**: "Relative timestamp (e.g., '2 hours ago')"

**ANSWER (MVP)**:
- Relative for recent: "5 minutes ago", "2 hours ago", "3 days ago"
- Switches to absolute after 7 days: "Jan 10, 2026"
- Hover shows exact timestamp: "January 10, 2026 at 3:45 PM"
- All times in user's browser timezone (client-side formatting)
- No real-time updates - static after page load (refresh page for updates)
- Use library like date-fns or Intl API for formatting

---

### 12. Role-Based Dashboard Adaptation
**Question**: How does dashboard adapt for different roles?

**CLARIFIED**: All authenticated users see the same dashboard and can create/edit content

**ANSWER (MVP)**:
- All users see same dashboard content
- All users see same activity feed (no filtering by role)
- Quick links section shows different links based on role:
  - All users: Create New Page, All Pages, Recent Changes, Search
  - Admins additionally see: User Management, Configuration
- No content access restrictions - keep authorization simple
- Pinned pages personal to each user regardless of role

---

### 13. Dashboard Mobile Experience
**Question**: How does dashboard adapt for mobile?

**ANSWER (MVP)**:
- Single column layout (responsive CSS)
- All sections visible (no collapsing) - content is minimal anyway
- Same section order: Welcome → Quick Links → Pinned Pages → Recent Activity
- No swipe gestures - standard scrolling
- Quick links may wrap to multiple rows
- Use CSS media queries for responsive design
- Test on mobile but keep implementation simple

---

### 14. Multiple Quick Link Rows
**Question**: If there are many quick links, how are they displayed?

**ANSWER (MVP)**:
- Wrap to multiple rows naturally (CSS flexbox)
- Max 6 links for non-admins, 8 for admins - won't wrap often
- No horizontal scroll - poor UX
- No dropdown - unnecessary with limited links
- Simple, clean flexbox layout

---

### 15. Refresh Behavior
**Question**: Does dashboard auto-refresh or require manual refresh?

**ANSWER (MVP)**:
- No auto-refresh - adds complexity and cost (polling)
- No WebSocket - over-engineered for family wiki
- No manual refresh button - use browser refresh
- Page reload fetches latest data
- For 10-user family wiki, updates aren't frequent enough to warrant auto-refresh
- Keep it simple - users can refresh browser if needed

---

## 🟢 Medium Priority - Nice to Have Clarity

### 16. Dashboard Widgets Beyond Core
**Question**: What other widgets could be added to dashboard?

**ANSWER (MVP)**:
- **None for MVP** - keep dashboard simple
- Core widgets only: Welcome, Quick Links, Pinned Pages, Recent Activity
- No drafts system - pages save immediately
- No page watching - no notification system for MVP
- No calendar/events parsing - out of scope
- No task tracking - out of scope
- No extensible widget system - YAGNI for family wiki
- Can add features later based on actual usage

---

### 17. Activity Feed Filtering on Dashboard
**Question**: Can users filter activity feed on dashboard?

**ANSWER (MVP)**:
- No filtering on dashboard - always shows last 10 global changes
- Want filtering? Go to Recent Changes page (spec #10)
- Dashboard is overview, Recent Changes is detailed view
- Keeps dashboard simple and fast
- No duplicate functionality

---

### 18. Dashboard Statistics/Metrics
**Question**: Should dashboard show wiki statistics?

**ANSWER (MVP)**:
- **No statistics for MVP** - adds complexity and query cost
- No total pages/edits counters
- No "this week" metrics
- No charts - significant frontend and backend work
- For family wiki, these stats aren't critical
- Can add later if there's demand
- Focus on core functionality first

---

### 19. Dashboard Notifications
**Question**: Should dashboard show notifications?

**ANSWER (MVP)**:
- **No notification system for MVP** - significant feature scope
- No page watching
- No @mentions (no comment system for MVP)
- No user join notifications
- Recent activity feed serves as lightweight notification mechanism
- Full notification system is future enhancement if needed

---

### 20. Personal History Privacy
**Question**: Are view history stats visible to others?

**Current spec says**: "Data is per-user and not visible to other users (even admins)"

**ANSWER (MVP)**:
- **N/A - No view history tracking for MVP**
- Only edit history exists (PageHistory table)
- Edit history is visible to all users (public)
- No privacy concerns since no personal tracking
- Simplifies both implementation and privacy considerations

---

### 21. Pinned Pages Limit
**Question**: Is there a maximum number of pinned pages?

**Current spec says**: "If more than 6 pages, display first 6 with 'View All Pinned' link"

**ANSWER (MVP)**:
- Hard limit: 10 pinned pages maximum
- Display all pinned pages on dashboard (no "View All" link)
- If user tries to pin 11th page, show error: "Maximum 10 pinned pages. Unpin one first."
- Simple validation in API
- 10 is reasonable for quick access without cluttering dashboard
- No "View All Pinned" page needed - just show all on dashboard

---

### 22. Dashboard Bookmarking
**Question**: Can users bookmark dashboard in browser?

**Not explicitly covered in spec**:
- Dashboard has clean URL (`/dashboard` or `/`)?
- Page title for bookmarks?
- Favicon?
- Open Graph tags for link sharing?

---

### 23. Dashboard Print View
**Question**: Can dashboard be printed?

**ANSWER (MVP)**:
- **No special print styles for MVP**
- Printing dashboard doesn't make sense for family wiki
- Users can print individual wiki pages if needed
- Not a priority feature
- Can add print CSS later if requested

---

### 24. Dashboard Export
**Question**: Can dashboard data be exported?

**ANSWER (MVP)**:
- **No export functionality for MVP**
- Not needed for family wiki
- Activity data is visible on screen
- If export needed, can export from Recent Changes page later
- Out of scope for MVP

---

### 25. Dashboard Onboarding
**Question**: Is there a first-time user experience?

**ANSWER (MVP)**:
- **No onboarding tour for MVP**
- Dashboard should be intuitive enough without tour
- For family wiki, can explain features in person or via help doc
- No tooltips/tours - adds frontend complexity
- Keep UI self-explanatory with clear labels
- Can add contextual help later if users struggle

---

## 📝 MVP Summary

### ✅ Included in MVP
- Welcome message with user's first name
- Quick links (role-based visibility)
- Pinned pages (max 10, simple list, stored in UserPreferences)
- Recent activity (last 10 global changes, shared with spec #10)
- Responsive design (mobile-friendly)
- Simple, clean UI

### ❌ Excluded from MVP (Future Enhancements)
- Personal view history tracking (cost savings)
- Dashboard statistics/metrics
- Notification system
- Activity feed filtering on dashboard
- Auto-refresh/real-time updates
- Onboarding tour
- Print/export functionality
- Additional widgets
- Drag-to-reorder pinned pages

### 💰 Cost Optimization
- No user activity tracking = no DynamoDB writes for every page view
- Simple caching (CloudFront 30s cache)
- Minimal queries (just recent changes + user preferences)
- Small UserPreferences items (just array of pageIds)

### 🎯 Next Steps
1. Update spec #13 based on these clarifications
2. Ensure spec #10 alignment (shared Recent Changes data)
3. Define UserPreferences DynamoDB table schema
4. Create simple dashboard UI mockup
