import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';

const ACTIVITY_LOG_TABLE = process.env.ACTIVITY_LOG_TABLE || process.env.DYNAMODB_ACTIVITY_LOG_TABLE || 'bluefinwiki-activity-log-local';
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';

const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region: AWS_REGION }));

/**
 * Log an activity event to the activity_log DynamoDB table.
 *
 * Fire-and-forget: errors are caught and logged but never thrown,
 * so activity logging never blocks the primary action.
 */
export async function logActivity(
  userId: string,
  action: string,
  resourceType: string,
  resourceGuid?: string,
  details?: Record<string, unknown>,
): Promise<void> {
  try {
    const now = new Date().toISOString();
    const ttl = Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60; // 90 days

    await dynamoClient.send(new PutCommand({
      TableName: ACTIVITY_LOG_TABLE,
      Item: {
        userId,
        timestamp: now,
        action,
        resourceType,
        ...(resourceGuid && { resourceGuid }),
        ...(details && { details }),
        createdAt: now,
        ttl,
      },
    }));
  } catch (error) {
    console.error('Failed to log activity:', error);
  }
}
