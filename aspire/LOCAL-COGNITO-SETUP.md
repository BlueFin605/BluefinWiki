# Local Cognito Setup for BlueFinWiki

This document describes the local Cognito development setup using cognito-local.

## Overview

For local development, we use [cognito-local](https://github.com/jagregory/cognito-local), a community-maintained mock of AWS Cognito User Pools. This allows testing authentication flows without connecting to AWS.

## Configuration

### Aspire Setup

The `cognito-local` container is configured in `Program.cs`:

```csharp
var cognitoLocal = builder.AddContainer("cognito-local", "jagregory/cognito-local", "latest")
    .WithHttpEndpoint(port: 9229, targetPort: 9229, name: "cognito-local")
    .WithBindMount("./cognito-local-data", "/app/.cognito");
```

### Environment Variables

Both backend and frontend are configured to use the local Cognito endpoint:

- **Backend**:
  - `COGNITO_ENDPOINT`: http://localhost:9229
  - `COGNITO_USER_POOL_ID`: local_user_pool_id
  - `COGNITO_CLIENT_ID`: local_client_id

- **Frontend**:
  - `VITE_COGNITO_ENDPOINT`: http://localhost:9229
  - `VITE_COGNITO_USER_POOL_ID`: local_user_pool_id
  - `VITE_COGNITO_CLIENT_ID`: local_client_id

## Initial Setup

### 1. Create User Pool

When the Aspire app starts, the cognito-local container initializes automatically. To create a user pool and client:

```bash
# Create user pool configuration
POST http://localhost:9229/
Content-Type: application/x-amz-json-1.1
X-Amz-Target: AWSCognitoIdentityProviderService.CreateUserPool

{
  "PoolName": "bluefinwiki-local",
  "Policies": {
    "PasswordPolicy": {
      "MinimumLength": 8,
      "RequireUppercase": true,
      "RequireLowercase": true,
      "RequireNumbers": true,
      "RequireSymbols": true
    }
  },
  "AutoVerifiedAttributes": ["email"],
  "UsernameAttributes": ["email"],
  "Schema": [
    {
      "Name": "email",
      "AttributeDataType": "String",
      "Required": true,
      "Mutable": true
    },
    {
      "Name": "name",
      "AttributeDataType": "String",
      "Required": false,
      "Mutable": true
    },
    {
      "Name": "role",
      "AttributeDataType": "String",
      "Required": false,
      "Mutable": true,
      "DeveloperOnlyAttribute": false
    }
  ]
}
```

### 2. Create User Pool Client

```bash
POST http://localhost:9229/
Content-Type: application/x-amz-json-1.1
X-Amz-Target: AWSCognitoIdentityProviderService.CreateUserPoolClient

{
  "UserPoolId": "local_user_pool_id",
  "ClientName": "bluefinwiki-web-client",
  "GenerateSecret": false,
  "ExplicitAuthFlows": [
    "ALLOW_USER_SRP_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
    "ALLOW_USER_PASSWORD_AUTH"
  ],
  "RefreshTokenValidity": 30,
  "AccessTokenValidity": 60,
  "IdTokenValidity": 60
}
```

## Test Users

For development, create test users with different roles:

### Admin User

```bash
POST http://localhost:9229/
Content-Type: application/x-amz-json-1.1
X-Amz-Target: AWSCognitoIdentityProviderService.AdminCreateUser

{
  "UserPoolId": "local_user_pool_id",
  "Username": "admin@bluefinwiki.local",
  "UserAttributes": [
    { "Name": "email", "Value": "admin@bluefinwiki.local" },
    { "Name": "email_verified", "Value": "true" },
    { "Name": "name", "Value": "Admin User" },
    { "Name": "custom:role", "Value": "Admin" }
  ],
  "TemporaryPassword": "TempPassword123!",
  "MessageAction": "SUPPRESS"
}
```

Then set permanent password:

```bash
POST http://localhost:9229/
Content-Type: application/x-amz-json-1.1
X-Amz-Target: AWSCognitoIdentityProviderService.AdminSetUserPassword

{
  "UserPoolId": "local_user_pool_id",
  "Username": "admin@bluefinwiki.local",
  "Password": "AdminPass123!",
  "Permanent": true
}
```

### Standard User

```bash
POST http://localhost:9229/
Content-Type: application/x-amz-json-1.1
X-Amz-Target: AWSCognitoIdentityProviderService.AdminCreateUser

{
  "UserPoolId": "local_user_pool_id",
  "Username": "user@bluefinwiki.local",
  "UserAttributes": [
    { "Name": "email", "Value": "user@bluefinwiki.local" },
    { "Name": "email_verified", "Value": "true" },
    { "Name": "name", "Value": "Standard User" },
    { "Name": "custom:role", "Value": "Standard" }
  ],
  "TemporaryPassword": "TempPassword123!",
  "MessageAction": "SUPPRESS"
}

# Set permanent password
POST http://localhost:9229/
Content-Type: application/x-amz-json-1.1
X-Amz-Target: AWSCognitoIdentityProviderService.AdminSetUserPassword

{
  "UserPoolId": "local_user_pool_id",
  "Username": "user@bluefinwiki.local",
  "Password": "UserPass123!",
  "Permanent": true
}
```

## Automated Setup Script

A Node.js script is provided to automate the initial setup:

```bash
cd aspire/scripts
npm install
node setup-cognito-local.js
```

This script will:
1. Create the user pool
2. Create the user pool client
3. Create test users (admin and standard)
4. Seed DynamoDB with user profiles

## Testing Authentication

### Using AWS SDK

```typescript
import { CognitoIdentityProviderClient, InitiateAuthCommand } from '@aws-sdk/client-cognito-identity-provider';

const client = new CognitoIdentityProviderClient({
  region: 'us-east-1',
  endpoint: 'http://localhost:9229',
  credentials: {
    accessKeyId: 'test',
    secretAccessKey: 'test',
  },
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
console.log('Access Token:', response.AuthenticationResult?.AccessToken);
```

### Using Frontend

1. Start Aspire: `dotnet run --project aspire/BlueFinWiki.AppHost`
2. Navigate to: http://localhost:5173
3. Login with test credentials:
   - Admin: `admin@bluefinwiki.local` / `AdminPass123!`
   - User: `user@bluefinwiki.local` / `UserPass123!`

## Email Testing

Emails from Cognito (password reset, verification codes) are captured by MailHog:

- **Web UI**: http://localhost:8025
- **SMTP**: localhost:1025

All emails sent during local development can be viewed in the MailHog web interface.

## Debugging

### View Logs

```bash
docker logs cognito-local
```

### Check User Pool

List users in the pool:

```bash
POST http://localhost:9229/
Content-Type: application/x-amz-json-1.1
X-Amz-Target: AWSCognitoIdentityProviderService.ListUsers

{
  "UserPoolId": "local_user_pool_id"
}
```

### Reset Cognito State

To start fresh, delete the cognito-local data directory:

```bash
rm -rf aspire/BlueFinWiki.AppHost/cognito-local-data
```

Then restart Aspire.

## Differences from AWS Cognito

cognito-local is a best-effort mock and doesn't support all Cognito features:

**Supported**:
- User creation and authentication
- Password policies
- Custom attributes
- Token generation (JWT)
- Lambda triggers (limited)

**Not Supported**:
- Hosted UI
- Social identity providers (Google, Facebook)
- Advanced security features (device tracking, MFA)
- Some Lambda triggers

For production-like testing, use a real AWS Cognito User Pool in a dev environment.

## Troubleshooting

### Issue: Cognito container won't start

**Solution**: Check port 9229 is not in use:
```bash
netstat -an | findstr "9229"
```

### Issue: JWT verification fails

**Solution**: Ensure the JWT library is configured to use the local endpoint:
```typescript
const verifier = CognitoJwtVerifier.create({
  userPoolId: 'local_user_pool_id',
  tokenUse: 'access',
  clientId: 'local_client_id',
  jwksUri: 'http://localhost:9229/local_user_pool_id/.well-known/jwks.json',
});
```

### Issue: Lambda triggers not firing

**Solution**: cognito-local has limited trigger support. Test triggers separately or use AWS Cognito dev environment.

## Migration to AWS Cognito

When deploying to AWS:

1. Update environment variables to use real Cognito endpoints
2. Configure Lambda triggers in AWS Console or CDK/Terraform
3. Set up custom domain for hosted UI (if used)
4. Configure SES for email sending
5. Enable MFA and advanced security features
6. Test OAuth flows with production URLs

## Resources

- [cognito-local GitHub](https://github.com/jagregory/cognito-local)
- [AWS Cognito Documentation](https://docs.aws.amazon.com/cognito/)
- [Aspire Documentation](https://learn.microsoft.com/en-us/dotnet/aspire/)
