import { APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import {
  CognitoIdentityProviderClient,
  ListUsersCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { z } from 'zod';
import { withAuth, withRole, AuthenticatedEvent } from '../middleware/auth.js';

const USER_PROFILES_TABLE = process.env.USER_PROFILES_TABLE || 'bluefinwiki-user-profiles-local';
const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID || process.env.USER_POOL_ID || '';
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';

const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region: AWS_REGION }));
const cognitoClient = new CognitoIdentityProviderClient({ region: AWS_REGION });

const ListUsersQuerySchema = z.object({
  role: z.enum(['Admin', 'Standard']).optional(),
  status: z.enum(['active', 'suspended', 'pending', 'deleted']).optional(),
});

interface UserProfileRecord {
  cognitoUserId: string;
  email: string;
  displayName: string;
  role: 'Admin' | 'Standard';
  status: string;
  createdAt: string;
  updatedAt?: string;
  lastLoginAt?: string;
}

interface UserResponse {
  userId: string;
  email: string;
  displayName: string;
  role: 'Admin' | 'Standard';
  status: string;
  createdAt: string;
  lastLoginAt?: string;
  cognitoEnabled?: boolean;
}

/**
 * Lambda handler for listing all users
 * Admin-only endpoint: GET /admin/users
 */
export const handler = withAuth(withRole(['Admin'], async (event: AuthenticatedEvent): Promise<APIGatewayProxyResult> => {
  console.log('List users request received');

  try {
    const queryParams = ListUsersQuerySchema.parse({
      role: event.queryStringParameters?.role,
      status: event.queryStringParameters?.status,
    });

    // Scan user profiles from DynamoDB
    const scanResult = await dynamoClient.send(new ScanCommand({
      TableName: USER_PROFILES_TABLE,
    }));

    const profiles = (scanResult.Items || []) as unknown as UserProfileRecord[];

    // Try to get Cognito status for each user (best-effort)
    const cognitoStatusMap = new Map<string, { enabled: boolean; lastLogin?: string }>();
    if (USER_POOL_ID) {
      try {
        let paginationToken: string | undefined;
        do {
          const cognitoResult = await cognitoClient.send(new ListUsersCommand({
            UserPoolId: USER_POOL_ID,
            PaginationToken: paginationToken,
          }));
          for (const user of cognitoResult.Users || []) {
            const sub = user.Attributes?.find(a => a.Name === 'sub')?.Value;
            if (sub) {
              cognitoStatusMap.set(sub, {
                enabled: user.Enabled ?? true,
                lastLogin: user.UserLastModifiedDate?.toISOString(),
              });
            }
          }
          paginationToken = cognitoResult.PaginationToken;
        } while (paginationToken);
      } catch (error) {
        console.warn('Could not fetch Cognito users (continuing with DynamoDB data only):', error);
      }
    }

    // Build response, applying filters
    const users: UserResponse[] = [];
    for (const profile of profiles) {
      if (queryParams.role && profile.role !== queryParams.role) continue;
      if (queryParams.status && profile.status !== queryParams.status) continue;

      const cognitoInfo = cognitoStatusMap.get(profile.cognitoUserId);

      users.push({
        userId: profile.cognitoUserId,
        email: profile.email,
        displayName: profile.displayName,
        role: profile.role,
        status: profile.status,
        createdAt: profile.createdAt,
        lastLoginAt: profile.lastLoginAt || cognitoInfo?.lastLogin,
        cognitoEnabled: cognitoInfo?.enabled,
      });
    }

    // Sort by displayName
    users.sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''));

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ users, total: users.length }),
    };
  } catch (err: unknown) {
    console.error('Error listing users:', err);
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
