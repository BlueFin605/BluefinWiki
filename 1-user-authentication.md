# Feature Specification: User Authentication with Invite-Only Access

**Feature Branch**: `1-user-auth`  
**Created**: 2026-01-12  
**Status**: Draft  
**Input**: User description: "Add user authentication with email and password. I tneeds to be by invite only (outside of the first user) so that it is only liited to family users. iu.e. not just anyone can access the wiki"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - First Admin Account Creation (Priority: P1)

The very first user to access the wiki creates the initial admin account that will manage all subsequent user invitations. This is a one-time setup process that secures the wiki.

**Why this priority**: Without an initial admin, the system cannot function. This is the foundation for all security.

**Independent Test**: Can be fully tested by accessing a fresh wiki instance, creating the first admin account with email/password, and verifying that subsequent attempts to create admin accounts are blocked until proper invitations are sent.

**Acceptance Scenarios**:

1. **Given** the wiki is newly deployed with no users, **When** a visitor accesses the wiki, **Then** they are presented with a "Create Admin Account" page
2. **Given** the "Create Admin Account" page, **When** the user enters a valid email and strong password, **Then** the admin account is created and they are logged in
3. **Given** the admin account has been created, **When** any subsequent visitor accesses the wiki, **Then** they see a login page (not the admin creation page)
4. **Given** the admin account exists, **When** someone tries to access the admin creation endpoint directly, **Then** they receive an error indicating the wiki is already initialized

---

### User Story 2 - Admin Invites Family Members (Priority: P1)

An admin user can generate invitation links for family members, controlling who has access to the wiki. Each invitation is single-use and expires after 7 days.

**Why this priority**: This is the core security mechanism that keeps the wiki family-only. Without invitations, the wiki would be inaccessible to family members.

**Independent Test**: Log in as admin, generate an invitation link, send it to a test email, and verify that using the link allows account creation while the link is valid and blocks reuse.

**Acceptance Scenarios**:

1. **Given** an admin is logged in, **When** they navigate to "User Management", **Then** they see an "Invite User" button
2. **Given** the "Invite User" page, **When** the admin enters a family member's email address, **Then** a unique invitation link is generated and displayed
3. **Given** an invitation link, **When** the recipient clicks it within 7 days, **Then** they are taken to a registration page pre-filled with their email
4. **Given** an invitation link has been used, **When** someone tries to use it again, **Then** they see an error that the invitation has already been used
5. **Given** an invitation link is older than 7 days, **When** someone tries to use it, **Then** they see an error that the invitation has expired
6. **Given** the admin invites a user, **When** the invitation is sent, **Then** the admin can see the invitation status (pending/used/expired) in the user management panel

---

### User Story 3 - Family Member Creates Account via Invitation (Priority: P1)

A family member receives an invitation link and uses it to create their account with email and password, gaining access to the wiki.

**Why this priority**: This completes the invitation workflow and allows family members to access the wiki. Without this, invitations would be useless.

**Independent Test**: Use a valid invitation link, complete the registration form with email and password, and verify successful account creation and automatic login.

**Acceptance Scenarios**:

1. **Given** a valid invitation link, **When** the recipient clicks it, **Then** they see a registration page with their email pre-filled
2. **Given** the registration page, **When** the user enters a valid password meeting security requirements, **Then** their account is created with "Editor" role by default
3. **Given** successful registration, **When** the account is created, **Then** the user is automatically logged in and redirected to the wiki home page
4. **Given** the registration page, **When** the user enters a password that doesn't meet requirements (e.g., too short), **Then** they see clear error messages explaining the requirements
5. **Given** successful registration, **When** the account is created, **Then** the invitation link is marked as used and cannot be reused

---

### User Story 4 - User Login with Email and Password (Priority: P1)

An existing user can log in to the wiki using their email address and password to access family content.

**Why this priority**: This is essential functionality - users need to authenticate to access the wiki. Without login, authenticated users cannot access the system.

