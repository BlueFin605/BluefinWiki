# Clarification Questions: User Management

**Feature**: Admin User Management  
**Generated**: 2026-01-13  
**Updated**: 2026-02-06  
**Status**: Awaiting Answers

**CLARIFIED**: This spec is purely the admin UI/UX layer for user management features defined in Spec #1 (User Authentication). All backend functionality, data models, roles, permissions, and authentication logic are defined in Spec #1. This spec covers only the administrative interface for managing those features.

---

## 🔴 Critical Priority - Must Answer Before Implementation

### 1. Relationship to User Authentication Spec ✅ ANSWERED
**Answer**: This spec is purely the admin UI/UX for features defined in spec #1.

**Implications**:
- Backend functionality (authentication, authorization, roles, data storage) is owned by Spec #1
- This spec defines only the admin interface for managing users
- All API endpoints, data models, and business logic come from Spec #1
- Must reference Spec #1 for technical implementation details
- UI must align with roles and permissions structure defined in Spec #1

---

### 2. Role Terminology Inconsistency ✅ CLARIFIED
**Question**: Is the role "standard" or "Editor"?

**Current spec says**: "Standard vs admin" but authentication spec says "Editor, Admin, Viewer"

**CLARIFIED**: Only 2 roles exist:
- **Admin**: Full access to all content plus administrative features (user management, system configuration)
- **Standard**: Full access to all content (view and edit all pages)

**Terminology Decision**: Use "Standard" (not "Editor" or "Viewer") for the non-admin role to reflect that all authenticated users have equal content access rights.

---

### 3. Suspended vs Disabled
**Question**: What's the difference between "suspended" and "disabled" accounts?

**Current spec uses both terms**: "status (active/invited/suspended)" and "account is disabled"

**Needs clarification**:
- Are suspended and disabled the same thing? yes
- Or is suspended temporary and disabled permanent?
- Can suspended users be restored but disabled users cannot?
- Consistent terminology needed!

---

### 4. User Storage and Data Model ✅ ANSWERED
**Question**: What data model from Spec #1 should the UI display?

**Answer**: Based on Spec #1's User entity definition, the admin UI should display the following fields:

**Available Fields from Spec #1 User Entity**:
- `userId` (unique identifier)
- `email` (unique, primary identifier)
- `displayName` (from IDP for federated logins, otherwise email address)
- `role` (Admin/Standard - only two roles)
- `accountStatus` (active/disabled - note: "disabled" is the correct term, not "suspended")
- `createdAt` (account creation timestamp)
- `lastLoginAt` (last successful login timestamp)

**Display Requirements**:
- **Required display fields**: email, role, accountStatus, createdAt
- **Optional display fields**: displayName (if different from email), lastLoginAt
- **Editable fields**: role (Admin can change), accountStatus (Admin can disable/enable)
- **Read-only fields**: userId, email, createdAt, lastLoginAt, displayName (comes from IDP or profile settings, not editable in user management UI)

**IDP-Dependent Behavior**:
- **displayName**: For federated logins (e.g., Google via Cognito), displayName comes from the IDP. For email/password accounts, defaults to email address. Users can update this in their profile settings (not in admin user management).
- **Password management**: Not shown in admin UI as password resets are handled by the IDP
- **Invitation status**: For pending invitations, users appear with an "unverified" or similar status until they complete registration

**Field Labels & Formats**:
- Use "Standard" for the default role (not "Editor" or "Viewer")
- Use "active" and "disabled" (not "suspended") for account status
- Format timestamps consistently (e.g., "Jan 15, 2026" or "2026-01-15")
- Display email as primary identifier in user lists

**Role Permissions**:
- **Admin**: Can access all content + administrative features (user management, system configuration, etc.)
- **Standard**: Can access all content (view and edit all pages, upload attachments, etc.)

---

### 5. Last Activity Tracking Mechanism (per Spec #1)? [POST-MVP]

**Current spec shows**: "Last activity date" in user list

**MVP Decision**: Activity tracking is NOT included in MVP. This feature will be added post-MVP.

