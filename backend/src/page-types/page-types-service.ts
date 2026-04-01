/**
 * Page Types Service
 *
 * Manages page type definitions stored in DynamoDB.
 * A page type defines a schema (required properties, allowed child types, icon)
 * that can be assigned to pages via the pageType frontmatter field.
 */

import {
  DynamoDBClient,
  PutItemCommand,
  GetItemCommand,
  ScanCommand,
  DeleteItemCommand,
  UpdateItemCommand,
} from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { PageTypeDefinition } from '../types/index.js';

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
  return process.env.DYNAMODB_PAGE_TYPES_TABLE || process.env.PAGE_TYPES_TABLE || 'bluefinwiki-page-types-local';
}

/**
 * List all page type definitions. Table is small enough to scan in MVP.
 */
export async function listPageTypes(): Promise<PageTypeDefinition[]> {
  const result = await getDynamoClient().send(new ScanCommand({
    TableName: getTableName(),
  }));

  if (!result.Items || result.Items.length === 0) {
    return [];
  }

  return result.Items.map(item => {
    const record = unmarshall(item) as Record<string, unknown>;
    return deserializePageType(record);
  }).sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Get a single page type definition by GUID.
 */
export async function getPageType(guid: string): Promise<PageTypeDefinition | null> {
  const result = await getDynamoClient().send(new GetItemCommand({
    TableName: getTableName(),
    Key: marshall({ guid }),
  }));

  if (!result.Item) {
    return null;
  }

  const record = unmarshall(result.Item) as Record<string, unknown>;
  return deserializePageType(record);
}

/**
 * Create a new page type definition.
 */
export async function createPageType(pageType: PageTypeDefinition): Promise<PageTypeDefinition> {
  const item = serializePageType(pageType);

  await getDynamoClient().send(new PutItemCommand({
    TableName: getTableName(),
    Item: marshall(item, { removeUndefinedValues: true }),
    ConditionExpression: 'attribute_not_exists(guid)',
  }));

  return pageType;
}

/**
 * Update an existing page type definition.
 * Only updates mutable fields (name, icon, properties, allowedChildTypes, allowWikiPageChildren, allowedParentTypes, allowAnyParent).
 */
export async function updatePageType(
  guid: string,
  updates: Partial<Pick<PageTypeDefinition, 'name' | 'icon' | 'properties' | 'allowedChildTypes' | 'allowWikiPageChildren' | 'allowedParentTypes' | 'allowAnyParent'>>
): Promise<PageTypeDefinition | null> {
  const expressionParts: string[] = [];
  const names: Record<string, string> = {};
  const values: Record<string, unknown> = {};

  if (updates.name !== undefined) {
    expressionParts.push('#n = :name');
    names['#n'] = 'name';
    values[':name'] = updates.name;
  }
  if (updates.icon !== undefined) {
    expressionParts.push('icon = :icon');
    values[':icon'] = updates.icon;
  }
  if (updates.properties !== undefined) {
    expressionParts.push('properties = :properties');
    values[':properties'] = JSON.stringify(updates.properties);
  }
  if (updates.allowedChildTypes !== undefined) {
    expressionParts.push('allowedChildTypes = :allowedChildTypes');
    values[':allowedChildTypes'] = JSON.stringify(updates.allowedChildTypes);
  }
  if (updates.allowWikiPageChildren !== undefined) {
    expressionParts.push('allowWikiPageChildren = :allowWikiPageChildren');
    values[':allowWikiPageChildren'] = updates.allowWikiPageChildren;
  }
  if (updates.allowedParentTypes !== undefined) {
    expressionParts.push('allowedParentTypes = :allowedParentTypes');
    values[':allowedParentTypes'] = JSON.stringify(updates.allowedParentTypes);
  }
  if (updates.allowAnyParent !== undefined) {
    expressionParts.push('allowAnyParent = :allowAnyParent');
    values[':allowAnyParent'] = updates.allowAnyParent;
  }

  if (expressionParts.length === 0) {
    return getPageType(guid);
  }

  const now = new Date().toISOString();
  expressionParts.push('updatedAt = :updatedAt');
  values[':updatedAt'] = now;

  const result = await getDynamoClient().send(new UpdateItemCommand({
    TableName: getTableName(),
    Key: marshall({ guid }),
    UpdateExpression: 'SET ' + expressionParts.join(', '),
    ...(Object.keys(names).length > 0 ? { ExpressionAttributeNames: names } : {}),
    ExpressionAttributeValues: marshall(values, { removeUndefinedValues: true }),
    ConditionExpression: 'attribute_exists(guid)',
    ReturnValues: 'ALL_NEW',
  }));

  if (!result.Attributes) {
    return null;
  }

  const record = unmarshall(result.Attributes) as Record<string, unknown>;
  return deserializePageType(record);
}

/**
 * Delete a page type definition. Does not affect pages already using this type.
 */
export async function deletePageType(guid: string): Promise<boolean> {
  try {
    await getDynamoClient().send(new DeleteItemCommand({
      TableName: getTableName(),
      Key: marshall({ guid }),
      ConditionExpression: 'attribute_exists(guid)',
    }));
    return true;
  } catch (err: unknown) {
    const error = err as { name?: string };
    if (error.name === 'ConditionalCheckFailedException') {
      return false;
    }
    throw err;
  }
}

/**
 * Get the allowed child type definitions for a given page type.
 */
export async function getAllowedChildTypes(guid: string): Promise<PageTypeDefinition[]> {
  const pageType = await getPageType(guid);
  if (!pageType || pageType.allowedChildTypes.length === 0) {
    return [];
  }

  // Fetch each allowed child type (small list, OK to do sequentially in MVP)
  const childTypes: PageTypeDefinition[] = [];
  for (const childGuid of pageType.allowedChildTypes) {
    const childType = await getPageType(childGuid);
    if (childType) {
      childTypes.push(childType);
    }
  }

  return childTypes;
}

/** Serialize a PageTypeDefinition for DynamoDB storage (JSON-encode complex fields). */
function serializePageType(pageType: PageTypeDefinition): Record<string, unknown> {
  return {
    guid: pageType.guid,
    name: pageType.name,
    icon: pageType.icon,
    properties: JSON.stringify(pageType.properties),
    allowedChildTypes: JSON.stringify(pageType.allowedChildTypes),
    allowWikiPageChildren: pageType.allowWikiPageChildren,
    allowedParentTypes: JSON.stringify(pageType.allowedParentTypes),
    allowAnyParent: pageType.allowAnyParent,
    createdBy: pageType.createdBy,
    createdAt: pageType.createdAt,
    updatedAt: pageType.updatedAt,
  };
}

/** Deserialize a DynamoDB record back into a PageTypeDefinition. */
function deserializePageType(record: Record<string, unknown>): PageTypeDefinition {
  return {
    guid: record.guid as string,
    name: record.name as string,
    icon: record.icon as string,
    properties: typeof record.properties === 'string'
      ? JSON.parse(record.properties)
      : (record.properties as PageTypeDefinition['properties']) || [],
    allowedChildTypes: typeof record.allowedChildTypes === 'string'
      ? JSON.parse(record.allowedChildTypes)
      : (record.allowedChildTypes as string[]) || [],
    allowWikiPageChildren: record.allowWikiPageChildren !== false,
    allowedParentTypes: typeof record.allowedParentTypes === 'string'
      ? JSON.parse(record.allowedParentTypes)
      : (record.allowedParentTypes as string[]) || [],
    allowAnyParent: record.allowAnyParent !== false,
    createdBy: record.createdBy as string,
    createdAt: record.createdAt as string,
    updatedAt: record.updatedAt as string,
  };
}
