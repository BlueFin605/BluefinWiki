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
      const guid = 'test-page-123';
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
      const guid = 'versioned-page';
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
      const parentGuid = 'parent-page';
      const child1Guid = 'child-page-1';
      const child2Guid = 'child-page-2';

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
      const root1Guid = 'root-page-1';
      const root2Guid = 'root-page-2';

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
      const guid = 'page-without-children';

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
      const parentGuid = 'parent-with-children';
      const childGuid = 'child-page';

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
      await expect(plugin.deletePage(parentGuid, false)).rejects.toThrow(/has children/);
    });

    it('should recursively delete page and all children', async () => {
      const parentGuid = 'parent-recursive';
      const child1Guid = 'child-recursive-1';
      const child2Guid = 'child-recursive-2';

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
      const pageGuid = 'movable-page';
      const newParentGuid = 'new-parent';

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
      const parentGuid = 'old-parent';
      const pageGuid = 'page-to-move';

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
      const parent1Guid = 'parent-1';
      const parent2Guid = 'parent-2';
      const pageGuid = 'page-to-move';

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
      const guid = 'page-guid';

      // Trying to move a page to be its own parent should fail
      await expect(plugin.movePage(guid, guid)).rejects.toThrow();
    });
  });
});
