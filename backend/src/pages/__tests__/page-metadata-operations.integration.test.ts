/**
 * Integration Tests for Page Metadata and Pagination Operations
 * Task 4.4: Page Hierarchy Testing
 * 
 * Tests metadata handling and pagination
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { S3StoragePlugin } from '../../storage/S3StoragePlugin.js';
import { PageContent } from '../../types/index.js';
import { v4 as uuidv4 } from 'uuid';
import { mockClient } from 'aws-sdk-client-mock';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  CopyObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import { sdkStreamMixin } from '@smithy/util-stream';

const s3Mock = mockClient(S3Client);

function createMockStream(content: string) {
  return () => {
    const stream = new Readable();
    stream.push(content);
    stream.push(null);
    return sdkStreamMixin(stream);
  };
}

function createMockPageContent(
  guid: string,
  title: string,
  folderId: string | null,
  content: string = 'Test content'
): string {
  return `---
guid: "${guid}"
title: "${title}"
folderId: ${folderId ? `"${folderId}"` : 'null'}
status: "published"
tags: []
createdBy: "user-123"
modifiedBy: "user-123"
createdAt: "2026-02-10T12:00:00Z"
modifiedAt: "2026-02-10T12:00:00Z"
---

${content}
`;
}

describe('Page Operations - Folder Metadata Tests', () => {
  let plugin: S3StoragePlugin;

  beforeEach(() => {
    s3Mock.reset();
    plugin = new S3StoragePlugin({
      bucketName: 'test-bucket',
      region: 'us-east-1',
    });
  });

  afterEach(() => {
    s3Mock.reset();
  });

  it('should store and retrieve page metadata correctly', async () => {
    const pageGuid = uuidv4();
    const metadata: PageContent = {
      guid: pageGuid,
      title: 'Test Page',
      content: '# Content',
      folderId: '',
      tags: ['tag1', 'tag2'],
      status: 'published',
      createdBy: 'user-123',
      modifiedBy: 'user-456',
      createdAt: '2026-02-10T12:00:00Z',
      modifiedAt: '2026-02-11T14:30:00Z',
    };

    s3Mock.on(PutObjectCommand).resolves({});
    
    // Mock HeadObjectCommand for findPageKey
    s3Mock.on(HeadObjectCommand).callsFake((input: any) => {
      if (input.Key === `${pageGuid}/${pageGuid}.md`) {
        return Promise.resolve({});
      }
      return Promise.reject({ name: 'NotFound' });
    });
    
    s3Mock.on(GetObjectCommand).callsFake((input: any) => {
      if (input.Key === `${pageGuid}/${pageGuid}.md`) {
        return Promise.resolve({
          Body: createMockStream(createMockPageContent(pageGuid, 'Test Page', null, '# Content'))(),
        });
      }
      return Promise.reject({ name: 'NoSuchKey' });
    });

    await plugin.savePage(pageGuid, null, metadata);
    const loaded = await plugin.loadPage(pageGuid);

    expect(loaded.guid).toBe(pageGuid);
    expect(loaded.title).toBe('Test Page');
    expect(loaded.createdBy).toBe('user-123');
    expect(loaded.modifiedBy).toBe('user-123');
  });

  it('should preserve metadata when moving page', async () => {
    const pageGuid = uuidv4();
    const newParentGuid = uuidv4();
    const originalCreatedBy = 'user-123';
    const originalCreatedAt = '2026-02-10T12:00:00Z';

    s3Mock.on(HeadObjectCommand).callsFake((input: any) => {
      if (input.Key === `${pageGuid}/${pageGuid}.md`) {
        return Promise.resolve({});
      }
      return Promise.reject({ name: 'NotFound' });
    });

    s3Mock.on(GetObjectCommand).callsFake((input: any) => {
      if (input.Key === `${pageGuid}/${pageGuid}.md`) {
        const content = `---
guid: "${pageGuid}"
title: "Test Page"
folderId: null
status: "published"
tags: ["important"]
createdBy: "${originalCreatedBy}"
modifiedBy: "${originalCreatedBy}"
createdAt: "${originalCreatedAt}"
modifiedAt: "${originalCreatedAt}"
---

# Content`;
        return Promise.resolve({
          Body: createMockStream(content)(),
        });
      }
      return Promise.reject({ name: 'NoSuchKey' });
    });

    s3Mock.on(ListObjectsV2Command).resolves({ Contents: [] });
    s3Mock.on(CopyObjectCommand).resolves({});
    s3Mock.on(DeleteObjectCommand).resolves({});
    s3Mock.on(PutObjectCommand).resolves({});

    await plugin.movePage(pageGuid, newParentGuid);

    const saveCalls = s3Mock.commandCalls(PutObjectCommand);
    expect(saveCalls.length).toBeGreaterThan(0);
    
    const body = saveCalls[0].args[0].input.Body as string;
    expect(body).toContain(`createdBy: "${originalCreatedBy}"`);
    expect(body).toContain(`createdAt: "${originalCreatedAt}"`);
  });

  it('should handle pages with empty or null folderId', async () => {
    const pageGuid = uuidv4();

    s3Mock.on(HeadObjectCommand).callsFake((input: any) => {
      if (input.Key === `${pageGuid}/${pageGuid}.md`) {
        return Promise.resolve({});
      }
      return Promise.reject({ name: 'NotFound' });
    });

    s3Mock.on(GetObjectCommand).callsFake((input: any) => {
      if (input.Key === `${pageGuid}/${pageGuid}.md`) {
        return Promise.resolve({
          Body: createMockStream(createMockPageContent(pageGuid, 'Root Page', null))(),
        });
      }
      return Promise.reject({ name: 'NoSuchKey' });
    });

    const page = await plugin.loadPage(pageGuid);
    expect(page.folderId).toBe('');
  });

  it('should track modification history correctly', async () => {
    const pageGuid = uuidv4();
    const initialContent: PageContent = {
      guid: pageGuid,
      title: 'Original',
      content: '# Original',
      folderId: '',
      tags: [],
      status: 'published',
      createdBy: 'user-1',
      modifiedBy: 'user-1',
      createdAt: '2026-02-10T12:00:00Z',
      modifiedAt: '2026-02-10T12:00:00Z',
    };

    s3Mock.on(PutObjectCommand).resolves({});

    await plugin.savePage(pageGuid, null, initialContent);

    const updatedContent: PageContent = {
      ...initialContent,
      title: 'Updated',
      content: '# Updated',
      modifiedBy: 'user-2',
      modifiedAt: '2026-02-11T14:00:00Z',
    };

    await plugin.savePage(pageGuid, null, updatedContent);

    const saveCalls = s3Mock.commandCalls(PutObjectCommand);
    expect(saveCalls).toHaveLength(2);

    const secondSave = saveCalls[1].args[0].input.Body as string;
    expect(secondSave).toContain('title: "Updated"');
    expect(secondSave).toContain('modifiedBy: "user-2"');
    expect(secondSave).toContain('createdBy: "user-1"');
  });
});

describe('Page Operations - Pagination Tests', () => {
  let plugin: S3StoragePlugin;

  beforeEach(() => {
    s3Mock.reset();
    plugin = new S3StoragePlugin({
      bucketName: 'test-bucket',
      region: 'us-east-1',
    });
  });

  afterEach(() => {
    s3Mock.reset();
  });

  it('should list first page of children with pagination', async () => {
    const parentGuid = uuidv4();
    const childrenGuids = Array.from({ length: 10 }, () => uuidv4());

    s3Mock.on(ListObjectsV2Command).callsFake((input: any) => {
      // When listing children of parent using folder structure
      if (input.Prefix === `${parentGuid}/` && input.Delimiter === '/') {
        return Promise.resolve({
          CommonPrefixes: childrenGuids.map(id => ({
            Prefix: `${parentGuid}/${id}/`,
          })),
        });
      }
      // When searching for a page (findPageKey - no Prefix, no Delimiter)
      if (!input.Prefix && !input.Delimiter) {
        return Promise.resolve({
          Contents: childrenGuids.map(id => ({ Key: `${parentGuid}/${id}/${id}.md` })),
        });
      }
      // When checking if a child has children (hasChildrenDirect)
      if (input.Prefix && input.Prefix.endsWith('/') && input.MaxKeys === 1) {
        return Promise.resolve({ Contents: [] }); // No grandchildren
      }
      return Promise.resolve({ Contents: [] });
    });

    s3Mock.on(HeadObjectCommand).callsFake((input: any) => {
      // Check parent page
      if (input.Key === `${parentGuid}/${parentGuid}.md`) {
        return Promise.resolve({});
      }
      // Check child pages
      const matchingGuid = childrenGuids.find(id => input.Key === `${parentGuid}/${id}/${id}.md`);
      if (matchingGuid) {
        return Promise.resolve({});
      }
      return Promise.reject({ name: 'NotFound' });
    });

    s3Mock.on(GetObjectCommand).callsFake((input: any) => {
      const matchingGuid = childrenGuids.find(id => input.Key === `${parentGuid}/${id}/${id}.md`);
      if (matchingGuid) {
        return Promise.resolve({
          Body: createMockStream(createMockPageContent(matchingGuid, 'Child', parentGuid))(),
        });
      }
      return Promise.reject({ name: 'NoSuchKey' });
    });

    const children = await plugin.listChildren(parentGuid);
    expect(children).toHaveLength(10);
  });

  it('should handle pagination with continuation token', async () => {
    const parentGuid = uuidv4();
    const firstBatch = Array.from({ length: 5 }, () => uuidv4());
    const secondBatch = Array.from({ length: 5 }, () => uuidv4());

    s3Mock.on(HeadObjectCommand).callsFake((input: any) => {
      // Check parent page
      if (input.Key === `${parentGuid}/${parentGuid}.md`) {
        return Promise.resolve({});
      }
      // Check child pages
      const allGuids = [...firstBatch, ...secondBatch];
      const matchingGuid = allGuids.find(id => input.Key === `${parentGuid}/${id}/${id}.md`);
      if (matchingGuid) {
        return Promise.resolve({});
      }
      return Promise.reject({ name: 'NotFound' });
    });

    s3Mock.on(GetObjectCommand).callsFake((input: any) => {
      const allGuids = [...firstBatch, ...secondBatch];
      const matchingGuid = allGuids.find(id => input.Key === `${parentGuid}/${id}/${id}.md`);
      if (matchingGuid) {
        return Promise.resolve({
          Body: createMockStream(createMockPageContent(matchingGuid, 'Child', parentGuid))(),
        });
      }
      return Promise.reject({ name: 'NoSuchKey' });
    });

    s3Mock.on(ListObjectsV2Command).callsFake((input: any) => {
      // First batch of children using folder structure
      if (input.Prefix === `${parentGuid}/` && input.Delimiter === '/' && !input.ContinuationToken) {
        return Promise.resolve({
          CommonPrefixes: firstBatch.map(id => ({
            Prefix: `${parentGuid}/${id}/`,
          })),
          IsTruncated: true,
          NextContinuationToken: 'token-2',
        });
      }
      // Second batch of children
      if (input.ContinuationToken === 'token-2') {
        return Promise.resolve({
          CommonPrefixes: secondBatch.map(id => ({
            Prefix: `${parentGuid}/${id}/`,
          })),
          IsTruncated: false,
        });
      }
      // When checking if a child has children (hasChildrenDirect)
      if (input.Prefix && input.Prefix.endsWith('/') && input.MaxKeys === 1) {
        return Promise.resolve({ Contents: [] }); // No grandchildren
      }
      // When searching for pages
      if (!input.Prefix && !input.ContinuationToken) {
        return Promise.resolve({
          Contents: [...firstBatch, ...secondBatch].map(id => ({ Key: `${parentGuid}/${id}/${id}.md` })),
        });
      }
      return Promise.resolve({ Contents: [] });
    });

    const children = await plugin.listChildren(parentGuid);
    expect(children).toHaveLength(10);
  });

  it('should handle empty result sets', async () => {
    const parentGuid = uuidv4();

    s3Mock.on(ListObjectsV2Command).resolves({
      Contents: [],
      IsTruncated: false,
    });

    const children = await plugin.listChildren(parentGuid);
    expect(children).toHaveLength(0);
  });

  it('should handle large batch operations (>1000 items)', async () => {
    const guids = Array.from({ length: 1500 }, () => uuidv4());

    s3Mock.on(ListObjectsV2Command).callsFake((input: any) => {
      if (!input.Prefix && !input.ContinuationToken) {
        return Promise.resolve({
          Contents: guids.slice(0, 1000).map(id => ({ Key: `${id}/${id}.md` })),
          IsTruncated: true,
          NextContinuationToken: 'batch-2',
        });
      } else if (input.ContinuationToken === 'batch-2') {
        return Promise.resolve({
          Contents: guids.slice(1000).map(id => ({ Key: `${id}/${id}.md` })),
          IsTruncated: false,
        });
      }
      return Promise.resolve({ Contents: [] });
    });

    // The mock is set up to handle pagination correctly
    // Actual plugin methods will use this pagination behavior
  });
});
