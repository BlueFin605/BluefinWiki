/**
 * Integration tests for S3StoragePlugin
 * 
 * These tests use LocalStack (via Aspire) to test actual S3 operations.
 * Run these tests with LocalStack running: npm run test:integration
 * 
 * To run locally with Aspire:
 * 1. Start Aspire: dotnet run --project ../../aspire/BlueFinWiki.AppHost
 * 2. LocalStack will be available at http://localhost:4566
 * 3. Run tests: npm run test:integration
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { randomUUID } from 'crypto';
import { S3StoragePlugin } from '../S3StoragePlugin.js';
import { PageContent } from '../../types/index.js';
import {
  S3Client,
  CreateBucketCommand,
  DeleteBucketCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
  PutBucketVersioningCommand,
} from '@aws-sdk/client-s3';

// LocalStack endpoint - customize if needed
const LOCALSTACK_ENDPOINT = process.env.LOCALSTACK_ENDPOINT || 'http://localhost:4566';
const TEST_BUCKET = 'bluefinwiki-test-pages';
const TEST_REGION = 'us-east-1';

describe('S3StoragePlugin Integration Tests', () => {
  let plugin: S3StoragePlugin;
  let s3Client: S3Client;

  beforeAll(async () => {
    // Initialize S3 client for setup/teardown
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
      
      // Enable versioning
      await s3Client.send(new PutBucketVersioningCommand({
        Bucket: TEST_BUCKET,
        VersioningConfiguration: {
          Status: 'Enabled',
        },
      }));
    } catch (error: any) {
      // Bucket might already exist
      if (error.name !== 'BucketAlreadyOwnedByYou') {
        console.error('Failed to create test bucket:', error);
      }
    }

    // Initialize plugin
    plugin = new S3StoragePlugin({
      bucketName: TEST_BUCKET,
      region: TEST_REGION,
      endpoint: LOCALSTACK_ENDPOINT,
    });
  });

  afterAll(async () => {
    // Clean up test bucket
    try {
      // Delete all objects first
      const listResponse = await s3Client.send(
        new ListObjectsV2Command({ Bucket: TEST_BUCKET })
      );

      if (listResponse.Contents && listResponse.Contents.length > 0) {
        await s3Client.send(
          new DeleteObjectsCommand({
            Bucket: TEST_BUCKET,
            Delete: {
              Objects: listResponse.Contents.map(obj => ({ Key: obj.Key! })),
            },
          })
        );
      }

      // Delete bucket
      await s3Client.send(new DeleteBucketCommand({ Bucket: TEST_BUCKET }));
    } catch (error) {
      console.error('Failed to clean up test bucket:', error);
    }
  });

  beforeEach(async () => {
    // Clean up all objects before each test
    const listResponse = await s3Client.send(
      new ListObjectsV2Command({ Bucket: TEST_BUCKET })
    );

    if (listResponse.Contents && listResponse.Contents.length > 0) {
      await s3Client.send(
        new DeleteObjectsCommand({
          Bucket: TEST_BUCKET,
          Delete: {
            Objects: listResponse.Contents.map(obj => ({ Key: obj.Key! })),
          },
        })
      );
    }
  });

  describe('End-to-end page lifecycle', () => {
    it('should create, read, update, and delete a page', async () => {
      const guid = randomUUID();
      const content: PageContent = {
        guid,
        title: 'Test Page',
        content: '# Test Content\n\nThis is a test.',
        folderId: '',
        tags: ['test', 'integration'],
        status: 'published',
        createdBy: 'user-123',
        modifiedBy: 'user-123',
        createdAt: '2026-02-10T12:00:00Z',
        modifiedAt: '2026-02-10T12:00:00Z',
      };

      // Create
      await plugin.savePage(guid, null, content);

      // Read
      const loadedPage = await plugin.loadPage(guid);
      expect(loadedPage.guid).toBe(guid);
      expect(loadedPage.title).toBe('Test Page');
      expect(loadedPage.content).toContain('# Test Content');
      expect(loadedPage.tags).toEqual(['test', 'integration']);

      // Update
      const updatedContent = {
        ...content,
        title: 'Updated Test Page',
        content: '# Updated Content',
        modifiedAt: '2026-02-10T14:00:00Z',
      };
      await plugin.savePage(guid, null, updatedContent);

      const reloadedPage = await plugin.loadPage(guid);
      expect(reloadedPage.title).toBe('Updated Test Page');
      expect(reloadedPage.content).toContain('# Updated Content');

      // Delete
      await plugin.deletePage(guid, false);

      // Verify deletion
      await expect(plugin.loadPage(guid)).rejects.toThrow();
    });
  });

  describe('Versioning behavior', () => {
    it('should create multiple versions when page is updated', async () => {
      const guid = randomUUID();
      const content: PageContent = {
        guid,
        title: 'Version 1',
        content: 'Content v1',
        folderId: '',
        tags: [],
        status: 'published',
        createdBy: 'user-123',
        modifiedBy: 'user-123',
        createdAt: '2026-02-10T12:00:00Z',
        modifiedAt: '2026-02-10T12:00:00Z',
      };

      // Create initial version
      await plugin.savePage(guid, null, content);

      // Wait a bit to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 100));

      // Create second version
      await plugin.savePage(guid, null, {
        ...content,
        title: 'Version 2',
        modifiedAt: '2026-02-10T13:00:00Z',
      });

      // Wait again
      await new Promise(resolve => setTimeout(resolve, 100));

      // Create third version
      await plugin.savePage(guid, null, {
        ...content,
        title: 'Version 3',
        modifiedAt: '2026-02-10T14:00:00Z',
      });

      // List versions
      const versions = await plugin.listVersions(guid);

      expect(versions.length).toBeGreaterThanOrEqual(3);
      expect(versions[0].versionId).toBeDefined();
      expect(versions[0].timestamp).toBeDefined();
    });
  });

  describe('Page hierarchy (parent-child relationships)', () => {
    it('should create and manage parent-child page relationships', async () => {
      const parentGuid = randomUUID();
      const child1Guid = randomUUID();
      const child2Guid = randomUUID();

      // Create parent page
      const parentContent: PageContent = {
        guid: parentGuid,
        title: 'Parent Page',
        content: 'Parent content',
        folderId: '',
        tags: [],
        status: 'published',
        createdBy: 'user-123',
        modifiedBy: 'user-123',
        createdAt: '2026-02-10T12:00:00Z',
        modifiedAt: '2026-02-10T12:00:00Z',
      };
      await plugin.savePage(parentGuid, null, parentContent);

      // Create child pages
      const child1Content: PageContent = {
        guid: child1Guid,
        title: 'Child Page 1',
        content: 'Child 1 content',
        folderId: parentGuid,
        tags: [],
        status: 'published',
        createdBy: 'user-123',
        modifiedBy: 'user-123',
        createdAt: '2026-02-10T12:00:00Z',
        modifiedAt: '2026-02-10T12:00:00Z',
      };
      await plugin.savePage(child1Guid, parentGuid, child1Content);

      const child2Content: PageContent = {
        guid: child2Guid,
        title: 'Child Page 2',
        content: 'Child 2 content',
        folderId: parentGuid,
        tags: [],
        status: 'published',
        createdBy: 'user-123',
        modifiedBy: 'user-123',
        createdAt: '2026-02-10T12:00:00Z',
        modifiedAt: '2026-02-10T12:00:00Z',
      };
      await plugin.savePage(child2Guid, parentGuid, child2Content);

      // List children
      const children = await plugin.listChildren(parentGuid);

      expect(children.length).toBe(2);
      expect(children.map(c => c.guid)).toContain(child1Guid);
      expect(children.map(c => c.guid)).toContain(child2Guid);
      expect(children[0].parentGuid).toBe(parentGuid);
    });

    it('should list root-level pages correctly', async () => {
      const root1Guid = randomUUID();
      const root2Guid = randomUUID();

      // Create root pages
      await plugin.savePage(root1Guid, null, {
        guid: root1Guid,
        title: 'Root Page 1',
        content: 'Content',
        folderId: '',
        tags: [],
        status: 'published',
        createdBy: 'user-123',
        modifiedBy: 'user-123',
        createdAt: '2026-02-10T12:00:00Z',
        modifiedAt: '2026-02-10T12:00:00Z',
      });

      await plugin.savePage(root2Guid, null, {
        guid: root2Guid,
        title: 'Root Page 2',
        content: 'Content',
        folderId: '',
        tags: [],
        status: 'published',
        createdBy: 'user-123',
        modifiedBy: 'user-123',
        createdAt: '2026-02-10T12:00:00Z',
        modifiedAt: '2026-02-10T12:00:00Z',
      });

      // List root pages
      const rootPages = await plugin.listChildren(null);

      expect(rootPages.length).toBe(2);
      expect(rootPages.map(p => p.guid)).toContain(root1Guid);
      expect(rootPages.map(p => p.guid)).toContain(root2Guid);
      expect(rootPages[0].parentGuid).toBeNull();
    });

    it('should delete page without children when recursive=false', async () => {
      const guid = randomUUID();

      await plugin.savePage(guid, null, {
        guid,
        title: 'Page Without Children',
        content: 'Content',
        folderId: '',
        tags: [],
        status: 'published',
        createdBy: 'user-123',
        modifiedBy: 'user-123',
        createdAt: '2026-02-10T12:00:00Z',
        modifiedAt: '2026-02-10T12:00:00Z',
      });

      // Should succeed
      await plugin.deletePage(guid, false);

      await expect(plugin.loadPage(guid)).rejects.toThrow();
    });

    it('should prevent deletion of page with children when recursive=false', async () => {
      const parentGuid = randomUUID();
      const childGuid = randomUUID();

      // Create parent and child
      await plugin.savePage(parentGuid, null, {
        guid: parentGuid,
        title: 'Parent',
        content: 'Content',
        folderId: '',
        tags: [],
        status: 'published',
        createdBy: 'user-123',
        modifiedBy: 'user-123',
        createdAt: '2026-02-10T12:00:00Z',
        modifiedAt: '2026-02-10T12:00:00Z',
      });

      await plugin.savePage(childGuid, parentGuid, {
        guid: childGuid,
        title: 'Child',
        content: 'Content',
        folderId: parentGuid,
        tags: [],
        status: 'published',
        createdBy: 'user-123',
        modifiedBy: 'user-123',
        createdAt: '2026-02-10T12:00:00Z',
        modifiedAt: '2026-02-10T12:00:00Z',
      });

      // Should fail
      await expect(plugin.deletePage(parentGuid, false)).rejects.toThrow(/Cannot delete page with children/);
    });

    it('should recursively delete page and all children', async () => {
      const parentGuid = randomUUID();
      const child1Guid = randomUUID();
      const child2Guid = randomUUID();

      // Create parent and children
      await plugin.savePage(parentGuid, null, {
        guid: parentGuid,
        title: 'Parent',
        content: 'Content',
        folderId: '',
        tags: [],
        status: 'published',
        createdBy: 'user-123',
        modifiedBy: 'user-123',
        createdAt: '2026-02-10T12:00:00Z',
        modifiedAt: '2026-02-10T12:00:00Z',
      });

      await plugin.savePage(child1Guid, parentGuid, {
        guid: child1Guid,
        title: 'Child 1',
        content: 'Content',
        folderId: parentGuid,
        tags: [],
        status: 'published',
        createdBy: 'user-123',
        modifiedBy: 'user-123',
        createdAt: '2026-02-10T12:00:00Z',
        modifiedAt: '2026-02-10T12:00:00Z',
      });

      await plugin.savePage(child2Guid, parentGuid, {
        guid: child2Guid,
        title: 'Child 2',
        content: 'Content',
        folderId: parentGuid,
        tags: [],
        status: 'published',
        createdBy: 'user-123',
        modifiedBy: 'user-123',
        createdAt: '2026-02-10T12:00:00Z',
        modifiedAt: '2026-02-10T12:00:00Z',
      });

      // Delete recursively
      await plugin.deletePage(parentGuid, true);

      // Verify all deleted
      await expect(plugin.loadPage(parentGuid)).rejects.toThrow();
      await expect(plugin.loadPage(child1Guid)).rejects.toThrow();
      await expect(plugin.loadPage(child2Guid)).rejects.toThrow();
    });
  });

  describe('Page movement between parents', () => {
    it('should move page from root to under a parent', async () => {
      const pageGuid = randomUUID();
      const newParentGuid = randomUUID();

      // Create page at root
      await plugin.savePage(pageGuid, null, {
        guid: pageGuid,
        title: 'Movable Page',
        content: 'Content',
        folderId: '',
        tags: [],
        status: 'published',
        createdBy: 'user-123',
        modifiedBy: 'user-123',
        createdAt: '2026-02-10T12:00:00Z',
        modifiedAt: '2026-02-10T12:00:00Z',
      });

      // Create parent
      await plugin.savePage(newParentGuid, null, {
        guid: newParentGuid,
        title: 'New Parent',
        content: 'Content',
        folderId: '',
        tags: [],
        status: 'published',
        createdBy: 'user-123',
        modifiedBy: 'user-123',
        createdAt: '2026-02-10T12:00:00Z',
        modifiedAt: '2026-02-10T12:00:00Z',
      });

      // Move page
      await plugin.movePage(pageGuid, newParentGuid);

      // Verify new location
      const children = await plugin.listChildren(newParentGuid);
      expect(children.map(c => c.guid)).toContain(pageGuid);

      const rootPages = await plugin.listChildren(null);
      expect(rootPages.map(p => p.guid)).not.toContain(pageGuid);
    });

    it('should move page from parent to root', async () => {
      const parentGuid = randomUUID();
      const pageGuid = randomUUID();

      // Create parent and child
      await plugin.savePage(parentGuid, null, {
        guid: parentGuid,
        title: 'Old Parent',
        content: 'Content',
        folderId: '',
        tags: [],
        status: 'published',
        createdBy: 'user-123',
        modifiedBy: 'user-123',
        createdAt: '2026-02-10T12:00:00Z',
        modifiedAt: '2026-02-10T12:00:00Z',
      });

      await plugin.savePage(pageGuid, parentGuid, {
        guid: pageGuid,
        title: 'Page to Move',
        content: 'Content',
        folderId: parentGuid,
        tags: [],
        status: 'published',
        createdBy: 'user-123',
        modifiedBy: 'user-123',
        createdAt: '2026-02-10T12:00:00Z',
        modifiedAt: '2026-02-10T12:00:00Z',
      });

      // Move to root
      await plugin.movePage(pageGuid, null);

      // Verify new location
      const rootPages = await plugin.listChildren(null);
      expect(rootPages.map(p => p.guid)).toContain(pageGuid);

      const oldChildren = await plugin.listChildren(parentGuid);
      expect(oldChildren.map(c => c.guid)).not.toContain(pageGuid);
    });

    it('should move page between different parents', async () => {
      const parent1Guid = randomUUID();
      const parent2Guid = randomUUID();
      const pageGuid = randomUUID();

      // Create both parents
      await plugin.savePage(parent1Guid, null, {
        guid: parent1Guid,
        title: 'Parent 1',
        content: 'Content',
        folderId: '',
        tags: [],
        status: 'published',
        createdBy: 'user-123',
        modifiedBy: 'user-123',
        createdAt: '2026-02-10T12:00:00Z',
        modifiedAt: '2026-02-10T12:00:00Z',
      });

      await plugin.savePage(parent2Guid, null, {
        guid: parent2Guid,
        title: 'Parent 2',
        content: 'Content',
        folderId: '',
        tags: [],
        status: 'published',
        createdBy: 'user-123',
        modifiedBy: 'user-123',
        createdAt: '2026-02-10T12:00:00Z',
        modifiedAt: '2026-02-10T12:00:00Z',
      });

      // Create page under parent1
      await plugin.savePage(pageGuid, parent1Guid, {
        guid: pageGuid,
        title: 'Page to Move',
        content: 'Content',
        folderId: parent1Guid,
        tags: [],
        status: 'published',
        createdBy: 'user-123',
        modifiedBy: 'user-123',
        createdAt: '2026-02-10T12:00:00Z',
        modifiedAt: '2026-02-10T12:00:00Z',
      });

      // Move to parent2
      await plugin.movePage(pageGuid, parent2Guid);

      // Verify new location
      const parent2Children = await plugin.listChildren(parent2Guid);
      expect(parent2Children.map(c => c.guid)).toContain(pageGuid);

      const parent1Children = await plugin.listChildren(parent1Guid);
      expect(parent1Children.map(c => c.guid)).not.toContain(pageGuid);
    });
  });

  describe('Health check', () => {
    it('should return true for healthy connection', async () => {
      const isHealthy = await plugin.healthCheck();
      expect(isHealthy).toBe(true);
    });
  });

  describe('Error scenarios', () => {
    it('should handle loading non-existent page', async () => {
      await expect(plugin.loadPage('non-existent-guid')).rejects.toThrow();
    });

    it('should handle deleting non-existent page', async () => {
      await expect(plugin.deletePage('non-existent-guid', false)).rejects.toThrow();
    });

    it('should handle moving non-existent page', async () => {
      await expect(plugin.movePage('non-existent-guid', null)).rejects.toThrow();
    });

    it('should handle circular reference in move operation', async () => {
      const guid = randomUUID();

      // Trying to move a page to be its own parent should fail
      await expect(plugin.movePage(guid, guid)).rejects.toThrow();
    });
  });

  describe('Performance Tests with Large Datasets', () => {
    const PERFORMANCE_TEST_TIMEOUT = 60000; // 60 seconds for performance tests

    it('should handle creating and listing 20 pages efficiently', async () => {
      const startTime = Date.now();
      const pageCount = 20;
      const pageGuids: string[] = [];

      // Create 100 pages in parallel
      const createPromises = Array.from({ length: pageCount }, (_, i) => {
        const guid = randomUUID();
        pageGuids.push(guid);
        return plugin.savePage(guid, null, {
          guid,
          title: `Performance Test Page ${i}`,
          content: `# Page ${i}\n\nThis is test content for performance testing.\n\n`.repeat(10),
          folderId: '',
          tags: ['performance', 'test'],
          status: 'published',
          createdBy: 'perf-test-user',
          modifiedBy: 'perf-test-user',
          createdAt: new Date().toISOString(),
          modifiedAt: new Date().toISOString(),
        });
      });

      await Promise.all(createPromises);
      const createTime = Date.now() - startTime;

      // List all root pages
      const listStartTime = Date.now();
      const rootPages = await plugin.listChildren(null);
      const listTime = Date.now() - listStartTime;

      // Verify
      expect(rootPages.length).toBeGreaterThanOrEqual(pageCount);
      expect(createTime).toBeLessThan(30000); // Should complete within 30 seconds
      expect(listTime).toBeLessThan(5000); // Listing should be under 5 seconds

      console.log(`Created ${pageCount} pages in ${createTime}ms`);
      console.log(`Listed pages in ${listTime}ms`);
    }, PERFORMANCE_TEST_TIMEOUT);

    it('should handle large page content (1MB)', async () => {
      const guid = randomUUID();
      const largeContent = 'A'.repeat(1024 * 1024); // 1MB of content
      
      const startTime = Date.now();
      
      await plugin.savePage(guid, null, {
        guid,
        title: 'Large Content Page',
        content: largeContent,
        folderId: '',
        tags: ['performance', 'large'],
        status: 'published',
        createdBy: 'perf-test-user',
        modifiedBy: 'perf-test-user',
        createdAt: new Date().toISOString(),
        modifiedAt: new Date().toISOString(),
      });

      const saveTime = Date.now() - startTime;

      // Load the page
      const loadStartTime = Date.now();
      const loadedPage = await plugin.loadPage(guid);
      const loadTime = Date.now() - loadStartTime;

      expect(loadedPage.content).toBe(largeContent);
      expect(saveTime).toBeLessThan(10000); // Should save within 10 seconds
      expect(loadTime).toBeLessThan(5000); // Should load within 5 seconds

      console.log(`Saved 5MB page in ${saveTime}ms`);
      console.log(`Loaded 5MB page in ${loadTime}ms`);
    }, PERFORMANCE_TEST_TIMEOUT);

    it('should handle deep page hierarchy (5 levels)', async () => {
      const depth = 5;
      const pageGuids: string[] = [];
      let parentGuid: string | null = null;

      const startTime = Date.now();

      // Create nested hierarchy
      for (let i = 0; i < depth; i++) {
        const guid = randomUUID();
        pageGuids.push(guid);

        await plugin.savePage(guid, parentGuid, {
          guid,
          title: `Level ${i}`,
          content: `Content at level ${i}`,
          folderId: parentGuid || '',
          tags: ['hierarchy', 'deep'],
          status: 'published',
          createdBy: 'perf-test-user',
          modifiedBy: 'perf-test-user',
          createdAt: new Date().toISOString(),
          modifiedAt: new Date().toISOString(),
        });

        parentGuid = guid;
      }

      const createTime = Date.now() - startTime;

      // Load deepest page
      const loadStartTime = Date.now();
      const deepestPage = await plugin.loadPage(pageGuids[depth - 1]);
      const loadTime = Date.now() - loadStartTime;

      expect(deepestPage.title).toBe(`Level ${depth - 1}`);
      expect(createTime).toBeLessThan(15000); // Should complete within 15 seconds
      expect(loadTime).toBeLessThan(1000); // Loading single page should be fast

      console.log(`Created ${depth}-level hierarchy in ${createTime}ms`);
      console.log(`Loaded deepest page in ${loadTime}ms`);
    }, PERFORMANCE_TEST_TIMEOUT);

    it('should handle wide hierarchy (30 children under one parent)', async () => {
      const parentGuid = randomUUID();
      const childCount = 30;

      // Create parent
      await plugin.savePage(parentGuid, null, {
        guid: parentGuid,
        title: 'Wide Parent',
        content: 'Parent with many children',
        folderId: '',
        tags: ['hierarchy', 'wide'],
        status: 'published',
        createdBy: 'perf-test-user',
        modifiedBy: 'perf-test-user',
        createdAt: new Date().toISOString(),
        modifiedAt: new Date().toISOString(),
      });

      const startTime = Date.now();

      // Create children in parallel
      const createPromises = Array.from({ length: childCount }, (_, i) => {
        const childGuid = randomUUID();
        return plugin.savePage(childGuid, parentGuid, {
          guid: childGuid,
          title: `Child ${i}`,
          content: `Child content ${i}`,
          folderId: parentGuid,
          tags: ['child'],
          status: 'published',
          createdBy: 'perf-test-user',
          modifiedBy: 'perf-test-user',
          createdAt: new Date().toISOString(),
          modifiedAt: new Date().toISOString(),
        });
      });

      await Promise.all(createPromises);
      const createTime = Date.now() - startTime;

      // List children
      const listStartTime = Date.now();
      const children = await plugin.listChildren(parentGuid);
      const listTime = Date.now() - listStartTime;

      expect(children.length).toBe(childCount);
      expect(createTime).toBeLessThan(30000); // Should complete within 30 seconds
      expect(listTime).toBeLessThan(5000); // Listing should be under 5 seconds

      console.log(`Created ${childCount} children in ${createTime}ms`);
      console.log(`Listed ${childCount} children in ${listTime}ms`);
    }, PERFORMANCE_TEST_TIMEOUT);

    it('should handle bulk delete operations efficiently', async () => {
      const parentGuid = randomUUID();
      const childCount = 20;

      // Create parent and children
      await plugin.savePage(parentGuid, null, {
        guid: parentGuid,
        title: 'Bulk Delete Parent',
        content: 'Parent for bulk deletion',
        folderId: '',
        tags: ['bulk'],
        status: 'published',
        createdBy: 'perf-test-user',
        modifiedBy: 'perf-test-user',
        createdAt: new Date().toISOString(),
        modifiedAt: new Date().toISOString(),
      });

      const createPromises = Array.from({ length: childCount }, (_, i) => {
        const childGuid = randomUUID();
        return plugin.savePage(childGuid, parentGuid, {
          guid: childGuid,
          title: `Child ${i}`,
          content: `Content ${i}`,
          folderId: parentGuid,
          tags: ['bulk'],
          status: 'published',
          createdBy: 'perf-test-user',
          modifiedBy: 'perf-test-user',
          createdAt: new Date().toISOString(),
          modifiedAt: new Date().toISOString(),
        });
      });

      await Promise.all(createPromises);

      // Delete all at once
      const startTime = Date.now();
      await plugin.deletePage(parentGuid, true);
      const deleteTime = Date.now() - startTime;

      expect(deleteTime).toBeLessThan(10000); // Should delete within 10 seconds

      // Verify all deleted
      await expect(plugin.loadPage(parentGuid)).rejects.toThrow();

      console.log(`Deleted parent with ${childCount} children in ${deleteTime}ms`);
    }, PERFORMANCE_TEST_TIMEOUT);

    it('should handle concurrent read/write operations', async () => {
      const pageGuid = randomUUID();
      
      // Create initial page
      await plugin.savePage(pageGuid, null, {
        guid: pageGuid,
        title: 'Concurrent Operations Page',
        content: 'Initial content',
        folderId: '',
        tags: ['concurrent'],
        status: 'published',
        createdBy: 'perf-test-user',
        modifiedBy: 'perf-test-user',
        createdAt: new Date().toISOString(),
        modifiedAt: new Date().toISOString(),
      });

      const startTime = Date.now();
      
      // Perform 20 concurrent operations (10 reads, 10 writes)
      const operations = [
        ...Array.from({ length: 10 }, () => plugin.loadPage(pageGuid)),
        ...Array.from({ length: 10 }, (_, i) => 
          plugin.savePage(pageGuid, null, {
            guid: pageGuid,
            title: `Concurrent Update ${i}`,
            content: `Updated content ${i}`,
            folderId: '',
            tags: ['concurrent'],
            status: 'published',
            createdBy: 'perf-test-user',
            modifiedBy: 'perf-test-user',
            createdAt: new Date().toISOString(),
            modifiedAt: new Date().toISOString(),
          })
        ),
      ];

      // Shuffle operations to simulate real concurrent access
      operations.sort(() => Math.random() - 0.5);
      
      await Promise.all(operations);
      const operationTime = Date.now() - startTime;

      expect(operationTime).toBeLessThan(15000); // Should complete within 15 seconds

      console.log(`Completed 20 concurrent operations in ${operationTime}ms`);
    }, PERFORMANCE_TEST_TIMEOUT);

    it('should handle versioning with many updates', async () => {
      const guid = randomUUID();
      const updateCount = 10;

      // Create initial page
      await plugin.savePage(guid, null, {
        guid,
        title: 'Version Stress Test',
        content: 'Version 0',
        folderId: '',
        tags: ['versioning'],
        status: 'published',
        createdBy: 'perf-test-user',
        modifiedBy: 'perf-test-user',
        createdAt: new Date().toISOString(),
        modifiedAt: new Date().toISOString(),
      });

      const startTime = Date.now();

      // Create many versions
      for (let i = 1; i <= updateCount; i++) {
        await plugin.savePage(guid, null, {
          guid,
          title: `Version ${i}`,
          content: `Content version ${i}`,
          folderId: '',
          tags: ['versioning'],
          status: 'published',
          createdBy: 'perf-test-user',
          modifiedBy: 'perf-test-user',
          createdAt: new Date().toISOString(),
          modifiedAt: new Date().toISOString(),
        });
        
        // Small delay to ensure different timestamps
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      const updateTime = Date.now() - startTime;

      // List versions
      const listStartTime = Date.now();
      const versions = await plugin.listVersions(guid);
      const listTime = Date.now() - listStartTime;

      expect(versions.length).toBeGreaterThanOrEqual(updateCount);
      expect(updateTime).toBeLessThan(15000); // Should complete within 15 seconds
      expect(listTime).toBeLessThan(2000); // Listing versions should be fast

      console.log(`Created ${updateCount} versions in ${updateTime}ms`);
      console.log(`Listed versions in ${listTime}ms`);
    }, PERFORMANCE_TEST_TIMEOUT);
  });
});
