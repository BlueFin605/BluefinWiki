# Task 2.2 Verification and Testing Guide

## Installation Steps

### 1. Install Frontend Dependencies

```powershell
cd frontend
npm install
```

This will install the new dependency:
- `amazon-cognito-identity-js@^6.3.12` - AWS Cognito Identity SDK for JavaScript

### 2. Verify Backend Dependencies

The backend Lambda functions use AWS SDK v3, which should already be installed:
- `@aws-sdk/client-dynamodb`
- `@aws-sdk/lib-dynamodb`

If not installed:
```powershell
cd backend
npm install @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb
```

## Local Development Testing

### Step 1: Start Aspire

```powershell
# From project root
cd aspire
dotnet run --project BlueFinWiki.AppHost
```

**Wait for services to start**:
- MailHog UI: http://localhost:8025
- Cognito Local: http://localhost:9229
- Backend API: http://localhost:3000
- Frontend: http://localhost:5173

### Step 2: Initialize Cognito Local (if not done)

```powershell
cd aspire/scripts
npm install
npm run setup-cognito
```

This creates test users:
- Admin: `admin@bluefinwiki.local` / `AdminPass123!`
- Standard: `user@bluefinwiki.local` / `UserPass123!`

### Step 3: Test Password Reset Flow

#### 3.1 Request Password Reset

**Option A: Using Frontend UI**
1. Navigate to: http://localhost:5173/forgot-password
2. Enter email: `admin@bluefinwiki.local`
3. Click "Send Reset Code"
4. Should see success message

**Option B: Using Cognito SDK Directly (Test Script)**

Create `test-password-reset.js`:
```javascript
import { CognitoIdentityProviderClient, ForgotPasswordCommand } from '@aws-sdk/client-cognito-identity-provider';

const client = new CognitoIdentityProviderClient({
  region: 'us-east-1',
  endpoint: 'http://localhost:9229',
});

const command = new ForgotPasswordCommand({
  ClientId: 'local_client_id',
  Username: 'admin@bluefinwiki.local',
});

try {
  const response = await client.send(command);
  console.log('Password reset requested:', response);
} catch (error) {
  console.error('Error:', error);
}
```

Run:
```powershell
node test-password-reset.js
```

#### 3.2 Check MailHog for Email

1. Open http://localhost:8025
2. You should see an email with subject: "Reset Your BlueFinWiki Password"
3. Email should contain:
   - Branded HTML template with gradient header
   - Large verification code (6 digits)
   - Reset link: `http://localhost:5173/reset-password?code=...`
   - Security warnings

#### 3.3 Complete Password Reset

**Option A: Using Frontend UI**
1. Copy verification code from email
2. Navigate to: http://localhost:5173/reset-password
3. Enter email: `admin@bluefinwiki.local`
4. Enter verification code (6 digits)
5. Enter new password (must meet requirements):
   - Min 8 characters
   - Uppercase letter
   - Lowercase letter
   - Number
   - Special character
6. Confirm password
7. Click "Reset Password"
8. Should see success message

**Option B: Using Cognito SDK (Test Script)**

Create `test-confirm-reset.js`:
```javascript
import { CognitoIdentityProviderClient, ConfirmForgotPasswordCommand } from '@aws-sdk/client-cognito-identity-provider';

const client = new CognitoIdentityProviderClient({
  region: 'us-east-1',
  endpoint: 'http://localhost:9229',
});

const command = new ConfirmForgotPasswordCommand({
  ClientId: 'local_client_id',
  Username: 'admin@bluefinwiki.local',
  ConfirmationCode: '123456', // Replace with actual code from email
  Password: 'NewSecurePass123!',
});

try {
  const response = await client.send(command);
  console.log('Password reset confirmed:', response);
} catch (error) {
  console.error('Error:', error);
}
```

### Step 4: Test Rate Limiting

#### 4.1 Trigger Multiple Reset Requests

