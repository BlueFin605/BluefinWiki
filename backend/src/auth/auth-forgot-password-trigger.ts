/**
 * Cognito Pre-Forgot Password Trigger
 * 
 * This Lambda function is triggered before Cognito processes a forgot password request.
 * Used for custom logic like logging, rate limiting, and security monitoring.
 * 
 * Trigger: Cognito User Pool - CustomMessage_ForgotPassword
 */

import { PreAuthenticationTriggerHandler } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';

const dynamoClient = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
  ...(process.env.AWS_ENDPOINT && { endpoint: process.env.AWS_ENDPOINT }),
});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const ACTIVITY_LOG_TABLE = process.env.DYNAMODB_ACTIVITY_LOG_TABLE || 'bluefinwiki-activity-log-local';

// Rate limiting: Max 3 password reset requests per hour per user
const MAX_RESET_ATTEMPTS = 3;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

interface PasswordResetAttempt {
  userId: string;
  timestamp: number;
  action: string;
  resourceType: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Log password reset request for security monitoring
 */
async function logPasswordResetRequest(
  userId: string,
  email: string,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  const timestamp = Date.now();
  const ttl = Math.floor(timestamp / 1000) + (90 * 24 * 60 * 60); // 90 days retention

  const logEntry: PasswordResetAttempt = {
    userId,
    timestamp,
    action: 'PASSWORD_RESET_REQUESTED',
    resourceType: 'AUTH',
    ipAddress,
    userAgent,
  };

  await docClient.send(
    new PutCommand({
      TableName: ACTIVITY_LOG_TABLE,
      Item: {
        ...logEntry,
        ttl,
        email,
        details: {
          event: 'forgot_password',
          timestamp: new Date(timestamp).toISOString(),
        },
      },
    })
  );

  console.log(`Password reset requested for user: ${userId} (${email})`);
}

/**
 * Check rate limiting: Count reset attempts in the last hour
 */
async function checkRateLimit(userId: string): Promise<boolean> {
  const oneHourAgo = Date.now() - RATE_LIMIT_WINDOW_MS;

  const result = await docClient.send(
    new QueryCommand({
      TableName: ACTIVITY_LOG_TABLE,
      KeyConditionExpression: 'userId = :userId AND #ts > :timestamp',
      FilterExpression: '#action = :action',
      ExpressionAttributeNames: {
        '#ts': 'timestamp',
        '#action': 'action',
      },
      ExpressionAttributeValues: {
        ':userId': userId,
        ':timestamp': oneHourAgo,
        ':action': 'PASSWORD_RESET_REQUESTED',
      },
    })
  );

  const attemptCount = result.Items?.length || 0;
  
  if (attemptCount >= MAX_RESET_ATTEMPTS) {
    console.warn(`Rate limit exceeded for user: ${userId} (${attemptCount} attempts in last hour)`);
    return false;
  }

  return true;
}

/**
 * Cognito Pre-Forgot Password Trigger Handler
 * 
 * Note: This is invoked as a CustomMessage trigger, not PreForgotPassword
 * Cognito doesn't have a specific pre-forgot-password trigger, so we use CustomMessage
 */
export const handler: PreAuthenticationTriggerHandler = async (event) => {
  console.log('Forgot Password Trigger Event:', JSON.stringify(event, null, 2));

  try {
    const userId = event.request.userAttributes.sub;
    const email = event.request.userAttributes.email;
    // Note: userContextData may not be available in all Cognito triggers
    const ipAddress = event.request?.clientMetadata?.sourceIp;
    const userAgent = event.request?.clientMetadata?.userAgent;

    // Check rate limiting
    const isAllowed = await checkRateLimit(userId);
    if (!isAllowed) {
      throw new Error('Too many password reset requests. Please try again in an hour.');
    }

    // Log the password reset request for security monitoring
    await logPasswordResetRequest(userId, email, ipAddress, userAgent);

    // Return the event unchanged (Cognito will proceed with forgot password flow)
    return event;
  } catch (error) {
    console.error('Error in forgot password trigger:', error);
    throw error;
  }
};
