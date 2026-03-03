/**
 * Unit tests for S3StoragePlugin
 * 
 * These tests mock the S3 client to verify plugin behavior without
 * requiring actual AWS/LocalStack connections.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { S3StoragePlugin } from '../S3StoragePlugin.js';
import { PageContent } from '../../types/index.js';
import { v4 as uuidv4 } from 'uuid';
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
import { sdkStreamMixin } from '@smithy/util-stream';

// Create a mock S3 client
const s3Mock = mockClient(S3Client);

// Helper function to create a mock SDK stream
// Creates a fresh stream each time to avoid "already transformed" errors
function createMockStream(content: string) {
  return () => {
    const stream = new Readable();
    stream.push(content);
    stream.push(null);
    return sdkStreamMixin(stream);
  };
}

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
      const guid = uuidv4();
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
      expect(call.args[0].input.Key).toBe(`${guid}/${guid}.md`);
      expect(call.args[0].input.ContentType).toBe('text/markdown');
      
      // Verify the body contains frontmatter and content
      const body = call.args[0].input.Body as string;
      expect(body).toContain('---');
      expect(body).toContain('title: "Test Page"');
      expect(body).toContain(`guid: "${guid}"`);
      expect(body).toContain('# Hello World');
    });

    it('should save a child page under a parent', async () => {
      const guid = uuidv4();
      const parentGuid = uuidv4();
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
      expect(call.args[0].input.Key).toBe(`${parentGuid}/${guid}/${guid}.md`);
    });

    it('should include metadata in frontmatter', async () => {
      const guid = uuidv4();
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
      const guid = uuidv4();
      const markdownContent = `---
title: "Test Page"
guid: "${guid}"
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

      s3Mock.on(GetObjectCommand).resolves({ Body: createMockStream(markdownContent)() as any });
      
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
      const guid = uuidv4();
      const markdownContent = `---
title: "Simple Page"
guid: "${guid}"
folderId: ""
status: "published"
createdBy: "user-123"
modifiedBy: "user-123"
createdAt: "2026-02-10T12:00:00Z"
modifiedAt: "2026-02-10T12:00:00Z"
---

Content here`;

      s3Mock.on(GetObjectCommand).resolves({ Body: createMockStream(markdownContent)() as any });
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
      const guid = uuidv4();

      // Mock no children found
      s3Mock.on(ListObjectsV2Command).resolves({
        Contents: [],
      });

      s3Mock.on(DeleteObjectCommand).resolves({});

      await plugin.deletePage(guid, false);

      expect(s3Mock.commandCalls(DeleteObjectCommand).length).toBe(1);
    });

    it('should throw error if page has children and recursive=false', async () => {
      const guid = uuidv4();
      const child1Guid = uuidv4();
      const child2Guid = uuidv4();

      const childContent1 = `---
title: "Child 1"
guid: "${child1Guid}"
folderId: "${guid}"
status: "published"
createdBy: "user-123"
modifiedBy: "user-123"
createdAt: "2026-02-10T12:00:00Z"
modifiedAt: "2026-02-10T12:00:00Z"
---

Content`;

      // childContent2 not needed for this test

      // Mock HeadObject for findPageKey - must find parent page first
      s3Mock.on(HeadObjectCommand).callsFake((input: any) => {
        const key = input.Key as string;
        if (key === `${guid}.md` || key === `${child1Guid}.md` || key === `${child2Guid}.md` ||
            key === `${guid}/${child1Guid}.md` || key === `${guid}/${child2Guid}.md`) {
          return { ContentLength: 100, LastModified: new Date() };
        }
        throw { name: 'NotFound' };
      });

      // Mock that children exist
      s3Mock.on(ListObjectsV2Command).resolves({
        Contents: [
          { Key: `${guid}/${child1Guid}.md` },
          { Key: `${guid}/${child2Guid}.md` },
        ],
      });

      // Mock GetObject to return streams for children
      s3Mock.on(GetObjectCommand).callsFake(() => {
        return { Body: createMockStream(childContent1)() } as any;
      });

      await expect(plugin.deletePage(guid, false)).rejects.toThrow(/Cannot delete page with children/);
    });

    it('should recursively delete page and all children', async () => {
      const guid = uuidv4();
      const child1Guid = uuidv4();
      const child2Guid = uuidv4();

      const childContent = `---
title: "Child"
guid: "${child1Guid}"
folderId: "${guid}"
status: "published"
createdBy: "user-123"
modifiedBy: "user-123"
createdAt: "2026-02-10T12:00:00Z"
modifiedAt: "2026-02-10T12:00:00Z"
---

Content`;

      // Mock HeadObject for finding pages
      s3Mock.on(HeadObjectCommand).callsFake(() => {
        return { ContentLength: 100, LastModified: new Date() };
      });

      // Multiple ListObjects calls: hasChildren checks and deletion listing
      // Return children for hasChildren, then all objects for deletion
      s3Mock.on(ListObjectsV2Command).resolves({
        Contents: [
          { Key: `${guid}.md` },
          { Key: `${guid}/${child1Guid}.md` },
          { Key: `${guid}/${child2Guid}.md` },
        ],
      });

      // Mock GetObject for child pages
      s3Mock.on(GetObjectCommand).callsFake(() => {
        return { Body: createMockStream(childContent)() } as any;
      });

      s3Mock.on(DeleteObjectsCommand).resolves({});

      await plugin.deletePage(guid, true);

      expect(s3Mock.commandCalls(DeleteObjectsCommand).length).toBeGreaterThan(0);
    });
  });

  describe('listVersions', () => {
    it('should list all versions of a page', async () => {
      const guid = uuidv4();

      // Mock HeadObject to find the page
      s3Mock.on(HeadObjectCommand).callsFake((input: any) => {
        if (input.Key === `${guid}.md`) {
          return { ContentLength: 100, LastModified: new Date() };
        }
        throw { name: 'NotFound' };
      });

      s3Mock.on(ListObjectVersionsCommand).resolves({
        Versions: [
          {
            Key: `${guid}.md`,
            VersionId: 'v2',
            LastModified: new Date('2026-02-10T14:00:00Z'),
            Size: 200,
          },
          {
            Key: `${guid}.md`,
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
      const guid = uuidv4();

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
      const guid1 = uuidv4();
      const guid2 = uuidv4();
      const markdownContent1 = `---
title: "Page 1"
guid: "${guid1}"
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
guid: "${guid2}"
folderId: ""
status: "draft"
createdBy: "user-456"
modifiedBy: "user-456"
createdAt: "2026-02-10T13:00:00Z"
modifiedAt: "2026-02-10T13:00:00Z"
---

Content`;

      // Mock ListObjects: first call for root pages, subsequent calls for hasChildren checks
      let listCallCount = 0;
      s3Mock.on(ListObjectsV2Command).callsFake((_input: any) => {
        listCallCount++;
        if (listCallCount === 1) {
          // First call: list root pages (return folders as CommonPrefixes)
          return {
            CommonPrefixes: [
              { Prefix: `${guid1}/` },
              { Prefix: `${guid2}/` },
            ],
          };
        }
        // Subsequent calls for hasChildren checks - return empty
        return { Contents: [], CommonPrefixes: [] };
      });

      // Mock GetObject with fresh streams
      s3Mock.on(GetObjectCommand).callsFake((input: any) => {
        if (input.Key === `${guid1}/${guid1}.md`) {
          return { Body: createMockStream(markdownContent1)() } as any;
        } else if (input.Key === `${guid2}/${guid2}.md`) {
          return { Body: createMockStream(markdownContent2)() } as any;
        }
        throw { name: 'NoSuchKey' };
      });

      // Mock HeadObject for findPageKey
      s3Mock.on(HeadObjectCommand).callsFake((input: any) => {
        if (input.Key === `${guid1}/${guid1}.md` || input.Key === `${guid2}/${guid2}.md`) {
          return { ContentLength: 100, LastModified: new Date() };
        }
        throw { name: 'NotFound' };
      });

      const children = await plugin.listChildren(null);

      expect(children.length).toBe(2);
      expect(children[0].title).toBe('Page 1');
      expect(children[1].title).toBe('Page 2');
    });

    it('should list children of a specific parent', async () => {
      const parentGuid = uuidv4();
      const childGuid = uuidv4();
      const childContent = `---
title: "Child Page"
guid: "${childGuid}"
folderId: "${parentGuid}"
status: "published"
createdBy: "user-123"
modifiedBy: "user-123"
createdAt: "2026-02-10T12:00:00Z"
modifiedAt: "2026-02-10T12:00:00Z"
---

Content`;

      // Mock GetObject with fresh stream
      s3Mock.on(GetObjectCommand).callsFake(() => {
        return { Body: createMockStream(childContent)() } as any;
      });

      // Mock HeadObject for findPageKey - handle root check first, then folder check
      s3Mock.on(HeadObjectCommand).callsFake((input: any) => {
        // Root check will fail, folder check will succeed
        if (input.Key === `${childGuid}/${childGuid}.md`) {
          throw { name: 'NotFound' };
        }
        if (input.Key === `${parentGuid}/${childGuid}/${childGuid}.md`) {
          return { ContentLength: 100, LastModified: new Date() };
        }
        throw { name: 'NotFound' };
      });

      // Mock ListObjectsV2Command
      s3Mock.on(ListObjectsV2Command).callsFake((input: any) => {
        // If it's searching for the child page key (no prefix or Delimiter)
        if (!input.Prefix && !input.Delimiter) {
          return {
            Contents: [
              { Key: `${parentGuid}/${childGuid}/${childGuid}.md` },
            ],
          };
        }
        // For listing children of parent (with Delimiter)
        if (input.Prefix === `${parentGuid}/` && input.Delimiter === '/') {
          return {
            CommonPrefixes: [
              { Prefix: `${parentGuid}/${childGuid}/` },
              { Prefix: `${parentGuid}/${parentGuid}/` }, // parent's own folder
            ],
          };
        }
        // For hasChildren checks
        if (input.Prefix === `${childGuid}/` && input.Delimiter === '/') {
          return { Contents: [], CommonPrefixes: [] };
        }
        return { Contents: [], CommonPrefixes: [] };
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
      const guid = uuidv4();
      const newParentGuid = uuidv4();

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

      // Mock finding the page at root level
      s3Mock.on(HeadObjectCommand).callsFake((input: any) => {
        if (input.Key === `${guid}.md`) {
          return { ContentLength: 100, LastModified: new Date() };
        }
        throw { name: 'NotFound' };
      });

      // Mock GetObject with fresh stream each time
      s3Mock.on(GetObjectCommand).callsFake(() => {
        return { Body: createMockStream(pageContent)() } as any;
      });

      // Mock no children
      s3Mock.on(ListObjectsV2Command).resolves({
        Contents: [],
      });

      s3Mock.on(CopyObjectCommand).resolves({});
      s3Mock.on(DeleteObjectCommand).resolves({});
      s3Mock.on(PutObjectCommand).resolves({});

      await plugin.movePage(guid, newParentGuid);

      // Verify PutObject was called to save the updated page
      expect(s3Mock.commandCalls(PutObjectCommand).length).toBeGreaterThan(0);
    });

    it('should move a page from parent to root', async () => {
      const guid = uuidv4();
      const oldParentGuid = uuidv4();

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

      // Mock HeadObject: root check will fail (NotFound), then findPageKey uses ListObjects
      s3Mock.on(HeadObjectCommand).callsFake(() => {
        // Reject root-level check
        throw { name: 'NotFound' };
      });

      // Mock ListObjectsV2 to find page under parent
      s3Mock.on(ListObjectsV2Command).resolves({
        Contents: [
          { Key: `${oldParentGuid}/${guid}.md` },
        ],
      });

      // Mock GetObject with fresh stream
      s3Mock.on(GetObjectCommand).callsFake(() => {
        return { Body: createMockStream(pageContent)() } as any;
      });

      s3Mock.on(CopyObjectCommand).resolves({});
      s3Mock.on(DeleteObjectCommand).resolves({});
      s3Mock.on(PutObjectCommand).resolves({});

      await plugin.movePage(guid, null);

      expect(s3Mock.commandCalls(PutObjectCommand).length).toBeGreaterThan(0);
    });

    it('should throw error on circular reference', async () => {
      const guid = uuidv4();

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

  describe('getAncestors', () => {
    it('should return empty array for root page', async () => {
      const guid = uuidv4();
      const pageContent = `---
title: "Root Page"
guid: "${guid}"
parentGuid: null
folderId: ""
status: "published"
tags: []
createdBy: "user-123"
modifiedBy: "user-123"
createdAt: "2026-02-10T12:00:00Z"
modifiedAt: "2026-02-10T12:00:00Z"
---

Content`;

      s3Mock.on(ListObjectsV2Command).resolves({
        Contents: [{ Key: `${guid}.md` }],
      });

      s3Mock.on(GetObjectCommand).callsFake(() => {
        return { Body: createMockStream(pageContent)() } as any;
      });

      const ancestors = await plugin.getAncestors(guid);
      expect(ancestors).toEqual([]);
    });

    it('should return parent for child page', async () => {
      const childGuid = uuidv4();
      const parentGuid = uuidv4();
      
      const childContent = `---
title: "Child Page"
guid: "${childGuid}"
parentGuid: "${parentGuid}"
folderId: "${parentGuid}"
status: "published"
tags: []
createdBy: "user-123"
modifiedBy: "user-123"
createdAt: "2026-02-10T12:00:00Z"
modifiedAt: "2026-02-10T12:00:00Z"
---

Content`;

      const parentContent = `---
title: "Parent Page"
guid: "${parentGuid}"
parentGuid: null
folderId: ""
status: "published"
tags: []
createdBy: "user-123"
modifiedBy: "user-123"
createdAt: "2026-02-10T12:00:00Z"
modifiedAt: "2026-02-10T12:00:00Z"
---

Content`;

      s3Mock.on(ListObjectsV2Command).resolves({
        Contents: [
          { Key: `${parentGuid}/${childGuid}.md` },
          { Key: `${parentGuid}.md` },
        ],
      });

      s3Mock.on(HeadObjectCommand).callsFake((input: any) => {
        const key = input.Key;
        if (key === `${childGuid}.md`) {
          throw { name: 'NotFound' };
        } else if (key === `${parentGuid}.md`) {
          return {};
        }
        return {};
      });

      s3Mock.on(GetObjectCommand).callsFake((input: any) => {
        if (input.Key === `${parentGuid}/${childGuid}.md`) {
          return { Body: createMockStream(childContent)() } as any;
        } else if (input.Key === `${parentGuid}.md`) {
          return { Body: createMockStream(parentContent)() } as any;
        }
        throw new Error('Key not found');
      });

      const ancestors = await plugin.getAncestors(childGuid);
      expect(ancestors).toHaveLength(1);
      expect(ancestors[0].guid).toBe(parentGuid);
      expect(ancestors[0].title).toBe('Parent Page');
    });

    it('should return full ancestor chain for nested page', async () => {
      const grandchildGuid = uuidv4();
      const childGuid = uuidv4();
      const parentGuid = uuidv4();

      const grandchildContent = `---
title: "Grandchild Page"
guid: "${grandchildGuid}"
parentGuid: "${childGuid}"
folderId: "${childGuid}"
status: "published"
tags: []
createdBy: "user-123"
modifiedBy: "user-123"
createdAt: "2026-02-10T12:00:00Z"
modifiedAt: "2026-02-10T12:00:00Z"
---

Content`;

      const childContent = `---
title: "Child Page"
guid: "${childGuid}"
parentGuid: "${parentGuid}"
folderId: "${parentGuid}"
status: "published"
tags: []
createdBy: "user-123"
modifiedBy: "user-123"
createdAt: "2026-02-10T12:00:00Z"
modifiedAt: "2026-02-10T12:00:00Z"
---

Content`;

      const parentContent = `---
title: "Parent Page"
guid: "${parentGuid}"
parentGuid: null
folderId: ""
status: "published"
tags: []
createdBy: "user-123"
modifiedBy: "user-123"
createdAt: "2026-02-10T12:00:00Z"
modifiedAt: "2026-02-10T12:00:00Z"
---

Content`;

      s3Mock.on(ListObjectsV2Command).resolves({
        Contents: [
          { Key: `${parentGuid}/${childGuid}/${grandchildGuid}.md` },
          { Key: `${parentGuid}/${childGuid}.md` },
          { Key: `${parentGuid}.md` },
        ],
      });

      s3Mock.on(GetObjectCommand).callsFake((input: any) => {
        if (input.Key.includes(grandchildGuid)) {
          return { Body: createMockStream(grandchildContent)() } as any;
        } else if (input.Key.includes(childGuid) && !input.Key.includes(grandchildGuid)) {
          return { Body: createMockStream(childContent)() } as any;
        } else if (input.Key === `${parentGuid}.md`) {
          return { Body: createMockStream(parentContent)() } as any;
        }
        throw new Error('Key not found');
      });

      const ancestors = await plugin.getAncestors(grandchildGuid);
      expect(ancestors).toHaveLength(2);
      expect(ancestors[0].guid).toBe(parentGuid);
      expect(ancestors[0].title).toBe('Parent Page');
      expect(ancestors[1].guid).toBe(childGuid);
      expect(ancestors[1].title).toBe('Child Page');
    });
  });

  describe('isDescendantOf', () => {
    it('should return true if page is itself', async () => {
      const guid = uuidv4();
      const result = await plugin.isDescendantOf(guid, guid);
      expect(result).toBe(true);
    });

    it('should return true if page is child of ancestor', async () => {
      const childGuid = uuidv4();
      const parentGuid = uuidv4();
      
      const childContent = `---
title: "Child Page"
guid: "${childGuid}"
parentGuid: "${parentGuid}"
folderId: "${parentGuid}"
status: "published"
tags: []
createdBy: "user-123"
modifiedBy: "user-123"
createdAt: "2026-02-10T12:00:00Z"
modifiedAt: "2026-02-10T12:00:00Z"
---

Content`;

      s3Mock.on(ListObjectsV2Command).resolves({
        Contents: [{ Key: `${parentGuid}/${childGuid}.md` }],
      });

      s3Mock.on(GetObjectCommand).callsFake(() => {
        return { Body: createMockStream(childContent)() } as any;
      });

      const result = await plugin.isDescendantOf(childGuid, parentGuid);
      expect(result).toBe(true);
    });

    it('should return false if pages are unrelated', async () => {
      const guid1 = uuidv4();
      const guid2 = uuidv4();
      
      const content1 = `---
title: "Page 1"
guid: "${guid1}"
parentGuid: null
folderId: ""
status: "published"
tags: []
createdBy: "user-123"
modifiedBy: "user-123"
createdAt: "2026-02-10T12:00:00Z"
modifiedAt: "2026-02-10T12:00:00Z"
---

Content`;

      s3Mock.on(ListObjectsV2Command).resolves({
        Contents: [{ Key: `${guid1}.md` }],
      });

      s3Mock.on(GetObjectCommand).callsFake(() => {
        return { Body: createMockStream(content1)() } as any;
      });

      const result = await plugin.isDescendantOf(guid1, guid2);
      expect(result).toBe(false);
    });
  });
});
