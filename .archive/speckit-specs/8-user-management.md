# Feature Specification: Admin User Management

**Feature Branch**: `8-user-management`  
**Created**: 2026-01-12  
**Status**: Draft  
**Input**: User description: "admin users should be able to do user management, be able to see all the users, invite new ones, remove access, and assign additional privileges (standard vs admin)"

## Cross-References

**Depends on:**
- [1-user-authentication.md](1-user-authentication.md) - Invitation system for adding new users

**Provides user data for:**
- [9-page-history.md](9-page-history.md) - Author attribution in version history
- [15-page-comments.md](15-page-comments.md) - Comment author information and @mentions
- [11-page-permissions.md](11-page-permissions.md) - User selection for specific page access
- All specifications - User role enforcement (Admin vs Standard)

**Configuration:**
- [17-admin-configuration.md](17-admin-configuration.md) - US-12.4 user-related settings (default roles, session timeout)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View All Users (Priority: P1)

An admin user can view a comprehensive list of all wiki users, displaying their email, role (standard/admin), account status (active/invited/suspended), and last activity date. This provides visibility into who has access to the wiki.

**Why this priority**: Viewing existing users is the foundation of user management. Without visibility into current users, admins cannot make informed decisions about access control.

**Independent Test**: Log in as admin, navigate to User Management page, and verify that all existing users are displayed with their email, role, status, and last activity. Can filter and search through the user list.

**Acceptance Scenarios**:

1. **Given** an admin is logged in, **When** they navigate to "User Management", **Then** they see a list of all users with columns for email, role, status, and last activity
2. **Given** the user list is displayed, **When** shown, **Then** the admin's own account is clearly marked as "You" or highlighted
3. **Given** the user list, **When** there are more than 20 users, **Then** pagination or infinite scroll is provided for easy navigation
4. **Given** the user list, **When** admin types in the search box, **Then** the list filters in real-time by email or name
5. **Given** the user list, **When** admin clicks on column headers (email, role, status, last activity), **Then** the list sorts by that column
6. **Given** a user has never logged in, **When** their account is shown, **Then** their status shows as "Invited" and last activity shows "Never"

---

### User Story 2 - Invite New Users (Priority: P1)

An admin can generate invitation links for new users and optionally set their initial role (standard or admin) at invitation time. The invitation system integrates with the existing invite-only authentication feature.

**Why this priority**: Adding new users is critical for wiki growth. Admins need this capability immediately to onboard family members with the correct permissions.

**Independent Test**: As admin, click "Invite User" button, enter an email address, select role (standard/admin), generate invitation link, and verify the invite appears in pending invitations list with the correct role assignment.

**Acceptance Scenarios**:

1. **Given** an admin is on the User Management page, **When** they click "Invite User", **Then** a dialog opens with fields for email address and role selection (standard/admin)
2. **Given** the invite dialog, **When** admin enters a valid email and selects a role, **Then** an invitation link is generated with that role pre-assigned
3. **Given** an invitation is created, **When** generated, **Then** it appears in the "Pending Invitations" section with email, role, expiration date, and invitation link
4. **Given** a pending invitation, **When** displayed, **Then** admin can copy the invitation link with one click
5. **Given** the invite dialog, **When** admin enters an email that already exists, **Then** they see an error message "User with this email already exists"
6. **Given** a pending invitation, **When** the recipient registers, **Then** the invitation moves from "Pending" to the main user list with status "Active"
7. **Given** role selection in invite dialog, **When** admin role is selected, **Then** a confirmation message warns "This user will have full admin privileges including user management"

---

### User Story 3 - Change User Roles (Priority: P1)

An admin can promote standard users to admin or demote admins to standard users, changing their privilege level and access to administrative functions.

**Why this priority**: Role management is essential for adapting to changing family needs. Someone who initially had standard access might need admin privileges later.

**Independent Test**: As admin, select a standard user, change their role to admin, verify the change persists, then change them back to standard and verify admin features are no longer accessible to that user.

**Acceptance Scenarios**:

