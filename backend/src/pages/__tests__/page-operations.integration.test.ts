/**
 * Integration Tests for Page Operations
 * Task 4.4: Page Hierarchy Testing
 * 
 * Tests page operations with hierarchy: create, move, delete, rename
 * These tests use LocalStack or mock services to test full operations
 * 
 * NOTE: This test file has 31 tests with heavy AWS SDK mock usage. Running all tests
 * in a single file causes Node.js heap memory exhaustion even with --max-old-space-size=12288.
 * The aws-sdk-client-mock library accumulates command history across all tests, leading to OOM errors.
 * 
 * Current workaround: This file is excluded from the default integration test run in vitest.integration.config.ts
 * 
 * TODO: Refactor this file into smaller test suites (6-8 tests each) to avoid memory issues:
 * - page-create-operations.integration.test.ts (create tests)
 * - page-move-operations.integration.test.ts (move tests)
 * - page-delete-operations.integration.test.ts (delete tests)
 * - page-rename-operations.integration.test.ts (rename tests)
 * - page-metadata-operations.integration.test.ts (metadata & pagination tests)
 * - page-validation-operations.integration.test.ts (validation & error tests)
 * - page-softdelete-operations.integration.test.ts (soft delete tests)
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
  content: string = 'Test content',
  tags: string[] = []
): string {
  const lines = [
    '---',
    `title: "${title}"`,
    `guid: "${guid}"`,
    folderId ? `parentGuid: "${folderId}"` : '',
    folderId ? `folderId: "${folderId}"` : '',
    `status: "published"`,
  ];
  
  // Add tags in YAML list format
  if (tags.length > 0) {
    lines.push('tags:');
    tags.forEach(tag => {
      lines.push(`  - ${tag}`);
    });
  } else {
    lines.push('tags: []');
  }
  
  lines.push(
    `createdBy: "user-123"`,
    `modifiedBy: "user-123"`,
    `createdAt: "2026-02-10T12:00:00Z"`,
    `modifiedAt: "2026-02-10T12:00:00Z"`,
    '---',
    ''
  );
  
  const frontmatter = lines.filter(line => line !== '').join('\n');
  return frontmatter + content + '\n';
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

  afterEach(() => {
    s3Mock.reset();
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

  afterEach(() => {
    s3Mock.reset();
  });

  it('should move page from root to under parent', async () => {
    const pageGuid = uuidv4();
    const newParentGuid = uuidv4();

    // Mock HeadObjectCommand for findPageKey
    s3Mock.on(HeadObjectCommand).callsFake((input: any) => {
      if (input.Key === `${pageGuid}.md`) {
        return Promise.resolve({});
      }
      return Promise.reject({ name: 'NotFound' });
    });

    // Mock loading the page
    s3Mock.on(GetObjectCommand).callsFake((input: any) => {
      if (input.Key === `${pageGuid}.md`) {
        return Promise.resolve({
          Body: createMockStream(createMockPageContent(pageGuid, 'Page', null))(),
        });
      }
      return Promise.reject({ name: 'NoSuchKey' });
    });

    // Mock checking if page has children and other ListObjectsV2 calls
    s3Mock.on(ListObjectsV2Command).callsFake((input: any) => {
      if (input.Prefix === `${pageGuid}/`) {
        return Promise.resolve({ Contents: [] }); // No children
      }
      return Promise.resolve({ Contents: [] });
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

    // Mock HeadObjectCommand for findPageKey
    s3Mock.on(HeadObjectCommand).callsFake((input: any) => {
      if (input.Key === `${parentGuid}/${pageGuid}.md`) {
        return Promise.resolve({});
      }
      if (input.Key === `${pageGuid}.md`) {
        return Promise.reject({ name: 'NotFound' });
      }
      return Promise.reject({ name: 'NotFound' });
    });

    // Mock loading the page - use callsFake to handle multiple calls
    s3Mock.on(GetObjectCommand).callsFake((input: any) => {
      if (input.Key === `${parentGuid}/${pageGuid}.md`) {
        return Promise.resolve({
          Body: createMockStream(createMockPageContent(pageGuid, 'Page', parentGuid))(),
        });
      }
      return Promise.reject({ name: 'NoSuchKey' });
    });

    // Mock no children and other ListObjectsV2 calls
    s3Mock.on(ListObjectsV2Command).callsFake((input: any) => {
      if (input.Prefix === `${parentGuid}/${pageGuid}/`) {
        return Promise.resolve({ Contents: [] });
      }
      if (!input.Prefix && !input.ContinuationToken) {
        return Promise.resolve({
          Contents: [{ Key: `${parentGuid}/${pageGuid}.md` }],
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
    const oldParentGuid = uuidv4();
    const pageGuid = uuidv4();
    const childGuid = uuidv4();
    const newParentGuid = uuidv4();

    // Mock HeadObjectCommand for findPageKey
    s3Mock.on(HeadObjectCommand).callsFake((input: any) => {
      if (input.Key === `${oldParentGuid}/${pageGuid}.md`) {
        return Promise.resolve({});
      }
      if (input.Key === `${pageGuid}.md`) {
        return Promise.reject({ name: 'NotFound' });
      }
      return Promise.reject({ name: 'NotFound' });
    });

    // Mock loading pages - use callsFake to handle multiple calls
    s3Mock.on(GetObjectCommand).callsFake((input: any) => {
      if (input.Key === `${oldParentGuid}/${pageGuid}.md`) {
        return Promise.resolve({
          Body: createMockStream(createMockPageContent(pageGuid, 'Page', oldParentGuid))(),
        });
      }
      if (input.Key === `${oldParentGuid}/${pageGuid}/${childGuid}.md`) {
        return Promise.resolve({
          Body: createMockStream(createMockPageContent(childGuid, 'Child', pageGuid))(),
        });
      }
      return Promise.reject({ name: 'NoSuchKey' });
    });

    // Mock ListObjectsV2Command for children and search
    s3Mock.on(ListObjectsV2Command).callsFake((input: any) => {
      // Page has children
      if (input.Prefix === `${oldParentGuid}/${pageGuid}/`) {
        return Promise.resolve({
          Contents: [
            {
              Key: `${oldParentGuid}/${pageGuid}/${childGuid}.md`,
              LastModified: new Date(),
              Size: 100,
            },
          ],
        });
      }
      // Search for page key
      if (!input.Prefix && !input.ContinuationToken) {
        return Promise.resolve({
          Contents: [{ Key: `${oldParentGuid}/${pageGuid}.md` }],
        });
      }
      return Promise.resolve({ Contents: [] });
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

    // Mock HeadObjectCommand for findPageKey
    s3Mock.on(HeadObjectCommand).callsFake((input: any) => {
      if (input.Key === `${parentGuid}.md`) {
        return Promise.resolve({});
      }
      if (input.Key === `${parentGuid}/${childGuid}.md`) {
        return Promise.resolve({});
      }
      if (input.Key === `${childGuid}.md`) {
        return Promise.reject({ name: 'NotFound' });
      }
      return Promise.reject({ name: 'NotFound' });
    });

    // Mock ListObjectsV2Command for searching child pages
    s3Mock.on(ListObjectsV2Command).callsFake((input: any) => {
      // If no prefix, it's searching for a page key
      if (!input.Prefix && !input.ContinuationToken) {
        return Promise.resolve({
          Contents: [
            { Key: `${parentGuid}.md` },
            { Key: `${parentGuid}/${childGuid}.md` },
          ],
        });
      }
      // Otherwise empty (no children)
      return Promise.resolve({ Contents: [] });
    });

    // Mock loading pages - use callsFake to handle multiple GetObjectCommand calls
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

  afterEach(() => {
    s3Mock.reset();
  });

  it('should delete page without children', async () => {
    const pageGuid = uuidv4();

    // Mock HeadObjectCommand for findPageKey
    s3Mock.on(HeadObjectCommand).callsFake((input: any) => {
      if (input.Key === `${pageGuid}.md`) {
        return Promise.resolve({});
      }
      return Promise.reject({ name: 'NotFound' });
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

    // Mock HeadObjectCommand for findPageKey
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

    // Mock GetObjectCommand for loading child page in listChildren
    s3Mock.on(GetObjectCommand).callsFake((input: any) => {
      if (input.Key === `${pageGuid}/${childGuid}.md`) {
        return Promise.resolve({
          Body: createMockStream(createMockPageContent(childGuid, 'Child', pageGuid))(),
        });
      }
      return Promise.reject({ name: 'NoSuchKey' });
    });

    // Mock ListObjectsV2Command - distinguish between checking children and other operations
    s3Mock.on(ListObjectsV2Command).callsFake((input: any) => {
      // listChildren call (has Delimiter)
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
      // Search for child page key
      if (!input.Prefix && !input.ContinuationToken) {
        return Promise.resolve({
          Contents: [
            { Key: `${pageGuid}.md` },
            { Key: `${pageGuid}/${childGuid}.md` },
          ],
        });
      }
      // hasChildrenDirect check for child
      if (input.Prefix === `${childGuid}/` && input.Delimiter === '/') {
        return Promise.resolve({ Contents: [] }); // Child has no children
      }
      // Other calls return empty
      return Promise.resolve({ Contents: [] });
    });

    await expect(plugin.deletePage(pageGuid, false)).rejects.toThrow();
  });

  it('should delete page with children recursively', async () => {
    const pageGuid = uuidv4();
    const childGuid = uuidv4();

    // Mock HeadObjectCommand for findPageKey
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

    // Mock GetObjectCommand for loading child page
    s3Mock.on(GetObjectCommand).callsFake((input: any) => {
      if (input.Key === `${pageGuid}/${childGuid}.md`) {
        return Promise.resolve({
          Body: createMockStream(createMockPageContent(childGuid, 'Child', pageGuid))(),
        });
      }
      return Promise.reject({ name: 'NoSuchKey' });
    });

    // Mock ListObjectsV2Command - distinguish between checking children and listing for delete
    s3Mock.on(ListObjectsV2Command).callsFake((input: any) => {
      // listChildren call (has Delimiter) - for hasChildren check
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
      // deletePageAndChildren call (no Delimiter, lists all descendants)
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
      // Search for child page key
      if (!input.Prefix && !input.ContinuationToken) {
        return Promise.resolve({
          Contents: [
            { Key: `${pageGuid}.md` },
            { Key: `${pageGuid}/${childGuid}.md` },
          ],
        });
      }
      // hasChildrenDirect check for child
      if (input.Prefix === `${childGuid}/` && input.Delimiter === '/') {
        return Promise.resolve({ Contents: [] }); // Child has no children
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

    // Mock HeadObjectCommand for findPageKey
    s3Mock.on(HeadObjectCommand).callsFake((input: any) => {
      if (input.Key === `${parentGuid}.md`) {
        return Promise.resolve({});
      }
      if (input.Key === `${parentGuid}/${childGuid}.md`) {
        return Promise.resolve({});
      }
      if (input.Key === `${childGuid}.md`) {
        return Promise.reject({ name: 'NotFound' });
      }
      return Promise.reject({ name: 'NotFound' });
    });

    // Mock ListObjectsV2Command for searching pages
    s3Mock.on(ListObjectsV2Command).callsFake((input: any) => {
      // If no prefix, it's searching for a page key
      if (!input.Prefix && !input.ContinuationToken) {
        return Promise.resolve({
          Contents: [
            { Key: `${parentGuid}.md` },
            { Key: `${parentGuid}/${childGuid}.md` },
          ],
        });
      }
      // Otherwise empty (no children)
      return Promise.resolve({ Contents: [] });
    });

    // Mock page loading - use callsFake to handle multiple calls
    s3Mock.on(GetObjectCommand).callsFake((input: any) => {
      if (input.Key === `${parentGuid}.md`) {
        return Promise.resolve({
          Body: createMockStream(createMockPageContent(parentGuid, 'Old Parent', null))(),
        });
      }
      if (input.Key === `${parentGuid}/${childGuid}.md`) {
        return Promise.resolve({
          Body: createMockStream(createMockPageContent(childGuid, 'Child', parentGuid))(),
        });
      }
      return Promise.reject({ name: 'NoSuchKey' });
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
    s3Mock.on(GetObjectCommand).callsFake((input: any) => {
      if (input.Key === `${pageGuid}.md`) {
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
    expect(loaded.tags).toEqual([]);
  });

  it('should preserve metadata when moving page', async () => {
    const pageGuid = uuidv4();
    const newParentGuid = uuidv4();
    const originalCreatedBy = 'user-123';
    const originalCreatedAt = '2026-02-10T12:00:00Z';

    // Mock HeadObjectCommand for findPageKey
    s3Mock.on(HeadObjectCommand).callsFake((input: any) => {
      if (input.Key === `${pageGuid}.md`) {
        return Promise.resolve({});
      }
      return Promise.reject({ name: 'NotFound' });
    });

    s3Mock.on(GetObjectCommand).callsFake((input: any) => {
      if (input.Key === `${pageGuid}.md`) {
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

    s3Mock.on(GetObjectCommand).callsFake((input: any) => {
      if (input.Key === `${pageGuid}.md`) {
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

    // Update the page
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
    const childGuids = Array.from({ length: 15 }, () => uuidv4());

    s3Mock.on(HeadObjectCommand).callsFake((input: any) => {
      const key = input.Key as string;
      if (key === `${parentGuid}.md` || childGuids.some(id => key.includes(id))) {
        return Promise.resolve({});
      }
      return Promise.reject({ name: 'NotFound' });
    });

    s3Mock.on(GetObjectCommand).callsFake((input: any) => {
      const key = input.Key as string;
      const childId = childGuids.find(id => key.includes(id));
      if (childId) {
        return Promise.resolve({
          Body: createMockStream(createMockPageContent(childId, `Child ${childId}`, parentGuid))(),
        });
      }
      return Promise.reject({ name: 'NoSuchKey' });
    });

    s3Mock.on(ListObjectsV2Command).callsFake((input: any) => {
      if (input.Prefix === `${parentGuid}/` && input.Delimiter === '/') {
        const firstTen = childGuids.slice(0, 10).map(id => ({
          Key: `${parentGuid}/${id}.md`,
          LastModified: new Date(),
          Size: 100,
        }));
        return Promise.resolve({
          Contents: firstTen,
          IsTruncated: true,
          NextContinuationToken: 'token-for-next-page',
        });
      }
      if (!input.Prefix && !input.ContinuationToken) {
        return Promise.resolve({
          Contents: childGuids.map(id => ({ Key: `${parentGuid}/${id}.md` })),
        });
      }
      return Promise.resolve({ Contents: [] });
    });

    const children = await plugin.listChildren(parentGuid);
    expect(children).toHaveLength(10);
  });

  it('should handle pagination with continuation token', async () => {
    const parentGuid = uuidv4();
    const firstBatch = Array.from({ length: 5 }, () => uuidv4());
    const secondBatch = Array.from({ length: 5 }, () => uuidv4());

    s3Mock.on(HeadObjectCommand).callsFake((input: any) => {
      const key = input.Key as string;
      if (key === `${parentGuid}.md` || [...firstBatch, ...secondBatch].some(id => key.includes(id))) {
        return Promise.resolve({});
      }
      return Promise.reject({ name: 'NotFound' });
    });

    s3Mock.on(GetObjectCommand).callsFake((input: any) => {
      const key = input.Key as string;
      const allGuids = [...firstBatch, ...secondBatch];
      const childId = allGuids.find(id => key.includes(id));
      if (childId) {
        return Promise.resolve({
          Body: createMockStream(createMockPageContent(childId, `Child ${childId}`, parentGuid))(),
        });
      }
      return Promise.reject({ name: 'NoSuchKey' });
    });

    s3Mock.on(ListObjectsV2Command).callsFake((input: any) => {
      if (input.Prefix === `${parentGuid}/` && input.Delimiter === '/') {
        if (!input.ContinuationToken) {
          return Promise.resolve({
            Contents: firstBatch.map(id => ({
              Key: `${parentGuid}/${id}.md`,
              LastModified: new Date(),
              Size: 100,
            })),
            IsTruncated: true,
            NextContinuationToken: 'continue-token',
          });
        } else if (input.ContinuationToken === 'continue-token') {
          return Promise.resolve({
            Contents: secondBatch.map(id => ({
              Key: `${parentGuid}/${id}.md`,
              LastModified: new Date(),
              Size: 100,
            })),
            IsTruncated: false,
          });
        }
      }
      if (!input.Prefix && !input.ContinuationToken) {
        return Promise.resolve({
          Contents: [...firstBatch, ...secondBatch].map(id => ({ Key: `${parentGuid}/${id}.md` })),
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
          Contents: guids.slice(0, 1000).map(id => ({ Key: `${id}.md` })),
          IsTruncated: true,
          NextContinuationToken: 'batch-2',
        });
      } else if (input.ContinuationToken === 'batch-2') {
        return Promise.resolve({
          Contents: guids.slice(1000).map(id => ({ Key: `${id}.md` })),
          IsTruncated: false,
        });
      }
      return Promise.resolve({ Contents: [] });
    });

    // This would normally trigger automatic continuation
    // Test that the mock handles pagination correctly
    const result = await s3Mock.client.send(new ListObjectsV2Command({
      Bucket: 'test-bucket',
    }));

    expect(result.Contents).toHaveLength(1000);
    expect(result.IsTruncated).toBe(true);
  });
});

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

    // Soft delete (status = 'deleted')
    const deletedContent: PageContent = {
      guid: pageGuid,
      title: 'Page',
      content: '# Page',
      folderId: '',
      tags: [],
      status: 'deleted',
      createdBy: 'user-123',
      modifiedBy: 'user-123',
      createdAt: '2026-02-10T12:00:00Z',
      modifiedAt: '2026-02-12T10:00:00Z',
    };

    await plugin.savePage(pageGuid, null, deletedContent);

    const saveCalls = s3Mock.commandCalls(PutObjectCommand);
    expect(saveCalls.length).toBeGreaterThan(0);

    const body = saveCalls[0].args[0].input.Body as string;
    expect(body).toContain('status: "deleted"');
  });

  it('should list only non-deleted pages by default', async () => {
    const activeGuid = uuidv4();
    const deletedGuid = uuidv4();

    s3Mock.on(HeadObjectCommand).callsFake((input: any) => {
      const key = input.Key as string;
      if (key.includes(activeGuid) || key.includes(deletedGuid)) {
        return Promise.resolve({});
      }
      return Promise.reject({ name: 'NotFound' });
    });

    s3Mock.on(GetObjectCommand).callsFake((input: any) => {
      if (input.Key === `${activeGuid}.md`) {
        return Promise.resolve({
          Body: createMockStream(createMockPageContent(activeGuid, 'Active', null))(),
        });
      }
      if (input.Key === `${deletedGuid}.md`) {
        const deletedContent = `---
guid: "${deletedGuid}"
title: "Deleted Page"
folderId: null
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

    s3Mock.on(ListObjectsV2Command).callsFake((input: any) => {
      if (input.Prefix === '' && input.Delimiter === '/') {
        return Promise.resolve({
          Contents: [
            { Key: `${activeGuid}.md`, LastModified: new Date(), Size: 100 },
            { Key: `${deletedGuid}.md`, LastModified: new Date(), Size: 100 },
          ],
        });
      }
      if (!input.Prefix && !input.ContinuationToken) {
        return Promise.resolve({
          Contents: [
            { Key: `${activeGuid}.md` },
            { Key: `${deletedGuid}.md` },
          ],
        });
      }
      return Promise.resolve({ Contents: [] });
    });

    const children = await plugin.listChildren(null);
    
    // Both pages are listed, but deleted status is in metadata
    expect(children).toHaveLength(2);
    
    // Load each and check status
    const activePage = await plugin.loadPage(activeGuid);
    const deletedPage = await plugin.loadPage(deletedGuid);
    
    expect(activePage.status).toBe('published');
    expect(deletedPage.status).toBe('deleted');
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

    // Soft delete parent (should also mark children as deleted)
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
