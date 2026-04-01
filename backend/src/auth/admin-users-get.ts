import { APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import {
  CognitoIdentityProviderClient,
  AdminGetUserCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { withAuth, withRole, AuthenticatedEvent } from '../middleware/auth.js';

const USER_PROFILES_TABLE = process.env.USER_PROFILES_TABLE || 'bluefinwiki-user-profiles-local';
const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID || process.env.USER_POOL_ID || '';
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';

const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region: AWS_REGION }));
const cognitoClient = new CognitoIdentityProviderClient({ region: AWS_REGION });

/**
 * Lambda handler for getting a single user's details
 * Admin-only endpoint: GET /admin/users/{userId}
 */
export const handler = withAuth(withRole(['Admin'], async (event: AuthenticatedEvent): Promise<APIGatewayProxyResult> => {
  const userId = event.pathParameters?.userId;

  if (!userId) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Missing userId parameter' }),
    };
  }

  try {
    // Get profile from DynamoDB
    const profileResult = await dynamoClient.send(new GetCommand({
      TableName: USER_PROFILES_TABLE,
      Key: { cognitoUserId: userId },
    }));

    if (!profileResult.Item) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'User not found' }),
      };
    }

    const profile = profileResult.Item;

    // Try to get Cognito info (best-effort)
    let cognitoEnabled: boolean | undefined;
    let cognitoLastModified: string | undefined;
    let cognitoUserStatus: string | undefined;

    if (USER_POOL_ID && profile.email) {
      try {
        const cognitoResult = await cognitoClient.send(new AdminGetUserCommand({
          UserPoolId: USER_POOL_ID,
          Username: profile.email,
        }));
        cognitoEnabled = cognitoResult.Enabled;
        cognitoLastModified = cognitoResult.UserLastModifiedDate?.toISOString();
        cognitoUserStatus = cognitoResult.UserStatus;
      } catch (error) {
        console.warn('Could not fetch Cognito user info:', error);
      }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: profile.cognitoUserId,
        email: profile.email,
        displayName: profile.displayName,
        role: profile.role,
        status: profile.status,
        createdAt: profile.createdAt,
        updatedAt: profile.updatedAt,
        lastLoginAt: profile.lastLoginAt || cognitoLastModified,
        cognitoEnabled,
        cognitoUserStatus,
      }),
    };
  } catch (err: unknown) {
    console.error('Error getting user:', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
}));