**Independent Test**: Create an account, log out, then log back in with the correct credentials and verify access is granted.

**Acceptance Scenarios**:

1. **Given** an existing user account, **When** the user navigates to the wiki, **Then** they see a login page
2. **Given** the login page, **When** the user enters correct email and password, **Then** they are logged in and redirected to the wiki home page
3. **Given** the login page, **When** the user enters an incorrect password, **Then** they see an error message and remain on the login page
4. **Given** the login page, **When** the user enters an email that doesn't exist, **Then** they see an error message (intentionally vague for security)
5. **Given** a logged-in user, **When** their session expires after 7 days of inactivity, **Then** they are redirected to the login page on next page load
6. **Given** the login page, **When** the user checks "Remember me", **Then** their session persists for 30 days

---

### User Story 5 - Password Reset via Email (Priority: P2)

A user who forgets their password can request a password reset link via email, allowing them to regain access without admin intervention.

**Why this priority**: Forgotten passwords are common and should not require admin support. However, this is P2 because users can ask admins to send new invitations as a workaround.

**Independent Test**: Request a password reset, receive the email with reset link, use it to set a new password, and verify login works with the new password.

**Acceptance Scenarios**:

1. **Given** the login page, **When** the user clicks "Forgot Password?", **Then** they see a password reset request page
2. **Given** the password reset page, **When** the user enters their email, **Then** a reset link is sent to that email address
3. **Given** a reset link email, **When** the user clicks the link within 1 hour, **Then** they see a page to set a new password
4. **Given** the password reset link is older than 1 hour, **When** the user clicks it, **Then** they see an error that the link has expired
5. **Given** the new password page, **When** the user enters and confirms a valid new password, **Then** their password is updated and they are automatically logged in
6. **Given** a password reset request for an email that doesn't exist, **When** the request is submitted, **Then** the system shows a generic success message (to prevent email enumeration)

---

### User Story 6 - Admin Manages User Roles and Access (Priority: P2)

Admins can view all users, change their roles (Admin/Standard), and revoke access when needed (e.g., if a family member should no longer have access).

**Why this priority**: Role management is important for wiki operations but not needed for basic functionality. The system can work initially with everyone as "Standard" and a single admin.

**Independent Test**: Log in as admin, change a user's role from Standard to Admin, log in as that user, and verify they can access admin features.

**Acceptance Scenarios**:

1. **Given** an admin is logged in, **When** they navigate to "User Management", **Then** they see a list of all users with their current roles
2. **Given** the user list, **When** the admin clicks on a user, **Then** they can change the user's role between Admin, Editor, and Viewer
3. **Given** the user list, **When** the admin clicks "Revoke Access" for a user, **Then** that user's account is disabled and they cannot log in
4. **Given** a disabled user account, **When** that user tries to log in, **Then** they see a message that their access has been revoked
5. **Given** a disabled user account, **When** an admin re-enables it, **Then** the user can log in again
6. **Given** multiple admin accounts exist, **When** an admin tries to revoke the last admin's access, **Then** they see an error preventing removal of the last admin

---

### User Story 7 - User Profile and Password Change (Priority: P3)

Users can update their own profile information and change their password without admin assistance.

**Why this priority**: Nice to have for user convenience, but not essential for initial release. Users can request new invitations or password resets as workarounds.

**Independent Test**: Log in, navigate to profile settings, change password, log out, and verify login works with the new password.

**Acceptance Scenarios**:

1. **Given** a logged-in user, **When** they click their profile icon, **Then** they see a "Profile Settings" option
2. **Given** the profile settings page, **When** the user enters their current password and a new password, **Then** their password is updated
3. **Given** the profile settings page, **When** the user tries to change password without entering the correct current password, **Then** they see an error
4. **Given** the profile settings page, **When** the user updates their display name, **Then** the new name appears in page edit history and comments

---

### Edge Cases

