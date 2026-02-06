# Authentication Implementation (Task 2.1)

This directory contains the AWS Cognito-based authentication implementation for BlueFinWiki.

## Overview

The authentication system uses **AWS Cognito User Pools** for identity management with custom Lambda functions for registration, token generation, and post-confirmation actions.

## Components

### Lambda Functions

#### 1. `auth-register.ts`
**Purpose**: Handle user registration with invitation codes

**Trigger**: API Gateway POST /auth/register

**Flow**:
1. Validates invitation code from DynamoDB
2. Creates Cognito user via AdminCreateUser
3. Sets permanent password
4. Creates user profile in DynamoDB
5. Marks invitation as used

**Request**:
```json
{
  "inviteCode": "ABC12345",
  "email": "user@example.com",
  "displayName": "John Doe",
  "password": "SecurePass123!"
}
```

**Response**:
```json
{
  "message": "User registered successfully",
  "userId": "cognito-sub-uuid",
  "email": "user@example.com",
  "role": "Standard"
}
```

#### 2. `auth-post-confirmation.ts`
**Purpose**: Cognito post-confirmation trigger

**Trigger**: Cognito User Pool (Post Confirmation)

**Actions**:
- Updates user profile status from 'pending' to 'active'
- Records first login timestamp
- Creates activity log entry

**Notes**:
- Non-blocking: errors won't prevent authentication
- Runs after email confirmation or password change

#### 3. `auth-pre-token-generation.ts`
**Purpose**: Cognito pre-token generation trigger

**Trigger**: Cognito User Pool (Pre Token Generation)

**Actions**:
- Loads user profile from DynamoDB
- Injects custom claims into JWT:
  - `custom:role` (Admin | Standard)
  - `custom:displayName`
  - `custom:status`
  - `custom:preferences` (JSON string)

**Notes**:
- Suspended users don't receive custom claims
- Non-blocking: returns minimal claims on error

### Middleware

#### `auth.ts`
**Purpose**: JWT validation and authorization middleware

**Key Functions**:

1. **`withAuth(handler)`**: Wraps Lambda handlers with JWT validation
   ```typescript
   export const handler = withAuth(async (event, context) => {
     const user = getUserContext(event);
     // ... handler logic
   });
   ```

2. **`withRole(roles, handler)`**: Restricts access by role
   ```typescript
   export const handler = withAuth(
     withRole(['Admin'], async (event, context) => {
       // Admin-only logic
     })
   );
   ```

3. **`getUserContext(event)`**: Extracts user info from JWT claims
   ```typescript
   const user = getUserContext(event);
   // user.userId, user.email, user.role, etc.
   ```

4. **`hasPermission(event, resourceOwnerId)`**: Check resource access
   ```typescript
   if (!hasPermission(event, pageOwnerId)) {
     return { statusCode: 403, ... };
   }
   ```

**JWT Verification**:
- Uses `aws-jwt-verify` library
- Verifies signature against Cognito JWKS
- Validates token expiry and issuer
- Extracts claims for authorization

## Authentication Flow

### Registration
1. User receives invitation code (via email)
2. User submits registration form (email, password, invite code)
3. Backend validates invite code
4. Cognito user created with AdminCreateUser
5. Password set via AdminSetUserPassword
6. User profile created in DynamoDB
7. Invite marked as used

### Login
1. Frontend calls Cognito SignIn API (via AWS SDK)
2. Cognito validates credentials
3. Pre-token generation trigger adds custom claims
4. Access token returned to frontend
5. Frontend stores token (localStorage/sessionStorage)

### API Requests
1. Frontend includes token in Authorization header
2. Lambda middleware (`withAuth`) verifies JWT
3. User context extracted from claims
4. Handler processes request with user info

### Token Refresh
1. Frontend detects token expiry
2. Uses refresh token to get new access token
3. Cognito returns new access token
4. Frontend updates stored token

## Local Development

### Setup
1. Start Aspire: `dotnet run --project aspire/BlueFinWiki.AppHost`
2. Initialize Cognito: `cd aspire/scripts && npm run setup-cognito`
3. Test users created automatically:
   - Admin: `admin@bluefinwiki.local` / `AdminPass123!`
   - User: `user@bluefinwiki.local` / `UserPass123!`

### Cognito Local
- **Endpoint**: http://localhost:9229
- **User Pool ID**: `local_user_pool_id`
- **Client ID**: `local_client_id`
- **Docs**: See `aspire/LOCAL-COGNITO-SETUP.md`

### MailHog (Email Testing)
- **Web UI**: http://localhost:8025
- **SMTP**: localhost:1025
- All emails captured for inspection

### Testing Authentication

