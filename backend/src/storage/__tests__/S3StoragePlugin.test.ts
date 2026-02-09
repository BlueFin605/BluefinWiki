/**
 * Unit tests for S3StoragePlugin
 * 
 * These tests mock the S3 client to verify plugin behavior without
 * requiring actual AWS/LocalStack connections.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { S3StoragePlugin } from '../S3StoragePlugin.js';
import { PageContent } from '../../types/index.js';
import { mockClient } from 'aws-sdk-client-mock';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  ListObjectVersionsCommand,
  ListObjectsV2Command,
  HeadObjectCommand,
  CopyObjectCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';
import { Readable } from 'stream';

// Create a mock S3 client
const s3Mock = mockClient(S3Client);

describe('S3StoragePlugin', () => {
  let plugin: S3StoragePlugin;

  beforeEach(() => {
    // Reset all mocks before each test
    s3Mock.reset();
    
    // Create plugin instance
    plugin = new S3StoragePlugin({
      bucketName: 'test-bucket',
      region: 'us-east-1',
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('savePage', () => {
    it('should save a root-level page to S3', async () => {
      const guid = 'test-guid-123';
      const content: PageContent = {
        guid,
        title: 'Test Page',
        content: '# Hello World\n\nThis is a test.',
        folderId: '',
        tags: ['test'],
        status: 'published',
        createdBy: 'user-123',
        modifiedBy: 'user-123',
        createdAt: '2026-02-10T12:00:00Z',
        modifiedAt: '2026-02-10T12:00:00Z',
      };

      s3Mock.on(PutObjectCommand).resolves({});

      await plugin.savePage(guid, null, content);

      // Verify S3 PutObject was called with correct parameters
      expect(s3Mock.commandCalls(PutObjectCommand).length).toBe(1);
      const call = s3Mock.commandCalls(PutObjectCommand)[0];
      expect(call.args[0].input.Bucket).toBe('test-bucket');
      expect(call.args[0].input.Key).toBe(`${guid}.md`);
      expect(call.args[0].input.ContentType).toBe('text/markdown');
      
      // Verify the body contains frontmatter and content
      const body = call.args[0].input.Body as string;
      expect(body).toContain('---');
      expect(body).toContain('title: "Test Page"');
      expect(body).toContain('guid: "test-guid-123"');
      expect(body).toContain('# Hello World');
    });

    it('should save a child page under a parent', async () => {
      const guid = 'child-guid-456';
      const parentGuid = 'parent-guid-789';
      const content: PageContent = {
        guid,
        title: 'Child Page',
        content: 'Child content',
        folderId: parentGuid,
        tags: [],
        status: 'published',
        createdBy: 'user-123',
        modifiedBy: 'user-123',
        createdAt: '2026-02-10T12:00:00Z',
        modifiedAt: '2026-02-10T12:00:00Z',
      };

      s3Mock.on(PutObjectCommand).resolves({});

      await plugin.savePage(guid, parentGuid, content);

      const call = s3Mock.commandCalls(PutObjectCommand)[0];
      expect(call.args[0].input.Key).toBe(`${parentGuid}/${guid}.md`);
    });

    it('should include metadata in frontmatter', async () => {
      const guid = 'test-guid';
      const content: PageContent = {
        guid,
        title: 'Test with Tags',
        content: 'Content',
        folderId: '',
        tags: ['tag1', 'tag2'],
        status: 'draft',
        createdBy: 'user-123',
        modifiedBy: 'user-456',
        createdAt: '2026-02-10T10:00:00Z',
        modifiedAt: '2026-02-10T12:00:00Z',
      };

      s3Mock.on(PutObjectCommand).resolves({});

      await plugin.savePage(guid, null, content);

      const call = s3Mock.commandCalls(PutObjectCommand)[0];
      const body = call.args[0].input.Body as string;
      
      expect(body).toContain('tags:');
      expect(body).toContain('- tag1');
      expect(body).toContain('- tag2');
      expect(body).toContain('status: "draft"');
      expect(body).toContain('createdBy: "user-123"');
      expect(body).toContain('modifiedBy: "user-456"');
    });
  });

  describe('loadPage', () => {
    it('should load a page from S3 and parse frontmatter', async () => {
      const guid = 'test-guid-123';
      const markdownContent = `---
title: "Test Page"
guid: "test-guid-123"
folderId: ""
tags:
  - test
status: "published"
createdBy: "user-123"
modifiedBy: "user-123"
createdAt: "2026-02-10T12:00:00Z"
modifiedAt: "2026-02-10T12:00:00Z"
---

# Hello World

This is a test.`;

      const stream = Readable.from([markdownContent]);
      s3Mock.on(GetObjectCommand).resolves({ Body: stream as any });
      
      // Mock HeadObject to find the page
      s3Mock.on(HeadObjectCommand).resolves({
        ContentLength: 100,
        LastModified: new Date(),
      });

      const page = await plugin.loadPage(guid);

      expect(page.guid).toBe(guid);
      expect(page.title).toBe('Test Page');
      expect(page.content).toContain('# Hello World');
      expect(page.tags).toEqual(['test']);
      expect(page.status).toBe('published');
    });

    it('should throw error if page not found', async () => {
      s3Mock.on(HeadObjectCommand).rejects({ name: 'NotFound' });

      await expect(plugin.loadPage('nonexistent-guid')).rejects.toThrow();
    });

    it('should handle pages without tags', async () => {
      const guid = 'test-guid-456';
      const markdownContent = `---
title: "Simple Page"
guid: "test-guid-456"
folderId: ""
status: "published"
createdBy: "user-123"
modifiedBy: "user-123"
createdAt: "2026-02-10T12:00:00Z"
modifiedAt: "2026-02-10T12:00:00Z"
---

Content here`;

      const stream = Readable.from([markdownContent]);
      s3Mock.on(GetObjectCommand).resolves({ Body: stream as any });
      s3Mock.on(HeadObjectCommand).resolves({
        ContentLength: 100,
        LastModified: new Date(),
      });

      const page = await plugin.loadPage(guid);

      expect(page.tags).toEqual([]);
    });
  });

  describe('deletePage', () => {
    it('should delete a page without children', async () => {
      const guid = 'test-guid-123';

      // Mock no children found
      s3Mock.on(ListObjectsV2Command).resolves({
        Contents: [],
      });

      s3Mock.on(DeleteObjectCommand).resolves({});

      await plugin.deletePage(guid, false);

      expect(s3Mock.commandCalls(DeleteObjectCommand).length).toBe(1);
    });

    it('should throw error if page has children and recursive=false', async () => {
      const guid = 'parent-guid';

      // Mock that children exist
      s3Mock.on(ListObjectsV2Command).resolves({
        Contents: [
          { Key: `${guid}/child1.md` },
          { Key: `${guid}/child2.md` },
        ],
      });

      await expect(plugin.deletePage(guid, false)).rejects.toThrow(/has children/);
    });

    it('should recursively delete page and all children', async () => {
      const guid = 'parent-guid';

      // First call: check for children
      // Second call: list all objects to delete
      s3Mock.on(ListObjectsV2Command)
        .resolvesOnce({
          Contents: [
            { Key: `${guid}/child1.md` },
          ],
        })
        .resolvesOnce({
          Contents: [
            { Key: `${guid}.md` },
            { Key: `${guid}/child1.md` },
            { Key: `${guid}/child2.md` },
          ],
        });

      s3Mock.on(DeleteObjectsCommand).resolves({});

      await plugin.deletePage(guid, true);

      expect(s3Mock.commandCalls(DeleteObjectsCommand).length).toBeGreaterThan(0);
    });
  });

  describe('listVersions', () => {
    it('should list all versions of a page', async () => {
      const guid = 'test-guid';

      s3Mock.on(HeadObjectCommand).resolves({
        ContentLength: 100,
        LastModified: new Date(),
      });

      s3Mock.on(ListObjectVersionsCommand).resolves({
        Versions: [
          {
            VersionId: 'v2',
            LastModified: new Date('2026-02-10T14:00:00Z'),
            Size: 200,
          },
          {
            VersionId: 'v1',
            LastModified: new Date('2026-02-10T12:00:00Z'),
            Size: 150,
          },
        ],
      });

      const versions = await plugin.listVersions(guid);

      expect(versions.length).toBe(2);
      expect(versions[0].versionId).toBe('v2');
      expect(versions[1].versionId).toBe('v1');
      expect(versions[0].size).toBe(200);
    });

    it('should return empty array if no versions found', async () => {
      const guid = 'test-guid';

      s3Mock.on(HeadObjectCommand).resolves({
        ContentLength: 100,
        LastModified: new Date(),
      });

      s3Mock.on(ListObjectVersionsCommand).resolves({
        Versions: [],
      });

      const versions = await plugin.listVersions(guid);

      expect(versions).toEqual([]);
    });
  });

  describe('listChildren', () => {
    it('should list root-level pages when parentGuid is null', async () => {
      const markdownContent1 = `---
title: "Page 1"
guid: "guid-1"
folderId: ""
status: "published"
createdBy: "user-123"
modifiedBy: "user-123"
createdAt: "2026-02-10T12:00:00Z"
modifiedAt: "2026-02-10T12:00:00Z"
---

Content`;

      const markdownContent2 = `---
title: "Page 2"
guid: "guid-2"
folderId: ""
status: "draft"
createdBy: "user-456"
modifiedBy: "user-456"
createdAt: "2026-02-10T13:00:00Z"
modifiedAt: "2026-02-10T13:00:00Z"
---

Content`;

      s3Mock.on(ListObjectsV2Command).resolves({
        Contents: [
          { Key: 'guid-1.md' },
          { Key: 'guid-2.md' },
        ],
      });

      s3Mock.on(GetObjectCommand)
        .resolvesOnce({ Body: Readable.from([markdownContent1]) as any })
        .resolvesOnce({ Body: Readable.from([markdownContent2]) as any });

      // Mock for hasChildren checks
      s3Mock.on(ListObjectsV2Command).resolves({
        Contents: [],
      });

      const children = await plugin.listChildren(null);

      expect(children.length).toBe(2);
      expect(children[0].title).toBe('Page 1');
      expect(children[1].title).toBe('Page 2');
    });

    it('should list children of a specific parent', async () => {
      const parentGuid = 'parent-guid';
      const childContent = `---
title: "Child Page"
guid: "child-guid"
folderId: "${parentGuid}"
status: "published"
createdBy: "user-123"
modifiedBy: "user-123"
createdAt: "2026-02-10T12:00:00Z"
modifiedAt: "2026-02-10T12:00:00Z"
---

Content`;

      s3Mock.on(ListObjectsV2Command).resolves({
        Contents: [
          { Key: `${parentGuid}/child-guid.md` },
        ],
      });

      s3Mock.on(GetObjectCommand).resolves({
        Body: Readable.from([childContent]) as any,
      });

      const children = await plugin.listChildren(parentGuid);

      expect(children.length).toBe(1);
      expect(children[0].title).toBe('Child Page');
      expect(children[0].parentGuid).toBe(parentGuid);
    });

    it('should return empty array if no children found', async () => {
      s3Mock.on(ListObjectsV2Command).resolves({
        Contents: [],
      });

      const children = await plugin.listChildren('nonexistent-parent');

      expect(children).toEqual([]);
    });
  });

  describe('movePage', () => {
    it('should move a page from root to under a parent', async () => {
      const guid = 'page-guid';
      const newParentGuid = 'parent-guid';

      const pageContent = `---
title: "Test Page"
guid: "${guid}"
folderId: ""
status: "published"
createdBy: "user-123"
modifiedBy: "user-123"
createdAt: "2026-02-10T12:00:00Z"
modifiedAt: "2026-02-10T12:00:00Z"
---

Content`;

      // Mock finding the page
      s3Mock.on(HeadObjectCommand).resolves({
        ContentLength: 100,
        LastModified: new Date(),
      });

      s3Mock.on(GetObjectCommand).resolves({
        Body: Readable.from([pageContent]) as any,
      });

      // Mock no children
      s3Mock.on(ListObjectsV2Command).resolves({
        Contents: [],
      });

      s3Mock.on(CopyObjectCommand).resolves({});
      s3Mock.on(DeleteObjectCommand).resolves({});
      s3Mock.on(PutObjectCommand).resolves({});

      await plugin.movePage(guid, newParentGuid);

      // Verify copy and delete operations
      expect(s3Mock.commandCalls(CopyObjectCommand).length).toBeGreaterThan(0);
      expect(s3Mock.commandCalls(DeleteObjectCommand).length).toBeGreaterThan(0);
    });

    it('should move a page from parent to root', async () => {
      const guid = 'page-guid';
      const oldParentGuid = 'old-parent-guid';

      const pageContent = `---
title: "Test Page"
guid: "${guid}"
folderId: "${oldParentGuid}"
status: "published"
createdBy: "user-123"
modifiedBy: "user-123"
createdAt: "2026-02-10T12:00:00Z"
modifiedAt: "2026-02-10T12:00:00Z"
---

Content`;

      s3Mock.on(HeadObjectCommand)
        .resolvesOnce({ ContentLength: 100, LastModified: new Date() })
        .rejectsOnce({ name: 'NotFound' });

      s3Mock.on(GetObjectCommand).resolves({
        Body: Readable.from([pageContent]) as any,
      });

      s3Mock.on(ListObjectsV2Command).resolves({
        Contents: [],
      });

      s3Mock.on(CopyObjectCommand).resolves({});
      s3Mock.on(DeleteObjectCommand).resolves({});
      s3Mock.on(PutObjectCommand).resolves({});

      await plugin.movePage(guid, null);

      expect(s3Mock.commandCalls(CopyObjectCommand).length).toBeGreaterThan(0);
    });

    it('should throw error on circular reference', async () => {
      const guid = 'parent-guid';
      const newParentGuid = 'child-guid';

      // Mock the page being its own descendant
      await expect(plugin.movePage(guid, guid)).rejects.toThrow();
    });
  });

  describe('healthCheck', () => {
    it('should return true if bucket is accessible', async () => {
      s3Mock.on(HeadBucketCommand).resolves({});

      const isHealthy = await plugin.healthCheck();

      expect(isHealthy).toBe(true);
    });

    it('should return false if bucket is not accessible', async () => {
      s3Mock.on(HeadBucketCommand).rejects(new Error('Access denied'));

      const isHealthy = await plugin.healthCheck();

      expect(isHealthy).toBe(false);
    });
  });

  describe('getType', () => {
    it('should return plugin type', () => {
      expect(plugin.getType()).toBe('s3');
    });
  });
});
