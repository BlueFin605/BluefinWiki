# Clarification Questions: User Authentication Feature

**Feature**: User Authentication with Invite-Only Access  
**Generated**: 2026-01-13  
**Status**: Awaiting Answers

---

## 🔴 Critical Priority - Must Answer Before Implementation

### 1. First Admin Setup Security
**Question**: What happens if someone discovers the wiki URL during the brief window when no admin exists yet? How do you prevent an unauthorized person from creating the first admin account?

**Why this matters**: The spec states "given the wiki is newly deployed with no users, when a visitor accesses the wiki, then they are presented with a 'Create Admin Account' page." This is a significant security vulnerability if the wiki URL is publicly accessible or discovered.

**Suggested considerations**:
- Should there be a one-time setup token/key required to create the first admin?
- Should the first admin creation require access to server environment variables or deployment credentials?
- Is there a time-limited window (e.g., 1 hour after deployment) for first admin creation?
- Should initial setup be done via CLI/admin panel rather than public web interface?

#### Clarification
I don't think this matter because
1. There will be no content, and if there ws users would alredy be setup so window is closed
2. Admin owns the hosting so can reset wiki and restart the process
---

### 2. Email Sending Failure Handling
**Question**: The spec mentions email service failure as an edge case but doesn't specify the complete behavior. What should happen to the invitation/password-reset token when email delivery fails?

**Current spec says**: "System should log the error and show admin a clear error message with the invitation link to manually share."

**Needs clarification**:
- Does the invitation token remain valid and can be manually shared? no
- How does the admin access/view the invitation link after initial failure? the user management should show the user as unverified
- Should the system auto-retry sending the email? no
- Is there a "resend email" button in the user management interface? yes
- What if password reset email fails - can user request another reset immediately? should this be up to the IDP such as Cognito and how that works

---

### 3. Session Management Across Devices
**Question**: Can a user be logged in on multiple devices simultaneously with the same account?

**Why this matters**: Family members might access from phone, tablet, and computer. The spec mentions sessions but doesn't clarify multi-device behavior.

**Needs clarification**:
- Are multiple concurrent sessions per user allowed? yes
- If user logs in on device B, does device A session remain active? yes
- Is there a "log out all devices" option? no
- How does "Remember me" work across multiple devices? it doesn;t, remember me is for just that device

#### Clarification
We do not need to track sessions, aceess token shuld expire and if a user is deleved or deactivated then the refresh should fail
---

### 4. Password Reset Token Generation
**Question**: What happens if a user requests multiple password reset emails before using any of them?

**Scenarios needing clarification**:
- User requests reset, doesn't use it, requests another 10 minutes later - are both tokens valid?
- Should requesting a new reset invalidate previous unused tokens?
- Is there rate limiting on password reset requests per email address? 
- The spec has rate limiting for login (5 attempts per 15 min) but not for password reset requests

#### Clarification
This is up to ther IDP to handle password resets
---

### 5. Invitation Email Address Validation
**Question**: Can an admin invite the same email address multiple times (e.g., if first invitation expires)?

**Current spec mentions**: "System shows a warning that the email is already registered and offers to resend invitation if account is pending."

**Needs clarification**:
- What if invitation expired - can admin send new one to same email? yes
- What if invitation is still pending (not used, not expired) - can admin send another? yes
- Should expired invitations be automatically cleaned up, or do they remain in "expired" status forever?
- Can an admin "cancel" a pending invitation before it's used? yes

---

## 🟡 High Priority - Important for User Experience

### 6. Session Timeout User Experience
**Question**: How does the user experience session timeout? What happens to unsaved work when session expires?

**Current spec**: "User sessions MUST expire after 7 days of inactivity" and "when session expires after 7 days of inactivity, then they are redirected to login page on next page load"

**Needs clarification**:
- Is there any warning before session expires? no
- What if user is actively typing/editing when session expires? it fails
- Does the system attempt to save work-in-progress before redirecting to login? no
- After logging back in, does user return to where they were? no


---

### 7. Display Name Handling
**Question**: What are the rules for user display names?

**Spec mentions**: "When user updates their display name, then the new name appears in page edit history and comments"

**Needs clarification**:
- Is display name required or optional? If optional, what displays instead? should take the display name from the idp when using federated logins such as google, otherwise just show the email address
- Can display name be the same as email address? up to the idp
- Can multiple users have the same display name? (e.g., two people named "John") yes
- Are there any restrictions on display name (length, special characters)? no
- Is display name set during invitation/registration or only changeable later in profile? initial value should be from the idp or their emaila ddressm it can be changed later

---

### 8. Admin Role Assignment
**Question**: Can the first admin create additional admin accounts? If so, how?