**Aligned with Spec #13 (Dashboard)**: No user activity tracking for MVP
- Dashboard doesn't track page views
- No personal history tracking
- Only edit history tracked (PageHistory table)
- Cost savings: No DynamoDB writes per page view
- Privacy benefit: No user surveillance

**Future considerations** (for post-MVP implementation):
- What activity data is available from Spec #1's backend?
- What counts as activity per Spec #1's definition?
- How should UI display the activity timestamp (relative vs absolute)?
- Is this data real-time or cached?
- Privacy considerations?

---

## 🟡 High Priority - Important for User Experience

### 6. Admin UI Access Control
**Question**: Can standard users see the User Management page at all?

**Current spec says**: "Menu item that is only visible to admin users"

**Needs clarification**:
- Completely hidden for non-admins? yes
- Or visible but access denied when clicked?
- Can standard users see their own profile/account details? yes
- Where do standard users change their own password/settings? password is managed by idp,  non idp settings in the profile page

---

### 7. Invitation Role Pre-Assignment
**Question**: When inviting with pre-assigned admin role, what are the security implications? only invite as standard user, once accepted the admin can elevate priviliges

**Current spec says**: "Confirmation message warns 'This user will have full admin privileges'"

**Needs clarification**:
- Should there be additional confirmation (type username to confirm)?
- Should invitation link for admin role be time-limited (shorter than 7 days)?
- Should admin invitations require two admins to approve (dual control)?
- Log admin role invitations for audit?

---

### 8. Role Change Immediate Effect
**Question**: What happens to active sessions when role is changed? nothing

**Current spec says**: "User immediately gains/loses access to admin features"

