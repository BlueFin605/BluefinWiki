/**
 * MCP Tool: list_page_types
 *
 * List all page type definitions with their property schemas.
 * Page types define what properties a page should have (e.g., a "TV Show" type has rating, genre, status).
 */

import { DynamoDBClient, ScanCommand } from '@aws-sdk/client-dynamodb';
import { unmarshall } from '@aws-sdk/util-dynamodb';

const dynamodb = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const tableName = process.env.PAGE_TYPES_TABLE!;

interface PageTypeProperty {
  name: string;
  type: string;
  required: boolean;
  defaultValue?: string | number | string[];
}

interface PageType {
  guid: string;
  name: string;
  icon: string;
  properties: PageTypeProperty[];
  allowedChildTypes: string[];
}

// Module-level cache for warm Lambda invocations
let cachedTypes: PageType[] | null = null;

/**
 * List all page type definitions.
 */
export async function listPageTypes(): Promise<PageType[]> {
  if (cachedTypes) return cachedTypes;

  const result = await dynamodb.send(new ScanCommand({
    TableName: tableName,
  }));

  if (!result.Items || result.Items.length === 0) {
    cachedTypes = [];
    return cachedTypes;
  }

  cachedTypes = result.Items.map(item => {
    const record = unmarshall(item) as Record<string, unknown>;
    return {
      guid: record.guid as string,
      name: record.name as string,
      icon: record.icon as string,
      properties: typeof record.properties === 'string'
        ? JSON.parse(record.properties)
        : (record.properties as PageTypeProperty[]) || [],
      allowedChildTypes: typeof record.allowedChildTypes === 'string'
        ? JSON.parse(record.allowedChildTypes)
        : (record.allowedChildTypes as string[]) || [],
    };
  }).sort((a, b) => a.name.localeCompare(b.name));

  return cachedTypes;
}
