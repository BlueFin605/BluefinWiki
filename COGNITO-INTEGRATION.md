# AWS Cognito Integration - BlueFinWiki

**Date**: February 6, 2026  
**Purpose**: Document AWS Cognito setup, integration, and local development configuration

---

## Overview

BlueFinWiki uses **AWS Cognito User Pools** for authentication and authorization. This document explains the architecture, setup, and key differences between local development and cloud deployment.

---

## Architecture

### Authentication Flow

```
┌─────────────┐
│   Frontend  │
│  (React)    │
└──────┬──────┘
       │ 1. signIn(email, password)
       ↓
┌─────────────────────┐
│  Cognito User Pool  │  ← Local: cognito-local (port 9229)
│                     │  ← Cloud: AWS Cognito
└──────┬──────────────┘
       │ 2. Returns JWT tokens (access, id, refresh)
       ↓
┌─────────────┐
│   Frontend  │
│  (Stores    │
│   tokens)   │
└──────┬──────┘
       │ 3. API request with Authorization: Bearer <token>
       ↓
┌─────────────────────┐
│  API Gateway        │
│  + Lambda           │
│  (JWT Verification) │
└─────────────────────┘
```

### Data Storage

- **Cognito User Pool**: Core authentication data (email, password hash, verification status)
- **DynamoDB `user_profiles`**: Extended profile data (displayName, role, preferences, invite tracking)

**Why separate storage?**
- Cognito manages secure authentication (passwords, MFA, tokens)
- DynamoDB stores application-specific data (roles, preferences, activity)
- Clean separation of concerns

---

## Cognito User Pool Configuration

### User Attributes

#### Standard Attributes
- **email** (required, unique): Used as username for sign-in
- **given_name** (optional): User's first name
- **family_name** (optional): User's last name

#### Custom Attributes
- **custom:role** (string, max 20 chars): User role for RBAC
  - Values: `Admin`, `Standard`
  - Immutable after creation (by design)
  - Included in JWT token claims

### Password Policy

- **Minimum length**: 8 characters
- **Required characters**: Uppercase, lowercase, digit, symbol
- **Temporary password validity**: 7 days
- **Password history**: Not enforced (users can reuse old passwords)

### Multi-Factor Authentication (MFA)

- **Status**: Optional (user can enable)
- **Methods**: TOTP (Google Authenticator, Authy, etc.)
- **SMS**: Disabled (to reduce costs for MVP)

### Account Recovery

- **Recovery method**: Email only
- **Verification code expiry**: 1 hour
- **Flow**: User requests reset → Cognito sends code via email → User submits code + new password

### Email Configuration

#### Development (Cognito default)
- Sends up to **50 emails/day** for free
- Sender: `no-reply@verificationemail.com`
- Limited customization

#### Production (SES integration - future)
- Custom sender address (e.g., `no-reply@bluefinwiki.com`)
- Higher sending limits (SES quotas)
- Rich HTML email templates
- DKIM/SPF authentication

---

## User Registration Flow (Invite-Only)

BlueFinWiki uses an **invitation-based registration** system (no public sign-up).

### Step 1: Admin Creates Invitation

1. Admin clicks "Create Invitation" in admin panel
2. Backend Lambda (`admin-create-invitation`) generates 8-char invite code
3. Invitation stored in DynamoDB `invitations` table:
   - `inviteCode`: Unique alphanumeric code
   - `email`: Optional pre-assigned email
   - `role`: Default role for invited user (Standard or Admin)
   - `expiresAt`: Unix timestamp (7 days from creation)
   - `status`: `pending`
4. Invitation email sent via SES/Cognito with registration link

### Step 2: User Registers

1. User clicks link: `https://bluefinwiki.com/register?invite={code}`
2. Frontend validates invite code via backend API
3. User fills registration form:
   - Email (must match pre-assigned email if set)
   - Password (meets password policy)
   - Display name
4. Backend Lambda (`auth-register`) validates invite and creates Cognito user:
   - Calls `AdminCreateUser` API with email and temporary password
   - Sets user attributes: `email`, `custom:role`
   - Forces user to change password on first login
5. Creates user profile in DynamoDB `user_profiles` table:
   - `cognitoUserId`: Cognito `sub` claim (UUID)
   - `email`, `displayName`, `role`, `inviteCode`, `status: active`, `createdAt`
6. Marks invitation as `used` in DynamoDB

### Step 3: First Login

1. User logs in with email and temporary password
2. Cognito requires password change (NEW_PASSWORD_REQUIRED challenge)
3. User sets permanent password
4. Cognito triggers **Post-Confirmation Lambda** (future):
   - Updates `lastLogin` timestamp in `user_profiles`
   - Logs activity in `activity_log`

---

## JWT Token Structure

### Access Token

Contains user claims for authorization:

```json
{
  "sub": "a1b2c3d4-5e6f-7890-abcd-ef1234567890",
  "cognito:username": "user@example.com",
  "email": "user@example.com",
  "custom:role": "Admin",
  "token_use": "access",
  "auth_time": 1675728000,
  "exp": 1675731600,
  "iat": 1675728000
}
```

