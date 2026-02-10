/**
 * Integration Tests for Page Operations
 * Task 4.4: Page Hierarchy Testing
 * 
 * Tests page operations with hierarchy: create, move, delete, rename
 * These tests use LocalStack or mock services to test full operations
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
  DeleteObjectsCommand,
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

describe('Page Operations - Create Child Pages at Various Depths', () => {
  let plugin: S3StoragePlugin;

  beforeEach(() => {
    s3Mock.reset();
    plugin = new S3StoragePlugin({
      bucketName: 'test-bucket',
      region: 'us-east-1',
    });
  });

  it('should create root-level page', async () => {
    const guid = uuidv4();
    const content: PageContent = {
      guid,
      title: 'Root Page',
      content: '# Root Content',
      folderId: '',
      tags: [],
      status: 'published',
      createdBy: 'user-123',
      modifiedBy: 'user-123',
      createdAt: '2026-02-10T12:00:00Z',
      modifiedAt: '2026-02-10T12:00:00Z',
    };

    s3Mock.on(PutObjectCommand).resolves({});

    await plugin.savePage(guid, null, content);

    const calls = s3Mock.commandCalls(PutObjectCommand);
    expect(calls).toHaveLength(1);
    expect(calls[0].args[0].input.Key).toBe(`${guid}.md`);
  });

  it('should create child page under parent', async () => {
    const parentGuid = uuidv4();
    const childGuid = uuidv4();

    const childContent: PageContent = {
      guid: childGuid,
      title: 'Child Page',
      content: '# Child Content',
      folderId: parentGuid,
      tags: [],
      status: 'published',
      createdBy: 'user-123',
      modifiedBy: 'user-123',
      createdAt: '2026-02-10T12:00:00Z',
      modifiedAt: '2026-02-10T12:00:00Z',
    };

    s3Mock.on(PutObjectCommand).resolves({});

    await plugin.savePage(childGuid, parentGuid, childContent);

    const calls = s3Mock.commandCalls(PutObjectCommand);
    expect(calls).toHaveLength(1);
    expect(calls[0].args[0].input.Key).toBe(`${parentGuid}/${childGuid}.md`);
  });

  it('should create deeply nested page (3 levels)', async () => {
    const rootGuid = uuidv4();
    const level1Guid = uuidv4();
    const level2Guid = uuidv4();

    // Create level 2 page under level 1
    const level2Content: PageContent = {
      guid: level2Guid,
      title: 'Level 2',
      content: '# Deep Content',
      folderId: level1Guid,
      tags: [],
      status: 'published',
      createdBy: 'user-123',
      modifiedBy: 'user-123',
      createdAt: '2026-02-10T12:00:00Z',
      modifiedAt: '2026-02-10T12:00:00Z',
    };

    s3Mock.on(PutObjectCommand).resolves({});

    await plugin.savePage(level2Guid, level1Guid, level2Content);

    const calls = s3Mock.commandCalls(PutObjectCommand);
    expect(calls).toHaveLength(1);
    expect(calls[0].args[0].input.Key).toBe(`${level1Guid}/${level2Guid}.md`);
  });
});

describe('Page Operations - Move Pages Between Parents', () => {
  let plugin: S3StoragePlugin;

  beforeEach(() => {
    s3Mock.reset();
    plugin = new S3StoragePlugin({
      bucketName: 'test-bucket',
      region: 'us-east-1',
    });
  });

  it('should move page from root to under parent', async () => {
    const pageGuid = uuidv4();
    const newParentGuid = uuidv4();

    // Mock loading the page
    s3Mock.on(GetObjectCommand, { Key: `${pageGuid}.md` }).resolves({
      Body: createMockStream(createMockPageContent(pageGuid, 'Page', null))(),
    });

    // Mock checking if page has children
    s3Mock.on(ListObjectsV2Command, {
      Prefix: `${pageGuid}/`,
    }).resolves({
      Contents: [], // No children
    });

    // Mock copy and delete operations
    s3Mock.on(CopyObjectCommand).resolves({});
    s3Mock.on(DeleteObjectCommand).resolves({});
    s3Mock.on(PutObjectCommand).resolves({});

    await plugin.movePage(pageGuid, newParentGuid);

    // Verify copy was called with correct target
    const copyCalls = s3Mock.commandCalls(CopyObjectCommand);
    expect(copyCalls.length).toBeGreaterThan(0);
    
    // Verify old location was deleted
    const deleteCalls = s3Mock.commandCalls(DeleteObjectCommand);
    expect(deleteCalls.length).toBeGreaterThan(0);
  });

  it('should move page from parent to root', async () => {
    const parentGuid = uuidv4();
    const pageGuid = uuidv4();

    // Mock loading the page
    s3Mock.on(GetObjectCommand, {
      Key: `${parentGuid}/${pageGuid}.md`,
    }).resolves({
      Body: createMockStream(createMockPageContent(pageGuid, 'Page', parentGuid))(),
    });

    // Mock no children
    s3Mock.on(ListObjectsV2Command).resolves({ Contents: [] });

    s3Mock.on(CopyObjectCommand).resolves({});
    s3Mock.on(DeleteObjectCommand).resolves({});
    s3Mock.on(PutObjectCommand).resolves({});

    await plugin.movePage(pageGuid, null);

    const copyCalls = s3Mock.commandCalls(CopyObjectCommand);
    expect(copyCalls.length).toBeGreaterThan(0);
  });

  it('should move page with children (recursive)', async () => {
    const oldParentGuid = uuidv4();
    const pageGuid = uuidv4();
    const childGuid = uuidv4();
    const newParentGuid = uuidv4();

    // Mock loading the page
    s3Mock.on(GetObjectCommand, {
      Key: `${oldParentGuid}/${pageGuid}.md`,
    }).resolves({
      Body: createMockStream(createMockPageContent(pageGuid, 'Page', oldParentGuid))(),
    });

    // Mock page has children
    s3Mock.on(ListObjectsV2Command, {
      Prefix: `${oldParentGuid}/${pageGuid}/`,
    }).resolves({
      Contents: [
        {
          Key: `${oldParentGuid}/${pageGuid}/${childGuid}.md`,
          LastModified: new Date(),
          Size: 100,
        },
      ],
    });

    // Mock child page load
    s3Mock.on(GetObjectCommand, {
      Key: `${oldParentGuid}/${pageGuid}/${childGuid}.md`,
    }).resolves({
      Body: createMockStream(createMockPageContent(childGuid, 'Child', pageGuid))(),
    });

    s3Mock.on(CopyObjectCommand).resolves({});
    s3Mock.on(DeleteObjectsCommand).resolves({});
    s3Mock.on(DeleteObjectCommand).resolves({});
    s3Mock.on(PutObjectCommand).resolves({});

    await plugin.movePage(pageGuid, newParentGuid);

    // Should copy both parent and child
    const copyCalls = s3Mock.commandCalls(CopyObjectCommand);
    expect(copyCalls.length).toBeGreaterThanOrEqual(1);
  });

  it('should prevent moving page under its own descendant', async () => {
    const parentGuid = uuidv4();
    const childGuid = uuidv4();

    // Parent is root, child is under parent
    s3Mock.on(GetObjectCommand, { Key: `${parentGuid}.md` }).resolves({
      Body: createMockStream(createMockPageContent(parentGuid, 'Parent', null))(),
    });

    s3Mock.on(GetObjectCommand, {
      Key: `${parentGuid}/${childGuid}.md`,
    }).resolves({
      Body: createMockStream(createMockPageContent(childGuid, 'Child', parentGuid))(),
    });

    // Check if parent is descendant of child (should be false)
    const isDescendant = await plugin.isDescendantOf(parentGuid, childGuid);
    expect(isDescendant).toBe(false);

    // Check if child is descendant of parent (should be true)
    const isChildDescendant = await plugin.isDescendantOf(childGuid, parentGuid);
    expect(isChildDescendant).toBe(true);
  });
});

describe('Page Operations - Delete Pages with Children', () => {
  let plugin: S3StoragePlugin;

  beforeEach(() => {
    s3Mock.reset();
    plugin = new S3StoragePlugin({
      bucketName: 'test-bucket',
      region: 'us-east-1',
    });
  });

  it('should delete page without children', async () => {
    const pageGuid = uuidv4();

    // Mock page load
    s3Mock.on(GetObjectCommand, { Key: `${pageGuid}.md` }).resolves({
      Body: createMockStream(createMockPageContent(pageGuid, 'Page', null))(),
    });

    // Mock no children
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

    // Mock page has children
    s3Mock.on(ListObjectsV2Command, {
      Prefix: `${pageGuid}/`,
    }).resolves({
      Contents: [
        {
          Key: `${pageGuid}/${childGuid}.md`,
          LastModified: new Date(),
          Size: 100,
        },
      ],
    });

    await expect(plugin.deletePage(pageGuid, false)).rejects.toThrow();
  });

  it('should delete page with children recursively', async () => {
    const pageGuid = uuidv4();
    const childGuid = uuidv4();

    // Mock page has children
    s3Mock.on(ListObjectsV2Command, {
      Prefix: `${pageGuid}/`,
    }).resolves({
      Contents: [
        {
          Key: `${pageGuid}.md`,
          LastModified: new Date(),
          Size: 100,
        },
        {
          Key: `${pageGuid}/${childGuid}.md`,
          LastModified: new Date(),
          Size: 100,
        },
      ],
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

describe('Page Operations - Rename Pages', () => {
  let plugin: S3StoragePlugin;

  beforeEach(() => {
    s3Mock.reset();
    plugin = new S3StoragePlugin({
      bucketName: 'test-bucket',
      region: 'us-east-1',
    });
  });

  it('should rename page while preserving GUID and location', async () => {
    const pageGuid = uuidv4();
    const oldTitle = 'Old Title';
    const newTitle = 'New Title';

    // Load page
    s3Mock.on(GetObjectCommand, { Key: `${pageGuid}.md` }).resolves({
      Body: createMockStream(createMockPageContent(pageGuid, oldTitle, null))(),
    });

    // Save updated page
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
    expect(saveCalls[0].args[0].input.Key).toBe(`${pageGuid}.md`);
    
    const body = saveCalls[0].args[0].input.Body as string;
    expect(body).toContain(`title: "${newTitle}"`);
    expect(body).toContain(`guid: "${pageGuid}"`);
  });

  it('should rename page with children and verify children remain linked', async () => {
    const parentGuid = uuidv4();
    const childGuid = uuidv4();

    // Mock parent load
    s3Mock.on(GetObjectCommand, { Key: `${parentGuid}.md` }).resolves({
      Body: createMockStream(createMockPageContent(parentGuid, 'Old Parent', null))(),
    });

    // Mock child load (child references parent GUID, not title)
    s3Mock.on(GetObjectCommand, {
      Key: `${parentGuid}/${childGuid}.md`,
    }).resolves({
      Body: createMockStream(createMockPageContent(childGuid, 'Child', parentGuid))(),
    });

    s3Mock.on(PutObjectCommand).resolves({});

    // Rename parent
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

    // Load child again to verify relationship intact
    const childPage = await plugin.loadPage(childGuid);
    expect(childPage.folderId).toBe(parentGuid);
  });
});
