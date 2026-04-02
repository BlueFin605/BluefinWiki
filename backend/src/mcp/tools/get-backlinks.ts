/**
 * MCP Tool: get_backlinks
 *
 * Find all pages that link to a given page.
 * Queries the page_links DynamoDB table using the targetGuid GSI.
 */

import { DynamoDBClient, QueryCommand } from '@aws-sdk/client-dynamodb';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { unmarshall } from '@aws-sdk/util-dynamodb';

const dynamodb = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const s3 = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
const linksTable = process.env.PAGE_LINKS_TABLE!;
const bucket = process.env.PAGES_BUCKET!;

interface BacklinkResult {
  sourceGuid: string;
  sourceTitle: string;
}

/**
 * Try to read a page's title from S3 by checking common key patterns.
 */
async function getPageTitle(guid: string): Promise<string> {
  // Try root-level first
  const rootKey = `${guid}/${guid}.md`;
  try {
    const result = await s3.send(new GetObjectCommand({
      Bucket: bucket,
      Key: rootKey,
      Range: 'bytes=0-2047',
    }));
    const content = await result.Body!.transformToString();
    const titleMatch = content.match(/^title:\s*["']?(.+?)["']?\s*$/m);
    return titleMatch ? titleMatch[1] : 'Untitled';
  } catch {
    return 'Unknown';
  }
}

/**
 * Get all pages that link to the given page GUID.
 */
export async function getBacklinks(pageGuid: string): Promise<BacklinkResult[]> {
  const result = await dynamodb.send(new QueryCommand({
    TableName: linksTable,
    IndexName: 'targetGuid-index',
    KeyConditionExpression: 'targetGuid = :targetGuid',
    ExpressionAttributeValues: {
      ':targetGuid': { S: pageGuid },
    },
  }));

  if (!result.Items || result.Items.length === 0) {
    return [];
  }

  const sourceGuids = result.Items.map(item => {
    const record = unmarshall(item);
    return record.sourceGuid as string;
  });

  // Resolve titles in parallel
  const backlinks = await Promise.all(
    sourceGuids.map(async (sourceGuid) => ({
      sourceGuid,
      sourceTitle: await getPageTitle(sourceGuid),
    }))
  );

  return backlinks;
}