**Current spec**: "Admin users MUST be able to change any user's role" but doesn't clarify if this means promoting existing users to admin, or if admins can invite users directly as admins.

**Needs clarification**:
- Can admin send invitations that grant admin role immediately upon registration? no
- Or do all invitations create "Editor" role and admin must manually promote after registration? yes
- Should there be a confirmation/warning when granting admin privileges? no
- Is there a maximum number of admins recommended/allowed? no

---

### 9. Disabled Account Behavior
**Question**: What happens to content created by a disabled user?

**Current spec**: "When admin clicks 'Revoke Access' for a user, then that user's account is disabled"

**Needs clarification**:
- Do pages/edits created by disabled user remain visible? yes
- Does their display name still appear in edit history? yes
- Can disabled users be re-enabled, or is it permanent? they can be re-enabled
- Should there be "soft delete" vs "hard delete" options? just soft-delete
- What happens if a disabled user tries to use a "remember me" session token? login gets rejected

---

### 10. Invitation Link Delivery Method
**Question**: How exactly is the invitation link delivered to the recipient?

**Current spec assumes email delivery**: "invitation email delivered within 5 minutes"

**Needs clarification**:
- Is email the ONLY delivery method, or can admin copy/share link manually? email only
- If email is required, what if recipient doesn't receive it (spam folder, wrong email)? admin can resend it
- Should admin be able to view/copy invitation links after creation? no
- Should there be an "invitation sent successfully" confirmation or just "invitation created"? state of user should be unverfied

---

## 🟢 Medium Priority - Nice to Have Clarity

### 11. Password Requirements Documentation
**Question**: Where and when are password requirements shown to users?

**Current spec**: "System MUST enforce password requirements: minimum 8 characters, at least one uppercase letter, one lowercase letter, and one number"

**Needs clarification**:
- Are requirements shown before user starts typing or only after validation fails?
- Is there real-time feedback as user types (e.g., "password too short" or checkmarks)?
- Are these requirements configurable by admin or hardcoded?
- Should there be a password strength meter?

#### Clarification
Password requirements are up to the IDP

---

### 12. "Remember Me" Checkbox Visibility
**Question**: Is "Remember Me" opt-in (unchecked by default) or opt-out (checked by default)?

**Why this matters**: Security best practice is opt-in, but user convenience favors opt-out, especially for a family wiki accessed from trusted devices.

**Needs clarification**:
- What is the default state of the checkbox? unchecked
- Is this configurable per deployment or hardcoded? hardcoded

---

### 13. Rate Limiting Feedback
**Question**: What does the user see when they hit the rate limit on login attempts?

**Current spec**: "System MUST implement rate limiting on login attempts (max 5 attempts per email per 15 minutes)"

**Needs clarification**:
- Does the error message tell user how long they must wait? no
- "Too many attempts. Please try again in 12 minutes."
- Or generic: "Too many failed login attempts. Please try again later." yes
- Does this lock out valid users if someone else is attacking their email? yes

---

### 14. Invitation Link URL Format
**Question**: What does the invitation link URL look like?

**Example needed**:
- `https://bluefinwiki.com/invite?token=abc123...`
- `https://bluefinwiki.com/register/abc123...`
- Something else?

**Why this matters**: Affects implementation and also user perception (cleaner URLs are more trustworthy).

#### Clarification
- `https://bluefinwiki.com/invite?token=abc123...`
---

### 15. Session Storage Location
**Question**: Where are sessions stored?

**Current spec mentions**: "Session storage will use secure, httpOnly cookies"

**Needs clarification for implementation**:
- Are sessions stored in database, Redis, memory, or cookies only? cookies only
- If cookies only (stateless JWT), can sessions be revoked immediately? no
- If database-backed, what happens if database is unavailable?
- How does this work with serverless architecture mentioned in constitution?

---

### 16. Authentication Provider Interface
**Question**: What does the `IAuthProvider` pluggable interface look like?

**Current spec mentions**: "Designed with `IAuthProvider` interface to support AWS Cognito (default) with future options for Auth0, Firebase, or custom OIDC"

**Needs clarification**:
- What methods must be implemented? (login, register, resetPassword, etc.) login, resetpassword, inviteusers
- How are invitations handled - are they provider-specific or handled at app level? ideally by IDP
- Does each provider need to implement its own user role system? no
- How is session management abstracted across providers? we don;t care about sessions as they will not expire. Refresh tokens will not refresh if user is deleted or deactivated

---

### 17. Security Audit Logs Access
**Question**: How and where can admins view the authentication security audit logs?

**Current spec**: "System MUST log all authentication events (login attempts, account creation, password resets) for security audit"