**Used for**: API authorization (verified by Lambda)

### ID Token

Contains user identity information:

```json
{
  "sub": "a1b2c3d4-5e6f-7890-abcd-ef1234567890",
  "email": "user@example.com",
  "email_verified": true,
  "given_name": "John",
  "family_name": "Doe",
  "custom:role": "Admin",
  "token_use": "id",
  "exp": 1675731600,
  "iat": 1675728000
}
```

**Used for**: Displaying user info in UI

### Refresh Token

- **Validity**: 30 days
- **Purpose**: Obtain new access/id tokens without re-authentication
- **Storage**: Secure HttpOnly cookie (frontend) or local storage

---

## DynamoDB `user_profiles` Table

### Schema

```
Partition Key: cognitoUserId (STRING) - Cognito sub claim
```

### Attributes

| Attribute      | Type   | Description                              |
|----------------|--------|------------------------------------------|
| cognitoUserId  | String | Cognito user ID (sub claim from JWT)    |
| email          | String | User's email (duplicated for queries)    |
| displayName    | String | Full name or nickname                    |
| role           | String | User role: "Admin" or "Standard"         |
| inviteCode     | String | Invitation code used for registration    |
| status         | String | "active", "suspended", "deleted"         |
| createdAt      | String | ISO 8601 timestamp                       |
| lastLogin      | String | ISO 8601 timestamp (updated on login)    |

### Global Secondary Index (GSI)

**email-index**:
- **Partition Key**: `email`
- **Purpose**: Look up user profile by email (for admin search, @mentions)
- **Projection**: ALL attributes

---

## DynamoDB `invitations` Table

### Schema

```
Partition Key: inviteCode (STRING) - 8-character alphanumeric
```

### Attributes

| Attribute      | Type   | Description                              |
|----------------|--------|------------------------------------------|
| inviteCode     | String | Unique 8-char code (e.g., "AB12CD34")   |
| email          | String | Optional pre-assigned email              |
| role           | String | "Admin" or "Standard"                    |
| createdBy      | String | Cognito userId of admin who created it   |
| createdAt      | String | ISO 8601 timestamp                       |
| expiresAt      | Number | Unix timestamp (TTL for auto-deletion)   |
| status         | String | "pending", "used", "revoked"             |
| usedBy         | String | Cognito userId of user who used it       |
| usedAt         | String | ISO 8601 timestamp                       |

### Time-to-Live (TTL)

- **Attribute**: `expiresAt`
- **Behavior**: DynamoDB automatically deletes items after expiry (7 days default)
- **Purpose**: Clean up old invitations without manual intervention

---

## Local Development Setup

### Cognito Local Container

BlueFinWiki uses **cognito-local** (open-source Cognito emulator) for local authentication testing.

#### Aspire Configuration

```csharp
var cognitoLocal = builder.AddContainer("cognito-local", "jagregory/cognito-local", "latest")
    .WithHttpEndpoint(port: 9229, targetPort: 9229, name: "cognito-local")
    .WithBindMount("./cognito-local-data", "/app/.cognito");
```

#### Environment Variables (Backend)

```bash
COGNITO_ENDPOINT=http://localhost:9229
COGNITO_USER_POOL_ID=local_user_pool_id
COGNITO_CLIENT_ID=local_client_id
```

#### Environment Variables (Frontend)

```bash
VITE_COGNITO_USER_POOL_ID=local_user_pool_id
VITE_COGNITO_CLIENT_ID=local_client_id
VITE_COGNITO_ENDPOINT=http://localhost:9229
```

### Creating Local Test Users

1. **Start Aspire**: `dotnet run --project aspire/BlueFinWiki.AppHost`
2. **Access Cognito Local**: http://localhost:9229
3. **Seed Test Users** (via backend script or manual API calls):

```javascript
// Example: Create test admin user
const { CognitoIdentityProviderClient, AdminCreateUserCommand } = require("@aws-sdk/client-cognito-identity-provider");

const client = new CognitoIdentityProviderClient({
  endpoint: "http://localhost:9229",
  region: "us-east-1",
  credentials: { accessKeyId: "test", secretAccessKey: "test" }
});

const command = new AdminCreateUserCommand({
  UserPoolId: "local_user_pool_id",
  Username: "admin@example.com",
  UserAttributes: [
    { Name: "email", Value: "admin@example.com" },
    { Name: "email_verified", Value: "true" },
    { Name: "custom:role", Value: "Admin" }
  ],
  TemporaryPassword: "TempPass123!",
  MessageAction: "SUPPRESS" // Don't send email
});

await client.send(command);
```

4. **Create profile in DynamoDB Local** (via LocalStack):

