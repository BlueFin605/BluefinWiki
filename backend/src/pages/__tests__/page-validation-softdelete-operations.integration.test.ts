/**
 * Integration Tests for Page Validation and Soft Delete Operations
 * Task 4.4: Page Hierarchy Testing
 * 
 * Tests validation errors and soft delete functionality
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
  folderId: string | null
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

# ${title}
`;
}

describe('Page Operations - Validation Error Message Tests', () => {
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

  it('should throw error when page not found', async () => {
    const nonExistentGuid = uuidv4();

    s3Mock.on(HeadObjectCommand).rejects({ name: 'NotFound' });
    s3Mock.on(ListObjectsV2Command).resolves({ Contents: [] });

    await expect(plugin.loadPage(nonExistentGuid)).rejects.toThrow();
  });

  it('should throw descriptive error when attempting circular move', async () => {
    const pageGuid = uuidv4();

    s3Mock.on(HeadObjectCommand).callsFake((input: any) => {
      if (input.Key === `${pageGuid}.md`) {
        return Promise.resolve({});
      }
      return Promise.reject({ name: 'NotFound' });
    });

    s3Mock.on(ListObjectsV2Command).resolves({ Contents: [] });

    s3Mock.on(GetObjectCommand).callsFake((input: any) => {
      if (input.Key === `${pageGuid}.md`) {
        return Promise.resolve({
          Body: createMockStream(createMockPageContent(pageGuid, 'Page', null))(),
        });
      }
      return Promise.reject({ name: 'NoSuchKey' });
    });

    await expect(plugin.movePage(pageGuid, pageGuid)).rejects.toThrow();
  });

  it('should throw error when saving with invalid GUID', async () => {
    const invalidContent: PageContent = {
      guid: '',
      title: 'Test',
      content: '# Test',
      folderId: '',
      tags: [],
      status: 'published',
      createdBy: 'user-123',
      modifiedBy: 'user-123',
      createdAt: '2026-02-10T12:00:00Z',
      modifiedAt: '2026-02-10T12:00:00Z',
    };

    await expect(plugin.savePage('', null, invalidContent)).rejects.toThrow();
  });

  it('should throw error when parent folder does not exist', async () => {
    const pageGuid = uuidv4();
    const nonExistentParent = uuidv4();

    s3Mock.on(HeadObjectCommand).callsFake((input: any) => {
      if (input.Key === `${nonExistentParent}.md`) {
        return Promise.reject({ name: 'NotFound' });
      }
      return Promise.reject({ name: 'NotFound' });
    });

    s3Mock.on(ListObjectsV2Command).resolves({ Contents: [] });

    await expect(plugin.movePage(pageGuid, nonExistentParent)).rejects.toThrow();
  });

  it('should provide clear error message for S3 access denied', async () => {
    const pageGuid = uuidv4();

    s3Mock.on(GetObjectCommand).rejects({
      name: 'AccessDenied',
      message: 'Access Denied',
    });

    await expect(plugin.loadPage(pageGuid)).rejects.toThrow('Access Denied');
  });

  it('should handle malformed page content gracefully', async () => {
    const pageGuid = uuidv4();

    s3Mock.on(GetObjectCommand).callsFake((input: any) => {
      if (input.Key === `${pageGuid}.md`) {
        return Promise.resolve({
          Body: createMockStream('Invalid YAML content without frontmatter')(),
        });
      }
      return Promise.reject({ name: 'NoSuchKey' });
    });

    await expect(plugin.loadPage(pageGuid)).rejects.toThrow();
  });
});

describe('Page Operations - Soft Delete and Trash Tests', () => {
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

  it('should mark page as deleted instead of removing immediately', async () => {
    const pageGuid = uuidv4();

    s3Mock.on(HeadObjectCommand).callsFake((input: any) => {
      if (input.Key === `${pageGuid}.md`) {
        return Promise.resolve({});
      }
      return Promise.reject({ name: 'NotFound' });
    });

    s3Mock.on(GetObjectCommand).callsFake((input: any) => {
      if (input.Key === `${pageGuid}.md`) {
        return Promise.resolve({
          Body: createMockStream(createMockPageContent(pageGuid, 'Page', null))(),
        });
      }
      return Promise.reject({ name: 'NoSuchKey' });
    });

    s3Mock.on(ListObjectsV2Command).resolves({ Contents: [] });
    s3Mock.on(PutObjectCommand).resolves({});
    s3Mock.on(DeleteObjectCommand).resolves({});

    const softDeletedContent: PageContent = {
      guid: pageGuid,
      title: 'Page',
      content: '# Content',
      folderId: '',
      tags: [],
      status: 'deleted',
      createdBy: 'user-123',
      modifiedBy: 'user-123',
      createdAt: '2026-02-10T12:00:00Z',
      modifiedAt: '2026-02-12T10:00:00Z',
    };

    await plugin.savePage(pageGuid, null, softDeletedContent);

    const saveCalls = s3Mock.commandCalls(PutObjectCommand);
    expect(saveCalls).toHaveLength(1);

    const body = saveCalls[0].args[0].input.Body as string;
    expect(body).toContain('status: "deleted"');
  });

  it('should list only non-deleted pages by default', async () => {
    const parentGuid = uuidv4();
    const activeGuid = uuidv4();
    const deletedGuid = uuidv4();

    s3Mock.on(ListObjectsV2Command).callsFake((input: any) => {
      // When listing children of parent
      if (input.Prefix === `${parentGuid}/` && input.Delimiter === '/') {
        return Promise.resolve({
          Contents: [
            { Key: `${parentGuid}/${activeGuid}.md`, LastModified: new Date(), Size: 100 },
            { Key: `${parentGuid}/${deletedGuid}.md`, LastModified: new Date(), Size: 100 },
          ],
        });
      }
      // When searching for a page (findPageKey - no Prefix, no Delimiter)
      if (!input.Prefix && !input.Delimiter) {
        return Promise.resolve({
          Contents: [
            { Key: `${parentGuid}/${activeGuid}.md` },
            { Key: `${parentGuid}/${deletedGuid}.md` },
          ],
        });
      }
      // When checking if a child has children (hasChildrenDirect)
      if (input.Prefix && input.Prefix.endsWith('/') && input.MaxKeys === 1) {
        return Promise.resolve({ Contents: [] }); // No grandchildren
      }
      return Promise.resolve({ Contents: [] });
    });

    s3Mock.on(HeadObjectCommand).callsFake((input: any) => {
      if (input.Key === `${parentGuid}/${activeGuid}.md` || input.Key === `${parentGuid}/${deletedGuid}.md`) {
        return Promise.resolve({});
      }
      return Promise.reject({ name: 'NotFound' });
    });

    s3Mock.on(GetObjectCommand).callsFake((input: any) => {
      if (input.Key === `${parentGuid}/${activeGuid}.md`) {
        return Promise.resolve({
          Body: createMockStream(createMockPageContent(activeGuid, 'Active', parentGuid))(),
        });
      }
      if (input.Key === `${parentGuid}/${deletedGuid}.md`) {
        const deletedContent = `---
guid: "${deletedGuid}"
title: "Deleted"
folderId: "${parentGuid}"
status: "deleted"
tags: []
createdBy: "user-123"
modifiedBy: "user-123"
createdAt: "2026-02-10T12:00:00Z"
modifiedAt: "2026-02-12T10:00:00Z"
---

# Deleted`;
        return Promise.resolve({
          Body: createMockStream(deletedContent)(),
        });
      }
      return Promise.reject({ name: 'NoSuchKey' });
    });

    const children = await plugin.listChildren(parentGuid);
    const activeChildren = children.filter(c => c.status !== 'deleted');
    expect(activeChildren).toHaveLength(1);
    expect(activeChildren[0].guid).toBe(activeGuid);
  });

  it('should restore page from trash by updating status', async () => {
    const pageGuid = uuidv4();

    s3Mock.on(GetObjectCommand).callsFake((input: any) => {
      if (input.Key === `${pageGuid}.md`) {
        const deletedContent = `---
guid: "${pageGuid}"
title: "Trashed Page"
folderId: null
status: "deleted"
tags: []
createdBy: "user-123"
modifiedBy: "user-123"
createdAt: "2026-02-10T12:00:00Z"
modifiedAt: "2026-02-12T10:00:00Z"
---

# Content`;
        return Promise.resolve({
          Body: createMockStream(deletedContent)(),
        });
      }
      return Promise.reject({ name: 'NoSuchKey' });
    });

    s3Mock.on(PutObjectCommand).resolves({});

    const restoredContent: PageContent = {
      guid: pageGuid,
      title: 'Trashed Page',
      content: '# Content',
      folderId: '',
      tags: [],
      status: 'published',
      createdBy: 'user-123',
      modifiedBy: 'user-456',
      createdAt: '2026-02-10T12:00:00Z',
      modifiedAt: '2026-02-12T14:00:00Z',
    };

    await plugin.savePage(pageGuid, null, restoredContent);

    const saveCalls = s3Mock.commandCalls(PutObjectCommand);
    expect(saveCalls).toHaveLength(1);

    const body = saveCalls[0].args[0].input.Body as string;
    expect(body).toContain('status: "published"');
  });

  it('should permanently delete page after trash period', async () => {
    const pageGuid = uuidv4();

    s3Mock.on(HeadObjectCommand).callsFake((input: any) => {
      if (input.Key === `${pageGuid}.md`) {
        return Promise.resolve({});
      }
      return Promise.reject({ name: 'NotFound' });
    });

    s3Mock.on(ListObjectsV2Command).resolves({ Contents: [] });
    s3Mock.on(DeleteObjectCommand).resolves({});

    await plugin.deletePage(pageGuid, false);

    const deleteCalls = s3Mock.commandCalls(DeleteObjectCommand);
    expect(deleteCalls).toHaveLength(1);
    expect(deleteCalls[0].args[0].input.Key).toBe(`${pageGuid}.md`);
  });

  it('should handle soft delete with children', async () => {
    const parentGuid = uuidv4();
    const childGuid = uuidv4();

    s3Mock.on(HeadObjectCommand).callsFake((input: any) => {
      const key = input.Key as string;
      if (key.includes(parentGuid) || key.includes(childGuid)) {
        return Promise.resolve({});
      }
      return Promise.reject({ name: 'NotFound' });
    });

    s3Mock.on(GetObjectCommand).callsFake((input: any) => {
      if (input.Key === `${parentGuid}.md`) {
        return Promise.resolve({
          Body: createMockStream(createMockPageContent(parentGuid, 'Parent', null))(),
        });
      }
      if (input.Key === `${parentGuid}/${childGuid}.md`) {
        return Promise.resolve({
          Body: createMockStream(createMockPageContent(childGuid, 'Child', parentGuid))(),
        });
      }
      return Promise.reject({ name: 'NoSuchKey' });
    });

    s3Mock.on(ListObjectsV2Command).callsFake((input: any) => {
      if (input.Prefix === `${parentGuid}/` && input.Delimiter === '/') {
        return Promise.resolve({
          Contents: [
            { Key: `${parentGuid}/${childGuid}.md`, LastModified: new Date(), Size: 100 },
          ],
        });
      }
      if (!input.Prefix && !input.ContinuationToken) {
        return Promise.resolve({
          Contents: [
            { Key: `${parentGuid}.md` },
            { Key: `${parentGuid}/${childGuid}.md` },
          ],
        });
      }
      return Promise.resolve({ Contents: [] });
    });

    s3Mock.on(PutObjectCommand).resolves({});

    const deletedParent: PageContent = {
      guid: parentGuid,
      title: 'Parent',
      content: '# Parent',
      folderId: '',
      tags: [],
      status: 'deleted',
      createdBy: 'user-123',
      modifiedBy: 'user-123',
      createdAt: '2026-02-10T12:00:00Z',
      modifiedAt: '2026-02-12T10:00:00Z',
    };

    await plugin.savePage(parentGuid, null, deletedParent);

    const saveCalls = s3Mock.commandCalls(PutObjectCommand);
    expect(saveCalls.length).toBeGreaterThan(0);

    const body = saveCalls[0].args[0].input.Body as string;
    expect(body).toContain('status: "deleted"');
  });
});
