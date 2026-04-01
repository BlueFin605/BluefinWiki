import { APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import {
  CognitoIdentityProviderClient,
  AdminUpdateUserAttributesCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { z } from 'zod';
import { withAuth, withRole, getUserContext, AuthenticatedEvent } from '../middleware/auth.js';
import { logActivity } from './activity-log.js';

const USER_PROFILES_TABLE = process.env.USER_PROFILES_TABLE || 'bluefinwiki-user-profiles-local';
const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID || process.env.USER_POOL_ID || '';
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';

const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region: AWS_REGION }));
const cognitoClient = new CognitoIdentityProviderClient({ region: AWS_REGION });

const UpdateUserRequestSchema = z.object({
  role: z.enum(['Admin', 'Standard']).optional(),
  displayName: z.string().min(1).max(256).optional(),
}).refine(data => data.role !== undefined || data.displayName !== undefined, {
  message: 'At least one field (role or displayName) must be provided',
});

/**
 * Lambda handler for updating a user's role or displayName
 * Admin-only endpoint: PUT /admin/users/{userId}
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
    const body = JSON.parse(event.body || '{}');
    const validatedData = UpdateUserRequestSchema.parse(body);

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

    const currentProfile = profileResult.Item;

    // Guard: cannot change own role
    if (validatedData.role && caller.userId === targetUserId) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Cannot change your own role' }),
      };
    }

    // Guard: cannot remove last admin
    if (validatedData.role === 'Standard' && currentProfile.role === 'Admin') {
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
          body: JSON.stringify({ error: 'Cannot remove the last admin' }),
        };
      }
    }

    // Build update expression
    const now = new Date().toISOString();
    const updateParts: string[] = ['#updatedAt = :updatedAt'];
    const exprNames: Record<string, string> = { '#updatedAt': 'updatedAt' };
    const exprValues: Record<string, unknown> = { ':updatedAt': now };

    if (validatedData.role) {
      updateParts.push('#role = :role');
      exprNames['#role'] = 'role';
      exprValues[':role'] = validatedData.role;
    }
    if (validatedData.displayName) {
      updateParts.push('#displayName = :displayName');
      exprNames['#displayName'] = 'displayName';
      exprValues[':displayName'] = validatedData.displayName;
    }

    // Update DynamoDB
    await dynamoClient.send(new UpdateCommand({
      TableName: USER_PROFILES_TABLE,
      Key: { cognitoUserId: targetUserId },
      UpdateExpression: `SET ${updateParts.join(', ')}`,
      ExpressionAttributeNames: exprNames,
      ExpressionAttributeValues: exprValues,
    }));

    // Update Cognito custom attributes (best-effort)
    if (USER_POOL_ID && currentProfile.email) {
      try {
        const cognitoAttributes: { Name: string; Value: string }[] = [];
        if (validatedData.role) {
          cognitoAttributes.push({ Name: 'custom:role', Value: validatedData.role });
        }
        if (validatedData.displayName) {
          cognitoAttributes.push({ Name: 'custom:displayName', Value: validatedData.displayName });
        }

        if (cognitoAttributes.length > 0) {
          await cognitoClient.send(new AdminUpdateUserAttributesCommand({
            UserPoolId: USER_POOL_ID,
            Username: currentProfile.email,
            UserAttributes: cognitoAttributes,
          }));
        }
      } catch (error) {
        console.warn('Could not update Cognito attributes (DynamoDB updated successfully):', error);
      }
    }

    // Log activity
    const changes: string[] = [];
    if (validatedData.role) changes.push(`role: ${currentProfile.role} → ${validatedData.role}`);
    if (validatedData.displayName) changes.push(`displayName: ${currentProfile.displayName} → ${validatedData.displayName}`);

    await logActivity(caller.userId, 'USER_UPDATED', 'USER', targetUserId, {
      targetEmail: currentProfile.email,
      changes,
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'User updated successfully',
        userId: targetUserId,
        changes,
      }),
    };
  } catch (err: unknown) {
    console.error('Error updating user:', err);
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
      body: JSON.stringify({ error: 'Internal server error', message: error.message }),
    };
  }
}));
