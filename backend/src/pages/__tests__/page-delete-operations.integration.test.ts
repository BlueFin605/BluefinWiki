/**
 * Integration Tests for Page Delete Operations
 * Task 4.4: Page Hierarchy Testing
 * 
 * Tests deleting pages with and without children
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { S3StoragePlugin } from '../../storage/S3StoragePlugin.js';
import { v4 as uuidv4 } from 'uuid';
import { mockClient } from 'aws-sdk-client-mock';
import {
  S3Client,
  GetObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
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

describe('Page Operations - Delete Pages with Children', () => {
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

  it('should delete page without children', async () => {
    const pageGuid = uuidv4();

    s3Mock.on(HeadObjectCommand).callsFake((input: any) => {
      if (input.Key === `${pageGuid}.md`) {
        return Promise.resolve({});
      }
      return Promise.reject({ name: 'NotFound' });
    });

    s3Mock.on(ListObjectsV2Command, {
      Prefix: `${pageGuid}/`,
    }).resolves({
      Contents: [],
    });

    s3Mock.on(DeleteObjectCommand).resolves({});

    await plugin.deletePage(pageGuid, false);

    const deleteCalls = s3Mock.commandCalls(DeleteObjectCommand);
    expect(deleteCalls).toHaveLength(1);
    expect(deleteCalls[0].args[0].input.Key).toBe(`${pageGuid}.md`);
  });

  it('should reject deleting page with children when recursive=false', async () => {
    const pageGuid = uuidv4();
    const childGuid = uuidv4();

    s3Mock.on(HeadObjectCommand).callsFake((input: any) => {
      if (input.Key === `${pageGuid}.md`) {
        return Promise.resolve({});
      }
      if (input.Key === `${childGuid}.md`) {
        return Promise.reject({ name: 'NotFound' });
      }
      if (input.Key === `${pageGuid}/${childGuid}.md`) {
        return Promise.resolve({});
      }
      return Promise.reject({ name: 'NotFound' });
    });

    s3Mock.on(GetObjectCommand).callsFake((input: any) => {
      if (input.Key === `${pageGuid}/${childGuid}.md`) {
        return Promise.resolve({
          Body: createMockStream(createMockPageContent(childGuid, 'Child', pageGuid))(),
        });
      }
      return Promise.reject({ name: 'NoSuchKey' });
    });

    s3Mock.on(ListObjectsV2Command).callsFake((input: any) => {
      if (input.Prefix === `${pageGuid}/` && input.Delimiter === '/') {
        return Promise.resolve({
          Contents: [
            {
              Key: `${pageGuid}/${childGuid}.md`,
              LastModified: new Date(),
              Size: 100,
            },
          ],
        });
      }
      if (!input.Prefix && !input.ContinuationToken) {
        return Promise.resolve({
          Contents: [
            { Key: `${pageGuid}.md` },
            { Key: `${pageGuid}/${childGuid}.md` },
          ],
        });
      }
      if (input.Prefix === `${childGuid}/` && input.Delimiter === '/') {
        return Promise.resolve({ Contents: [] });
      }
      return Promise.resolve({ Contents: [] });
    });

    await expect(plugin.deletePage(pageGuid, false)).rejects.toThrow();
  });

  it('should delete page with children recursively', async () => {
    const pageGuid = uuidv4();
    const childGuid = uuidv4();

    s3Mock.on(HeadObjectCommand).callsFake((input: any) => {
      if (input.Key === `${pageGuid}.md`) {
        return Promise.resolve({});
      }
      if (input.Key === `${childGuid}.md`) {
        return Promise.reject({ name: 'NotFound' });
      }
      if (input.Key === `${pageGuid}/${childGuid}.md`) {
        return Promise.resolve({});
      }
      return Promise.reject({ name: 'NotFound' });
    });

    s3Mock.on(GetObjectCommand).callsFake((input: any) => {
      if (input.Key === `${pageGuid}/${childGuid}.md`) {
        return Promise.resolve({
          Body: createMockStream(createMockPageContent(childGuid, 'Child', pageGuid))(),
        });
      }
      return Promise.reject({ name: 'NoSuchKey' });
    });

    s3Mock.on(ListObjectsV2Command).callsFake((input: any) => {
      if (input.Prefix === `${pageGuid}/` && input.Delimiter === '/') {
        return Promise.resolve({
          Contents: [
            {
              Key: `${pageGuid}/${childGuid}.md`,
              LastModified: new Date(),
              Size: 100,
            },
          ],
        });
      }
      if (input.Prefix === `${pageGuid}/` && !input.Delimiter) {
        return Promise.resolve({
          Contents: [
            {
              Key: `${pageGuid}/${childGuid}.md`,
              LastModified: new Date(),
              Size: 100,
            },
          ],
        });
      }
      if (!input.Prefix && !input.ContinuationToken) {
        return Promise.resolve({
          Contents: [
            { Key: `${pageGuid}.md` },
            { Key: `${pageGuid}/${childGuid}.md` },
          ],
        });
      }
      if (input.Prefix === `${childGuid}/` && input.Delimiter === '/') {
        return Promise.resolve({ Contents: [] });
      }
      return Promise.resolve({ Contents: [] });
    });

    s3Mock.on(DeleteObjectsCommand).resolves({
      Deleted: [
        { Key: `${pageGuid}.md` },
        { Key: `${pageGuid}/${childGuid}.md` },
      ],
    });

    await plugin.deletePage(pageGuid, true);

    const deleteCalls = s3Mock.commandCalls(DeleteObjectsCommand);
    expect(deleteCalls).toHaveLength(1);
  });
});
