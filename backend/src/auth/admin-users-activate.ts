import { APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import {
  CognitoIdentityProviderClient,
  AdminEnableUserCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { withAuth, withRole, getUserContext, AuthenticatedEvent } from '../middleware/auth.js';
import { logActivity } from './activity-log.js';

const USER_PROFILES_TABLE = process.env.USER_PROFILES_TABLE || 'bluefinwiki-user-profiles-local';
const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID || process.env.USER_POOL_ID || '';
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';

const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region: AWS_REGION }));
const cognitoClient = new CognitoIdentityProviderClient({ region: AWS_REGION });

/**
 * Lambda handler for activating a suspended user
 * Admin-only endpoint: POST /admin/users/{userId}/activate
 */
export const handler = withAuth(withRole(['Admin'], async (event: AuthenticatedEvent): Promise<APIGatewayProxyResult> => {
  const targetUserId = event.pathParameters?.userId;
  const caller = getUserContext(event);

  if (!targetUserId) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Missing userId parameter' }),
    };
  }

  try {
    // Get current profile
    const profileResult = await dynamoClient.send(new GetCommand({
      TableName: USER_PROFILES_TABLE,
      Key: { cognitoUserId: targetUserId },
    }));

    if (!profileResult.Item) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'User not found' }),
      };
    }

    const profile = profileResult.Item;

    if (profile.status === 'active') {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'User is already active' }),
      };
    }

    // Enable in Cognito (best-effort)
    if (USER_POOL_ID && profile.email) {
      try {
        await cognitoClient.send(new AdminEnableUserCommand({
          UserPoolId: USER_POOL_ID,
          Username: profile.email,
        }));
      } catch (error) {
        console.warn('Could not enable Cognito user:', error);
      }
    }

    // Update DynamoDB status
    const now = new Date().toISOString();
    await dynamoClient.send(new UpdateCommand({
      TableName: USER_PROFILES_TABLE,
      Key: { cognitoUserId: targetUserId },
      UpdateExpression: 'SET #status = :status, #updatedAt = :updatedAt',
      ExpressionAttributeNames: { '#status': 'status', '#updatedAt': 'updatedAt' },
      ExpressionAttributeValues: { ':status': 'active', ':updatedAt': now },
    }));

    await logActivity(caller.userId, 'USER_ACTIVATED', 'USER', targetUserId, {
      targetEmail: profile.email,
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'User activated successfully', userId: targetUserId }),
    };
  } catch (err: unknown) {
    console.error('Error activating user:', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
}));
