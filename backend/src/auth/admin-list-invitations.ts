import { APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { z } from 'zod';
import { withAuth, withRole, AuthenticatedEvent } from '../middleware/auth.js';

// Environment variables
const INVITATIONS_TABLE = process.env.INVITATIONS_TABLE || 'bluefinwiki-invitations-local';
const USER_PROFILES_TABLE = process.env.USER_PROFILES_TABLE || 'bluefinwiki-user-profiles-local';
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';

// Initialize AWS clients
const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region: AWS_REGION }));

// Query parameters validation schema
const ListInvitationsQuerySchema = z.object({
  status: z.enum(['pending', 'used', 'revoked', 'expired', 'all']).optional().default('all'),
});

interface InvitationRecord {
  inviteCode: string;
  email?: string;
  role: 'Admin' | 'Standard';
  createdBy: string;
  createdAt: string;
  expiresAt: string;
  status: 'pending' | 'used' | 'revoked';
  usedBy?: string;
  usedAt?: string;
}

interface UserProfile {
  cognitoUserId: string;
  email: string;
  displayName: string;
}

interface InvitationResponse {
  inviteCode: string;
  email?: string;
  role: string;
  createdBy: {
    userId: string;
    displayName?: string;
    email?: string;
  };
  createdAt: string;
  expiresAt: string;
  status: 'pending' | 'used' | 'revoked' | 'expired';
  usedBy?: {
    userId: string;
    displayName?: string;
    email?: string;
  };
  usedAt?: string;
}

/**
 * Fetch user profile from DynamoDB
 */
async function getUserProfile(userId: string): Promise<UserProfile | null> {
  try {
    const result = await dynamoClient.send(new GetCommand({
      TableName: USER_PROFILES_TABLE,
      Key: { cognitoUserId: userId },
    }));
    
    if (!result.Item) {
      return null;
    }
    
    return {
      cognitoUserId: result.Item.cognitoUserId,
      email: result.Item.email,
      displayName: result.Item.displayName,
    };
  } catch (error) {
    console.error(`Failed to fetch user profile for ${userId}:`, error);
    return null;
  }
}

/**
 * Check if invitation is expired
 */
function isExpired(expiresAt: string): boolean {
  const expiryTimestamp = parseInt(expiresAt, 10) * 1000; // Convert to milliseconds
  return Date.now() > expiryTimestamp;
}

/**
 * Lambda handler for listing invitation codes
 *
 * This function:
 * 1. Validates admin permissions (via withAuth + withRole middleware)
 * 2. Queries all invitations from DynamoDB
 * 3. Filters by status (pending, used, expired, revoked, or all)
 * 4. Enriches with creator and user information
 * 5. Returns sorted list (newest first)
 *
 * Admin-only endpoint
 */
export const handler = withAuth(withRole(['Admin'], async (event: AuthenticatedEvent): Promise<APIGatewayProxyResult> => {
  console.log('List invitations request received');

  try {
    // Parse and validate query parameters
    const queryParams = ListInvitationsQuerySchema.parse({
      status: event.queryStringParameters?.status,
    });
    
    // Scan invitations table (Note: For production, consider pagination)
    const scanResult = await dynamoClient.send(new ScanCommand({
      TableName: INVITATIONS_TABLE,
    }));
    
    if (!scanResult.Items || scanResult.Items.length === 0) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invitations: [],
          total: 0,
        }),
      };
    }
    
    // Process invitations
    const invitations: InvitationResponse[] = [];
    
    for (const item of scanResult.Items) {
      const invitation = item as unknown as InvitationRecord;
      
      // Determine actual status (check if expired)
      let actualStatus: 'pending' | 'used' | 'revoked' | 'expired' = invitation.status;
      if (invitation.status === 'pending' && isExpired(invitation.expiresAt)) {
        actualStatus = 'expired';
      }
      
      // Filter by status if requested
      if (queryParams.status !== 'all' && actualStatus !== queryParams.status) {
        continue;
      }
      
      // Fetch creator profile
      const creatorProfile = await getUserProfile(invitation.createdBy);
      
      // Fetch user profile if invitation was used
      let usedByProfile: UserProfile | null = null;
      if (invitation.usedBy) {
        usedByProfile = await getUserProfile(invitation.usedBy);
      }
      
      // Build response object
      invitations.push({
        inviteCode: invitation.inviteCode,
        email: invitation.email,
        role: invitation.role,
        createdBy: {
          userId: invitation.createdBy,
          displayName: creatorProfile?.displayName,
          email: creatorProfile?.email,
        },
        createdAt: invitation.createdAt,
        expiresAt: new Date(parseInt(invitation.expiresAt, 10) * 1000).toISOString(),
        status: actualStatus,
        usedBy: invitation.usedBy ? {
          userId: invitation.usedBy,
          displayName: usedByProfile?.displayName,
          email: usedByProfile?.email,
        } : undefined,
        usedAt: invitation.usedAt,
      });
    }
    
    // Sort by creation date (newest first)
    invitations.sort((a, b) => {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    
    // Return success response
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        invitations,
        total: invitations.length,
        filter: queryParams.status,
      }),
    };
  } catch (err: unknown) {
    console.error('Error listing invitations:', err);
    const error = err as { name?: string; errors?: unknown[]; message?: string };
    
    // Handle validation errors
    if (error.name === 'ZodError') {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Validation error',
          details: error.errors,
        }),
      };
    }
    
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Internal server error', message: error.message }),
    };
  }
}));
