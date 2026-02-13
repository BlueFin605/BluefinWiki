/**
 * Integration Tests: links-resolve Lambda
 * Tests the link resolution service with fuzzy matching and confidence scoring
 * 
 * These tests require LocalStack to be running.
 * Run with: npm run test:integration -- links-resolve
 */

// Set LocalStack endpoint BEFORE importing any modules that create AWS clients
process.env.AWS_ENDPOINT = process.env.AWS_ENDPOINT || 'http://localhost:4566';
process.env.LOCALSTACK_ENDPOINT = process.env.LOCALSTACK_ENDPOINT || 'http://localhost:4566';
process.env.AWS_REGION = 'us-east-1';
// Mock Cognito environment variables to avoid JWT verification errors
process.env.AWS_COGNITO_USER_POOL_ID = 'us-east-1_TESTPOOL';
process.env.AWS_COGNITO_CLIENT_ID = 'test-client-id';

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { randomUUID } from 'crypto';
import { S3StoragePlugin } from '../../storage/S3StoragePlugin.js';
import { StoragePluginRegistry, initializeStoragePlugin, resetStoragePlugin } from '../../storage/StoragePluginRegistry.js';
import { PageContent } from '../../types/index.js';
import {
  S3Client,
  CreateBucketCommand,
  PutBucketVersioningCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} from '@aws-sdk/client-s3';

// LocalStack endpoint
const LOCALSTACK_ENDPOINT = process.env.LOCALSTACK_ENDPOINT || 'http://localhost:4566';
const TEST_BUCKET = 'bluefinwiki-test-links';
const TEST_REGION = 'us-east-1';


