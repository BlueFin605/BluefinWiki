# Feature Specification: User Authentication with Invite-Only Access

**Feature Branch**: `1-user-auth`
**Created**: 2026-01-12
**Updated**: 2026-03-16
**Status**: Implemented
**Input**: User description: "Add user authentication with email and password. I tneeds to be by invite only (outside of the first user) so that it is only liited to family users. iu.e. not just anyone can access the wiki"

> **Implementation Note (2026-03-16)**: Authentication is now implemented using **AWS Cognito Hosted UI** with OAuth2 authorization code flow, rather than custom auth pages. This was chosen for security, simplicity, and to enable social login (Google). Custom Login, Register, ForgotPassword, and ResetPassword pages have been removed. All auth UI is handled by Cognito's hosted pages. A pre-signup Lambda trigger enforces invite-only access and handles federated identity linking.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - First Admin Account Creation (Priority: P1)

The first admin account is created directly in the AWS Cognito console or via the `AdminCreateUser` API during initial deployment. This bootstraps the wiki's invite-only access system.

**Why this priority**: Without an initial admin, the system cannot function. This is the foundation for all security.

**Independent Test**: After deployment, create the first admin user in Cognito console, navigate to the wiki, authenticate via Cognito Hosted UI, and verify access is granted.

**Acceptance Scenarios**:

1. **Given** the wiki is newly deployed with no users, **When** an admin creates the first user in Cognito, **Then** that user can log in via the Cognito Hosted UI
2. **Given** the first admin account exists in Cognito, **When** they log in to the wiki, **Then** they are redirected through OAuth2 flow and land on the wiki home page
3. **Given** no Cognito users exist, **When** a visitor accesses the wiki, **Then** they are redirected to the Cognito Hosted UI login page
4. **Given** the Cognito Hosted UI, **When** someone without an account tries to sign up, **Then** the pre-signup Lambda rejects the attempt (invite-only enforcement)

---

### User Story 2 - Admin Invites Family Members (Priority: P1)

An admin user creates new users in Cognito via the backend invitation API. Each invitation creates a Cognito user with a temporary password sent via email.

**Why this priority**: This is the core security mechanism that keeps the wiki family-only. Without invitations, the wiki would be inaccessible to family members.

**Independent Test**: Call the invitation API as admin, verify the invited user receives a temporary password email, and confirm they can log in via Cognito Hosted UI.

**Acceptance Scenarios**:

1. **Given** an admin is logged in, **When** they invoke the invitation API with a family member's email, **Then** a Cognito user is created with `AdminCreateUser` and a temporary password email is sent
2. **Given** an invitation has been created, **When** the recipient accesses the wiki, **Then** they are redirected to the Cognito Hosted UI where they can log in with their temporary password
3. **Given** a temporary password, **When** the user logs in for the first time, **Then** Cognito prompts them to set a new permanent password
4. **Given** an invitation link has been used, **When** someone tries to use it again, **Then** they see an error that the invitation has already been used
5. **Given** an invitation link is older than 7 days, **When** someone tries to use it, **Then** they see an error that the invitation has expired

---

### User Story 3 - Family Member Creates Account via Invitation (Priority: P1)

A family member receives a temporary password via email and uses it to complete their account setup through the Cognito Hosted UI, setting a permanent password.

**Why this priority**: This completes the invitation workflow and allows family members to access the wiki. Without this, invitations would be useless.

**Independent Test**: Receive a temporary password email, navigate to the wiki, log in via Cognito Hosted UI with the temporary password, set a permanent password, and verify access to the wiki.

**Acceptance Scenarios**:

1. **Given** a valid invitation email with temporary password, **When** the recipient navigates to the wiki, **Then** they are redirected to Cognito Hosted UI login
2. **Given** the Cognito login page, **When** the user enters their email and temporary password, **Then** Cognito prompts them to set a new password
3. **Given** the user sets a new password, **When** the account is activated, **Then** they are redirected back to the wiki via OAuth callback and logged in
4. **Given** password requirements, **When** the user enters a weak password, **Then** Cognito displays password requirement errors
5. **Given** successful registration, **When** the account is activated, **Then** the invitation is marked as used and cannot be reused

