# Frontend Authentication Implementation

This document describes the frontend authentication implementation for BlueFinWiki using AWS Cognito.

## Overview

Task 2.4 has been completed with a full-featured authentication system that includes:
- Login with email/password
- User registration with invitation codes
- Password reset flow
- Protected routes with role-based access control
- Authentication context for global state management

## Components

### Core Components

#### 1. **AuthContext** (`src/contexts/AuthContext.tsx`)
Provides global authentication state and methods using React Context API.

**Features:**
- Stores user state (userId, email, displayName, role)
- Checks for existing Cognito session on app load
- Handles automatic token refresh
- Provides `signIn`, `signOut`, `refreshUser`, and `getCurrentSession` methods

**Usage:**
```tsx
import { useAuth } from './contexts/AuthContext';

function MyComponent() {
  const { user, isAuthenticated, signIn, signOut } = useAuth();
  // Use authentication state and methods
}
```

#### 2. **Login** (`src/components/auth/Login.tsx`)
Full-featured login page with email/password authentication.

**Features:**
- Email and password validation
- "Remember me" option (device tracking)
- Show/hide password toggle
- "Forgot password" link
- Comprehensive error handling for Cognito error codes
- Loading states

**Route:** `/login`

#### 3. **Register** (`src/components/auth/Register.tsx`)
User registration page with invitation code validation.

**Features:**
- Invitation code input (8-character alphanumeric)
- Email and display name fields
- Password strength indicator (weak/fair/good/strong)
- Password confirmation
- Terms acceptance checkbox
- Calls backend `/auth/register` Lambda function

**Route:** `/register`

**URL Parameters:**
- `?invite=CODE` - Pre-fills invitation code

#### 4. **ForgotPassword** & **ForgotPasswordPage**
Password reset request flow.

**Features:**
- Email input with validation
- Calls Cognito `forgotPassword` API
- Success confirmation with next steps
- Error handling

**Route:** `/forgot-password`

#### 5. **ResetPassword** & **ResetPasswordPage**
Password reset confirmation flow.

**Features:**
- Verification code input (from email)
- New password with strength validation
- Calls Cognito `confirmPassword` API
- Success confirmation

**Route:** `/reset-password?email=user@example.com`

#### 6. **ProtectedRoute** (`src/components/auth/ProtectedRoute.tsx`)
Route wrapper for protected pages.

**Features:**
- Checks authentication status
- Shows loading state during auth check
- Redirects to login if not authenticated
- Supports role-based access control (`requireAdmin` prop)
- Displays "Access Denied" for insufficient permissions

**Usage:**
```tsx
<Route
  path="/admin"
  element={
    <ProtectedRoute requireAdmin>
      <AdminPanel />
    </ProtectedRoute>
  }
/>
```

### Type Definitions

#### **Auth Types** (`src/types/auth.ts`)
TypeScript interfaces for authentication data:
- `User` - User profile data
- `AuthState` - Authentication state
- `LoginCredentials` - Login form data
- `RegistrationData` - Registration form data
- `CognitoError` - Cognito error structure

## Configuration

### Environment Variables

Create a `.env` file (or `.env.local`) in the `frontend/` directory:

```env
# API Configuration
VITE_API_BASE_URL=http://localhost:3000

# AWS Cognito Configuration
VITE_COGNITO_USER_POOL_ID=your-user-pool-id
VITE_COGNITO_CLIENT_ID=your-client-id
VITE_COGNITO_REGION=us-east-1
```

See `.env.example` for a template.

### Cognito Configuration

The Cognito configuration is centralized in `src/config/cognitoConfig.ts`:

```typescript
import { CognitoUserPool } from 'amazon-cognito-identity-js';

const poolData = {
  UserPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID || 'local_user_pool_id',
  ClientId: import.meta.env.VITE_COGNITO_CLIENT_ID || 'local_client_id',
};

const userPool = new CognitoUserPool(poolData);
export default userPool;
```

## App Structure

The main `App.tsx` is configured with routes and authentication:

```tsx
<BrowserRouter>
  <AuthProvider>
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      {/* Protected routes */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  </AuthProvider>
</BrowserRouter>
```

## User Flow

### Registration Flow
1. User receives invitation email with code (e.g., `ABC12345`)
2. User clicks registration link: `/register?invite=ABC12345`
3. User fills out form:
   - Invitation code (pre-filled)
   - Email address
   - Display name
   - Password (with strength indicator)
   - Terms acceptance
4. Frontend calls backend `/auth/register` Lambda
5. Backend validates invitation code and creates Cognito user
6. User is redirected to login page