describe('links-resolve Lambda Integration Tests', () => {
  const testUserId = 'test-user-001';
  let plugin: S3StoragePlugin;
  let s3Client: S3Client;

  // Test page GUIDs
  let rootPageGuid: string;
  let childPageGuid: string;
  let ambiguousPage1Guid: string;
  let ambiguousPage2Guid: string;

  beforeAll(async () => {
    // Register S3 plugin with the registry
    StoragePluginRegistry.register('s3', S3StoragePlugin);
    
    // Initialize S3 client for LocalStack
    s3Client = new S3Client({
      region: TEST_REGION,
      endpoint: LOCALSTACK_ENDPOINT,
      forcePathStyle: true,
      credentials: {
        accessKeyId: 'test',
        secretAccessKey: 'test',
      },
    });

    // Create test bucket
    try {
      await s3Client.send(new CreateBucketCommand({ Bucket: TEST_BUCKET }));
      await s3Client.send(new PutBucketVersioningCommand({
        Bucket: TEST_BUCKET,
        VersioningConfiguration: {
          Status: 'Enabled',
        },
      }));
    } catch (error: any) {
      if (error.name !== 'BucketAlreadyOwnedByYou') {
        console.error('Failed to create test bucket:', error);
      }
    }

    // Register S3 plugin with the registry and initialize it globally
    plugin = initializeStoragePlugin({
      type: 's3',
      bucketName: TEST_BUCKET,
      region: TEST_REGION,
      endpoint: LOCALSTACK_ENDPOINT,
    }) as S3StoragePlugin;

    // Create test pages
    rootPageGuid = randomUUID();
    await plugin.savePage(rootPageGuid, null, {
      guid: rootPageGuid,
      title: 'Getting Started Guide',
      content: 'This is a guide for getting started.',
      folderId: '',
      tags: [],
      status: 'published',
      createdBy: testUserId,
      modifiedBy: testUserId,
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
    });

    childPageGuid = randomUUID();
    await plugin.savePage(childPageGuid, rootPageGuid, {
      guid: childPageGuid,
      title: 'Installation Instructions',
      content: 'How to install the application.',
      folderId: rootPageGuid,
      tags: [],
      status: 'published',
      createdBy: testUserId,
      modifiedBy: testUserId,
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
    });

    // Create ambiguous pages with similar titles
    ambiguousPage1Guid = randomUUID();
    await plugin.savePage(ambiguousPage1Guid, null, {
      guid: ambiguousPage1Guid,
      title: 'Project Setup',
      content: 'Initial project setup instructions.',
      folderId: '',
      tags: [],
      status: 'published',
      createdBy: testUserId,
      modifiedBy: testUserId,
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
    });

    ambiguousPage2Guid = randomUUID();
    await plugin.savePage(ambiguousPage2Guid, null, {
      guid: ambiguousPage2Guid,
      title: 'Project Setup Guide',
      content: 'Complete project setup guide.',
      folderId: '',
      tags: [],
      status: 'published',
      createdBy: testUserId,
      modifiedBy: testUserId,
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
    });
  });

  afterAll(async () => {
    // Reset storage plugin
    resetStoragePlugin();
    
    // Clean up test pages
    try {
      const listResponse = await s3Client.send(
        new ListObjectsV2Command({ Bucket: TEST_BUCKET })
      );

      if (listResponse.Contents && listResponse.Contents.length > 0) {
        await s3Client.send(
          new DeleteObjectsCommand({
            Bucket: TEST_BUCKET,
            Delete: {
              Objects: listResponse.Contents.map((obj) => ({ Key: obj.Key })),
            },
          })
        );
      }
    } catch (err) {
      console.error('Cleanup error:', err);
    }
  });

  // Helper to test link resolution logic directly
  async function testLinkResolution(query: string, maxResults: number = 10) {
    // Import the handler dynamically to use mocked environment
    const { handler } = await import('../links-resolve.js');
    
    const event = {
      body: JSON.stringify({ query, maxResults }),
      pathParameters: null,
      queryStringParameters: null,
      requestContext: {
        authorizer: {
          claims: {
            sub: testUserId,
            email: 'test@example.com',
            'custom:role': 'Admin',
            'custom:displayName': 'Test User'
          }
        }
      }
    } as any;

    return handler(event);
  }

  /**
   * Test: Exact match by GUID
   */
  it('should resolve page by exact GUID', async () => {
    const result = await testLinkResolution(rootPageGuid);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.exactMatch).toBe(true);
    expect(body.matches).toHaveLength(1);
    expect(body.matches[0].guid).toBe(rootPageGuid);
    expect(body.matches[0].confidence).toBe(1.0);
    expect(body.exists).toBe(true);
    expect(body.ambiguous).toBe(false);
  });

  /**
   * Test: Exact match by title (case-insensitive)
   */
  it('should resolve page by exact title match (case-insensitive)', async () => {
    const result = await testLinkResolution('getting started guide');

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.exactMatch).toBe(true);
    expect(body.matches[0].title).toBe('Getting Started Guide');
    expect(body.matches[0].confidence).toBe(1.0);
    expect(body.exists).toBe(true);
  });

  /**
   * Test: Partial match (substring)
   */
  it('should resolve page by partial title match', async () => {
    const result = await testLinkResolution('Installation');

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.matches.length).toBeGreaterThan(0);
    expect(body.matches[0].title).toBe('Installation Instructions');
    expect(body.matches[0].confidence).toBeGreaterThan(0.7);
    expect(body.exists).toBe(true);
  });

  /**
   * Test: Fuzzy match with typo
   */
  it('should resolve page with fuzzy matching for typos', async () => {
    const result = await testLinkResolution('Instalation Instrutions'); // Typos: missing 'l' and 'c'

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.matches.length).toBeGreaterThan(0);
    // Should still find "Installation Instructions" with lower confidence
    const match = body.matches.find((m: { title: string }) => 
      m.title === 'Installation Instructions'
    );
    expect(match).toBeDefined();
    expect(match.confidence).toBeGreaterThan(0.5);
    expect(body.exists).toBe(true);
  });

  /**
   * Test: Ambiguous matches
   */
  it('should detect ambiguous matches with similar titles', async () => {
    const result = await testLinkResolution('Project Setup');

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.matches.length).toBeGreaterThanOrEqual(2);
    
    // Check if both "Project Setup" pages are in results
    const titles = body.matches.map((m: { title: string }) => m.title);
    expect(titles).toContain('Project Setup');
    expect(titles).toContain('Project Setup Guide');
    
    // One should be exact match
    const exactMatch = body.matches.find((m: { title: string }) => 
      m.title === 'Project Setup'
    );
    expect(exactMatch.confidence).toBe(1.0);
  });

  /**
   * Test: No matches found
   */
  it('should return empty matches for non-existent page', async () => {
    const result = await testLinkResolution('This Page Does Not Exist XYZ123');

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.matches).toHaveLength(0);
    expect(body.exactMatch).toBe(false);
    expect(body.exists).toBe(false);
    expect(body.ambiguous).toBe(false);
  });

  /**
   * Test: Invalid GUID format
   */
  it('should handle invalid GUID gracefully', async () => {
    const result = await testLinkResolution('not-a-valid-guid-format');

    // Should treat as title search, not error
    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.matches).toBeDefined();
  });

  /**
   * Test: Page path building for nested pages
   */
  it('should build correct hierarchical path for nested pages', async () => {
    const result = await testLinkResolution('Installation Instructions');

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.matches.length).toBeGreaterThan(0);
    
    const match = body.matches.find((m: { title: string }) => 
      m.title === 'Installation Instructions'
    );
    expect(match).toBeDefined();
    expect(match.path).toContain('>'); // Should have parent in path
    expect(match.path).toContain('Getting Started Guide');
  });

  /**
   * Test: maxResults parameter
   */
  it('should respect maxResults parameter', async () => {
    const result = await testLinkResolution('Guide', 2);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.matches.length).toBeLessThanOrEqual(2);
  });

  /**
   * Test: Empty query validation
   */
  it('should reject empty query', async () => {
    const result = await testLinkResolution('');

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.error).toContain('required');
  });

  /**
   * Test: maxResults bounds validation
   */
  it('should reject maxResults out of bounds', async () => {
    const result = await testLinkResolution('Test', 500);

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.error).toContain('maxResults');
  });

  /**
   * Test: Confidence scoring order
   */
  it('should order results by confidence score descending', async () => {
    const result = await testLinkResolution('Setup');

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    
    if (body.matches.length > 1) {
      for (let i = 0; i < body.matches.length - 1; i++) {
        expect(body.matches[i].confidence).toBeGreaterThanOrEqual(
          body.matches[i + 1].confidence
        );
      }
    }
  });
});
