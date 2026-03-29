/**
 * Unit tests for PageIndexService
 *
 * Mocks the DynamoDB client to verify index CRUD operations.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import {
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  DeleteItemCommand,
  BatchWriteItemCommand,
} from '@aws-sdk/client-dynamodb';

// Must mock before importing the module
const dynamoMock = mockClient(DynamoDBClient);

import {
  getPageKey,
  putPageKey,
  deletePageKey,
  deletePageKeys,
  PageIndexRecord,
} from '../PageIndexService.js';

describe('PageIndexService', () => {
  beforeEach(() => {
    dynamoMock.reset();
    process.env.DYNAMODB_PAGE_INDEX_TABLE = 'test-page-index';
  });

  describe('getPageKey', () => {
    it('should return s3Key when index entry exists', async () => {
      dynamoMock.on(GetItemCommand).resolves({
        Item: {
          guid: { S: 'abc-123' },
          s3Key: { S: 'abc-123/abc-123.md' },
        },
      });

      const result = await getPageKey('abc-123');
      expect(result).toBe('abc-123/abc-123.md');
    });

    it('should return null when index entry does not exist', async () => {
      dynamoMock.on(GetItemCommand).resolves({});

      const result = await getPageKey('nonexistent');
      expect(result).toBeNull();
    });

    it('should throw on DynamoDB error', async () => {
      dynamoMock.on(GetItemCommand).rejects(new Error('DynamoDB unavailable'));

      await expect(getPageKey('abc-123')).rejects.toThrow('DynamoDB unavailable');
    });
  });

  describe('putPageKey', () => {
    it('should write index entry', async () => {
      dynamoMock.on(PutItemCommand).resolves({});

      const record: PageIndexRecord = {
        guid: 'abc-123',
        s3Key: 'abc-123/abc-123.md',
        parentGuid: null,
        title: 'Test Page',
        updatedAt: '2026-03-29T00:00:00Z',
      };

      // Should not throw
      await putPageKey(record);

      const calls = dynamoMock.commandCalls(PutItemCommand);
      expect(calls).toHaveLength(1);
      expect(calls[0].args[0].input.TableName).toBe('test-page-index');
    });

    it('should not throw on DynamoDB error (fire-and-forget)', async () => {
      dynamoMock.on(PutItemCommand).rejects(new Error('DynamoDB unavailable'));

      const record: PageIndexRecord = {
        guid: 'abc-123',
        s3Key: 'abc-123/abc-123.md',
        parentGuid: null,
        title: 'Test Page',
        updatedAt: '2026-03-29T00:00:00Z',
      };

      // Should not throw — putPageKey swallows errors
      await putPageKey(record);
    });
  });

  describe('deletePageKey', () => {
    it('should delete index entry', async () => {
      dynamoMock.on(DeleteItemCommand).resolves({});

      await deletePageKey('abc-123');

      const calls = dynamoMock.commandCalls(DeleteItemCommand);
      expect(calls).toHaveLength(1);
    });

    it('should not throw on DynamoDB error', async () => {
      dynamoMock.on(DeleteItemCommand).rejects(new Error('DynamoDB unavailable'));

      // Should not throw
      await deletePageKey('abc-123');
    });
  });

  describe('deletePageKeys', () => {
    it('should batch delete index entries', async () => {
      dynamoMock.on(BatchWriteItemCommand).resolves({});

      await deletePageKeys(['guid-1', 'guid-2', 'guid-3']);

      const calls = dynamoMock.commandCalls(BatchWriteItemCommand);
      expect(calls).toHaveLength(1);
    });

    it('should handle empty array', async () => {
      await deletePageKeys([]);

      const calls = dynamoMock.commandCalls(BatchWriteItemCommand);
      expect(calls).toHaveLength(0);
    });

    it('should batch in groups of 25', async () => {
      dynamoMock.on(BatchWriteItemCommand).resolves({});

      const guids = Array.from({ length: 30 }, (_, i) => `guid-${i}`);
      await deletePageKeys(guids);

      const calls = dynamoMock.commandCalls(BatchWriteItemCommand);
      expect(calls).toHaveLength(2); // 25 + 5
    });
  });
});