**Needs clarification** (depends on Spec #1's session management):
- Does user need to refresh page or logout/login per Spec #1?
- What does Spec #1's backend do with active sessions?
- UI feedback: should admin UI show "User will see changes on next login" or "Changes take effect immediately"?
- If user is mid-edit on admin page and demoted, what does UI display?

---

### 9. Self-Role-Change Prevention
**Question**: Why can't admins change their own role? not needed for mvp, but if it is simpler implemment it

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
- Which one: pagination or infinite scroll? infinite scroll
- If pagination, how many users per page?
- If infinite scroll, how many initially loaded? 50
- Should this be user-configurable?

---

### 11. User Search and Filter Implementation
**Question**: What fields are searchable/filterable? no user search for MVP

**Current spec says**: "Filter by email, role, or status"

**Needs clarification**:
- Search by email only, or also by display name?
- Filter by multiple criteria at once (role=admin AND status=active)?
- Real-time filtering or apply button?
- Clear filters button?

---

### 12. Pending Invitation Display
**Question**: How are pending invitations displayed in relation to active users? list them amongst the users but show them as pending

**Current spec mentions**: "Pending Invitations section"

**Needs clarification**:
- Separate section on same page?
- Separate tab?
- Collapsed by default?
- Count of pending invitations shown prominently?

---

### 13. User Activity Details [POST-MVP]
**Question**: What level of detail is shown for user activity?

**MVP Decision**: Activity tracking is NOT included in MVP. This feature will be added post-MVP.

**Aligned with Spec #13 (Dashboard)**: No user activity tracking system
- Only edit history exists (visible in PageHistory)
- No login tracking
- No page view tracking
- Admins can see edit history but not view/login activity

**Future considerations** (for post-MVP implementation):
- Just date, or date and time?
- Just last login, or last page edit?
- Relative time ("2 hours ago") or absolute ("Jan 13, 2026 10:30 AM")?
- Can admin drill down to see detailed activity log?

---

### 14. Bulk User Operations
**Question**: Can admins perform operations on multiple users at once? no bulk operations

**Not explicitly covered in spec**:
- Select multiple users and change role?
- Select multiple and suspend access?
- Bulk invite multiple emails?
- Use cases for bulk operations in family wiki context?

---

### 15. User Sorting Persistence
**Question**: Are sort preferences saved per admin? no for mvp

**Current spec says**: "List sorts by that column"

**Needs clarification**:
- Is sort preference persisted (localStorage, user profile)?
- Or reset each time page loads (default sort)?
- What is default sort order (email alphabetical, last activity descending)?

---

## 🟢 Medium Priority - Nice to Have Clarity

### 16. User Profile View
**Question**: Can admins view detailed profile for each user? yes

**Current spec shows**: User list with basic info

**Needs clarification**:
- Click on user to see detailed profile? yes
- What details: email, role, status, created date, last login, pages created, pages edited? yes
- Edit profile from this view?
- Or is list the only view? yes

---

### 17. User Email Communication
**Question**: Can admins send messages to users? no

**Not explicitly covered in spec**:
- Send email to user(s) through UI?
- Useful for announcements, warnings?
- Or is email communication outside wiki scope?

---

### 18. User Audit Log
**Question**: Is there an audit trail for user management actions? not for mvp

**Not explicitly covered in spec**:
- Log who invited whom?
- Log role changes (who changed, when, old role, new role)?
- Log access removals/restorations?
- Where is this log viewed (separate page, part of user detail)?

---

### 19. User Export
**Question**: Can admin export user list? no export for mvp

**Not explicitly covered in spec**:
- Export as CSV for record keeping?
- Include: email, role, status, created, last activity?
- Useful for compliance/audit?

---

### 20. User Statistics Dashboard
**Question**: Should there be overview statistics for admins? no

**Not explicitly covered in spec**:
- Total users, active users, pending invitations?
- Growth chart (new users over time)?
- Activity metrics (active in last 7 days, 30 days)?
- Where displayed (top of user management page)?

**Aligned with Spec #13 (Dashboard)**: No statistics/metrics for MVP
- No user activity tracking (see question #5)
- No dashboard statistics
- Only basic user list with status
- Can count total users from list length if needed
- Future enhancement if needed

---

### 21. Suspended User Content Visibility
**Question**: How is suspended user's content displayed?

**Current spec says**: "Admin can see all the user's historical activity and created content"

**Needs clarification**:
- Are suspended user's pages still visible to other users? yes
- Is author name shown, or replaced with "Deleted User"? name shown
- Can suspended user's pages be transferred to another user? not for mvp

---

### 22. User Reinvitation After Suspension
**Question**: Can a suspended user be sent a new invitation? which ever way is the simplest

**Not explicitly covered in spec**:
- Different from "restore access" - new account?
- Or must restore be used for same email?
- Prevent creating duplicate accounts for same person?

---

### 23. Multiple Admin Safety Net
**Question**: Should there be a minimum number of admins (not just 1)? yes

**Current spec says**: "At least one admin must exist"

**Needs consideration**:
- Should system recommend having 2+ admins for redundancy?
- Warning when only 1 admin remains?
- Best practice guidance? tes please

---

### 24. User Impersonation
**Question**: Can admins impersonate users for troubleshooting? no

**Not explicitly covered in spec**:
- "View as" feature to see wiki from user's perspective?
- Useful for debugging permission issues?
- Audit trail for impersonation?
- Security/privacy implications?

---

### 25. Invitation Link Sharing Method
**Question**: How do admins share invitation links? only can invite a specific email, no sharing of invites

**Current spec says**: "Admin can copy the invitation link"

**Needs clarification**:
- Just copy to clipboard, or also:
- Send via email directly from UI?
- Display as QR code (for easy mobile access)?
- Show invitation link in plain text for reading over phone?

---

## 📝 Recommendations

1. **Reference Spec #1 throughout implementation** - this is the UI layer only
2. **Standardize terminology with Spec #1** - "standard" vs "editor", "suspended" vs "disabled"
3. **Design mockups for the user management UI** - visual designs for all admin pages
4. **Map UI actions to Spec #1 API endpoints** - document which backend endpoints each UI action calls
5. **Define error handling** - how UI displays errors from Spec #1's backend

Would you like me to:
- Create a mapping document showing UI actions → Spec #1 API endpoints?
- Design detailed mockups for the user management UI?
- Define comprehensive error handling for all admin operations?
- Create a UI/UX style guide for admin interfaces?