- What happens when an invitation email is sent but the email service fails? System should log the error and show admin a clear error message with the invitation link to manually share.
- What happens when multiple people try to create the first admin account simultaneously? System uses database transaction to ensure only one admin creation succeeds; others see error message.
- What happens when a user tries to log in with correct email but account has been disabled? They receive a message that their account access has been revoked, with contact information for wiki administrator.
- What happens when password reset link is clicked after it's already been used? User sees an error that the link is invalid or has already been used, with option to request a new reset link.
- What happens when invitation link email contains typos? Registration page validates email format and shows error if it doesn't match a valid email pattern.
- What happens when user tries to set a weak password? System enforces minimum password strength (8 characters, at least one uppercase, one lowercase, one number) and shows clear requirements.
- What happens when admin tries to invite an email that already has an account? System shows a warning that the email is already registered and offers to resend invitation if account is pending.
- What happens during the critical window between admin creation and first invitation? Admin has full access to create invitations immediately upon account creation.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow creation of exactly one initial admin account when wiki is first deployed
- **FR-002**: System MUST prevent any access to wiki pages without valid authentication
- **FR-003**: System MUST support email/password authentication for all users
- **FR-004**: Admin users MUST be able to generate single-use invitation links that expire after 7 days
- **FR-005**: Invitation links MUST pre-fill the recipient's email address on the registration form
- **FR-006**: System MUST mark invitation links as "used" once an account is successfully created
- **FR-007**: New users MUST be assigned the "Editor" role by default upon registration
- **FR-008**: System MUST enforce password requirements: minimum 8 characters, at least one uppercase letter, one lowercase letter, and one number
- **FR-009**: System MUST provide password reset functionality via email with links valid for 1 hour
- **FR-010**: System MUST maintain three user roles: Admin (full access), Editor (can create/edit), Viewer (read-only)
- **FR-011**: Admin users MUST be able to change any user's role or disable their account
- **FR-012**: System MUST prevent disabling the last remaining admin account
- **FR-013**: User sessions MUST expire after 7 days of inactivity by default
- **FR-014**: System MUST support "Remember me" functionality extending sessions to 30 days
- **FR-015**: System MUST send invitation and password reset emails within 5 minutes of request
- **FR-016**: System MUST log all authentication events (login attempts, account creation, password resets) for security audit
- **FR-017**: Users MUST be able to change their own password when logged in
- **FR-018**: System MUST use secure password hashing (bcrypt with salt) for all stored passwords
- **FR-019**: System MUST implement rate limiting on login attempts (max 5 attempts per email per 15 minutes)
- **FR-020**: System MUST provide intentionally vague error messages for failed login attempts to prevent email enumeration

### Key Entities

- **User**: Represents a family member with access to the wiki
  - Attributes: userId (unique), email (unique), passwordHash, displayName, role (Admin/Standard), accountStatus (active/disabled), createdAt, lastLoginAt
  - Relationships: Created by invitation (except first admin), all users have equal content access

- **Invitation**: Represents a single-use invite link for a new family member
  - Attributes: invitationId (unique), recipientEmail, invitationToken (unique, secure), createdByUserId, status (pending/used/expired), createdAt, expiresAt, usedAt
  - Relationships: Created by an admin user, consumed when user registers

- **PasswordResetToken**: Represents a temporary password reset request
  - Attributes: tokenId (unique), userId, resetToken (unique, secure), createdAt, expiresAt, usedAt
  - Relationships: Belongs to one user, single-use, expires after 1 hour

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: First admin can complete account setup in under 2 minutes from accessing fresh wiki deployment
- **SC-002**: Invited family members can complete registration in under 3 minutes from receiving invitation email
- **SC-003**: Existing users can log in successfully in under 10 seconds with correct credentials
- **SC-004**: Password reset process (request to new password set) takes under 5 minutes for users
- **SC-005**: System successfully blocks 100% of unauthenticated access attempts to wiki pages
- **SC-006**: Invitation system prevents unauthorized account creation (no signups without valid invitation links)
- **SC-007**: Admin can invite a new user and have invitation email delivered within 5 minutes
- **SC-008**: System prevents reuse of invitation links and expired links with clear error messages
- **SC-009**: Authentication endpoints respond within 500ms for login/registration operations (excluding email sending)
- **SC-010**: Password security requirements are enforced with zero weak passwords accepted
- **SC-011**: Rate limiting successfully blocks brute force attacks (max 5 failed login attempts per 15 minutes per email)
- **SC-012**: All authentication events are logged for security audit with timestamps and IP addresses