**Using cURL**:
```bash
# Login (get token)
curl -X POST http://localhost:9229/ \
  -H "Content-Type: application/x-amz-json-1.1" \
  -H "X-Amz-Target: AWSCognitoIdentityProviderService.InitiateAuth" \
  -d '{
    "AuthFlow": "USER_PASSWORD_AUTH",
    "ClientId": "local_client_id",
    "AuthParameters": {
      "USERNAME": "admin@bluefinwiki.local",
      "PASSWORD": "AdminPass123!"
    }
  }'

# Use token in API request
curl http://localhost:3000/auth/me \
  -H "Authorization: Bearer <access-token>"
```

**Using AWS SDK**:
```typescript
import { CognitoIdentityProviderClient, InitiateAuthCommand } from '@aws-sdk/client-cognito-identity-provider';

const client = new CognitoIdentityProviderClient({
  region: 'us-east-1',
  endpoint: 'http://localhost:9229',
});

const command = new InitiateAuthCommand({
  AuthFlow: 'USER_PASSWORD_AUTH',
  ClientId: 'local_client_id',
  AuthParameters: {
    USERNAME: 'admin@bluefinwiki.local',
    PASSWORD: 'AdminPass123!',
  },
});

const response = await client.send(command);
const accessToken = response.AuthenticationResult?.AccessToken;
```

## Deployment

### AWS Cognito Setup
1. Create User Pool in AWS Console or CDK
2. Configure password policy and MFA
3. Add custom attributes: `custom:role`
4. Create User Pool Client
5. Configure Lambda triggers:
   - Post Confirmation → `auth-post-confirmation`
   - Pre Token Generation → `auth-pre-token-generation`

### Environment Variables
- `USER_POOL_ID`: Cognito User Pool ID
- `CLIENT_ID`: User Pool Client ID
- `AWS_REGION`: AWS region
- `USER_PROFILES_TABLE`: DynamoDB table name
- `INVITATIONS_TABLE`: DynamoDB table name
- `ACTIVITY_LOG_TABLE`: DynamoDB table name

### API Gateway Authorization
Configure Cognito User Pool as authorizer:
1. Create Cognito User Pool authorizer
2. Attach to protected routes
3. Or use Lambda authorizer with custom logic

## Security Considerations

### Token Storage
- **Frontend**: Store access token in memory or sessionStorage
- **Refresh token**: Store in httpOnly cookie (preferred) or localStorage
- Never log tokens in production

### Password Requirements
- Minimum 8 characters
- Uppercase, lowercase, numbers, symbols required
- Enforced by Cognito password policy

### Rate Limiting
- API Gateway throttling: 100 req/sec per user
- Lambda concurrency limits
- Cognito login attempt limits

### Permissions
- **Admin**: Full access to all resources
- **Standard**: Read all published content, edit own drafts
- Resource ownership checked via `hasPermission()`

### Audit Logging
- All authentication events logged to `activity_log` table
- User actions tracked with Cognito sub
- Retention: 90 days (DynamoDB TTL)

## Troubleshooting

### JWT Verification Fails
- Check `USER_POOL_ID` and `CLIENT_ID` match
- Verify token hasn't expired (1 hour default)
- Ensure JWKS endpoint is accessible
- For local dev, check cognito-local is running

### User Registration Fails
- Verify invitation code exists and is valid
- Check email doesn't already exist in Cognito
- Ensure password meets policy requirements
- Check DynamoDB tables exist and are accessible

### Custom Claims Missing
- Verify pre-token generation trigger is configured
- Check user profile exists in DynamoDB
- Ensure trigger Lambda has DynamoDB permissions
- Review CloudWatch logs for trigger errors

### Cognito Local Issues
- Port 9229 must be available
- Check container logs: `docker logs cognito-local`
- Reset state: delete `cognito-local-data/` directory
- Limited feature support vs real Cognito

## Next Steps

Task 2.2: Password Reset Flow (Cognito Managed)
- Configure Cognito email settings
- Set up password reset templates
- Implement frontend password reset UI

Task 2.3: Invitation System
- Create Lambda for generating invitations
- Admin UI for managing invitations
- Email templates for invitation links

Task 2.4: Frontend Authentication UI
- Login/registration forms
- AWS Amplify or Cognito SDK integration
- Auth context provider
- Protected routes

## Resources

- [AWS Cognito Documentation](https://docs.aws.amazon.com/cognito/)
- [aws-jwt-verify Library](https://github.com/awslabs/aws-jwt-verify)
- [Cognito Lambda Triggers](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-identity-pools-working-with-aws-lambda-triggers.html)
- [cognito-local](https://github.com/jagregory/cognito-local)
