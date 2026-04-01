import { APIGatewayProxyResult } from 'aws-lambda';
import {
  CognitoIdentityProviderClient,
  ChangePasswordCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { z } from 'zod';
import { withAuth, AuthenticatedEvent } from '../middleware/auth.js';

const AWS_REGION = process.env.AWS_REGION || 'us-east-1';

const cognitoClient = new CognitoIdentityProviderClient({ region: AWS_REGION });

const ChangePasswordRequestSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});

/**
 * Lambda handler for changing own password (self-service)
 * Any authenticated user: POST /auth/change-password
 *
 * Requires the Cognito access token (not ID token) from the Authorization header.
 */
export const handler = withAuth(async (event: AuthenticatedEvent): Promise<APIGatewayProxyResult> => {
  try {
    const body = JSON.parse(event.body || '{}');
    const validatedData = ChangePasswordRequestSchema.parse(body);

    // Extract access token from Authorization header
    const authHeader = event.headers['Authorization'] || event.headers['authorization'] || '';
    const accessToken = authHeader.replace(/^Bearer\s+/i, '');

    if (!accessToken) {
      return {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing access token' }),
      };
    }

    await cognitoClient.send(new ChangePasswordCommand({
      AccessToken: accessToken,
      PreviousPassword: validatedData.currentPassword,
      ProposedPassword: validatedData.newPassword,
    }));

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Password changed successfully' }),
    };
  } catch (err: unknown) {
    console.error('Error changing password:', err);
    const error = err as { name?: string; errors?: unknown[]; message?: string; __type?: string };

    if (error.name === 'ZodError') {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Validation error', details: error.errors }),
      };
    }

    if (error.name === 'NotAuthorizedException' || error.__type?.includes('NotAuthorizedException')) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Incorrect current password' }),
      };
    }

    if (error.name === 'InvalidPasswordException' || error.__type?.includes('InvalidPasswordException')) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'New password does not meet requirements. Must include uppercase, lowercase, number, and symbol.' }),
      };
    }

    if (error.name === 'LimitExceededException' || error.__type?.includes('LimitExceededException')) {
      return {
        statusCode: 429,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Too many attempts. Please try again later.' }),
      };
    }

    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
});
