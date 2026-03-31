/**
 * Page Index Service
 *
 * Maintains a DynamoDB index mapping page GUIDs to their S3 keys.
 * Eliminates full bucket scans in findPageKey() — O(1) lookup instead of O(n).
 *
 * The index is maintained atomically with S3 writes (save, move, delete).
 * If the index is unavailable, callers should fall back to S3 scanning.
 */

import { DynamoDBClient, GetItemCommand, PutItemCommand, DeleteItemCommand, BatchWriteItemCommand, ScanCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';

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
  return process.env.DYNAMODB_PAGE_INDEX_TABLE || process.env.PAGE_INDEX_TABLE || 'bluefinwiki-page-index-local';
}

export interface PageIndexRecord {
  guid: string;
  s3Key: string;
  parentGuid: string | null;
  title: string;
  updatedAt: string;
}

/**
 * Look up an S3 key by page GUID.
 * Returns the S3 key if found, null if not in the index.
 * Throws only on DynamoDB errors (caller should fall back to S3 scan).
 */
export async function getPageKey(guid: string): Promise<string | null> {
  try {
    const result = await getDynamoClient().send(new GetItemCommand({
      TableName: getTableName(),
      Key: marshall({ guid }),
      ProjectionExpression: 's3Key',
    }));

    if (!result.Item) {
      return null;
    }

    const record = unmarshall(result.Item);
    return record.s3Key || null;
  } catch (error) {
    console.warn(`[PageIndex] Failed to read index for ${guid}:`, (error as Error).message);
    throw error;
  }
}

/**
 * Write or update a page's index entry.
 * Called after successful S3 writes (savePage, movePage).
 */
export async function putPageKey(record: PageIndexRecord): Promise<void> {
  try {
    await getDynamoClient().send(new PutItemCommand({
      TableName: getTableName(),
      Item: marshall({
        guid: record.guid,
        s3Key: record.s3Key,
        parentGuid: record.parentGuid || '',
        title: record.title,
        updatedAt: record.updatedAt,
      }, { removeUndefinedValues: true }),
    }));
  } catch (error) {
    // Index write failure should not block the primary operation
    console.error(`[PageIndex] Failed to write index for ${record.guid}:`, (error as Error).message);
  }
}

/**
 * Remove a page from the index.
 * Called after successful S3 deletes (deletePage).
 */
export async function deletePageKey(guid: string): Promise<void> {
  try {
    await getDynamoClient().send(new DeleteItemCommand({
      TableName: getTableName(),
      Key: marshall({ guid }),
    }));
  } catch (error) {
    console.error(`[PageIndex] Failed to delete index for ${guid}:`, (error as Error).message);
  }
}

/**
 * Batch delete multiple page index entries.
 * Used during recursive page deletion.
 */
export async function deletePageKeys(guids: string[]): Promise<void> {
  if (guids.length === 0) return;

  // DynamoDB batch write supports max 25 items
  const batches: string[][] = [];
  for (let i = 0; i < guids.length; i += 25) {
    batches.push(guids.slice(i, i + 25));
  }

  for (const batch of batches) {
    try {
      await getDynamoClient().send(new BatchWriteItemCommand({
        RequestItems: {
          [getTableName()]: batch.map(guid => ({
            DeleteRequest: {
              Key: marshall({ guid }),
            },
          })),
        },
      }));
    } catch (error) {
      console.error(`[PageIndex] Failed to batch delete ${batch.length} entries:`, (error as Error).message);
    }
  }
}

/**
 * Get all entries in the index.
 * Used for diagnostics and rebuild verification.
 */
export async function getAllEntries(): Promise<PageIndexRecord[]> {
  const entries: PageIndexRecord[] = [];
  let lastEvaluatedKey: ScanCommand["input"]["ExclusiveStartKey"];

  do {
    const result = await getDynamoClient().send(new ScanCommand({
      TableName: getTableName(),
      ExclusiveStartKey: lastEvaluatedKey,
    }));

    if (result.Items) {
      for (const item of result.Items) {
        const record = unmarshall(item) as PageIndexRecord;
        entries.push(record);
      }
    }

    lastEvaluatedKey = result.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  return entries;
}
