# Clarification Questions: Granular Page Permissions

**Feature**: Granular Page Permissions  
**Generated**: 2026-01-13  
**Status**: Awaiting Answers

---

## 🔴 Critical Priority - Must Answer Before Implementation

### 1. Permissions Storage Location
**Question**: Where is page permission data stored?

**Needs clarification**:
- In page frontmatter?
- Separate DynamoDB table (PagePermissions)?
- S3 object metadata?
- How does this work with different storage plugins (S3 vs GitHub)?
- Must be queryable for "can user X access page Y" checks!

---

### 2. Permission Check Performance
**Question**: How are permissions checked on every page request?

**Why this matters**: Permission checks happen on EVERY page view - performance is critical.

**Needs clarification**:
- Cache permissions in memory/Redis?
- Query on each request (slow for large wikis)?
- Include permissions in JWT/session token?
- What if user has access to 500 pages - how is that evaluated efficiently?
- Different strategy for S3 presigned URLs vs application-served content?

---

### 3. Role-Based vs. User-Based Permissions
**Question**: Are permissions assigned to individual users or roles or both?

**Current spec shows**: Specific users by email

**Needs clarification**:
- Can you grant access to "Admin role" or "Editor role" instead of individual users?
- Example: "All Admins can view" vs listing each admin individually?
- What happens when new admin is added - do they automatically get access?
- Or always require explicit user-by-user assignment?

---

### 4. Folder Permissions Inheritance Mechanism
**Question**: How is folder permission inheritance technically implemented?

**Current spec says**: "Pages inherit folder permissions"

**Needs clarification**:
- Is "parent folder GUID" stored with page permissions?
- Or are permissions copied to each child page on folder change?
- How does system resolve: check page permissions → if inherited, check folder permissions?
- Performance implications for deeply nested folders?
- What if folder permissions change - batch update all children?

---

### 5. Admin Override Implementation
**Question**: How do admins bypass permission checks?

**Current spec says**: "Admins bypass all page-level permissions"

**Needs clarification**:
- Is this a code-level check: `if (user.isAdmin) return true;`?
- Or do admins have explicit permission grants on all pages?
- How does this interact with audit logs (show admin accessed private page)?
- Can admin access be revoked for specific sensitive pages (e.g., medical records)?

---

## 🟡 High Priority - Important for User Experience

### 6. Permission UI Discoverability
**Question**: Where exactly is the permissions UI accessed?

**Current spec mentions**: "Click 'Page Settings' icon"

**Needs clarification**:
- Page settings button location (top-right toolbar, dropdown menu)?
- Only visible to page owner and admins?
- Or visible to all with permissions section grayed out for non-owners?
- Should permissions be shown in page metadata/info panel?

---

### 7. User Picker Implementation
**Question**: How does the user picker show "all wiki users"?

**Needs clarification**:
- Dropdown, multi-select checkboxes, or searchable modal?
- Lazy loading for wikis with 100+ users?
- Show user display names, emails, or both?
- Group by role (show admins first)?
- Can users be added by typing email (autocomplete)?

---

### 8. Permission Change Confirmation
**Question**: What level of confirmation is required for permission changes?

**Current spec mentions**: Confirmation showing who will have access

**Needs clarification**:
- Simple "Are you sure?" dialog?
- Or detailed view showing "Will add access for 3 users, remove access for 1 user"?
- Require typing page name to confirm for drastic changes?
- Different confirmation levels for different changes?

---

### 9. Access Denied Error Page Design
**Question**: What does the "Access Denied" page look like?

**Current spec shows**: "Access Denied - This page is private"

**Needs complete definition**:
- Show reason (private, specific users, role restriction)?
- Request access button (email page owner)?
- Show who owns the page?
- Link to home/dashboard?
- Different messages for "doesn't exist" vs "no permission"?

---

### 10. Permission Indicator Tooltips
**Question**: What exactly do permission tooltips show?

**Current spec says**: "Tooltip appears with permission details"

**Needs clarification**:
- Private: "Private - Only you and admins can see this"?
- Specific users: "Shared with Mom, Dad, and 1 other" or full list?
- Inherited: "Inherited from Projects folder - Shared with 3 users"?
- Clickable tooltip to view full permission details?

---

### 11. Search Result Filtering
**Question**: How do permissions affect search results?

**Current spec mentions**: "Restricted pages appear with permission icon"

