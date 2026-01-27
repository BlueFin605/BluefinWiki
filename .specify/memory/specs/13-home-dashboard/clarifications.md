# Clarification Questions: Home/Dashboard Page

**Feature**: Home/Dashboard Page  
**Generated**: 2026-01-13  
**Status**: Awaiting Answers

---

## 🔴 Critical Priority - Must Answer Before Implementation

### 1. Dashboard as Default Landing Page
**Question**: Should ALL users land on dashboard, or only when explicitly navigating to it?

**Current spec says**: "User logs in and lands on dashboard page"

**Needs clarification**:
- Always redirect to dashboard after login?
- Or remember last page and return there?
- What about deep links - if user clicks link to specific page while logged out, after login go to that page or dashboard?
- Should there be user preference "Landing page: Dashboard / Last Visited / Specific Page"?

---

### 2. Dashboard Data Source Overlap
**Question**: How does dashboard relate to navigation/discovery spec (#10)?

**Why this matters**: Both specs mention "recent activity" and "recent changes".

**Needs clarification**:
- Is dashboard's "Recent Activity" the same data as spec #10's "Recent Changes"?
- Should they share backend implementation?
- Or are they different views (dashboard = last 10, recent changes = paginated full list)?
- Avoid duplication of functionality and code!

---

### 3. Personal History Tracking Storage
**Question**: Where and how is personal page history stored?

**Current spec says**: "System records page views and edits in DynamoDB with userId, pageId, timestamp, and action type"

**Needs clarification**:
- Separate UserActivity table or part of PageHistory?
- How long is history retained (30 days, 90 days, forever)?
- Privacy consideration - can user clear their history?
- What if user views 1000 pages - storage cost?
- Should there be automatic cleanup of old history?

---

### 4. Pinned Pages Storage
**Question**: Where are pinned pages stored?

**Current spec says**: "Saved per-user in DynamoDB UserPreferences table"

**Needs schema definition**:
```json
{
  "userId": "user-guid-123",
  "pinnedPages": [
    {
      "pageId": "page-guid-456",
      "pinnedAt": "2026-01-13T10:00:00Z",
      "order": 1
    }
  ],
  "dashboardLayout": { /* customization data */ }
}
```
- Is this correct structure?
- Maximum number of pinned pages?

---

### 5. Dashboard Performance for Large Wikis
**Question**: How does dashboard perform with large datasets?

**Needs clarification**:
- If wiki has 10,000 page edits, querying "last 10 changes" - indexed properly?
- If user has viewed 5,000 pages, querying "last 5 personal views" - performant?
- DynamoDB query patterns optimized?
- Caching strategy?
- Performance targets: dashboard load in <1 second?

---

## 🟡 High Priority - Important for User Experience

### 6. Welcome Message Personalization
**Question**: How personalized is the welcome message?

**Current spec says**: "Welcome back, [User Name]!"

**Needs clarification**:
- User's display name or first name?
- Time-based greeting: "Good morning" vs "Good evening"?
- Last login timestamp: "Last visit: 2 days ago"?
- Personalized tips: "You have 3 unread changes"?
- Or keep it simple?

---

### 7. Quick Links Customization
**Question**: Can users customize which quick links appear?

**Current spec lists**: "Create New Page, All Pages, Recent Changes, Search, My Profile"

**Needs clarification**:
- Fixed set or user-customizable?
- Show/hide individual links?
- Add custom links to frequently accessed pages?
- Different defaults based on user role (Admin sees "User Management")?

---

### 8. Activity Entry Click Behavior
**Question**: What happens when clicking an activity entry?

**Current spec says**: "Navigate directly to that page"

**Needs clarification**:
- Open in same tab or new tab?
- If page has been edited multiple times, go to current version or specific version from activity?
- Should there be "view diff" option?
- Context menu for more options?

---

### 9. Empty Dashboard Experience
**Question**: What does dashboard look like for brand new user?

**Current spec mentions**: Empty state for "No recent activity"

**Needs clarification**:
- Should there be onboarding wizard?
- Tutorial/welcome message?
- Suggested first actions?
- Sample pages or templates?
- Or just empty with "Create your first page" button?

---

### 10. Pinned Pages Display Format
**Question**: How are pinned pages displayed?

**Current spec says**: "Shows page title, folder path, and 'Unpin' icon"

**Needs clarification**:
- Card layout, list layout, or grid layout?
- Show page preview/description?
- Show last modified date?
- Thumbnail if page has images?
- Drag-to-reorder functionality?

---

### 11. Recent Activity Time Display
**Question**: How are activity timestamps formatted?

**Current spec says**: "Relative timestamp (e.g., '2 hours ago')"

**Needs clarification**:
- Always relative, or switch to absolute after certain threshold (e.g., "3 days ago" vs "Jan 10, 2026")?
- Hover to see exact timestamp?
- Time zone consideration?
- Update in real-time (e.g., "1 minute ago" refreshes to "2 minutes ago")?

---

### 12. Viewer Role Quick Links
**Question**: How does dashboard adapt for different roles?

**Current spec mentions**: "Create New Page link is hidden/disabled" for viewers

**Needs clarification**:
- What other differences for Viewer vs Editor vs Admin?
- Admin sees "User Management" link?
- Different activity feed (viewers see less)?
- Or same dashboard for all with role-specific filtering?

---

### 13. Dashboard Mobile Experience
**Question**: How does dashboard adapt for mobile?

**Not explicitly covered in spec**:
- Single column layout?
- Collapse sections by default?
- Different section order?
- Hide some sections on mobile?
- Swipe between sections?

---

### 14. Multiple Quick Link Rows
**Question**: If there are many quick links, how are they displayed?

**Needs clarification**:
- Wrap to multiple rows?
- Horizontal scroll?
- "More" dropdown for additional links?
- Maximum number of quick links shown?

---

### 15. Refresh Behavior
**Question**: Does dashboard auto-refresh or require manual refresh?

**Not explicitly covered in spec**:
- Auto-refresh activity feed every X minutes?
- Real-time updates via WebSocket?
- Manual refresh button?
- Or always requires page reload?

---

## 🟢 Medium Priority - Nice to Have Clarity

### 16. Dashboard Widgets Beyond Core
**Question**: What other widgets could be added to dashboard?

**Not explicitly covered in spec**:
- "My drafts" (unsaved pages)?
- "Pages I'm watching"?
- "Upcoming events" (from calendar pages)?
- "To-do items" (from pages with tasks)?
- Extensible widget system?

---

### 17. Activity Feed Filtering on Dashboard
**Question**: Can users filter activity feed on dashboard?

**Not explicitly covered in spec (spec #10 has full filter)**:
- Quick filters: "My edits only", "Last 24 hours"?
- Or always show global activity (go to spec #10 for filtering)?

---

### 18. Dashboard Statistics/Metrics
**Question**: Should dashboard show wiki statistics?

**Not explicitly covered in spec**:
- Total pages, total edits, active users?
- "This week: 15 pages edited, 23 changes"?
- Growth charts?
- Only for admins or everyone?

---

### 19. Dashboard Notifications
**Question**: Should dashboard show notifications?

**Not explicitly covered in spec**:
- "3 pages you're watching were updated"?
- "Mom mentioned you in a comment"?
- "New user joined the wiki"?
- Separate notifications feature or part of dashboard?

---

### 20. Personal History Privacy
**Question**: Are view history stats visible to others?

**Current spec says**: "Data is per-user and not visible to other users (even admins)"

**Needs clarification**:
- Confirm admins definitely cannot see user view history?
- Or can admins see for support/debugging?
- Edit history is likely public (page history), but VIEW history is private?
- Important privacy distinction!

---

### 21. Pinned Pages Limit
**Question**: Is there a maximum number of pinned pages?

**Current spec says**: "If more than 6 pages, display first 6 with 'View All Pinned' link"

**Needs clarification**:
- What's the actual maximum (6, 20, 100, unlimited)?
- Why 6 specifically?
- Should there be recommended limit?
- Performance consideration?

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

**Not explicitly covered in spec**:
- Useful for "weekly activity report"?
- Print stylesheet to show only relevant sections?
- Or printing dashboard doesn't make sense?

---

### 24. Dashboard Export
**Question**: Can dashboard data be exported?

**Not explicitly covered in spec**:
- Export activity feed as CSV?
- Export pinned pages list?
- Useful for record-keeping?
- Or not needed?

---

### 25. Dashboard Onboarding
**Question**: Is there a first-time user experience?

**Not explicitly covered in spec**:
- Tour of dashboard features?
- Tooltips highlighting sections?
- "Skip tour" option?
- Only for new users or everyone after feature updates?

---

## 📝 Recommendations

1. **Answer Critical Priority (🔴) questions FIRST** - especially relationship with spec #10 and data storage
2. **Consolidate with navigation/discovery spec** - avoid duplicate implementations
3. **Design dashboard layout mockups** - desktop and mobile versions
4. **Define user preferences schema** - complete UserPreferences table structure

Would you like me to:
- Help consolidate dashboard and navigation/discovery specs?
- Create dashboard layout mockups?
- Design the UserPreferences data model?
- Draft the activity feed query optimization strategy?