1. **Given** an admin views the user list, **When** they click on a user's role badge, **Then** a dropdown appears with "Standard" and "Admin" options
2. **Given** the role dropdown, **When** admin selects a different role, **Then** a confirmation dialog appears saying "Change [User Email] from [Current Role] to [New Role]?"
3. **Given** the confirmation dialog, **When** admin confirms, **Then** the user's role is updated immediately and the list reflects the change
4. **Given** a user's role is changed to admin, **When** updated, **Then** that user immediately gains access to User Management and other admin features
5. **Given** a user's role is changed to standard, **When** updated, **Then** that user immediately loses access to admin features (if they were previously admin)
6. **Given** an admin tries to change their own role to standard, **When** attempted, **Then** they see an error "Cannot change your own role. Another admin must make this change."
7. **Given** only one admin exists, **When** that admin tries to demote themselves, **Then** they see an error "Cannot remove admin privileges. At least one admin must exist."

---

### User Story 4 - Remove User Access (Priority: P2)

An admin can revoke a user's access to the wiki, preventing them from logging in. The user's content and activity history is preserved for audit purposes, but they can no longer authenticate.

**Why this priority**: Access removal is important for security but less urgent than viewing/adding users. Families are typically stable, but when someone should no longer have access, it must be possible.

**Independent Test**: As admin, select an active user, click "Remove Access", confirm the action, verify the user's status changes to "Suspended", and verify that user cannot log in with their credentials.

**Important Note**: Due to stateless JWT session management (see [1-user-authentication.md](1-user-authentication.md)), suspended users can continue accessing the wiki until their current access token expires (7-30 days). New login attempts and token refresh requests will fail immediately. This delay is a trade-off for serverless architecture and cost-effectiveness.

**Acceptance Scenarios**:

1. **Given** an admin views a user in the list, **When** they click the three-dot menu, **Then** they see a "Remove Access" option
2. **Given** "Remove Access" is clicked, **When** selected, **Then** a confirmation dialog appears warning "This will prevent [User Email] from logging in. Their active session will expire within 7-30 days."
3. **Given** the confirmation dialog, **When** admin confirms, **Then** the user's status changes to "Suspended" and they appear in a separate "Suspended Users" section
4. **Given** a suspended user, **When** they try to log in with username/password, **Then** they see an error message "Your access has been removed. Please contact an administrator."
5. **Given** a suspended user with an active token, **When** their token expires and attempts to refresh, **Then** refresh fails and they are logged out
6. **Given** a suspended user, **When** admin views their details, **Then** admin can see all the user's historical activity and created content
7. **Given** an admin tries to remove their own access, **When** attempted, **Then** they see an error "Cannot remove your own access"
8. **Given** only one admin exists, **When** that admin tries to remove their own access, **Then** they see an error "Cannot remove the last admin account"

---

### User Story 5 - Restore Suspended User Access (Priority: P3)

An admin can restore access for a previously suspended user, allowing them to log in again with their existing account and credentials.

**Why this priority**: Access restoration is a nice-to-have for handling temporary suspensions or mistakes, but users can also be re-invited if needed.

**Independent Test**: As admin, navigate to "Suspended Users", select a suspended user, click "Restore Access", and verify the user can successfully log in again.

**Acceptance Scenarios**:

1. **Given** an admin views the "Suspended Users" section, **When** they click on a suspended user's three-dot menu, **Then** they see a "Restore Access" option
2. **Given** "Restore Access" is clicked, **When** selected, **Then** a confirmation dialog appears "Restore access for [User Email]?"
3. **Given** the confirmation is accepted, **When** confirmed, **Then** the user's status changes to "Active" and they move back to the main user list
4. **Given** access is restored, **When** updated, **Then** the user can immediately log in with their existing credentials
5. **Given** a restored user, **When** they log in, **Then** they retain their previous role (standard/admin) and see all their previous content

---

### User Story 6 - Cancel Pending Invitations (Priority: P3)

An admin can cancel pending invitations before they are used, preventing the invitation link from being usable and removing it from the pending invitations list.