---

### User Story 4 - User Login via Cognito Hosted UI (Priority: P1)

An existing user can log in to the wiki by being redirected to the Cognito Hosted UI, authenticating with email/password or Google, and being redirected back via OAuth2 callback.

**Why this priority**: This is essential functionality - users need to authenticate to access the wiki. Without login, authenticated users cannot access the system.

**Independent Test**: Navigate to the wiki as an unauthenticated user, verify redirect to Cognito Hosted UI, log in with correct credentials, and verify redirect back to the wiki with authenticated session.

**Acceptance Scenarios**:

1. **Given** an existing user account, **When** the user navigates to the wiki unauthenticated, **Then** they are redirected to the Cognito Hosted UI
2. **Given** the Cognito Hosted UI, **When** the user enters correct email and password, **Then** they are redirected back to the wiki `/callback` route with an authorization code
3. **Given** the OAuth callback, **When** the authorization code is exchanged for tokens, **Then** access and refresh tokens are stored and the user sees the wiki home page
4. **Given** the Cognito Hosted UI, **When** the user enters incorrect credentials, **Then** Cognito displays an error message
5. **Given** a logged-in user, **When** their access token expires (1 hour), **Then** the refresh token (30-day validity) is used to obtain a new access token transparently
6. **Given** the Cognito Hosted UI, **When** the user clicks "Sign in with Google", **Then** they authenticate via Google OAuth and the pre-signup Lambda links their Google identity to their Cognito account

---

### User Story 5 - Password Reset via Cognito (Priority: P2)

A user who forgets their password uses the Cognito Hosted UI's built-in password reset functionality, which sends a verification code via email.

**Why this priority**: Forgotten passwords are common and should not require admin support. Cognito handles this entirely.

**Independent Test**: From the Cognito Hosted UI login page, click "Forgot your password?", enter email, receive verification code, enter code and new password, and verify login works.

**Acceptance Scenarios**:

1. **Given** the Cognito Hosted UI, **When** the user clicks "Forgot your password?", **Then** they see Cognito's password reset page
2. **Given** the password reset page, **When** the user enters their email, **Then** a verification code is sent to that email address
3. **Given** a verification code, **When** the user enters the code and a new password, **Then** their password is updated
4. **Given** a verification code older than 1 hour, **When** the user enters it, **Then** they see an error that the code has expired
5. **Given** successful password reset, **When** the user returns to login, **Then** they can log in with the new password via Cognito Hosted UI

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

- **FR-001**: System MUST allow creation of an initial admin account via Cognito console or AdminCreateUser API during first deployment
- **FR-002**: System MUST prevent any access to wiki pages without valid authentication (redirect to Cognito Hosted UI)
- **FR-003**: System MUST support authentication via AWS Cognito Hosted UI with OAuth2 authorization code flow
- **FR-003a**: System MUST support Google social login via Cognito federated identity providers
- **FR-004**: Admin users MUST be able to create single-use invitation codes that expire after 7 days (via backend API using AdminCreateUser)
- **FR-005**: Invitation emails MUST contain a temporary password for initial Cognito login
- **FR-006**: System MUST mark invitation links as "used" once an account is successfully activated
- **FR-007**: New users MUST be assigned the "Editor" role by default upon registration
- **FR-008**: System MUST enforce Cognito password policy: minimum 8 characters, at least one uppercase letter, one lowercase letter, and one number
- **FR-009**: System MUST provide password reset functionality via Cognito Hosted UI with verification codes valid for 1 hour
- **FR-010**: System MUST maintain three user roles: Admin (full access), Editor (can create/edit), Viewer (read-only)
- **FR-011**: Admin users MUST be able to change any user's role or disable their account
- **FR-012**: System MUST prevent disabling the last remaining admin account
- **FR-013**: Access tokens MUST expire after 1 hour; refresh tokens MUST be valid for 30 days
- **FR-014**: System MUST transparently refresh access tokens using refresh tokens without user intervention
- **FR-015**: System MUST send invitation emails (with temporary password) via Cognito within 5 minutes of request
- **FR-016**: System MUST log all authentication events via Cognito and CloudWatch for security audit
- **FR-017**: Users MUST be able to change their own password via Cognito Hosted UI
- **FR-018**: System MUST delegate password hashing and storage to AWS Cognito (SRP protocol)
- **FR-019**: System MUST leverage Cognito's built-in rate limiting and brute force protection
- **FR-020**: System MUST provide intentionally vague error messages for failed login attempts to prevent email enumeration
- **FR-021**: System MUST implement a pre-signup Lambda trigger that enforces invite-only access by rejecting sign-ups for emails not already in Cognito
- **FR-022**: Pre-signup Lambda MUST automatically link federated identity providers (Google) to existing native Cognito accounts by matching email