```javascript
const { DynamoDBClient, PutItemCommand } = require("@aws-sdk/client-dynamodb");

const dynamoClient = new DynamoDBClient({
  endpoint: "http://localhost:4566",
  region: "us-east-1",
  credentials: { accessKeyId: "test", secretAccessKey: "test" }
});

const command = new PutItemCommand({
  TableName: "bluefinwiki-user-profiles-local",
  Item: {
    cognitoUserId: { S: "local-admin-sub-uuid" },
    email: { S: "admin@example.com" },
    displayName: { S: "Local Admin" },
    role: { S: "Admin" },
    status: { S: "active" },
    createdAt: { S: new Date().toISOString() }
  }
});

await dynamoClient.send(command);
```

### Email Testing (MailHog)

- **SMTP**: localhost:1025
- **Web UI**: http://localhost:8025
- **Purpose**: View password reset emails, invitation emails, etc.

---

## Cloud Deployment Differences

| Feature                  | Local Development               | Cloud (AWS)                     |
|--------------------------|----------------------------------|---------------------------------|
| **Cognito Endpoint**     | http://localhost:9229            | https://cognito-idp.us-east-1.amazonaws.com |
| **User Pool ID**         | `local_user_pool_id`             | Real UUID (e.g., `us-east-1_aBcD1234`) |
| **Client ID**            | `local_client_id`                | Real client ID (26-char string) |
| **Email Sending**        | MailHog (SMTP localhost:1025)    | Cognito default or SES          |
| **MFA**                  | Not supported                    | Fully supported (TOTP, SMS)     |
| **Advanced Security**    | Not available                    | Enforced (risk scoring, blocks) |
| **JWT Verification**     | Mock/simple validation           | Full JWKS verification          |
| **Password Reset**       | Simulated flow                   | Real email delivery             |

---

## Security Best Practices

### JWT Token Handling

1. **Storage**:
   - Access token: Memory (React state) or sessionStorage
   - Refresh token: HttpOnly cookie (preferred) or localStorage (less secure)
   - Never expose tokens in URLs or logs

2. **Verification** (Backend):
   - Verify JWT signature using Cognito JWKS public keys
   - Check token expiration (`exp` claim)
   - Validate issuer (`iss` claim matches User Pool)
   - Extract `sub` (user ID) and `custom:role` for authorization

3. **Refresh Flow**:
   - Access token expires after 1 hour
   - Use refresh token to obtain new access/id tokens
   - Refresh token valid for 30 days
   - Automatic refresh via AWS SDK or manual API call

### Role-Based Access Control (RBAC)

#### Admin Role
- Create/revoke invitations
- Manage users (suspend, activate, delete)
- View all pages (including others' drafts)
- Edit site configuration
- Access admin dashboard

#### Standard Role
- View published pages
- Create/edit own pages
- View own drafts
- Comment on pages
- Manage own profile

**Enforcement**:
- Backend: Check `custom:role` claim in JWT
- Frontend: Conditional rendering based on user role

---

## Troubleshooting

### Issue: "User does not exist" error during login

**Cause**: User not created in Cognito or wrong User Pool ID

**Solution**:
1. Verify User Pool ID in environment variables
2. Check if user exists: `aws cognito-idp admin-get-user --user-pool-id <id> --username <email>`
3. Ensure user is confirmed (email verified)

### Issue: JWT verification fails

**Cause**: Invalid token, expired token, or misconfigured JWKS endpoint

**Solution**:
1. Check token expiration: Decode JWT at jwt.io
2. Verify JWKS endpoint: `https://cognito-idp.<region>.amazonaws.com/<userpoolid>/.well-known/jwks.json`
3. Ensure clock synchronization (NTP) on backend

### Issue: Invitation code not working

**Cause**: Expired invitation, already used, or revoked

**Solution**:
1. Query `invitations` table: Check `status` and `expiresAt`
2. Verify TTL hasn't deleted the item
3. Create new invitation if expired

### Issue: User can't change password

**Cause**: Password doesn't meet policy requirements

**Solution**:
1. Check password policy in Cognito console
2. Ensure password has: 8+ chars, uppercase, lowercase, digit, symbol
3. Show clear error messages in frontend

---

## Future Enhancements

### Phase 2 (Post-MVP)

1. **Social Login**: Add OAuth providers (Google, Facebook)
2. **SMS MFA**: Enable SMS-based two-factor authentication
3. **Custom SES Email Templates**: Branded password reset emails
4. **User Groups**: Organize users into teams/families
5. **Session Management**: View active sessions, revoke tokens
6. **Audit Logging**: Track all authentication events (via CloudWatch)
7. **Account Linking**: Merge duplicate accounts

---

## References

- [AWS Cognito Documentation](https://docs.aws.amazon.com/cognito/)
- [Cognito User Pool Triggers](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-identity-pools-working-with-aws-lambda-triggers.html)
- [JWT Token Validation](https://docs.aws.amazon.com/cognito/latest/developerguide/amazon-cognito-user-pools-using-tokens-verifying-a-jwt.html)
- [cognito-local GitHub](https://github.com/jagregory/cognito-local)

---

**Document Version**: 1.0  
**Last Updated**: February 6, 2026  
**Maintained By**: Development Team