**Why this priority**: Invitation cancellation is useful for correcting mistakes or changing plans, but not critical since invitations expire automatically after 7 days.

**Independent Test**: As admin, view pending invitations, click "Cancel" on an unused invitation, verify it's removed from the list, and confirm the invitation link no longer works.

**Acceptance Scenarios**:

1. **Given** an admin views pending invitations, **When** they click the three-dot menu on an invitation, **Then** they see a "Cancel Invitation" option
2. **Given** "Cancel Invitation" is clicked, **When** selected, **Then** a confirmation dialog appears "Cancel invitation for [Email]?"
3. **Given** the confirmation is accepted, **When** confirmed, **Then** the invitation is immediately removed from the pending list
4. **Given** an invitation is canceled, **When** someone tries to use the link, **Then** they see an error "This invitation has been canceled. Please contact an administrator."
5. **Given** a canceled invitation, **When** admin wants to re-invite the same email, **Then** they can create a new invitation without any conflicts

---

### Edge Cases

- What happens when an admin demotes another admin while that admin is actively logged in and using admin features?
- How does the system handle race conditions where an admin removes a user's access while that user is actively creating or editing content?
- What happens when the last admin tries to demote themselves or remove their access?
- How does the system handle invitations sent to an email address that was previously suspended?
- What happens when an admin changes a user's role while that user is in the middle of a session?
- How does pagination/filtering handle very large user lists (100+ users)?
- What happens when multiple admins try to change the same user's role simultaneously?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST display a "User Management" menu item that is only visible to admin users
- **FR-002**: System MUST show a list of all users with email, role (standard/admin), status (active/invited/suspended), and last activity date
- **FR-003**: System MUST allow admins to search and filter the user list by email, role, or status
- **FR-004**: System MUST allow admins to sort the user list by any column (email, role, status, last activity)
- **FR-005**: System MUST allow admins to create invitations with a pre-assigned role (standard or admin)
- **FR-006**: System MUST prevent duplicate invitations for the same email address if one already exists (pending or active)
- **FR-007**: System MUST allow admins to copy invitation links with a single click
- **FR-008**: System MUST allow admins to change any user's role between standard and admin
- **FR-009**: System MUST prevent admins from changing their own role
- **FR-010**: System MUST prevent the last admin from being demoted or having their access removed
- **FR-011**: System MUST require confirmation for all destructive actions (role changes, access removal)
- **FR-012**: System MUST allow admins to remove user access (suspend accounts)
- **FR-013**: System MUST preserve all content and activity history when user access is removed
- **FR-014**: System MUST prevent suspended users from logging in
- **FR-015**: System MUST allow admins to restore access for suspended users
- **FR-016**: System MUST allow admins to cancel pending invitations
- **FR-017**: System MUST immediately revoke admin features when a user is demoted from admin to standard
- **FR-018**: System MUST immediately grant admin features when a user is promoted to admin
- **FR-019**: System MUST display pending invitations separately with expiration dates and ability to copy or cancel
- **FR-020**: System MUST show the admin's own account clearly marked in the user list

### Key Entities

- **User**: Represents a wiki user with email, role (standard/admin), status (active/invited/suspended), last activity timestamp, and creation date
- **Invitation**: Represents a pending user invitation with target email, assigned role, invitation token, expiration date (7 days), and creation timestamp
- **Audit Log**: Records all user management actions including who performed the action, what changed, and when (for security and compliance)

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Admins can view the complete user list and find a specific user in under 10 seconds
- **SC-002**: Admins can successfully invite a new user and assign their role in under 30 seconds
- **SC-003**: Admins can change a user's role or remove access in under 15 seconds
- **SC-004**: 100% of role changes take effect immediately without requiring user re-login for the system to recognize the change
- **SC-005**: Zero instances of the last admin being able to remove their own admin privileges
- **SC-006**: Suspended users cannot log in with 0 false positives (legitimate users blocked) or false negatives (suspended users gaining access)
- **SC-007**: All user management actions are logged for audit purposes with 100% coverage