## Out of Scope

- **Immediate session revocation**: Due to stateless JWT approach, sessions cannot be revoked before token expiration
  - When a user is deleted or disabled, they can continue accessing the wiki until their current token expires (max 7-30 days)
  - Refresh token validation prevents new tokens from being issued to deleted/disabled users
  - For immediate revocation needs, consider implementing token blacklist (post-MVP enhancement)
- **Session activity tracking**: No tracking of individual user sessions, login history, or active session counts
- **Device management**: No "sign out from all devices" or "view active sessions" functionality
- **Two-factor authentication (2FA)**: Security enhancement for future release
- **Social login**: OAuth providers (Google, GitHub, etc.) not included in MVP
- **Custom password policies**: Password requirements are fixed in MVP (configurable in Admin Config post-MVP)

## Assumptions

- Email delivery service is configured and operational (e.g., AWS SES, SendGrid, or similar)
- Wiki will have low concurrent user load (typical family usage: 2-5 concurrent users)
- Primary authentication module will be AWS Cognito (per constitution), but system will be designed to support pluggable auth providers
- Email addresses are unique identifiers for users (one account per email)
- Admin users are trusted family members who will manage invitations responsibly
- No two-factor authentication (2FA) in initial release (can be added as optional module later)
- **Session Management**: Stateless JWT tokens stored in secure, httpOnly cookies
  - Access tokens expire after 7 days (default) or 30 days with "Remember me"
  - No server-side session tracking - tokens are self-contained
  - **Implication**: Sessions cannot be revoked until token expiration
  - Refresh tokens are validated against user status (deleted/disabled users fail refresh)
- System will comply with basic security best practices (HTTPS, secure headers, CSRF protection)
- Password reset emails are sent from a trusted domain that family members will recognize
- Initial admin setup occurs in a trusted environment (family member's device, not public computer)

## Out of Scope

The following are explicitly **not** included in this specification:

- Social login (Google, Facebook, etc.) - can be added as optional auth module later
- Two-factor authentication (2FA/MFA) - can be added as future enhancement
- Single Sign-On (SSO) with external identity providers - pluggable auth architecture allows this as future module
- Account self-registration without invitation - violates core requirement of invite-only access
- Email verification step after registration - invitation link serves as email verification
- User profile pictures or avatars - out of scope for authentication feature
- Activity logging visible to non-admin users - only admins see audit logs
- Granular permission system beyond three roles - sufficient for family wiki usage
- Password complexity rules beyond basic requirements - balances security with usability for family members
- Account recovery via security questions - password reset via email is sufficient
- Automatic account expiration or forced password rotation - not needed for family context
- IP-based access controls or geofencing - family members may travel
- CAPTCHA on login/registration - rate limiting provides sufficient brute force protection for private wiki

## Constitutional Compliance

This feature aligns with the BlueFinWiki Constitution:

- **Privacy & Security**: Authentication is mandatory for all access, protecting family data
- **Pluggable Architecture**: Designed with `IAuthProvider` interface to support AWS Cognito (default) with future options for Auth0, Firebase, or custom OIDC
- **Family-Friendly**: Simple email/password auth suitable for all ages and tech skill levels
- **Cost-Effective**: Uses serverless authentication services (AWS Cognito free tier: 50K MAUs free)
- **Simplicity**: Straightforward invite-only workflow minimizes maintenance and support burden
