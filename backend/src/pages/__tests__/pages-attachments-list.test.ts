/**
 * Tests for pages-attachments-list Lambda function
 * Task 7.2: Attachment Metadata & Listing
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { APIGatewayProxyEvent } from 'aws-lambda';
import { handler } from '../pages-attachments-list.js';
import type { S3StoragePlugin } from '../../storage/S3StoragePlugin.js';
import type { AttachmentMetadata } from '../../types/index.js';

// Mock the storage plugin
vi.mock('../../storage/StoragePluginRegistry.js', () => ({
  getStoragePlugin: vi.fn(),
}));

// Mock auth middleware
vi.mock('../../middleware/auth.js', () => ({
  withAuth: (fn: any) => fn,
}));

const { getStoragePlugin } = await import('../../storage/StoragePluginRegistry.js');

describe('pages-attachments-list', () => {
  let mockPlugin: Partial<S3StoragePlugin>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockPlugin = {
      listAttachments: vi.fn(),
    };

    (getStoragePlugin as any).mockReturnValue(mockPlugin);
  });

  describe('Parameter Validation', () => {
    it('should return 400 if pageGuid is missing', async () => {
      const event: APIGatewayProxyEvent = {
        pathParameters: null,
      } as any;

      const result = await handler(event, {} as any);

      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body).error).toContain('Page GUID is required');
    });

    it('should return 400 if pageGuid is invalid format', async () => {
      const event: APIGatewayProxyEvent = {
        pathParameters: { pageGuid: 'invalid-guid-123' },
      } as any;

      const result = await handler(event, {} as any);

      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body).error).toContain('Invalid page GUID format');
    });

    it('should accept pageGuid parameter', async () => {
      const validGuid = '550e8400-e29b-41d4-a716-446655440000';
      (mockPlugin.listAttachments as any).mockResolvedValue([]);

      const event: APIGatewayProxyEvent = {
        pathParameters: { pageGuid: validGuid },
      } as any;

      const result = await handler(event, {} as any);

      expect(result.statusCode).toBe(200);
      expect(mockPlugin.listAttachments).toHaveBeenCalledWith(validGuid);
    });

    it('should accept guid parameter as fallback', async () => {
      const validGuid = '550e8400-e29b-41d4-a716-446655440000';
      (mockPlugin.listAttachments as any).mockResolvedValue([]);

      const event: APIGatewayProxyEvent = {
        pathParameters: { guid: validGuid },
      } as any;

      const result = await handler(event, {} as any);

      expect(result.statusCode).toBe(200);
      expect(mockPlugin.listAttachments).toHaveBeenCalledWith(validGuid);
    });
  });

  describe('Successful Responses', () => {
    it('should return empty array when page has no attachments', async () => {
      const validGuid = '550e8400-e29b-41d4-a716-446655440000';
      (mockPlugin.listAttachments as any).mockResolvedValue([]);

      const event: APIGatewayProxyEvent = {
        pathParameters: { pageGuid: validGuid },
      } as any;

      const result = await handler(event, {} as any);

      expect(result.statusCode).toBe(200);
      expect(result.headers?.['Content-Type']).toBe('application/json');
      const body = JSON.parse(result.body);
      expect(body.attachments).toEqual([]);
    });

    it('should return list of attachments with metadata', async () => {
      const validGuid = '550e8400-e29b-41d4-a716-446655440000';
      const mockAttachments: AttachmentMetadata[] = [
        {
          filename: 'document.pdf',
          contentType: 'application/pdf',
          size: 12345,
          uploadedAt: '2026-03-07T10:00:00.000Z',
          uploadedBy: 'user-1',
          checksum: 'abc123',
        },
        {
          filename: 'image.png',
          contentType: 'image/png',
          size: 54321,
          uploadedAt: '2026-03-07T09:00:00.000Z',
          uploadedBy: 'user-2',
          checksum: 'def456',
          dimensions: { width: 1920, height: 1080 },
        },
      ];

      (mockPlugin.listAttachments as any).mockResolvedValue(mockAttachments);

      const event: APIGatewayProxyEvent = {
        pathParameters: { pageGuid: validGuid },
      } as any;

      const result = await handler(event, {} as any);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.attachments).toHaveLength(2);
      expect(body.attachments[0].filename).toBe('document.pdf');
      expect(body.attachments[1].filename).toBe('image.png');
      expect(body.attachments[1].dimensions).toEqual({ width: 1920, height: 1080 });
    });

    it('should return attachments sorted by uploadedAt descending', async () => {
      const validGuid = '550e8400-e29b-41d4-a716-446655440000';
      const mockAttachments: AttachmentMetadata[] = [
        {
          filename: 'newest.pdf',
          contentType: 'application/pdf',
          size: 100,
          uploadedAt: '2026-03-07T12:00:00.000Z',
          uploadedBy: 'user-1',
          checksum: 'abc',
        },
        {
          filename: 'older.pdf',
          contentType: 'application/pdf',
          size: 100,
          uploadedAt: '2026-03-07T10:00:00.000Z',
          uploadedBy: 'user-1',
          checksum: 'def',
        },
      ];

      (mockPlugin.listAttachments as any).mockResolvedValue(mockAttachments);

      const event: APIGatewayProxyEvent = {
        pathParameters: { pageGuid: validGuid },
      } as any;

      const result = await handler(event, {} as any);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.attachments[0].filename).toBe('newest.pdf');
      expect(body.attachments[1].filename).toBe('older.pdf');
    });
  });

  describe('Error Handling', () => {
    it('should return 500 when storage plugin throws error', async () => {
      const validGuid = '550e8400-e29b-41d4-a716-446655440000';
      (mockPlugin.listAttachments as any).mockRejectedValue(new Error('S3 connection failed'));

      const event: APIGatewayProxyEvent = {
        pathParameters: { pageGuid: validGuid },
      } as any;

      const result = await handler(event, {} as any);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.error).toContain('S3 connection failed');
    });

    it('should handle errors with code property', async () => {
      const validGuid = '550e8400-e29b-41d4-a716-446655440000';
      const customError: any = new Error('Page not found');
      customError.code = 'PAGE_NOT_FOUND';
      customError.statusCode = 404;

      (mockPlugin.listAttachments as any).mockRejectedValue(customError);

      const event: APIGatewayProxyEvent = {
        pathParameters: { pageGuid: validGuid },
      } as any;

      const result = await handler(event, {} as any);

      expect(result.statusCode).toBe(404);
      const body = JSON.parse(result.body);
      expect(body.error).toContain('Page not found');
      expect(body.code).toBe('PAGE_NOT_FOUND');
    });

    it('should handle non-Error objects', async () => {
      const validGuid = '550e8400-e29b-41d4-a716-446655440000';
      (mockPlugin.listAttachments as any).mockRejectedValue('String error');

      const event: APIGatewayProxyEvent = {
        pathParameters: { pageGuid: validGuid },
      } as any;

      const result = await handler(event, {} as any);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.error).toBe('Failed to list attachments');
    });
  });

  describe('GUID Validation', () => {
    const validGuids = [
      '550e8400-e29b-41d4-a716-446655440000',
      'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      '00000000-0000-4000-8000-000000000000',
    ];

    const invalidGuids = [
      'not-a-guid',
      '550e8400-e29b-41d4-a716',
      '550e8400-e29b-41d4-a716-446655440000-extra',
      '',
      '550e8400e29b41d4a716446655440000', // No hyphens
    ];

    validGuids.forEach((guid) => {
      it(`should accept valid GUID: ${guid}`, async () => {
        (mockPlugin.listAttachments as any).mockResolvedValue([]);

        const event: APIGatewayProxyEvent = {
          pathParameters: { pageGuid: guid },
        } as any;

        const result = await handler(event, {} as any);

        expect(result.statusCode).toBe(200);
        expect(mockPlugin.listAttachments).toHaveBeenCalledWith(guid);
      });
    });

    invalidGuids.forEach((guid) => {
      it(`should reject invalid GUID: ${guid}`, async () => {
        const event: APIGatewayProxyEvent = {
          pathParameters: { pageGuid: guid },
        } as any;

        const result = await handler(event, {} as any);

        expect(result.statusCode).toBe(400);
        expect(mockPlugin.listAttachments).not.toHaveBeenCalled();
      });
    });
  });
});