**Needs clarification**:
- Is there a UI for viewing logs or only server/file access? no
- Can admins filter logs by user, event type, date range? no
- How long are logs retained?
- Are logs exportable?
- Do logs include IP addresses as mentioned in success criteria?

#### Clarification
Logs should be written to the cloud provider, so if it is in AWS Lambda it will end up in Cloudwatch
---

### 18. Email Template Customization
**Question**: Can admins customize the invitation and password reset email templates?

**Why this matters**: Constitution emphasizes family-friendly, and personalized emails ("Welcome to the Smith Family Wiki!") improve trust and adoption.

**Needs clarification**:
- Are email templates fixed or customizable? fixed
- Can admin set wiki name/branding in emails? yes
- Can admin preview emails before they're sent? no

---

### 19. HTTPS Enforcement
**Question**: How is HTTPS enforced?

**Current spec mentions**: "System will comply with basic security best practices (HTTPS, secure headers, CSRF protection)"

**Needs clarification for implementation**:
- Is HTTPS termination handled at load balancer/CloudFront level? yes
- Does application code redirect HTTP to HTTPS? yes everything to be over HTTPS
- Are cookies set with `Secure` flag requiring HTTPS? yes
- What happens if someone accesses via HTTP? redirected to HTTPS, if not possible they are rejected

---

### 20. Concurrent Admin Creation Race Condition
**Question**: The edge case mentions database transaction for preventing concurrent admin creation. What specific database mechanism?

**Current spec says**: "System uses database transaction to ensure only one admin creation succeeds"

**Needs technical clarity**:
- Is this a unique constraint on a "system_initialized" flag?
- Is it a conditional insert based on user count?
- How does this work with eventual consistency in DynamoDB (AWS stack)?
- Should there be a retry mechanism for the "losing" request?

#### Clarification
- This should be up to the IDP the handle, users are kept and managed within the IDP such as Cognito, if we need to create records suach as Roles in dynamo then that should be done after the user us created in the IDP
---

## 📋 Questions About Related Features (Gaps)

### 21. User Profile Beyond Display Name
**Question**: What other user profile information is stored/displayed?

**Current spec only mentions**: displayName, email, role

**Possible additions to clarify**:
- User avatar/profile picture? (spec says out of scope, confirm) out of scope
- Timezone preference for timestamps? timestamps are all stored in TUC and displayed in local time
- Email notification preferences? email notifcations outside of the IDP shuld be done via a wappable service - MVP just send to logs
- Last login timestamp shown to user? not needed for MVP

---

### 22. Account Deletion/GDPR
**Question**: Can users delete their own accounts? Can admins permanently delete user accounts?

**Why this matters**: Privacy regulations and user rights.

**Needs clarification**:
- Is "revoke access" the same as account deletion or just disable? disable
- If user is deleted, what happens to their content/edit history? kept
- Is there a "right to be forgotten" mechanism? no

---

### 23. Invitation Expiry Notification
**Question**: Are admins or invitees notified when an invitation is about to expire or has expired?

**Current spec**: Invitations expire after 7 days

**Could be enhanced with**:
- Email reminder to invitee after 5 days if unused? no
- Admin notification when invitation expires without being used? no
- Or is this considered too much communication overhead? yes

---

### 24. Session Persistence vs. Security
**Question**: How is the tradeoff between "Remember me" convenience (30 days) and security handled?

**Consideration**:
- Should "Remember me" sessions be revoked on password change? no
- Should there be additional verification for sensitive actions even with valid session? no
- Should "Remember me" work differently for Admin vs Standard roles? no

---

### 25. Testing Auth with AWS Cognito
**Question**: How will authentication be tested in development/staging environments without AWS Cognito costs?

**Why this matters**: Constitution emphasizes cost-effectiveness

**Needs clarification**:
- Should there be a mock auth provider for local development? no, connect to the dev insatnce of cognito
- Can the system work without AWS entirely for testing? no, but use .Net aspire and tech such as local stack where suitable
- Is the pluggable architecture designed with this in mind? no, but it is a good test of it

---

## 📝 Recommendations

After reviewing these questions, I recommend:

1. **Answer Critical Priority (🔴) questions BEFORE starting implementation** - these affect core security and architecture
2. **Answer High Priority (🟡) questions during sprint planning** - these significantly impact UX
3. **Answer Medium Priority (🟢) questions during implementation** - these are details that can be decided as you code, but documenting them now prevents mid-sprint debates

Would you like me to:
- Help you answer any of these questions?
- Prioritize which ones are most urgent for your next sprint?
- Create a checklist for tracking which questions have been addressed?
