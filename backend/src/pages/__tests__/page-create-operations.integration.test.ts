/**
 * Integration Tests for Page Create Operations
 * Task 4.4: Page Hierarchy Testing
 * 
 * Tests page creation at various hierarchy depths
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { S3StoragePlugin } from '../../storage/S3StoragePlugin.js';
import { PageContent } from '../../types/index.js';
import { v4 as uuidv4 } from 'uuid';
import { mockClient } from 'aws-sdk-client-mock';
import {
  S3Client,
  PutObjectCommand,
} from '@aws-sdk/client-s3';

const s3Mock = mockClient(S3Client);

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