Run this script 4 times quickly:
```javascript
// test-rate-limit.js
import { CognitoIdentityProviderClient, ForgotPasswordCommand } from '@aws-sdk/client-cognito-identity-provider';

const client = new CognitoIdentityProviderClient({
  region: 'us-east-1',
  endpoint: 'http://localhost:9229',
});

async function testRateLimit() {
  for (let i = 0; i < 4; i++) {
    try {
      const command = new ForgotPasswordCommand({
        ClientId: 'local_client_id',
        Username: 'admin@bluefinwiki.local',
      });
      const response = await client.send(command);
      console.log(`Attempt ${i + 1}: Success`);
    } catch (error) {
      console.log(`Attempt ${i + 1}: ${error.message}`);
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

testRateLimit();
```

Expected result:
- First 3 attempts: Success
- 4th attempt: Error "Too many password reset requests. Please try again in an hour."

#### 4.2 Check Activity Log

Query DynamoDB to verify logging:
```javascript
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({
  region: 'us-east-1',
  endpoint: 'http://localhost:4566',
});
const docClient = DynamoDBDocumentClient.from(client);

const result = await docClient.send(
  new QueryCommand({
    TableName: 'bluefinwiki-activity-log-local',
    KeyConditionExpression: 'userId = :userId',
    ExpressionAttributeValues: {
      ':userId': 'admin-user-cognito-sub', // Replace with actual Cognito sub
    },
    FilterExpression: '#action = :action',
    ExpressionAttributeNames: {
      '#action': 'action',
    },
    ExpressionAttributeValues: {
      ':action': 'PASSWORD_RESET_REQUESTED',
    },
  })
);

console.log('Activity log entries:', result.Items);
```

### Step 5: Test Email Templates

#### 5.1 Test Different Email Types

**Password Reset Email**:
- Already tested in Step 3

**Email Verification Email** (if implementing signup):
```javascript
// Trigger during signup flow
// Email should have "Verify Your Email" template
```

**Admin Create User Email**:
```javascript
import { CognitoIdentityProviderClient, AdminCreateUserCommand } from '@aws-sdk/client-cognito-identity-provider';

const client = new CognitoIdentityProviderClient({
  region: 'us-east-1',
  endpoint: 'http://localhost:9229',
});

const command = new AdminCreateUserCommand({
  UserPoolId: 'local_user_pool_id',
  Username: 'newuser@example.com',
  UserAttributes: [
    { Name: 'email', Value: 'newuser@example.com' },
    { Name: 'name', Value: 'New User' },
  ],
  TemporaryPassword: 'TempPass123!',
});

try {
  const response = await client.send(command);
  console.log('User created:', response);
  // Check MailHog for welcome email
} catch (error) {
  console.error('Error:', error);
}
```

#### 5.2 Verify Email Content

