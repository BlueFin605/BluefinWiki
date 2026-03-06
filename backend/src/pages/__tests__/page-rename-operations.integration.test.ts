/**
 * Integration Tests for Page Rename Operations
 * Task 4.4: Page Hierarchy Testing
 * 
 * Tests renaming pages and verifying children remain linked
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
  HeadObjectCommand,
  ListObjectsV2Command,
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

describe('Page Operations - Rename Pages', () => {
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

  it('should rename page while preserving GUID and location', async () => {
    const pageGuid = uuidv4();
    const oldTitle = 'Old Title';
    const newTitle = 'New Title';

    s3Mock.on(GetObjectCommand, { Key: `${pageGuid}.md` }).resolves({
      Body: createMockStream(createMockPageContent(pageGuid, oldTitle, null))(),
    });

    s3Mock.on(PutObjectCommand).resolves({});

    const updatedContent: PageContent = {
      guid: pageGuid,
      title: newTitle,
      content: '# Updated content',
      folderId: '',
      tags: [],
      status: 'published',
      createdBy: 'user-123',
      modifiedBy: 'user-123',
      createdAt: '2026-02-10T12:00:00Z',
      modifiedAt: '2026-02-10T13:00:00Z',
    };

    await plugin.savePage(pageGuid, null, updatedContent);

    const saveCalls = s3Mock.commandCalls(PutObjectCommand);
    expect(saveCalls).toHaveLength(1);
    expect(saveCalls[0].args[0].input.Key).toBe(`${pageGuid}/${pageGuid}.md`);

    const body = saveCalls[0].args[0].input.Body as string;
    expect(body).toContain(`title: "${newTitle}"`);
  });

  it('should rename page with children and verify children remain linked', async () => {
    const parentGuid = uuidv4();
    const childGuid = uuidv4();

    s3Mock.on(HeadObjectCommand).callsFake((input: any) => {
      if (input.Key === `${parentGuid}/${parentGuid}.md` || input.Key === `${parentGuid}/${childGuid}/${childGuid}.md`) {
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

    s3Mock.on(PutObjectCommand).resolves({});

    const renamedParent: PageContent = {
      guid: parentGuid,
      title: 'New Parent Title',
      content: '# Renamed',
      folderId: '',
      tags: [],
      status: 'published',
      createdBy: 'user-123',
      modifiedBy: 'user-123',
      createdAt: '2026-02-10T12:00:00Z',
      modifiedAt: '2026-02-10T13:00:00Z',
    };

    await plugin.savePage(parentGuid, null, renamedParent);

    const childPage = await plugin.loadPage(childGuid);
    expect(childPage.folderId).toBe(parentGuid);
  });
});