### Key Entities

- **User (Cognito)**: Represents a family member with access to the wiki
  - Attributes: sub (unique Cognito user ID), email (unique), displayName, role (Admin/Editor/Viewer), accountStatus (active/disabled), createdAt, lastLoginAt
  - Storage: AWS Cognito User Pool (password managed by Cognito, not stored in application DB)
  - Relationships: Created by invitation (except first admin via console), may have linked federated identities (Google)

- **Invitation**: Represents a single-use invite for a new family member
  - Attributes: invitationId (unique), recipientEmail, invitationToken (unique, secure), createdByUserId, status (pending/used/expired), createdAt, expiresAt, usedAt
  - Relationships: Created by an admin user via backend API, triggers `AdminCreateUser` in Cognito

- **OAuth Tokens**: Represents an active user session via OAuth2
  - Attributes: accessToken (JWT, 1-hour expiry), refreshToken (30-day expiry), idToken (user profile claims)
  - Storage: Browser memory/localStorage, managed by cognitoAuth.ts
  - Relationships: Issued by Cognito after successful OAuth2 authorization code exchange

- **Pre-Signup Lambda Trigger**: Enforces invite-only access and federated identity linking
  - Behavior: Rejects sign-ups for emails not in Cognito, auto-links Google identities to existing native accounts
  - Storage: Lambda function deployed alongside backend

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

## Assumptions

- AWS Cognito User Pool is configured with email delivery for temporary passwords and verification codes
- Wiki will have low concurrent user load (typical family usage: 2-5 concurrent users)
- AWS Cognito is the sole authentication provider; all auth UI is delegated to Cognito Hosted UI
- Email addresses are unique identifiers for users (one account per email)
- Admin users are trusted family members who will manage invitations responsibly
- No two-factor authentication (2FA) in initial release (can be added via Cognito MFA settings later)
- OAuth2 tokens are stored in browser; access tokens (JWT) are sent as Bearer tokens in API requests
- Cognito Hosted UI is served from a custom domain (auth.bluefin605.com) or Cognito prefix domain
- Google OAuth identity provider is configured in Cognito for social login
- Initial admin account is created via AWS Cognito console or CLI during first deployment
- Pre-signup Lambda trigger is deployed and wired to the Cognito User Pool

## Out of Scope

The following are explicitly **not** included in this specification:

- Social login providers beyond Google (Facebook, Apple, etc.) - can be added in Cognito configuration
- Two-factor authentication (2FA/MFA) - can be enabled via Cognito MFA settings as future enhancement
- Custom-branded auth UI pages - all auth UI is delegated to Cognito Hosted UI for security and simplicity
- Account self-registration without invitation - enforced by pre-signup Lambda trigger
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

- **Privacy & Security**: Authentication is mandatory for all access via Cognito Hosted UI, protecting family data
- **Pluggable Architecture**: AWS Cognito handles all auth concerns; Google social login enabled via federated identity providers
- **Family-Friendly**: Cognito Hosted UI provides familiar login experience with Google sign-in option; suitable for all ages and tech skill levels
- **Cost-Effective**: Uses serverless authentication services (AWS Cognito free tier: 50K MAUs free)
- **Simplicity**: Delegating auth UI to Cognito eliminates custom auth page maintenance; pre-signup Lambda enforces invite-only access automatically
