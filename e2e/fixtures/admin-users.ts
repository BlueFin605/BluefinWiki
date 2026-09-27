import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';

/**
 * Seeds/deletes rows directly in the local `bluefinwiki-user-profiles-local`
 * DynamoDB table (via LocalStack), bypassing `POST /auth/register` which
 * hard-depends on Cognito's `AdminCreateUserCommand` and 500s locally (no
 * Cognito in LocalStack). Client config and table name mirror
 * `aspire/scripts/seed-data.js`.
 *
 * NOTE: the table's partition key is `cognitoUserId`, not `userId` --
 * confirmed against `aspire/scripts/init-dynamodb.js` (KeySchema) and
 * `backend/src/auth/admin-users-list.ts` / `admin-users-delete.ts`, which
 * read/write `profile.cognitoUserId` and map it to `userId` only in the API
 * response shape.
 */

const ddb = DynamoDBDocumentClient.from(
  new DynamoDBClient({
    endpoint: 'http://localhost:4566',
    region: 'us-east-1',
    credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
  }),
);

const TABLE = 'bluefinwiki-user-profiles-local';

export async function seedDeletedUser(runId: string): Promise<{ userId: string; displayName: string }> {
  const userId = `e2e-${runId}`;
  const displayName = `E2E Deleted User ${runId}`;
  await ddb.send(
    new PutCommand({
      TableName: TABLE,
      Item: {
        cognitoUserId: userId,
        email: `${userId}@example.invalid`,
        displayName,
        role: 'Standard',
        status: 'deleted',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    }),
  );
  return { userId, displayName };
}

export async function deleteSeededUser(userId: string): Promise<void> {
  await ddb.send(new DeleteCommand({ TableName: TABLE, Key: { cognitoUserId: userId } }));
}