**Needs clarification**:
- Do search results ONLY show pages user has access to?
- Or show all pages with "Access Denied" indicator for restricted ones?
- If restricted pages are shown, do snippets appear?
- Performance impact of filtering thousands of search results?

---

### 12. Navigation Hiding Strategy
**Question**: How are restricted pages hidden from navigation?

**Current spec says**: "Private page is hidden from folder listings"

**Needs clarification**:
- Hidden at rendering (fetch all, filter client-side)?
- Or filtered at query level (don't fetch unauthorized pages)?
- What if folder has 50 pages, 40 are restricted - show empty folder?
- Or hide folder entirely if user can't access any children?

---

### 13. Override Permissions UI
**Question**: How does "Override Permissions" work for inherited pages?

**Current spec mentions**: "Owner clicks 'Override Permissions'"

**Needs clarification**:
- Is there a visible indicator that permissions are inherited?
- "Override" button next to inherited permission notice?
- Warning: "This will detach permissions from folder. Continue?"?
- Can owner revert to inherited after overriding?

---

### 14. Bulk Permission Management
**Question**: Can owners set permissions for multiple pages at once?

**Not explicitly covered in spec**:
- Select 10 pages and set permissions?
- Useful for reorganization or onboarding new users?
- Or always page-by-page?

---

### 15. Permission Templates
**Question**: Are there permission templates or presets?

**Not explicitly covered in spec**:
- "Adults Only" template (all adults have access)?
- "Private" template?
- "Project Team" template?
- Or always manual selection?

---

## 🟢 Medium Priority - Nice to Have Clarity

### 16. Permission Change Audit Log
**Question**: Are permission changes logged?

**Not explicitly covered in spec**:
- Who changed permissions, when, what changed?
- Visible to page owner, admins, or both?
- Important for accountability?
- Part of this spec or separate audit feature?

---

### 17. Temporary Access Grants
**Question**: Can access be time-limited?

**Not explicitly covered in spec**:
- Grant access for 7 days then auto-revoke?
- Useful for guests or temporary collaborators?
- Or always permanent until manually revoked?

---

### 18. Permission Request Workflow
**Question**: Can users request access to restricted pages?

**Not explicitly covered in spec**:
- "Request Access" button on Access Denied page?
- Notifies page owner for approval?
- Useful for discoverability?
- Or too complex for family wiki?

---

### 19. Group/Team Permissions
**Question**: Can permissions be granted to groups instead of individuals?

**Not explicitly covered in spec**:
- Create "Adults" group, "Kids" group?
- Grant access to group instead of listing individuals?
- Useful for family structure?
- Or overkill - use roles instead?

---

### 20. Anonymous/Guest Access
**Question**: Can pages be made public (no login required)?

**Not explicitly covered in spec**:
- "Public - Anyone with link" option?
- Useful for sharing with extended family/friends?
- Or against invite-only principle?

---

### 21. Permalink Permissions
**Question**: How do permissions work with permalinks (from page history)?

**Not explicitly covered in spec**:
- Do historical versions inherit current permissions?
- Or maintain permissions from when version was created?
- Security implications?

---

### 22. Attachment Permissions
**Question**: Do attachments inherit page permissions?

**Not explicitly covered in spec**:
- If page is private, are attachments also private?
- Or can attachments be public while page is private?
- Direct attachment URLs - bypass page auth?

---

### 23. Print/Export Permissions
**Question**: Do permissions affect printing or exporting?

**Not explicitly covered in spec**:
- Can user with view-only access print?
- Can they export as PDF?
- Or is export restricted to editors only?

---

### 24. Permission Conflict Resolution
**Question**: What if user has conflicting permissions?

**Not explicitly covered in spec**:
- User is in "Adults" group (view-only) but also individually granted edit access?
- Most permissive wins?
- Or most restrictive?

---

### 25. Default Permission Setting
**Question**: What are default permissions for new pages?

**Not explicitly covered in spec**:
- "Everyone" by default?
- Creator only by default (must explicitly share)?
- Inherit from parent folder by default?
- User preference?

---

## 📝 Recommendations

1. **Answer Critical Priority (🔴) questions FIRST** - especially storage and performance considerations
2. **Design permission check flow** - document exact logic for permission resolution
3. **Create permissions data model** - show exact schema for storing permissions
4. **Mockups for permission UI** - dialog, indicators, access denied page

Would you like me to:
- Design the complete permission data model and storage schema?
- Create flowchart for permission resolution logic?
- Design mockups for permission UI and access denied page?
- Research permission checking patterns and performance strategies?
