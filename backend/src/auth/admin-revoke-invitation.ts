import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

// Environment variables
const INVITATIONS_TABLE = process.env.INVITATIONS_TABLE || 'bluefinwiki-invitations-local';
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';

// Initialize AWS clients
const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region: AWS_REGION }));

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

/**
 * Extract user information from JWT token in Authorization header
 */
function extractUserFromToken(event: APIGatewayProxyEvent): { userId: string; role: string } {
  const authorizer = event.requestContext?.authorizer;
  
  if (!authorizer) {
    throw new Error('No authorizer context found');
  }
  
  const userId = authorizer.claims?.sub || authorizer.sub;
  const role = authorizer.claims?.['custom:role'] || authorizer['custom:role'] || 'Standard';
  
  if (!userId) {
    throw new Error('Invalid token: missing user ID');
  }
  
  return { userId, role };
}

/**
 * Lambda handler for revoking invitation codes
 * 
 * This function:
 * 1. Validates admin permissions
 * 2. Checks if invitation exists and is revokable
 * 3. Marks invitation as revoked in DynamoDB
 * 4. Prevents future use in registration flow
 * 
 * Admin-only endpoint
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('Revoke invitation request received');
  
  try {
    // Extract user from JWT token
    const user = extractUserFromToken(event);
    
    // Check admin permissions
    if (user.role !== 'Admin') {
      return {
        statusCode: 403,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Forbidden: Admin access required' }),
      };
    }
    
    // Extract invite code from path parameters
    const inviteCode = event.pathParameters?.code;
    
    if (!inviteCode) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Invitation code is required' }),
      };
    }
    
    // Validate invite code format (8 alphanumeric characters)
    if (!/^[A-Z0-9]{8}$/.test(inviteCode)) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Invalid invitation code format' }),
      };
    }
    
    // Check if invitation exists
    const getResult = await dynamoClient.send(new GetCommand({
      TableName: INVITATIONS_TABLE,
      Key: { inviteCode },
    }));
    
    if (!getResult.Item) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Invitation not found' }),
      };
    }
    
    const invitation = getResult.Item as unknown as InvitationRecord;
    
    // Check if invitation is already revoked
    if (invitation.status === 'revoked') {
      return {
        statusCode: 409,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Invitation is already revoked',
          invitation: {
            inviteCode: invitation.inviteCode,
            status: invitation.status,
          },
        }),
      };
    }
    
    // Check if invitation has already been used
    if (invitation.status === 'used') {
      return {
        statusCode: 409,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Cannot revoke a used invitation',
          invitation: {
            inviteCode: invitation.inviteCode,
            status: invitation.status,
            usedBy: invitation.usedBy,
            usedAt: invitation.usedAt,
          },
        }),
      };
    }
    
    // Update invitation status to revoked
    await dynamoClient.send(new UpdateCommand({
      TableName: INVITATIONS_TABLE,
      Key: { inviteCode },
      UpdateExpression: 'SET #status = :status, updatedAt = :updatedAt',
      ConditionExpression: '#status = :pendingStatus',
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: {
        ':status': 'revoked',
        ':updatedAt': new Date().toISOString(),
        ':pendingStatus': 'pending',
      },
    }));
    
    console.log(`Invitation revoked: ${inviteCode} by admin ${user.userId}`);
    
    // Return success response
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Invitation revoked successfully',
        inviteCode,
        revokedAt: new Date().toISOString(),
      }),
    };
  } catch (err: unknown) {
    console.error('Error revoking invitation:', err);
    const error = err as { name?: string; message?: string };
    
    // Handle conditional check failure (race condition: invitation was used)
    if (error.name === 'ConditionalCheckFailedException') {
      return {
        statusCode: 409,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Cannot revoke invitation: it may have been used or revoked by another admin',
        }),
      };
    }
    
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Internal server error', message: error.message }),
    };
  }
};
