import { APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import {
  CognitoIdentityProviderClient,
  AdminDeleteUserCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { withAuth, withRole, getUserContext, AuthenticatedEvent } from '../middleware/auth.js';
import { logActivity } from './activity-log.js';

const USER_PROFILES_TABLE = process.env.USER_PROFILES_TABLE || 'bluefinwiki-user-profiles-local';
const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID || process.env.USER_POOL_ID || '';
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';

const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region: AWS_REGION }));
const cognitoClient = new CognitoIdentityProviderClient({ region: AWS_REGION });

/**
 * Lambda handler for deleting a user
 * Soft-deletes in DynamoDB (anonymizes), hard-deletes from Cognito.
 * Admin-only endpoint: DELETE /admin/users/{userId}
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

  // Guard: cannot delete self
  if (caller.userId === targetUserId) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Cannot delete yourself' }),
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

    if (profile.status === 'deleted') {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'User is already deleted' }),
      };
    }

    // Guard: cannot delete last admin
    if (profile.role === 'Admin') {
      const scanResult = await dynamoClient.send(new ScanCommand({
        TableName: USER_PROFILES_TABLE,
        FilterExpression: '#role = :admin AND #status <> :deleted',
        ExpressionAttributeNames: { '#role': 'role', '#status': 'status' },
        ExpressionAttributeValues: { ':admin': 'Admin', ':deleted': 'deleted' },
        Select: 'COUNT',
      }));

      if ((scanResult.Count || 0) <= 1) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Cannot delete the last admin' }),
        };
      }
    }

    // Hard-delete from Cognito (best-effort)
    if (USER_POOL_ID && profile.email) {
      try {
        await cognitoClient.send(new AdminDeleteUserCommand({
          UserPoolId: USER_POOL_ID,
          Username: profile.email,
        }));
      } catch (error) {
        console.warn('Could not delete Cognito user:', error);
      }
    }

    // Soft-delete in DynamoDB: anonymize and mark deleted
    const now = new Date().toISOString();
    await dynamoClient.send(new UpdateCommand({
      TableName: USER_PROFILES_TABLE,
      Key: { cognitoUserId: targetUserId },
      UpdateExpression: 'SET #status = :status, #updatedAt = :updatedAt, #email = :email, #displayName = :displayName',
      ExpressionAttributeNames: {
        '#status': 'status',
        '#updatedAt': 'updatedAt',
        '#email': 'email',
        '#displayName': 'displayName',
      },
      ExpressionAttributeValues: {
        ':status': 'deleted',
        ':updatedAt': now,
        ':email': `deleted-${targetUserId.substring(0, 8)}@removed`,
        ':displayName': 'Deleted User',
      },
    }));

    await logActivity(caller.userId, 'USER_DELETED', 'USER', targetUserId, {
      targetEmail: profile.email,
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'User deleted successfully', userId: targetUserId }),
    };
  } catch (err: unknown) {
    console.error('Error deleting user:', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
}));
