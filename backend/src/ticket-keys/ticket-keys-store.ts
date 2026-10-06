/**
 * Ticket keys table: per-prefix counters (`seq#BGT`) and write-once
 * key → page GUID mappings (`key#BGT-12`). See the ticket-keys design spec.
 */

import {
  DynamoDBClient,
  UpdateItemCommand,
  PutItemCommand,
  GetItemCommand,
  ConditionalCheckFailedException,
} from '@aws-sdk/client-dynamodb';

let _dynamoClient: DynamoDBClient | null = null;

function getDynamoClient(): DynamoDBClient {
  if (!_dynamoClient) {
    const endpoint = process.env.AWS_ENDPOINT_URL || process.env.AWS_ENDPOINT;
    _dynamoClient = new DynamoDBClient({
      region: process.env.AWS_REGION || 'us-east-1',
      ...(endpoint && {
        endpoint,
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'test',
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'test',
        },
      }),
    });
  }
  return _dynamoClient;
}

function getTableName(): string {
  return process.env.TICKET_KEYS_TABLE || process.env.DYNAMODB_TICKET_KEYS_TABLE || 'bluefinwiki-ticket-keys-local';
}

export async function allocateNumber(prefix: string): Promise<number> {
  const res = await getDynamoClient().send(new UpdateItemCommand({
    TableName: getTableName(),
    Key: { id: { S: `seq#${prefix}` } },
    UpdateExpression: 'ADD #next :one',
    ExpressionAttributeNames: { '#next': 'next' },
    ExpressionAttributeValues: { ':one': { N: '1' } },
    ReturnValues: 'UPDATED_NEW',
  }));
  return Number(res.Attributes!.next.N);
}

/** key must already be canonical (upper-cased). */
export async function getMapping(key: string): Promise<string | null> {
  const res = await getDynamoClient().send(new GetItemCommand({
    TableName: getTableName(),
    Key: { id: { S: `key#${key}` } },
  }));
  return res.Item?.guid?.S ?? null;
}

/** Write-once mapping; throws if the key already maps to a different guid. */
export async function putMapping(key: string, guid: string): Promise<'created' | 'exists'> {
  try {
    await getDynamoClient().send(new PutItemCommand({
      TableName: getTableName(),
      Item: { id: { S: `key#${key}` }, guid: { S: guid }, createdAt: { S: new Date().toISOString() } },
      ConditionExpression: 'attribute_not_exists(id)',
    }));
    return 'created';
  } catch (err) {
    if (!(err instanceof ConditionalCheckFailedException)) throw err;
    const existing = await getMapping(key);
    if (existing === guid) return 'exists';
    throw new Error(`${key} already maps to ${existing}`);
  }
}
