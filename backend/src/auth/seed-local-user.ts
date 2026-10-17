import type { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { isLocalMode, LOCAL_DEV_USER } from './local-mode.js';

/**
 * Local dev seed: make sure the profile behind `mock-jwt-token`
 * (`local-dev-user-id`) has an email, role and status, so the admin user
 * endpoints see a real Admin. Only fills attributes that are missing
 * (`if_not_exists`), so a profile edited by hand keeps its values.
 * No-op outside local mode.
 */
export async function seedLocalDevUser(
  client: DynamoDBClient,
  tableName: string,
): Promise<boolean> {
  if (!isLocalMode()) return false;
  const doc = DynamoDBDocumentClient.from(client);
  const now = new Date().toISOString();
  await doc.send(new UpdateCommand({
    TableName: tableName,
    Key: { cognitoUserId: LOCAL_DEV_USER.cognitoUserId },
    UpdateExpression:
      'SET #email = if_not_exists(#email, :email), #role = if_not_exists(#role, :role), '
      + '#status = if_not_exists(#status, :status), #displayName = if_not_exists(#displayName, :displayName), '
      + '#createdAt = if_not_exists(#createdAt, :now), #updatedAt = :now',
    ExpressionAttributeNames: {
      '#email': 'email',
      '#role': 'role',
      '#status': 'status',
      '#displayName': 'displayName',
      '#createdAt': 'createdAt',
      '#updatedAt': 'updatedAt',
    },
    ExpressionAttributeValues: {
      ':email': LOCAL_DEV_USER.email,
      ':role': LOCAL_DEV_USER.role,
      ':status': LOCAL_DEV_USER.status,
      ':displayName': LOCAL_DEV_USER.displayName,
      ':now': now,
    },
  }));
  return true;
}
