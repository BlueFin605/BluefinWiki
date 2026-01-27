# Clarification Questions: User Management

**Feature**: Admin User Management  
**Generated**: 2026-01-13  
**Status**: Awaiting Answers

---

## 🔴 Critical Priority - Must Answer Before Implementation

### 1. Relationship to User Authentication Spec
**Question**: How does this spec relate to the User Authentication spec (#1)?

**Why this matters**: Spec #1 covers invitations, roles, and access control. This spec seems to overlap.

**Needs clarification**:
- Is this spec purely the admin UI/UX for features defined in spec #1?
- Or does this define new backend functionality?
- Should both specs be merged, or kept separate (backend vs frontend)?
- Which spec owns the definition of roles and permissions?

---

### 2. Role Terminology Inconsistency
**Question**: Is the role "standard" or "Editor"?

**Current spec says**: "Standard vs admin" but authentication spec says "Editor, Admin, Viewer"

**Needs reconciliation**:
- Are "standard" and "Editor" the same thing?
- What happened to "Viewer" role?
- Should there be 2 roles (admin, standard) or 3 (admin, editor, viewer)?
- Need consistent terminology across all specs!

---

### 3. Suspended vs Disabled
**Question**: What's the difference between "suspended" and "disabled" accounts?

**Current spec uses both terms**: "status (active/invited/suspended)" and "account is disabled"

**Needs clarification**:
- Are suspended and disabled the same thing?
- Or is suspended temporary and disabled permanent?
- Can suspended users be restored but disabled users cannot?
- Consistent terminology needed!

---

### 4. User Storage and Data Model
**Question**: Where is user data stored and what's the schema?

**Needs definition**:
- DynamoDB table? Users table schema?
- Required fields: userId, email, role, status, created, lastLogin?
- How does this align with AWS Cognito (constitution says Cognito is default)?
- If using Cognito, where do custom fields (status, role) live?

---

### 5. Last Activity Tracking Mechanism
**Question**: How is "last activity" tracked and defined?

**Current spec shows**: "Last activity date" in user list

**Needs clarification**:
- What counts as activity? Login only, or any page view/edit?
- Updated on every request or periodically?
- Performance implications for tracking every action?
- Privacy considerations?

---

## 🟡 High Priority - Important for User Experience

### 6. Admin UI Access Control
**Question**: Can standard users see the User Management page at all?

**Current spec says**: "Menu item that is only visible to admin users"

**Needs clarification**:
- Completely hidden for non-admins?
- Or visible but access denied when clicked?
- Can standard users see their own profile/account details?
- Where do standard users change their own password/settings?

---

### 7. Invitation Role Pre-Assignment
**Question**: When inviting with pre-assigned admin role, what are the security implications?

**Current spec says**: "Confirmation message warns 'This user will have full admin privileges'"

**Needs clarification**:
- Should there be additional confirmation (type username to confirm)?
- Should invitation link for admin role be time-limited (shorter than 7 days)?
- Should admin invitations require two admins to approve (dual control)?
- Log admin role invitations for audit?

---

### 8. Role Change Immediate Effect
**Question**: What happens to active sessions when role is changed?

**Current spec says**: "User immediately gains/loses access to admin features"

**Needs clarification**:
- Does user need to refresh page or logout/login?
- Are active sessions terminated/refreshed automatically?
- If user is mid-edit on admin page and demoted, what happens?
- How is real-time role change communicated to client?

---

### 9. Self-Role-Change Prevention
**Question**: Why can't admins change their own role?

**Current spec says**: "Cannot change your own role. Another admin must make this change."

**Needs rationale**:
- Is this to prevent accidental lockout?
- Or to require peer review for role changes?
- What if admin wants to temporarily work as standard user for testing?
- Should there be an exception with additional confirmation?

---

### 10. User List Pagination Strategy
**Question**: How should pagination work for the user list?

**Current spec mentions**: "Pagination or infinite scroll is provided"

**Needs decision**:
- Which one: pagination or infinite scroll?
- If pagination, how many users per page?
- If infinite scroll, how many initially loaded?
- Should this be user-configurable?

---

### 11. User Search and Filter Implementation
**Question**: What fields are searchable/filterable?

**Current spec says**: "Filter by email, role, or status"

**Needs clarification**:
- Search by email only, or also by display name?
- Filter by multiple criteria at once (role=admin AND status=active)?
- Real-time filtering or apply button?
- Clear filters button?

---

### 12. Pending Invitation Display
**Question**: How are pending invitations displayed in relation to active users?

**Current spec mentions**: "Pending Invitations section"

**Needs clarification**:
- Separate section on same page?
- Separate tab?
- Collapsed by default?
- Count of pending invitations shown prominently?

---

### 13. User Activity Details
**Question**: What level of detail is shown for user activity?

**Current spec shows**: "Last activity date" only

**Needs clarification**:
- Just date, or date and time?
- Just last login, or last page edit?
- Relative time ("2 hours ago") or absolute ("Jan 13, 2026 10:30 AM")?
- Can admin drill down to see detailed activity log?

---

### 14. Bulk User Operations
**Question**: Can admins perform operations on multiple users at once?

**Not explicitly covered in spec**:
- Select multiple users and change role?
- Select multiple and suspend access?
- Bulk invite multiple emails?
- Use cases for bulk operations in family wiki context?

---

### 15. User Sorting Persistence
**Question**: Are sort preferences saved per admin?

**Current spec says**: "List sorts by that column"

**Needs clarification**:
- Is sort preference persisted (localStorage, user profile)?
- Or reset each time page loads (default sort)?
- What is default sort order (email alphabetical, last activity descending)?

---

## 🟢 Medium Priority - Nice to Have Clarity

### 16. User Profile View
**Question**: Can admins view detailed profile for each user?

**Current spec shows**: User list with basic info

**Needs clarification**:
- Click on user to see detailed profile?
- What details: email, role, status, created date, last login, pages created, pages edited?
- Edit profile from this view?
- Or is list the only view?

---

### 17. User Email Communication
**Question**: Can admins send messages to users?

**Not explicitly covered in spec**:
- Send email to user(s) through UI?
- Useful for announcements, warnings?
- Or is email communication outside wiki scope?

---

### 18. User Audit Log
**Question**: Is there an audit trail for user management actions?

**Not explicitly covered in spec**:
- Log who invited whom?
- Log role changes (who changed, when, old role, new role)?
- Log access removals/restorations?
- Where is this log viewed (separate page, part of user detail)?

---

### 19. User Export
**Question**: Can admin export user list?

**Not explicitly covered in spec**:
- Export as CSV for record keeping?
- Include: email, role, status, created, last activity?
- Useful for compliance/audit?

---

### 20. User Statistics Dashboard
**Question**: Should there be overview statistics for admins?

**Not explicitly covered in spec**:
- Total users, active users, pending invitations?
- Growth chart (new users over time)?
- Activity metrics (active in last 7 days, 30 days)?
- Where displayed (top of user management page)?

---

### 21. Suspended User Content Visibility
**Question**: How is suspended user's content displayed?

**Current spec says**: "Admin can see all the user's historical activity and created content"

**Needs clarification**:
- Are suspended user's pages still visible to other users?
- Is author name shown, or replaced with "Deleted User"?
- Can suspended user's pages be transferred to another user?

---

### 22. User Reinvitation After Suspension
**Question**: Can a suspended user be sent a new invitation?

**Not explicitly covered in spec**:
- Different from "restore access" - new account?
- Or must restore be used for same email?
- Prevent creating duplicate accounts for same person?

---

### 23. Multiple Admin Safety Net
**Question**: Should there be a minimum number of admins (not just 1)?

**Current spec says**: "At least one admin must exist"

**Needs consideration**:
- Should system recommend having 2+ admins for redundancy?
- Warning when only 1 admin remains?
- Best practice guidance?

---

### 24. User Impersonation
**Question**: Can admins impersonate users for troubleshooting?

**Not explicitly covered in spec**:
- "View as" feature to see wiki from user's perspective?
- Useful for debugging permission issues?
- Audit trail for impersonation?
- Security/privacy implications?

---

### 25. Invitation Link Sharing Method
**Question**: How do admins share invitation links?

**Current spec says**: "Admin can copy the invitation link"

**Needs clarification**:
- Just copy to clipboard, or also:
- Send via email directly from UI?
- Display as QR code (for easy mobile access)?
- Show invitation link in plain text for reading over phone?

---

## 📝 Recommendations

1. **Answer Critical Priority (🔴) questions FIRST** - especially reconciling with authentication spec
2. **Merge or clearly delineate specs #1 and #8** - avoid duplication and confusion
3. **Standardize terminology** - "standard" vs "editor", "suspended" vs "disabled"
4. **Create complete user data model** - align with Cognito integration

Would you like me to:
- Help reconcile this spec with the authentication spec?
- Create a unified user roles and permissions document?
- Design mockups for the user management UI?
- Define the complete user data model?
