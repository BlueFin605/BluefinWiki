import { APIGatewayProxyResult } from 'aws-lambda';
import { withAuth, getUserContext, AuthenticatedEvent } from '../middleware/auth.js';

/**
 * Example Lambda: Get Current User Profile
 * 
 * This endpoint demonstrates how to use the authentication middleware.
 * It extracts user information from the JWT token and returns the user's profile.
 * 
 * Endpoint: GET /auth/me
 * Auth: Required (any authenticated user)
 */
export const handler = withAuth(async (event: AuthenticatedEvent): Promise<APIGatewayProxyResult> => {
  console.log('Get current user request received');

  try {
    // Extract user context from the authenticated event
    const user = getUserContext(event);

    console.log('User authenticated:', {
      userId: user.userId,
      email: user.email,
      role: user.role,
    });

    // Return user profile
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        userId: user.userId,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        status: user.status,
        preferences: user.preferences,
      }),
    };
  } catch (error) {
    console.error('Error getting user profile:', error);

    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Failed to retrieve user profile' }),
    };
  }
});
