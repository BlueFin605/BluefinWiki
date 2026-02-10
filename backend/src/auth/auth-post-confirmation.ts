import { PostConfirmationTriggerHandler } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { UserProfileRecord } from '../types/index.js';

// Environment variables
const USER_PROFILES_TABLE = process.env.USER_PROFILES_TABLE || 'bluefinwiki-user-profiles-local';
const ACTIVITY_LOG_TABLE = process.env.ACTIVITY_LOG_TABLE || 'bluefinwiki-activity-log-local';
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

    // Check if user profile exists
    const userProfile = await getUserProfile(cognitoUserId);
    if (!userProfile) {
      console.error('User profile not found for cognitoUserId:', cognitoUserId);
      // Don't fail the authentication - profile might be created later
      return event;
    }

    // Update user profile to active status
    await activateUserProfile(cognitoUserId);

    // Log first login activity
    await logFirstLogin(cognitoUserId, email);

    console.log('User profile activated successfully:', { cognitoUserId, email });

    // Return the event to continue the authentication flow
    return event;
  } catch (error) {
    console.error('Error in post-confirmation trigger:', error);
    
    // Don't throw - we don't want to block user authentication
    // The trigger is for housekeeping, not critical path
    return event;
  }
};

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
