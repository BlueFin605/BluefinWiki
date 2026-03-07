/**
 * Unit tests for S3StoragePlugin
 * 
 * These tests mock the S3 client to verify plugin behavior without
 * requiring actual AWS/LocalStack connections.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
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
  HeadBucketCommand,
  CopyObjectCommand,
} from '@aws-sdk/client-s3';
import { Readable } from 'stream';

// Helper to create mock streams for S3 GetObject responses
const createMockStream = (content: string) => {
  return () => {
    const stream = new Readable();
    stream.push(content);
    stream.push(null);
    return stream;
  };
};

// Test constants
const TEST_BUCKET = 'test-bucket';
const TEST_REGION = 'us-east-1';

describe('S3StoragePlugin', () => {
  let s3Mock: ReturnType<typeof mockClient>;
  let plugin: S3StoragePlugin;

  beforeEach(() => {
    // Create mock S3 client
    s3Mock = mockClient(S3Client);
    
    // Initialize plugin with mocked client
    plugin = new S3StoragePlugin({
      bucketName: TEST_BUCKET,
      region: TEST_REGION,
    });

    // Inject the mocked client
    (plugin as any).s3Client = s3Mock as any;
  });

  afterEach(() => {
    s3Mock.reset();
  });

  describe('savePage', () => {
    it('should save a page to S3 with frontmatter', async () => {
      const pageGuid = uuidv4();
      const content: PageContent = {
        guid: pageGuid,
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

      await plugin.savePage(pageGuid, null, content);

      const calls = s3Mock.commandCalls(PutObjectCommand);
      expect(calls.length).toBeGreaterThan(0);
      
      const firstCall = calls[0];
      expect(firstCall.args[0].input.Bucket).toBe(TEST_BUCKET);
      expect(firstCall.args[0].input.Key).toBe(`${pageGuid}/${pageGuid}.md`);
      
      const body = firstCall.args[0].input.Body as string;
      expect(body).toContain('---');
      expect(body).toContain('title: "Test Page"');
      expect(body).toContain('# Hello World');
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

      // Mock HeadObject for findPageKey - only parent exists at root level
      s3Mock.on(HeadObjectCommand).callsFake((input: any) => {
        const key = input.Key as string;
        // Parent page at root
        if (key === `${guid}/${guid}.md`) {
          return { ContentLength: 100, LastModified: new Date() };
        }
        // Children are NOT at root level, they're nested
        throw { name: 'NotFound' };
      });

      // Mock that children exist - listChildren uses CommonPrefixes (folders)
      s3Mock.on(ListObjectsV2Command).callsFake((input: any) => {
        // For listChildren: Prefix=${guid}/, Delimiter=/
        if (input.Prefix === `${guid}/` && input.Delimiter === '/') {
          return {
            CommonPrefixes: [
              { Prefix: `${guid}/${child1Guid}/` },
              { Prefix: `${guid}/${child2Guid}/` },
              { Prefix: `${guid}/${guid}/` }, // parent's own folder
            ],
          };
        }
        // For hasChildrenDirect checks on child pages
        if ((input.Prefix === `${guid}/${child1Guid}/` || input.Prefix === `${guid}/${child2Guid}/`) && input.Delimiter === '/') {
          return { CommonPrefixes: [] };
        }
        // For findPageKey search (no Prefix/Delimiter) - return all files
        if (!input.Prefix && !input.Delimiter) {
          return {
            Contents: [
              { Key: `${guid}/${guid}.md` },
              { Key: `${guid}/${child1Guid}/${child1Guid}.md` },
              { Key: `${guid}/${child2Guid}/${child2Guid}.md` },
            ],
          };
        }
        return { Contents: [] };
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

      // Mock HeadObject for finding pages - only parent at root
      s3Mock.on(HeadObjectCommand).callsFake((input: any) => {
        const key = input.Key as string;
        // Parent at root level
        if (key === `${guid}/${guid}.md`) {
          return { ContentLength: 100, LastModified: new Date() };
        }
        // Children NOT at root
        throw { name: 'NotFound' };
      });

      // Mock ListObjects calls: listChildren uses CommonPrefixes, deletion uses Contents
      s3Mock.on(ListObjectsV2Command).callsFake((input: any) => {
        // For listChildren: Prefix=${guid}/, Delimiter=/
        if (input.Prefix === `${guid}/` && input.Delimiter === '/') {
          return {
            CommonPrefixes: [
              { Prefix: `${guid}/${child1Guid}/` },
              { Prefix: `${guid}/${child2Guid}/` },
              { Prefix: `${guid}/${guid}/` }, // parent's own folder
            ],
          };
        }
        // For hasChildrenDirect checks on child pages
        if ((input.Prefix === `${guid}/${child1Guid}/` || input.Prefix === `${guid}/${child2Guid}/`) && input.Delimiter === '/') {
          return { CommonPrefixes: [] };
        }
        // For findPageKey search (no Prefix/Delimiter) - return all files
        if (!input.Prefix && !input.Delimiter) {
          return {
            Contents: [
              { Key: `${guid}/${guid}.md` },
              { Key: `${guid}/${child1Guid}/${child1Guid}.md` },
              { Key: `${guid}/${child2Guid}/${child2Guid}.md` },
            ],
          };
        }
        // For deletion listing: Prefix=${guid}/, no Delimiter
        if (input.Prefix === `${guid}/` && !input.Delimiter) {
          return {
            Contents: [
              { Key: `${guid}/${guid}.md` },
              { Key: `${guid}/${child1Guid}/${child1Guid}.md` },
              { Key: `${guid}/${child2Guid}/${child2Guid}.md` },
            ],
          };
        }
        return { Contents: [] };
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
        if (input.Key === `${guid}/${guid}.md`) {
          return { ContentLength: 100, LastModified: new Date() };
        }
        throw { name: 'NotFound' };
      });

      s3Mock.on(ListObjectVersionsCommand).resolves({
        Versions: [
          {
            Key: `${guid}/${guid}.md`,
            VersionId: 'v2',
            LastModified: new Date('2026-02-10T14:00:00Z'),
            Size: 200,
          },
          {
            Key: `${guid}/${guid}.md`,
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

      // Mock HeadObject for findPageKey - parent and child pages
      s3Mock.on(HeadObjectCommand).callsFake((input: any) => {
        // Parent at root level
        if (input.Key === `${parentGuid}/${parentGuid}.md`) {
          return { ContentLength: 100, LastModified: new Date() };
        }
        // Child page under parent
        if (input.Key === `${parentGuid}/${childGuid}/${childGuid}.md`) {
          return { ContentLength: 100, LastModified: new Date() };
        }
        throw { name: 'NotFound' };
      });

      // Mock ListObjectsV2Command
      s3Mock.on(ListObjectsV2Command).callsFake((input: any) => {
        // For finding pages (no Prefix/Delimiter) - return all pages
        if (!input.Prefix && !input.Delimiter) {
          return {
            Contents: [
              { Key: `${parentGuid}/${parentGuid}.md` },
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
        // For hasChildrenDirect checks on child
        if (input.Prefix === `${parentGuid}/${childGuid}/` && input.Delimiter === '/') {
          return { CommonPrefixes: [] };
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
        if (input.Key === `${guid}/${guid}.md`) {
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
          { Key: `${oldParentGuid}/${guid}/${guid}.md` },
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
          { Key: `${parentGuid}/${childGuid}/${childGuid}.md` },
          { Key: `${parentGuid}/${parentGuid}.md` },
        ],
      });

      s3Mock.on(HeadObjectCommand).callsFake((input: any) => {
        const key = input.Key;
        if (key === `${childGuid}/${childGuid}.md`) {
          throw { name: 'NotFound' };
        } else if (key === `${parentGuid}/${parentGuid}.md`) {
          return {};
        }
        return {};
      });

      s3Mock.on(GetObjectCommand).callsFake((input: any) => {
        if (input.Key === `${parentGuid}/${childGuid}/${childGuid}.md`) {
          return { Body: createMockStream(childContent)() } as any;
        } else if (input.Key === `${parentGuid}/${parentGuid}.md`) {
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
          { Key: `${parentGuid}/${childGuid}/${grandchildGuid}/${grandchildGuid}.md` },
          { Key: `${parentGuid}/${childGuid}/${childGuid}.md` },
          { Key: `${parentGuid}/${parentGuid}.md` },
        ],
      });

      s3Mock.on(GetObjectCommand).callsFake((input: any) => {
        if (input.Key.includes(grandchildGuid)) {
          return { Body: createMockStream(grandchildContent)() } as any;
        } else if (input.Key.includes(childGuid) && !input.Key.includes(grandchildGuid)) {
          return { Body: createMockStream(childContent)() } as any;
        } else if (input.Key === `${parentGuid}/${parentGuid}.md`) {
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

  describe('Attachment Operations', () => {
    describe('uploadAttachment', () => {
      it('should upload an attachment to the pages bucket', async () => {
        const pageGuid = uuidv4();
        const pageContent = `---
title: "Test Page"
guid: "${pageGuid}"
parentGuid: null
folderId: ""
status: "published"
tags: []
createdBy: "user-123"
modifiedBy: "user-123"
createdAt: "2026-02-10T12:00:00Z"
modifiedAt: "2026-02-10T12:00:00Z"
---

Test content`;

        // Mock page exists check
        s3Mock.on(GetObjectCommand).resolves({
          Body: createMockStream(pageContent)() as any,
        });

        s3Mock.on(PutObjectCommand).resolves({});

        const fileData = Buffer.from('fake file content');
        const result = await plugin.uploadAttachment(pageGuid, {
          originalFilename: 'test-document.pdf',
          contentType: 'application/pdf',
          data: fileData,
          uploadedBy: 'user-123',
        });

        expect(result).toMatchObject({
          filename: 'test-document.pdf',
          contentType: 'application/pdf',
          size: fileData.length,
        });
        expect(result.attachmentGuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
        expect(result.attachmentKey).toContain(`${pageGuid}/_attachments/`);

        // Verify S3 PutObject was called
        const putCalls = s3Mock.commandCalls(PutObjectCommand);
        expect(putCalls.length).toBeGreaterThan(0);
        const lastCall = putCalls[putCalls.length - 1];
        expect(lastCall.args[0].input.Bucket).toBe('test-bucket');
        expect(lastCall.args[0].input.Key).toContain(`${pageGuid}/_attachments/`);
        expect(lastCall.args[0].input.ContentType).toBe('application/pdf');
      });

      it('should support various file extensions', async () => {
        const pageGuid = uuidv4();
          const pageContent = `---
  title: "Test Page"
  guid: "${pageGuid}"
  parentGuid: null
  folderId: ""
  status: "published"
  tags: []
  createdBy: "user-123"
  modifiedBy: "user-123"
  createdAt: "2026-02-10T12:00:00Z"
  modifiedAt: "2026-02-10T12:00:00Z"
  ---

  Test content`;

          // Mock page exists check
          s3Mock.on(GetObjectCommand).resolves({
            Body: createMockStream(pageContent)() as any,
          });

          s3Mock.on(PutObjectCommand).resolves({});

          // Test PNG
          const pngResult = await plugin.uploadAttachment(pageGuid, {
            originalFilename: 'image.png',
            contentType: 'image/png',
            data: Buffer.from('content'),
            uploadedBy: 'user-123',
          });
          expect(pngResult.filename).toBe('image.png');
          expect(pngResult.attachmentKey).toContain('.png');

          // Test DOCX
          const docxResult = await plugin.uploadAttachment(pageGuid, {
            originalFilename: 'document.docx',
            contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            data: Buffer.from('content'),
            uploadedBy: 'user-123',
          });
          expect(docxResult.filename).toBe('document.docx');
          expect(docxResult.attachmentKey).toContain('.docx');
      });

      it('should reject invalid page GUID', async () => {
        await expect(
          plugin.uploadAttachment('invalid-guid', {
            originalFilename: 'test.pdf',
            contentType: 'application/pdf',
            data: Buffer.from('test'),
            uploadedBy: 'user-123',
          })
        ).rejects.toThrow(/Invalid page GUID format/i);
      });

      it('should reject upload if page does not exist', async () => {
        const pageGuid = uuidv4();

        s3Mock.on(GetObjectCommand).rejects({ name: 'NoSuchKey' });

        await expect(
          plugin.uploadAttachment(pageGuid, {
            originalFilename: 'test.pdf',
            contentType: 'application/pdf',
            data: Buffer.from('test'),
            uploadedBy: 'user-123',
          })
        ).rejects.toThrow(/Page not found/i);
      });
    });

    describe('deleteAttachment', () => {
      it('should delete attachment file and metadata sidecar from S3', async () => {
        const pageGuid = uuidv4();
        const attachmentGuid = uuidv4();

        // Mock finding the attachment key
        s3Mock.on(ListObjectsV2Command).resolves({
          Contents: [
            { Key: `${pageGuid}/_attachments/${attachmentGuid}.pdf` },
          ],
        });

        s3Mock.on(DeleteObjectsCommand).resolves({});

        await plugin.deleteAttachment(pageGuid, attachmentGuid);

        // Verify both file and metadata delete were requested
        const deleteCalls = s3Mock.commandCalls(DeleteObjectsCommand);
        expect(deleteCalls.length).toBeGreaterThan(0);
        const lastCall = deleteCalls[deleteCalls.length - 1];
        expect(lastCall.args[0].input.Delete?.Objects).toEqual([
          { Key: `${pageGuid}/_attachments/${attachmentGuid}.pdf` },
          { Key: `${pageGuid}/_attachments/${attachmentGuid}.meta.json` },
        ]);
      });

      it('should reject invalid page GUID', async () => {
        const attachmentGuid = uuidv4();
        await expect(
          plugin.deleteAttachment('invalid-guid', attachmentGuid)
        ).rejects.toThrow(/Invalid GUID format/i);
      });

      it('should reject invalid attachment GUID', async () => {
        const pageGuid = uuidv4();
        await expect(
          plugin.deleteAttachment(pageGuid, 'invalid-guid')
        ).rejects.toThrow(/Invalid GUID format/i);
      });

      it('should throw error if attachment not found', async () => {
        const pageGuid = uuidv4();
        const attachmentGuid = uuidv4();

        s3Mock.on(ListObjectsV2Command).resolves({
          Contents: [],
        });

        await expect(
          plugin.deleteAttachment(pageGuid, attachmentGuid)
        ).rejects.toThrow(/Attachment not found/i);
      });
    });

    describe('saveAttachmentMetadata', () => {
      it('should save metadata as .meta.json sidecar file', async () => {
        const pageGuid = uuidv4();
        const attachmentGuid = uuidv4();
        const metadata = {
          attachmentId: attachmentGuid,
          originalFilename: 'test-document.pdf',
          contentType: 'application/pdf',
          size: 12345,
          uploadedAt: '2026-03-07T12:00:00Z',
          uploadedBy: 'user-123',
          checksum: 'abc123def456',
        };

        s3Mock.on(PutObjectCommand).resolves({});

        await plugin.saveAttachmentMetadata(pageGuid, attachmentGuid, metadata);

        // Verify metadata was saved
        const putCalls = s3Mock.commandCalls(PutObjectCommand);
        expect(putCalls.length).toBeGreaterThan(0);
        const lastCall = putCalls[putCalls.length - 1];
        expect(lastCall.args[0].input.Key).toBe(`${pageGuid}/_attachments/${attachmentGuid}.meta.json`);
        expect(lastCall.args[0].input.ContentType).toBe('application/json');

        const savedBody = JSON.parse(lastCall.args[0].input.Body as string);
        expect(savedBody).toEqual(metadata);
      });

      it('should reject invalid GUIDs', async () => {
        const attachmentGuid = uuidv4();
        await expect(
          plugin.saveAttachmentMetadata('invalid-guid', attachmentGuid, {} as any)
        ).rejects.toThrow(/Invalid GUID format/i);
      });
    });

    describe('getAttachmentUrl', () => {
      it('should generate a presigned URL for the attachment', async () => {
        const pageGuid = uuidv4();
        const attachmentGuid = uuidv4();

        // Mock finding the attachment key
        s3Mock.on(ListObjectsV2Command).resolves({
          Contents: [
            { Key: `${pageGuid}/_attachments/${attachmentGuid}.pdf` },
          ],
        });

        const url = await plugin.getAttachmentUrl(pageGuid, attachmentGuid);

        expect(url).toBeTruthy();
        expect(typeof url).toBe('string');
        // Presigned URLs should contain the bucket and key
        expect(url).toContain('test-bucket');
      });

      it('should throw error if attachment not found', async () => {
        const pageGuid = uuidv4();
        const attachmentGuid = uuidv4();

        s3Mock.on(ListObjectsV2Command).resolves({
          Contents: [],
        });

        await expect(
          plugin.getAttachmentUrl(pageGuid, attachmentGuid)
        ).rejects.toThrow(/Attachment not found/i);
      });

      it('should reject invalid GUIDs', async () => {
        const attachmentGuid = uuidv4();
        await expect(
          plugin.getAttachmentUrl('invalid-guid', attachmentGuid)
        ).rejects.toThrow(/Invalid GUID format/i);
      });
    });
  });
});