For each email type, check MailHog (http://localhost:8025) and verify:
- ✅ HTML rendering works correctly
- ✅ Gradient header displays
- ✅ Verification code is prominent and readable
- ✅ Links work (reset URL, verify URL)
- ✅ Security warnings are visible
- ✅ Footer information is correct
- ✅ Responsive design (resize browser)

## Error Handling Tests

### Test Invalid Email
```javascript
// Should fail with UserNotFoundException
const command = new ForgotPasswordCommand({
  ClientId: 'local_client_id',
  Username: 'nonexistent@example.com',
});
```

### Test Invalid Verification Code
```javascript
// Should fail with CodeMismatchException
const command = new ConfirmForgotPasswordCommand({
  ClientId: 'local_client_id',
  Username: 'admin@bluefinwiki.local',
  ConfirmationCode: '000000', // Wrong code
  Password: 'NewSecurePass123!',
});
```

### Test Expired Code
```javascript
// Wait 1 hour after requesting reset, then try to confirm
// Should fail with ExpiredCodeException
```

### Test Weak Password
```javascript
// Should fail with InvalidPasswordException
const command = new ConfirmForgotPasswordCommand({
  ClientId: 'local_client_id',
  Username: 'admin@bluefinwiki.local',
  ConfirmationCode: '123456',
  Password: 'weak', // Too short, no special chars
});
```

## Frontend UI Tests

### Visual Tests
- [ ] ForgotPassword component renders correctly
- [ ] Email input has proper validation
- [ ] Loading spinner appears during API call
- [ ] Success screen displays after submission
- [ ] Error messages show for invalid email
- [ ] "Try again" button works

### ResetPassword Component
- [ ] Email input pre-filled if passed as prop
- [ ] Verification code input accepts 6 digits only
- [ ] Password strength indicator updates in real-time
- [ ] Password requirements list updates dynamically
- [ ] Password confirmation detects mismatches
- [ ] Show/hide password toggle works
- [ ] Loading state displays during API call
- [ ] Success screen shows after reset
- [ ] Error messages show for various error types

### Responsive Design
- [ ] Test on mobile viewport (375px width)
- [ ] Test on tablet viewport (768px width)
- [ ] Test on desktop viewport (1024px+ width)
- [ ] Touch targets are adequate size (44x44px minimum)
- [ ] Text is readable on all screen sizes
- [ ] Buttons stack properly on mobile

### Accessibility
- [ ] Form labels are properly associated with inputs
- [ ] Focus indicators are visible
- [ ] Tab navigation works correctly
- [ ] Error messages are announced to screen readers
- [ ] Color contrast meets WCAG AA standards

## Production Checklist

Before deploying to production, ensure:

### AWS Cognito Configuration
- [ ] User Pool created with correct password policy
- [ ] Email settings configured (SES or Cognito default)
- [ ] Lambda triggers attached:
  - [ ] CustomMessage → `auth-custom-message`
  - [ ] PreTokenGeneration → `auth-pre-token-generation`
  - [ ] PostConfirmation → `auth-post-confirmation`
- [ ] User Pool Client created with correct OAuth flows
- [ ] Domain configured for hosted UI (if used)

### DynamoDB Tables
- [ ] `activity_log` table exists with TTL enabled
- [ ] Table has correct key schema (userId as PK, timestamp as SK)
- [ ] IAM permissions allow Lambda to write to table

### Environment Variables
- [ ] Backend Lambda functions have:
  - [ ] `DYNAMODB_ACTIVITY_LOG_TABLE`
  - [ ] `WIKI_NAME`
  - [ ] `WIKI_URL`
  - [ ] `SUPPORT_EMAIL`
- [ ] Frontend has:
  - [ ] `VITE_COGNITO_USER_POOL_ID`
  - [ ] `VITE_COGNITO_CLIENT_ID`
  - [ ] `VITE_API_URL`

### Security
- [ ] Rate limiting tested and working
- [ ] Activity logging verified
- [ ] Password policy enforced
- [ ] Email templates reviewed for security warnings
- [ ] HTTPS enforced for all URLs in production

### Monitoring
- [ ] CloudWatch logs enabled for Lambda functions
- [ ] CloudWatch alarms set up for error rates
- [ ] DynamoDB metrics monitored (read/write capacity)
- [ ] Cognito metrics monitored (user pool activity)

## Troubleshooting

### MailHog not receiving emails
- Check MailHog container is running: `docker ps | grep mailhog`
- Verify SMTP port 1025 is accessible
- Check backend SMTP configuration in Aspire AppHost

### Cognito Local not working
- Check container logs: `docker logs cognito-local`
- Verify port 9229 is not in use by another service
- Try resetting state: delete `aspire/cognito-local-data/` directory

### Frontend React errors
- Run `npm install` in frontend directory
- Ensure `amazon-cognito-identity-js` is installed
- Check TypeScript configuration includes JSX support

### Rate limiting not working
- Verify DynamoDB local (LocalStack) is running
- Check `activity_log` table exists
- Verify Lambda has permissions to query DynamoDB
- Check CloudWatch logs for Lambda errors

### Email templates not rendering
- Check `auth-custom-message` Lambda is attached to User Pool
- Verify Lambda has correct trigger configuration
- Check CloudWatch logs for Lambda errors
- Test with simple plain text email first

## Success Criteria

Task 2.2 is considered complete when:
- ✅ User can request password reset via email
- ✅ Verification code email is received in MailHog
- ✅ Email template is branded and professional
- ✅ User can reset password using verification code
- ✅ Password strength validation works correctly
- ✅ Rate limiting prevents abuse (3 attempts/hour)
- ✅ All password reset attempts are logged
- ✅ Error handling works for all error cases
- ✅ Frontend UI is responsive and accessible
- ✅ Local development works with Aspire + MailHog

---

**Last Updated**: February 6, 2026
