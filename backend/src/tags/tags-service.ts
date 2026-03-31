/**
 * Tags Vocabulary Service
 *
 * Manages the shared tag vocabulary stored in DynamoDB.
 * Tags are scoped by property name (or "_page" for page-level tags),
 * so each property gets its own autocomplete vocabulary.
 * Tags are auto-registered when used in page properties (type: tags)
 * or as page-level tags, and can be listed for autocomplete in the frontend.
 */

import {
  DynamoDBClient,
  PutItemCommand,
  QueryCommand,
  UpdateItemCommand,
} from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { PageProperty } from '../types/index.js';

/** Scope used for page-level tags (the top-level `tags` field in frontmatter) */
export const PAGE_TAGS_SCOPE = '_page';

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
  scope: string;
  tag: string;
  createdAt: string;
  createdBy: string;
  usageCount: number;
}

/**
 * List all tags for a given scope, sorted alphabetically.
 * Uses a DynamoDB Query on the partition key (scope) instead of a Scan.
 */
export async function listTags(scope: string): Promise<TagRecord[]> {
  const result = await getDynamoClient().send(new QueryCommand({
    TableName: getTableName(),
    KeyConditionExpression: '#s = :scope',
    ExpressionAttributeNames: { '#s': 'scope' },
    ExpressionAttributeValues: marshall({ ':scope': scope }),
  }));

  if (!result.Items || result.Items.length === 0) {
    return [];
  }

  return (result.Items.map(item => unmarshall(item)) as TagRecord[])
    .sort((a, b) => a.tag.localeCompare(b.tag));
}

/**
 * Create or update a tag in the vocabulary for a given scope.
 * If the tag already exists, increments its usage count.
 */
export async function registerTag(scope: string, tagName: string, userId: string): Promise<void> {
  const tag = tagName.toLowerCase().trim();
  if (!tag) return;

  const now = new Date().toISOString();

  await getDynamoClient().send(new UpdateItemCommand({
    TableName: getTableName(),
    Key: marshall({ scope, tag }),
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
export async function createTag(scope: string, tagName: string, userId: string): Promise<TagRecord> {
  const tag = tagName.toLowerCase().trim();
  if (!tag) throw new Error('Tag name is required');

  const now = new Date().toISOString();
  const record: TagRecord = {
    scope,
    tag,
    createdAt: now,
    createdBy: userId,
    usageCount: 0,
  };

  await getDynamoClient().send(new PutItemCommand({
    TableName: getTableName(),
    Item: marshall(record),
    ConditionExpression: 'attribute_not_exists(#s) AND attribute_not_exists(tag)',
    ExpressionAttributeNames: { '#s': 'scope' },
  }));

  return record;
}

/**
 * Auto-register all tags found in a page's custom properties.
 * Each tag is registered under its property name as scope.
 * Best-effort: failures are logged but don't block page saves.
 */
export async function autoRegisterTagsFromProperties(
  properties: Record<string, PageProperty>,
  userId: string
): Promise<void> {
  const registrations: Promise<void>[] = [];

  for (const [propertyName, prop] of Object.entries(properties)) {
    if (prop.type === 'tags' && Array.isArray(prop.value)) {
      const uniqueTags = [...new Set(
        (prop.value as string[]).map(t => t.toLowerCase().trim()).filter(Boolean)
      )];
      for (const tag of uniqueTags) {
        registrations.push(registerTag(propertyName, tag, userId));
      }
    }
  }

  if (registrations.length > 0) {
    await Promise.all(registrations);
  }
}

/**
 * Auto-register page-level tags (the top-level `tags` field).
 * Uses the special scope "_page".
 * Best-effort: failures are logged but don't block page saves.
 */
export async function autoRegisterPageTags(
  tags: string[],
  userId: string
): Promise<void> {
  if (!tags || tags.length === 0) return;

  const uniqueTags = [...new Set(tags.map(t => t.toLowerCase().trim()).filter(Boolean))];
  await Promise.all(uniqueTags.map(tag => registerTag(PAGE_TAGS_SCOPE, tag, userId)));
}
