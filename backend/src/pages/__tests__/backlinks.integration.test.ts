/**
 * Integration Tests for Backlinks Functionality
 * Task 6.4: Backlinks Tracking
 * 
 * Tests link extraction, storage, and backlinks retrieval
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { extractWikiLinks, saveLinkRelationship, getBacklinks, updatePageLinks, removePageLinks } from '../link-extraction.js';
import { DynamoDBClient, DeleteTableCommand, CreateTableCommand } from '@aws-sdk/client-dynamodb';
import { v4 as uuidv4 } from 'uuid';

// LocalStack DynamoDB for testing
const dynamoClient = new DynamoDBClient({
  region: 'us-east-1',
  endpoint: process.env.AWS_ENDPOINT || 'http://localhost:4566',
  credentials: {
    accessKeyId: 'test',
    secretAccessKey: 'test',
  },
});

const TEST_TABLE = 'bluefinwiki-page-links-test';

describe('Backlinks Functionality', () => {
  beforeEach(async () => {
    // Create test table
    try {
      await dynamoClient.send(new DeleteTableCommand({ TableName: TEST_TABLE }));
      // Wait for table to be deleted
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (err) {
      // Table might not exist, ignore error
    }

    await dynamoClient.send(new CreateTableCommand({
      TableName: TEST_TABLE,
      KeySchema: [
        { AttributeName: 'sourceGuid', KeyType: 'HASH' },
        { AttributeName: 'targetGuid', KeyType: 'RANGE' },
      ],
      AttributeDefinitions: [
        { AttributeName: 'sourceGuid', AttributeType: 'S' },
        { AttributeName: 'targetGuid', AttributeType: 'S' },
      ],
      GlobalSecondaryIndexes: [
        {
          IndexName: 'targetGuid-index',
          KeySchema: [{ AttributeName: 'targetGuid', KeyType: 'HASH' }],
          Projection: { ProjectionType: 'ALL' },
        },
      ],
      BillingMode: 'PAY_PER_REQUEST',
    }));

    // Wait for table to be ready
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Override environment variable for tests
    process.env.DYNAMODB_PAGE_LINKS_TABLE = TEST_TABLE;
  });

  afterEach(async () => {
    // Clean up test table
    try {
      await dynamoClient.send(new DeleteTableCommand({ TableName: TEST_TABLE }));
    } catch (err) {
      // Ignore cleanup errors
    }
  });

  describe('extractWikiLinks', () => {
    it('should extract single GUID link', () => {
      const content = 'Check out [[guid:12345678-1234-4123-8123-123456789abc]] for more info.';
      const links = extractWikiLinks(content);

      expect(links).toHaveLength(1);
      expect(links[0].targetGuid).toBe('12345678-1234-4123-8123-123456789abc');
    });

    it('should extract multiple GUID links', () => {
      const content = `
        See [[guid:12345678-1234-4123-8123-123456789abc]] and
        also [[guid:87654321-4321-4321-8321-abcdef123456]].
      `;
      const links = extractWikiLinks(content);

      expect(links).toHaveLength(2);
      expect(links[0].targetGuid).toBe('12345678-1234-4123-8123-123456789abc');
      expect(links[1].targetGuid).toBe('87654321-4321-4321-8321-abcdef123456');
    });

    it('should extract title-based links (without GUID)', () => {
      const content = 'See [[Related Page]] for details.';
      const links = extractWikiLinks(content);

      expect(links).toHaveLength(1);
      expect(links[0].linkText).toBe('Related Page');
      expect(links[0].targetGuid).toBe(''); // Not resolved yet
    });

    it('should handle mixed GUID and title links', () => {
      const content = `
        Check [[guid:12345678-1234-4123-8123-123456789abc]] and [[Another Page]].
      `;
      const links = extractWikiLinks(content);

      expect(links).toHaveLength(2);
      expect(links[0].targetGuid).toBe('12345678-1234-4123-8123-123456789abc');
      expect(links[1].linkText).toBe('Another Page');
    });

    it('should handle empty content', () => {
      const links = extractWikiLinks('');
      expect(links).toHaveLength(0);
    });

    it('should ignore invalid GUID format', () => {
      const content = 'Not a link: [[guid:invalid-format]]';
      const links = extractWikiLinks(content);

      expect(links).toHaveLength(1);
      expect(links[0].linkText).toBe('guid:invalid-format');
      expect(links[0].targetGuid).toBe(''); // Invalid GUID not extracted
    });
  });

  describe('saveLinkRelationship', () => {
    it('should save link relationship', async () => {
      const sourceGuid = uuidv4();
      const targetGuid = uuidv4();

      await saveLinkRelationship(sourceGuid, targetGuid, 'Test Link');

      // Verify by querying backlinks
      const backlinks = await getBacklinks(targetGuid);
      expect(backlinks).toHaveLength(1);
      expect(backlinks[0].sourceGuid).toBe(sourceGuid);
      expect(backlinks[0].targetGuid).toBe(targetGuid);
      expect(backlinks[0].linkText).toBe('Test Link');
    });
  });

  describe('getBacklinks', () => {
    it('should return empty array when no backlinks exist', async () => {
      const targetGuid = uuidv4();
      const backlinks = await getBacklinks(targetGuid);
      expect(backlinks).toHaveLength(0);
    });

    it('should return all pages linking to target', async () => {
      const targetGuid = uuidv4();
      const source1 = uuidv4();
      const source2 = uuidv4();
      const source3 = uuidv4();

      await saveLinkRelationship(source1, targetGuid, 'Link 1');
      await saveLinkRelationship(source2, targetGuid, 'Link 2');
      await saveLinkRelationship(source3, targetGuid, 'Link 3');

      const backlinks = await getBacklinks(targetGuid);
      expect(backlinks).toHaveLength(3);

      const sourceGuids = backlinks.map(link => link.sourceGuid).sort();
      expect(sourceGuids).toEqual([source1, source2, source3].sort());
    });
  });

  describe('updatePageLinks', () => {
    it('should add new links', async () => {
      const sourceGuid = uuidv4();
      const target1 = uuidv4();
      const target2 = uuidv4();

      const links = [
        { targetGuid: target1, linkText: 'Link 1' },
        { targetGuid: target2, linkText: 'Link 2' },
      ];

      await updatePageLinks(sourceGuid, links);

      const backlinks1 = await getBacklinks(target1);
      const backlinks2 = await getBacklinks(target2);

      expect(backlinks1).toHaveLength(1);
      expect(backlinks1[0].sourceGuid).toBe(sourceGuid);

      expect(backlinks2).toHaveLength(1);
      expect(backlinks2[0].sourceGuid).toBe(sourceGuid);
    });

    it('should remove stale links and add new ones', async () => {
      const sourceGuid = uuidv4();
      const oldTarget = uuidv4();
      const newTarget = uuidv4();

      // Add initial link
      await updatePageLinks(sourceGuid, [
        { targetGuid: oldTarget, linkText: 'Old Link' },
      ]);

      // Update with new link
      await updatePageLinks(sourceGuid, [
        { targetGuid: newTarget, linkText: 'New Link' },
      ]);

      const oldBacklinks = await getBacklinks(oldTarget);
      const newBacklinks = await getBacklinks(newTarget);

      expect(oldBacklinks).toHaveLength(0); // Old link removed
      expect(newBacklinks).toHaveLength(1); // New link added
      expect(newBacklinks[0].sourceGuid).toBe(sourceGuid);
    });

    it('should handle empty links array', async () => {
      const sourceGuid = uuidv4();
      const targetGuid = uuidv4();

      // Add initial link
      await updatePageLinks(sourceGuid, [
        { targetGuid, linkText: 'Link' },
      ]);

      // Remove all links
      await updatePageLinks(sourceGuid, []);

      const backlinks = await getBacklinks(targetGuid);
      expect(backlinks).toHaveLength(0);
    });

    it('should skip links with empty GUID', async () => {
      const sourceGuid = uuidv4();
      const validTarget = uuidv4();

      const links = [
        { targetGuid: validTarget, linkText: 'Valid Link' },
        { targetGuid: '', linkText: 'Unresolved Link' },
      ];

      await updatePageLinks(sourceGuid, links);

      const backlinks = await getBacklinks(validTarget);
      expect(backlinks).toHaveLength(1);
    });
  });

  describe('removePageLinks', () => {
    it('should remove all links from source page', async () => {
      const sourceGuid = uuidv4();
      const target1 = uuidv4();
      const target2 = uuidv4();

      await saveLinkRelationship(sourceGuid, target1, 'Link 1');
      await saveLinkRelationship(sourceGuid, target2, 'Link 2');

      await removePageLinks(sourceGuid);

      const backlinks1 = await getBacklinks(target1);
      const backlinks2 = await getBacklinks(target2);

      expect(backlinks1).toHaveLength(0);
      expect(backlinks2).toHaveLength(0);
    });

    it('should handle removing links from page with no links', async () => {
      const sourceGuid = uuidv4();
      await expect(removePageLinks(sourceGuid)).resolves.not.toThrow();
    });
  });

  describe('End-to-End Link Management', () => {
    it('should track links across multiple page updates', async () => {
      const page1 = uuidv4();
      const page2 = uuidv4();
      const page3 = uuidv4();

      // Page 1 links to Page 2
      const content1 = `Check out [[guid:${page2}]] for details.`;
      const links1 = extractWikiLinks(content1);
      await updatePageLinks(page1, links1);

      // Page 3 also links to Page 2
      const content3 = `See [[guid:${page2}]] and more.`;
      const links3 = extractWikiLinks(content3);
      await updatePageLinks(page3, links3);

      // Page 2 should have 2 backlinks
      const backlinks = await getBacklinks(page2);
      expect(backlinks).toHaveLength(2);

      const sourceGuids = backlinks.map(link => link.sourceGuid).sort();
      expect(sourceGuids).toEqual([page1, page3].sort());
    });
  });
});
