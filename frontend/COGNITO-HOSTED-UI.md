# Cognito Hosted UI Setup Guide

This guide explains how to set up AWS Cognito Hosted UI authentication for production.

## Overview

The application supports two authentication modes:

1. **Local Development** (`VITE_DISABLE_AUTH=true`): Bypasses authentication completely
2. **Production** (Cognito Hosted UI): Secure OAuth 2.0 flow

## Production Setup: Cognito Hosted UI

### Step 1: Create Cognito User Pool (if not already done)

1. Go to AWS Cognito console
2. Create a new User Pool with your preferred settings
3. Note your **User Pool ID** (format: `region_alphanumeric`, e.g., `us-east-1_abc123def`)

### Step 2: Create App Client

1. In your User Pool, go to "App Integration" → "App Clients"
2. Create a new app client with these settings:
   - **App type**: Public client
   - **Authentication flows**: Authorization code grant
   - **Allowed OAuth scopes**: 
     - openid
     - email
     - profile

### Step 3: Configure Callback URLs

1. Go to "App Integration" → "App Client Settings"
2. Set **Callback URLs**:
   ```
   https://yourdomain.com/callback
   https://localhost:3000/callback  (for local testing with real Cognito)
   ```
3. Set **Sign out URLs** (optional):
   ```
   https://yourdomain.com/login
   ```
4. Save changes

### Step 4: Create Cognito Domain

1. Go to "App Integration" → "Domain Name"
2. Create a domain (e.g., `bluefinwiki-prod`)
3. Note the full domain: `bluefinwiki-prod.auth.us-east-1.amazoncognito.com`

### Step 5: Configure Environment Variables

Create or update your production environment variables:

```bash
# Production (.env.production or CI/CD secrets)
VITE_COGNITO_USER_POOL_ID=us-east-1_abc123def
VITE_COGNITO_CLIENT_ID=your_client_id_here
VITE_COGNITO_REGION=us-east-1
VITE_COGNITO_DOMAIN=bluefinwiki-prod.auth.us-east-1.amazoncognito.com
VITE_COGNITO_REDIRECT_URI=https://yourdomain.com/callback
VITE_DISABLE_AUTH=false
```

**Important**: Set `VITE_DISABLE_AUTH=false` for production builds!

### Step 6: Test the Flow

1. User clicks "Sign in" on your login page → redirects to Cognito
2. User logs in at Cognito Hosted UI
3. Cognito redirects back to `/callback` with authorization code
4. Your app exchanges the code for tokens
5. User is logged in and redirected to dashboard

## Available Cognito Features (Automatically Handled)

When you use Cognito Hosted UI, these features work out of the box:

- ✅ **Email verification** - Cognito sends verification emails
- ✅ **Password reset** - Users can reset forgotten passwords
- ✅ **MFA** - Optional/required multi-factor authentication
- ✅ **Social login** - Google, Facebook, etc. (configure in Cognito)
- ✅ **NEW_PASSWORD_REQUIRED** - Users set password on first login
- ✅ **Session management** - Token refresh, logout
- ✅ **Account recovery** - Users can unlock/recover accounts

## Troubleshooting

### "Invalid redirect URI"
- Check that your callback URL exactly matches what's configured in Cognito App Client
- Include the protocol (https://) and exact path (/callback)

### "The authorization code is invalid"
- Code may have expired (valid for ~10 minutes)
- Browser cookies/state may be cleared
- Check that your app's base URL matches your Cognito domain region

### "Missing tokens in response"
- Verify App Client has "openid" in allowed OAuth scopes
- Check that your domain is fully created (can take a few minutes)

### Testing with cognito-local
To test with the local Cognito server, create a temporary env:
```bash
VITE_COGNITO_DOMAIN=localhost:9229
VITE_COGNITO_REDIRECT_URI=http://localhost:3000/callback  
VITE_COGNITO_ENDPOINT=http://localhost:9228
VITE_DISABLE_AUTH=false
```

## Security Considerations

1. **Never expose secrets** - Client ID is public, but keep user pool ID out of client code
2. **HTTPS required** - Cognito only sends codes to HTTPS redirect URIs in production
3. **State parameter** - Automatically verified to prevent CSRF attacks
4. **Token storage** - Tokens stored in localStorage; consider httpOnly cookies for maximum security
5. **Environment isolation** - Use separate user pools for dev/staging/production

## Removing Auth Bypass

When moving to production:
1. ✅ Remove `VITE_DISABLE_AUTH=true` from your environment
2. ✅ Set all Cognito variables correctly
3. ✅ Update your `.env.local` to NOT disable auth
4. ✅ Login page will now redirect to Cognito Hosted UI

## Local Dev with Real Cognito (Advanced)

If you want to test the real Cognito flow locally:

1. Configure Cognito callback URL to include `http://localhost:3000/callback`
2. Set environment variables pointing to real Cognito (no `VITE_DISABLE_AUTH`)
3. Run your frontend locally
4. Cognito will now handle login instead of the mock auth

This is useful for testing the full OAuth flow before deploying.
