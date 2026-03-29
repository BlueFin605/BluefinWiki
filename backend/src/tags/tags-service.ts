/**
 * Tags Vocabulary Service
 *
 * Manages the shared tag vocabulary stored in DynamoDB.
 * Tags are auto-registered when used in page properties (type: tags),
 * and can be listed for autocomplete in the frontend.
 */

import {
  DynamoDBClient,
  PutItemCommand,
  ScanCommand,
  UpdateItemCommand,
} from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { PageProperty } from '../types/index.js';

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
  return process.env.DYNAMODB_TAGS_TABLE || process.env.TAGS_TABLE || 'bluefinwiki-tags-local';
}

export interface TagRecord {
  tag: string;
  createdAt: string;
  createdBy: string;
  usageCount: number;
}

/**
 * List all tags from the vocabulary, sorted alphabetically.
 */
export async function listTags(): Promise<TagRecord[]> {
  const result = await getDynamoClient().send(new ScanCommand({
    TableName: getTableName(),
  }));

  if (!result.Items || result.Items.length === 0) {
    return [];
  }

  return (result.Items.map(item => unmarshall(item)) as TagRecord[])
    .sort((a, b) => a.tag.localeCompare(b.tag));
}

/**
 * Create or update a tag in the vocabulary.
 * If the tag already exists, increments its usage count.
 */
export async function registerTag(tagName: string, userId: string): Promise<void> {
  const tag = tagName.toLowerCase().trim();
  if (!tag) return;

  const now = new Date().toISOString();

  await getDynamoClient().send(new UpdateItemCommand({
    TableName: getTableName(),
    Key: marshall({ tag }),
    UpdateExpression: 'SET createdAt = if_not_exists(createdAt, :now), createdBy = if_not_exists(createdBy, :userId), usageCount = if_not_exists(usageCount, :zero) + :one',
    ExpressionAttributeValues: marshall({
      ':now': now,
      ':userId': userId,
      ':zero': 0,
      ':one': 1,
    }),
  }));
}

/**
 * Create a tag explicitly (admin). Same as registerTag but uses PutItem
 * to set initial values without incrementing.
 */
export async function createTag(tagName: string, userId: string): Promise<TagRecord> {
  const tag = tagName.toLowerCase().trim();
  if (!tag) throw new Error('Tag name is required');

  const now = new Date().toISOString();
  const record: TagRecord = {
    tag,
    createdAt: now,
    createdBy: userId,
    usageCount: 0,
  };

  await getDynamoClient().send(new PutItemCommand({
    TableName: getTableName(),
    Item: marshall(record),
    ConditionExpression: 'attribute_not_exists(tag)',
  }));

  return record;
}

/**
 * Auto-register all tags found in a page's properties.
 * Best-effort: failures are logged but don't block page saves.
 */
export async function autoRegisterTagsFromProperties(
  properties: Record<string, PageProperty>,
  userId: string
): Promise<void> {
  const tagValues: string[] = [];

  for (const prop of Object.values(properties)) {
    if (prop.type === 'tags' && Array.isArray(prop.value)) {
      tagValues.push(...prop.value);
    }
  }

  if (tagValues.length === 0) return;

  // Deduplicate
  const uniqueTags = [...new Set(tagValues.map(t => t.toLowerCase().trim()).filter(Boolean))];

  await Promise.all(uniqueTags.map(tag => registerTag(tag, userId)));
}
