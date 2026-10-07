/**
 * Link Extraction Service
 * 
 * Parses page content to extract wiki-style links ([[Page Title]]) 
 * and manages the page_links table for backlinks tracking.
 */

import { DynamoDBClient, PutItemCommand, QueryCommand, BatchWriteItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { publishChange } from '../realtime/broadcaster.js';

const dynamoClient = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
  ...(process.env.AWS_ENDPOINT && {
    endpoint: process.env.AWS_ENDPOINT,
    credentials: {
      accessKeyId: 'test',
      secretAccessKey: 'test',
    },
  }),
});

// Helper function to get the table name dynamically (allows tests to override via env vars)
function getPageLinksTable(): string {
  return process.env.DYNAMODB_PAGE_LINKS_TABLE || process.env.PAGE_LINKS_TABLE || 'bluefinwiki-page-links-local';
}

/**
 * Represents a wiki link found in page content
 */
export interface WikiLink {
  targetGuid: string;
  linkText: string;
}

/**
 * Represents a page link record in DynamoDB
 */
export interface PageLinkRecord {
  sourceGuid: string;
  targetGuid: string;
  linkText?: string;
  createdAt: string;
}

/**
 * Extract all wiki-style links from markdown content
 * Supports formats:
 * - [[Page Title]] -> resolve title to GUID
 * - [[guid:abc-123]] -> direct GUID reference
 * 
 * @param content - Markdown page content
 * @returns Array of wiki links with target GUIDs and link text
 */
export function extractWikiLinks(content: string): WikiLink[] {
  // Regex to match [[...]] wiki links
  const wikiLinkRegex = /\[\[([^\]]+)\]\]/g;
  const links: WikiLink[] = [];
  
  let match;
  while ((match = wikiLinkRegex.exec(content)) !== null) {
    const linkContent = match[1].trim();
    
    // Check if it's a GUID link format: [[guid:abc-123]]
    const guidMatch = linkContent.match(/^guid:([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i);
    
    if (guidMatch) {
      links.push({
        targetGuid: guidMatch[1],
        linkText: linkContent,
      });
    } else {
      // For title-based links, we'll need to resolve them later
      // For now, store the title as linkText and we'll resolve GUID elsewhere
      // This is a placeholder - actual resolution happens at the API layer
      links.push({
        targetGuid: '', // Will be resolved by caller
        linkText: linkContent,
      });
    }
  }
  
  return links;
}

/**
 * Save a link relationship to the page_links table
 * 
 * @param sourceGuid - GUID of the page containing the link
 * @param targetGuid - GUID of the page being linked to
 * @param linkText - Display text of the link
 */
export async function saveLinkRelationship(
  sourceGuid: string,
  targetGuid: string,
  linkText?: string
): Promise<void> {
  const now = new Date().toISOString();
  
  const record: PageLinkRecord = {
    sourceGuid: sourceGuid,
    targetGuid: targetGuid,
    linkText,
    createdAt: now,
  };
  
  const command = new PutItemCommand({
    TableName: getPageLinksTable(),
    Item: marshall(record),
  });
  
  await dynamoClient.send(command);
}

/**
 * Remove all link relationships originating from a source page
 * 
 * @param sourceGuid - GUID of the page whose links should be removed
 */
export async function removePageLinks(sourceGuid: string): Promise<void> {
  await deleteLinkRecords(await queryPageLinks(sourceGuid));
}

/** All link records originating from a source page. */
async function queryPageLinks(sourceGuid: string): Promise<PageLinkRecord[]> {
  const queryCommand = new QueryCommand({
    TableName: getPageLinksTable(),
    KeyConditionExpression: 'sourceGuid = :sourceGuid',
    ExpressionAttributeValues: marshall({
      ':sourceGuid': sourceGuid,
    }),
  });

  const queryResult = await dynamoClient.send(queryCommand);
  return (queryResult.Items ?? []).map(item => unmarshall(item) as PageLinkRecord);
}

async function deleteLinkRecords(items: PageLinkRecord[]): Promise<void> {
  // Delete in batches (max 25 per batch)
  for (let i = 0; i < items.length; i += 25) {
    const batch = items.slice(i, i + 25);
    
    const batchCommand = new BatchWriteItemCommand({
      RequestItems: {
        [getPageLinksTable()]: batch.map(item => ({
          DeleteRequest: {
            Key: marshall({
              sourceGuid: item.sourceGuid,
              targetGuid: item.targetGuid,
            }),
          },
        })),
      },
    });
    
    await dynamoClient.send(batchCommand);
  }
}

/**
 * Update all link relationships for a page
 * Removes stale links and adds new ones — or does nothing when the page's
 * resolved links (target + text) are unchanged, the common case for saves.
 *
 * @param sourceGuid - GUID of the page being updated
 * @param newLinks - Array of new wiki links to save
 */
export async function updatePageLinks(
  sourceGuid: string,
  newLinks: WikiLink[]
): Promise<void> {
  const existing = await queryPageLinks(sourceGuid);

  // Only links with resolved GUIDs are stored
  const validLinks = newLinks.filter(link => link.targetGuid && link.targetGuid.length > 0);

  if (sameLinks(existing, validLinks)) return;

  await deleteLinkRecords(existing);

  for (const link of validLinks) {
    await saveLinkRelationship(sourceGuid, link.targetGuid, link.linkText);
  }

  // Visible page saves publish an upsert, not backlinks:any, so this is the
  // signal for other tabs to refetch backlinks — sent once the index is written.
  await publishChange(['backlinks:any']);
}

/** Same targets with the same text. Later duplicates win, as the PutItems would. */
function sameLinks(existing: PageLinkRecord[], next: WikiLink[]): boolean {
  const want = new Map(next.map(link => [link.targetGuid, link.linkText ?? '']));
  return existing.length === want.size &&
    existing.every(record => want.get(record.targetGuid) === (record.linkText ?? ''));
}

/**
 * Get all pages that link to a target page (backlinks)
 * 
 * @param targetGuid - GUID of the page to find backlinks for
 * @returns Array of page link records
 */
export async function getBacklinks(targetGuid: string): Promise<PageLinkRecord[]> {
  const command = new QueryCommand({
    TableName: getPageLinksTable(),
    IndexName: 'targetGuid-index',
    KeyConditionExpression: 'targetGuid = :targetGuid',
    ExpressionAttributeValues: marshall({
      ':targetGuid': targetGuid,
    }),
  });
  
  const result = await dynamoClient.send(command);
  
  if (!result.Items || result.Items.length === 0) {
    return [];
  }
  
  return result.Items.map(item => unmarshall(item) as PageLinkRecord);
}

/**
 * Get all outbound links from a source page
 * 
 * @param sourceGuid - GUID of the page to find outbound links for
 * @returns Array of page link records
 */
export async function getOutboundLinks(sourceGuid: string): Promise<PageLinkRecord[]> {
  const command = new QueryCommand({
    TableName: getPageLinksTable(),
    KeyConditionExpression: 'sourceGuid = :sourceGuid',
    ExpressionAttributeValues: marshall({
      ':sourceGuid': sourceGuid,
    }),
  });
  
  const result = await dynamoClient.send(command);
  
  if (!result.Items || result.Items.length === 0) {
    return [];
  }
  
  return result.Items.map(item => unmarshall(item) as PageLinkRecord);
}
