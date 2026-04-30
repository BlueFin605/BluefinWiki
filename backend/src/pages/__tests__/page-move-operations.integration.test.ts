/**
 * Integration Tests for Page Move Operations
 * Task 4.4: Page Hierarchy Testing
 * 
 * Tests moving pages between parents
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { S3StoragePlugin } from '../../storage/S3StoragePlugin.js';
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

describe('Page Operations - Move Pages Between Parents', () => {
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

  it('should move page from root to under parent', async () => {
    const pageGuid = uuidv4();
    const newParentGuid = uuidv4();

    s3Mock.on(HeadObjectCommand).callsFake((input: any) => {
      if (input.Key === `${pageGuid}/${pageGuid}.md`) {
        return Promise.resolve({});
      }
      return Promise.reject({ name: 'NotFound' });
    });

    s3Mock.on(GetObjectCommand).callsFake((input: any) => {
      if (input.Key === `${pageGuid}/${pageGuid}.md`) {
        return Promise.resolve({
          Body: createMockStream(createMockPageContent(pageGuid, 'Page', null))(),
        });
      }
      return Promise.reject({ name: 'NoSuchKey' });
    });

    s3Mock.on(ListObjectsV2Command).callsFake((input: any) => {
      if (input.Prefix === `${pageGuid}/` && input.Delimiter === '/') {
        return Promise.resolve({ CommonPrefixes: [] });
      }
      return Promise.resolve({ Contents: [] });
    });

    s3Mock.on(CopyObjectCommand).resolves({});
    s3Mock.on(DeleteObjectCommand).resolves({});
    s3Mock.on(PutObjectCommand).resolves({});

    await plugin.movePage(pageGuid, newParentGuid);

    const copyCalls = s3Mock.commandCalls(CopyObjectCommand);
    expect(copyCalls.length).toBeGreaterThan(0);
    
    const deleteCalls = s3Mock.commandCalls(DeleteObjectCommand);
    expect(deleteCalls.length).toBeGreaterThan(0);
  });

  it('should move page from parent to root', async () => {
    const parentGuid = uuidv4();
    const pageGuid = uuidv4();

    s3Mock.on(HeadObjectCommand).callsFake((input: any) => {
      if (input.Key === `${parentGuid}/${pageGuid}/${pageGuid}.md`) {
        return Promise.resolve({});
      }
      if (input.Key === `${pageGuid}/${pageGuid}.md`) {
        return Promise.reject({ name: 'NotFound' });
      }
      return Promise.reject({ name: 'NotFound' });
    });

    s3Mock.on(GetObjectCommand).callsFake((input: any) => {
      if (input.Key === `${parentGuid}/${pageGuid}/${pageGuid}.md`) {
        return Promise.resolve({
          Body: createMockStream(createMockPageContent(pageGuid, 'Page', parentGuid))(),
        });
      }
      return Promise.reject({ name: 'NoSuchKey' });
    });

    s3Mock.on(ListObjectsV2Command).callsFake((input: any) => {
      if (input.Prefix === `${parentGuid}/${pageGuid}/` && input.Delimiter === '/') {
        return Promise.resolve({ CommonPrefixes: [] });
      }
      if (!input.Prefix && !input.ContinuationToken) {
        return Promise.resolve({
          Contents: [{ Key: `${parentGuid}/${pageGuid}/${pageGuid}.md` }],
        });
      }
      return Promise.resolve({ Contents: [] });
    });

    s3Mock.on(CopyObjectCommand).resolves({});
    s3Mock.on(DeleteObjectCommand).resolves({});
    s3Mock.on(PutObjectCommand).resolves({});

    await plugin.movePage(pageGuid, null);

    const copyCalls = s3Mock.commandCalls(CopyObjectCommand);
    expect(copyCalls.length).toBeGreaterThan(0);
  });

  it('should move page with children (recursive)', async () => {
    // Layout before move:
    //   oldParent/oldParent.md            (root parent A)
    //   oldParent/page/page.md            (B — being moved)
    //   oldParent/page/child/child.md     (C — child of B)
    //   newParent/newParent.md            (X — new root parent)
    // Expected layout after move:
    //   oldParent/oldParent.md
    //   newParent/newParent.md
    //   newParent/page/page.md
    //   newParent/page/child/child.md
    const oldParentGuid = uuidv4();
    const pageGuid = uuidv4();
    const childGuid = uuidv4();
    const newParentGuid = uuidv4();

    s3Mock.on(HeadObjectCommand).callsFake((input: any) => {
      // Only X is a root page (root-level HeadObject probe).
      if (input.Key === `${newParentGuid}/${newParentGuid}.md`) {
        return Promise.resolve({});
      }
      return Promise.reject({ name: 'NotFound' });
    });

    s3Mock.on(GetObjectCommand).callsFake((input: any) => {
      if (input.Key === `${oldParentGuid}/${pageGuid}/${pageGuid}.md`) {
        return Promise.resolve({
          Body: createMockStream(createMockPageContent(pageGuid, 'B', oldParentGuid))(),
        });
      }
      if (input.Key === `${oldParentGuid}/${pageGuid}/${childGuid}/${childGuid}.md`) {
        return Promise.resolve({
          Body: createMockStream(createMockPageContent(childGuid, 'C', pageGuid))(),
        });
      }
      if (input.Key === `${newParentGuid}/${newParentGuid}.md`) {
        return Promise.resolve({
          Body: createMockStream(createMockPageContent(newParentGuid, 'X', null))(),
        });
      }
      return Promise.reject({ name: 'NoSuchKey' });
    });

    s3Mock.on(ListObjectsV2Command).callsFake((input: any) => {
      // Listing under B's old folder — should report C as a child folder.
      if (input.Prefix === `${oldParentGuid}/${pageGuid}/` && input.Delimiter === '/') {
        return Promise.resolve({
          Contents: [{ Key: `${oldParentGuid}/${pageGuid}/${pageGuid}.md` }],
          CommonPrefixes: [
            { Prefix: `${oldParentGuid}/${pageGuid}/${childGuid}/` },
          ],
        });
      }
      // Listing under C's old folder — no grandchildren.
      if (input.Prefix === `${oldParentGuid}/${pageGuid}/${childGuid}/` && input.Delimiter === '/') {
        return Promise.resolve({
          Contents: [{ Key: `${oldParentGuid}/${pageGuid}/${childGuid}/${childGuid}.md` }],
          CommonPrefixes: [],
        });
      }
      // Attachment-prefix listings — none in this scenario.
      if (typeof input.Prefix === 'string' && input.Prefix.endsWith('_attachments/')) {
        return Promise.resolve({ Contents: [] });
      }
      // Full bucket scan (findPageFolder fallback).
      if (!input.Prefix && !input.Delimiter) {
        return Promise.resolve({
          Contents: [
            { Key: `${oldParentGuid}/${oldParentGuid}.md` },
            { Key: `${oldParentGuid}/${pageGuid}/${pageGuid}.md` },
            { Key: `${oldParentGuid}/${pageGuid}/${childGuid}/${childGuid}.md` },
            { Key: `${newParentGuid}/${newParentGuid}.md` },
          ],
        });
      }
      return Promise.resolve({ Contents: [] });
    });

    s3Mock.on(CopyObjectCommand).resolves({});
    s3Mock.on(DeleteObjectCommand).resolves({});
    s3Mock.on(PutObjectCommand).resolves({});

    await plugin.movePage(pageGuid, newParentGuid);

    // Both B and C must end up at their new keys, and the originals must be deleted.
    const copyOps = s3Mock.commandCalls(CopyObjectCommand).map((c) => ({
      src: (c.args[0].input as { CopySource?: string }).CopySource,
      dst: (c.args[0].input as { Key?: string }).Key,
    }));

    expect(copyOps).toContainEqual({
      src: `test-bucket/${oldParentGuid}/${pageGuid}/${pageGuid}.md`,
      dst: `${newParentGuid}/${pageGuid}/${pageGuid}.md`,
    });
    expect(copyOps).toContainEqual({
      src: `test-bucket/${oldParentGuid}/${pageGuid}/${childGuid}/${childGuid}.md`,
      dst: `${newParentGuid}/${pageGuid}/${childGuid}/${childGuid}.md`,
    });

    const deleteKeys = s3Mock
      .commandCalls(DeleteObjectCommand)
      .map((c) => (c.args[0].input as { Key?: string }).Key);

    expect(deleteKeys).toContain(`${oldParentGuid}/${pageGuid}/${pageGuid}.md`);
    expect(deleteKeys).toContain(`${oldParentGuid}/${pageGuid}/${childGuid}/${childGuid}.md`);
  });

  it('should prevent moving page under its own descendant', async () => {
    const parentGuid = uuidv4();
    const childGuid = uuidv4();

    s3Mock.on(HeadObjectCommand).callsFake((input: any) => {
      if (input.Key === `${parentGuid}/${parentGuid}.md`) {
        return Promise.resolve({});
      }
      if (input.Key === `${childGuid}/${childGuid}.md`) {
        return Promise.reject({ name: 'NotFound' });
      }
      if (input.Key === `${parentGuid}/${childGuid}/${childGuid}.md`) {
        return Promise.resolve({});
      }
      return Promise.reject({ name: 'NotFound' });
    });

    s3Mock.on(ListObjectsV2Command).callsFake((input: any) => {
      // When searching for a page (no Prefix, no Delimiter)
      if (!input.Prefix && !input.Delimiter) {
        return Promise.resolve({
          Contents: [
            { Key: `${parentGuid}/${parentGuid}.md` },
            { Key: `${parentGuid}/${childGuid}/${childGuid}.md` },
          ],
        });
      }
      return Promise.resolve({ Contents: [] });
    });

    s3Mock.on(GetObjectCommand).callsFake((input: any) => {
      if (input.Key === `${parentGuid}/${parentGuid}.md`) {
        return Promise.resolve({
          Body: createMockStream(createMockPageContent(parentGuid, 'Parent', null))(),
        });
      }
      if (input.Key === `${parentGuid}/${childGuid}/${childGuid}.md`) {
        return Promise.resolve({
          Body: createMockStream(createMockPageContent(childGuid, 'Child', parentGuid))(),
        });
      }
      return Promise.reject({ name: 'NoSuchKey' });
    });

    const isDescendant = await plugin.isDescendantOf(parentGuid, childGuid);
    expect(isDescendant).toBe(false);

    const isChildDescendant = await plugin.isDescendantOf(childGuid, parentGuid);
    expect(isChildDescendant).toBe(true);
  });
});
