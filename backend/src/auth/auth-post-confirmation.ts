import { PostConfirmationTriggerHandler } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand, GetCommand, PutCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { UserProfileRecord } from '../types/index.js';

// Environment variables
const USER_PROFILES_TABLE = process.env.USER_PROFILES_TABLE || 'bluefinwiki-user-profiles-local';
const ACTIVITY_LOG_TABLE = process.env.ACTIVITY_LOG_TABLE || 'bluefinwiki-activity-log-local';
const INVITATIONS_TABLE = process.env.INVITATIONS_TABLE || 'bluefinwiki-invitations-local';
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';

// Initialize AWS clients
const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region: AWS_REGION }));

/**
 * Cognito Post-Confirmation Trigger
 * 
 * This Lambda is triggered after:
 * - User confirms their email address
 * - User changes their initial temporary password
 * - User completes MFA setup (if enabled)
 * 
 * Actions:
 * 1. Update user profile status from 'pending' to 'active'
 * 2. Log first login timestamp
 * 3. Create activity log entry
 */
export const handler: PostConfirmationTriggerHandler = async (event) => {
  console.log('Post-confirmation trigger received:', {
    userPoolId: event.userPoolId,
    userName: event.userName,
    triggerSource: event.triggerSource,
  });

  try {
    const cognitoUserId = event.request.userAttributes.sub;
    const email = event.request.userAttributes.email;

    if (!cognitoUserId) {
      throw new Error('Missing Cognito user ID (sub) in user attributes');
    }

    let userProfile = await getUserProfile(cognitoUserId);

    if (!userProfile) {
      // Federated signup path: pre-signup approved this user because a pending
      // invitation matched their email. Now that Cognito has assigned a sub,
      // create the profile from the invitation and mark the invite as used.
      const invitation = await findPendingInvitationByEmail(email);
      if (!invitation) {
        console.error('Post-confirmation: no profile and no pending invitation', {
          cognitoUserId,
          email,
        });
        return event;
      }

      const displayName =
        event.request.userAttributes.name ||
        event.request.userAttributes.given_name ||
        email.split('@')[0];

      await createUserProfileFromInvitation({
        cognitoUserId,
        email,
        displayName,
        role: invitation.role,
        inviteCode: invitation.inviteCode,
      });
      await markInvitationUsed(invitation.inviteCode, cognitoUserId);

      console.log('Profile created from invitation:', {
        cognitoUserId,
        email,
        inviteCode: invitation.inviteCode,
        role: invitation.role,
      });
      userProfile = await getUserProfile(cognitoUserId);
    }

    await activateUserProfile(cognitoUserId);
    await logFirstLogin(cognitoUserId, email);

    console.log('User profile activated successfully:', { cognitoUserId, email });
    return event;
  } catch (error) {
    console.error('Error in post-confirmation trigger:', error);
    // Don't throw — post-confirmation failures shouldn't block authentication
    // outright. If the profile genuinely doesn't exist, pre-token-gen will reject
    // the token issuance, so the auth gate still holds.
    return event;
  }
};

interface InvitationRecord {
  inviteCode: string;
  email?: string;
  role: 'Admin' | 'Standard';
  status: 'pending' | 'used' | 'revoked';
  expiresAt: string;
}

async function findPendingInvitationByEmail(email: string): Promise<InvitationRecord | null> {
  const nowSeconds = Math.floor(Date.now() / 1000);

  const result = await dynamoClient.send(new ScanCommand({
    TableName: INVITATIONS_TABLE,
    FilterExpression: '#email = :email AND #status = :pending',
    ExpressionAttributeNames: { '#email': 'email', '#status': 'status' },
    ExpressionAttributeValues: { ':email': email, ':pending': 'pending' },
  }));

  const matches = (result.Items as InvitationRecord[] | undefined) ?? [];
  const valid = matches.find((inv) => parseInt(inv.expiresAt, 10) > nowSeconds);
  return valid ?? null;
}

async function createUserProfileFromInvitation(data: {
  cognitoUserId: string;
  email: string;
  displayName: string;
  role: 'Admin' | 'Standard';
  inviteCode: string;
}): Promise<void> {
  const now = new Date().toISOString();

  const profile = {
    cognitoUserId: data.cognitoUserId,
    email: data.email,
    displayName: data.displayName,
    role: data.role,
    status: 'pending' as const,
    inviteCode: data.inviteCode,
    createdAt: now,
    updatedAt: now,
  };

  await dynamoClient.send(new PutCommand({
    TableName: USER_PROFILES_TABLE,
    Item: profile,
    ConditionExpression: 'attribute_not_exists(cognitoUserId)',
  }));
}

async function markInvitationUsed(inviteCode: string, cognitoUserId: string): Promise<void> {
  const now = new Date().toISOString();

  await dynamoClient.send(new UpdateCommand({
    TableName: INVITATIONS_TABLE,
    Key: { inviteCode },
    UpdateExpression: 'SET #status = :status, usedBy = :usedBy, usedAt = :usedAt',
    ConditionExpression: '#status = :pending',
    ExpressionAttributeNames: { '#status': 'status' },
    ExpressionAttributeValues: {
      ':status': 'used',
      ':pending': 'pending',
      ':usedBy': cognitoUserId,
      ':usedAt': now,
    },
  }));
}

/**
 * Get user profile from DynamoDB
 */
async function getUserProfile(cognitoUserId: string): Promise<UserProfileRecord | null> {
  const getCommand = new GetCommand({
    TableName: USER_PROFILES_TABLE,
    Key: { cognitoUserId },
  });

  const result = await dynamoClient.send(getCommand);
  return (result.Item as UserProfileRecord | undefined) || null;
}

/**
 * Update user profile status to active and set lastLoginAt
 */
async function activateUserProfile(cognitoUserId: string): Promise<void> {
  const now = new Date().toISOString();

  const updateCommand = new UpdateCommand({
    TableName: USER_PROFILES_TABLE,
    Key: { cognitoUserId },
    UpdateExpression: 'SET #status = :status, lastLoginAt = :lastLoginAt, updatedAt = :updatedAt',
    ExpressionAttributeNames: {
      '#status': 'status',
    },
    ExpressionAttributeValues: {
      ':status': 'active',
      ':lastLoginAt': now,
      ':updatedAt': now,
    },
  });

  await dynamoClient.send(updateCommand);
  console.log('User profile activated:', { cognitoUserId, timestamp: now });
}

/**
 * Log first login activity
 */
async function logFirstLogin(cognitoUserId: string, email: string): Promise<void> {
  const now = new Date().toISOString();
  const timestamp = Date.now(); // Unix timestamp for sort key

  try {
    const putCommand = {
      TableName: ACTIVITY_LOG_TABLE,
      Item: {
        userId: cognitoUserId,
        timestamp,
        action: 'user.first_login',
        resourceType: 'user',
        resourceGuid: cognitoUserId,
        details: {
          email,
          event: 'post_confirmation',
        },
        createdAt: now,
      },
    };

    await dynamoClient.send(new PutCommand(putCommand));
    console.log('First login activity logged:', { cognitoUserId, timestamp });
  } catch (error) {
    // Log but don't fail if activity logging fails
    console.error('Failed to log first login activity:', error);
  }
}
