import { APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import {
  CognitoIdentityProviderClient,
  AdminUpdateUserAttributesCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { z } from 'zod';
import { withAuth, getUserContext, AuthenticatedEvent } from '../middleware/auth.js';

const USER_PROFILES_TABLE = process.env.USER_PROFILES_TABLE || 'bluefinwiki-user-profiles-local';
const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID || process.env.USER_POOL_ID || '';
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';

const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region: AWS_REGION }));
const cognitoClient = new CognitoIdentityProviderClient({ region: AWS_REGION });

const UpdateProfileRequestSchema = z.object({
  displayName: z.string().min(1, 'Display name is required').max(256, 'Display name too long'),
});

/**
 * Lambda handler for updating own profile (self-service)
 * Any authenticated user: PUT /auth/profile
 */
export const handler = withAuth(async (event: AuthenticatedEvent): Promise<APIGatewayProxyResult> => {
  const user = getUserContext(event);

  try {
    const body = JSON.parse(event.body || '{}');
    const validatedData = UpdateProfileRequestSchema.parse(body);

    const now = new Date().toISOString();

    // Update DynamoDB
    await dynamoClient.send(new UpdateCommand({
      TableName: USER_PROFILES_TABLE,
      Key: { cognitoUserId: user.userId },
      UpdateExpression: 'SET #displayName = :displayName, #updatedAt = :updatedAt',
      ExpressionAttributeNames: { '#displayName': 'displayName', '#updatedAt': 'updatedAt' },
      ExpressionAttributeValues: { ':displayName': validatedData.displayName, ':updatedAt': now },
    }));

    // Update Cognito (best-effort)
    if (USER_POOL_ID) {
      try {
        await cognitoClient.send(new AdminUpdateUserAttributesCommand({
          UserPoolId: USER_POOL_ID,
          Username: user.email,
          UserAttributes: [{ Name: 'custom:displayName', Value: validatedData.displayName }],
        }));
      } catch (error) {
        console.warn('Could not update Cognito displayName:', error);
      }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Profile updated successfully',
        displayName: validatedData.displayName,
      }),
    };
  } catch (err: unknown) {
    console.error('Error updating profile:', err);
    const error = err as { name?: string; errors?: unknown[]; message?: string };

    if (error.name === 'ZodError') {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Validation error', details: error.errors }),
      };
    }

    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
});