### Login Flow
1. User navigates to `/login`
2. User enters email and password
3. Frontend calls Cognito `authenticateUser`
4. On success:
   - JWT tokens are stored in local storage
   - User data is extracted from ID token
   - AuthContext updates with user state
   - User is redirected to dashboard
5. On error:
   - Display appropriate error message
   - Handle special cases (email not verified, password reset required, etc.)

### Password Reset Flow
1. User clicks "Forgot password" on login page
2. User enters email address
3. Cognito sends verification code via email
4. User enters code and new password
5. Cognito updates password
6. User is redirected to login

### Protected Route Access
1. User navigates to protected route
2. `ProtectedRoute` component checks `isAuthenticated`
3. If loading: show loading spinner
4. If not authenticated: redirect to `/login` with `from` location
5. If authenticated but insufficient role: show "Access Denied"
6. If authorized: render protected content

## Error Handling

### Cognito Error Codes
The login component handles these Cognito error codes:

- `UserNotFoundException` - "No account found with this email address"
- `NotAuthorizedException` - "Incorrect email or password"
- `UserNotConfirmedException` - "Please verify your email address"
- `PasswordResetRequiredException` - "Password reset required"
- `TooManyRequestsException` - "Too many attempts, try again later"
- `NewPasswordRequired` - "You must change your temporary password"

### Registration Errors
- Invalid invitation code
- Email already exists
- Password doesn't meet requirements
- Backend validation errors

## Security Features

1. **Password Requirements:**
   - Minimum 8 characters
   - At least one uppercase letter
   - At least one lowercase letter
   - At least one number
   - At least one special character

2. **Session Management:**
   - JWT tokens stored in local storage
   - Automatic token refresh via Cognito SDK
   - Session persistence across page reloads

3. **Device Tracking:**
   - "Remember me" option enables device tracking
   - Cognito remembers trusted devices

4. **Protected Routes:**
   - Authentication check before rendering
   - Role-based access control (Admin vs Standard)
   - Graceful error pages for unauthorized access

## Testing

### Manual Testing Checklist
- [ ] Login with valid credentials
- [ ] Login with invalid credentials (error handling)
- [ ] Register with valid invitation code
- [ ] Register with invalid invitation code
- [ ] Password strength indicator updates correctly
- [ ] "Remember me" persists session
- [ ] Forgot password sends email
- [ ] Reset password with verification code
- [ ] Protected routes redirect to login when not authenticated
- [ ] Admin routes show "Access Denied" for standard users
- [ ] Logout clears session

### Local Development
For local development with Cognito Local (or mocked Cognito):

1. Set environment variables in `.env`:
   ```
   VITE_COGNITO_USER_POOL_ID=local_user_pool_id
   VITE_COGNITO_CLIENT_ID=local_client_id
   ```

2. Start the backend with local Cognito emulation

3. Use test invitation codes created by the backend

## Next Steps

1. **Email Notifications:**
   - Customize Cognito email templates
   - Add branding to welcome emails

2. **MFA Support:**
   - Enable multi-factor authentication
   - Add SMS or TOTP verification

3. **Social Login:**
   - Configure Cognito identity providers (Google, Facebook)
   - Add social login buttons

4. **Profile Management:**
   - Allow users to update display name
   - Change password (authenticated users)
   - Update notification preferences

5. **Admin Features:**
   - User management UI (list, view, suspend users)
   - Invitation management UI
   - Activity logs

## Dependencies

- `amazon-cognito-identity-js` - Cognito authentication SDK
- `react-router-dom` - Routing and navigation
- `axios` - HTTP client for backend API calls

## Files Created

```
frontend/src/
├── types/
│   └── auth.ts                    # TypeScript type definitions
├── contexts/
│   └── AuthContext.tsx            # Authentication context provider
├── components/
│   └── auth/
│       ├── Login.tsx              # Login page component
│       ├── Register.tsx           # Registration page component
│       ├── ForgotPassword.tsx     # Forgot password component
│       ├── ForgotPasswordPage.tsx # Forgot password page wrapper
│       ├── ResetPassword.tsx      # Reset password component
│       ├── ResetPasswordPage.tsx  # Reset password page wrapper
│       ├── ProtectedRoute.tsx     # Protected route wrapper
│       └── index.ts               # Barrel export
├── config/
│   └── cognitoConfig.ts           # Cognito configuration (already exists)
└── App.tsx                        # Updated with routes

frontend/
└── .env.example                   # Environment variable template
```

## Support

For issues or questions:
- Check Cognito error messages in browser console
- Verify environment variables are set correctly
- Ensure backend Lambda functions are deployed
- Review AWS Cognito User Pool configuration

---

**Implementation Status:** ✅ Complete
**Task:** 2.4 Frontend Authentication UI (Cognito Integration)
**Date:** February 6, 2026
