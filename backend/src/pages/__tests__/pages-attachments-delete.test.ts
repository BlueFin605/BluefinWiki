/**
 * Tests for pages-attachments-delete Lambda function
 * Task 7.2: Attachment Metadata & Listing
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { APIGatewayProxyEvent } from 'aws-lambda';
import { handler } from '../pages-attachments-delete.js';
import type { S3StoragePlugin } from '../../storage/S3StoragePlugin.js';

// Mock the storage plugin
vi.mock('../../storage/StoragePluginRegistry.js', () => ({
  getStoragePlugin: vi.fn(),
}));

// Mock auth middleware
vi.mock('../../middleware/auth.js', () => ({
  withAuth: (fn: any) => fn,
}));

const { getStoragePlugin } = await import('../../storage/StoragePluginRegistry.js');

describe('pages-attachments-delete', () => {
  let mockPlugin: Partial<S3StoragePlugin>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockPlugin = {
      deleteAttachment: vi.fn(),
    };

    (getStoragePlugin as any).mockReturnValue(mockPlugin);
  });

  describe('Parameter Validation', () => {
    it('should return 400 if pageGuid is missing', async () => {
      const event: APIGatewayProxyEvent = {
        pathParameters: { filename: 'test-file.pdf' },
      } as any;

      const result = await handler(event, {} as any);

      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body).error).toContain('Page GUID and filename are required');
    });

    it('should return 400 if filename is missing', async () => {
      const event: APIGatewayProxyEvent = {
        pathParameters: { pageGuid: '550e8400-e29b-41d4-a716-446655440000' },
      } as any;

      const result = await handler(event, {} as any);

      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body).error).toContain('Page GUID and filename are required');
    });

    it('should return 400 if both are missing', async () => {
      const event: APIGatewayProxyEvent = {
        pathParameters: null,
      } as any;

      const result = await handler(event, {} as any);

      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body).error).toContain('Page GUID and filename are required');
    });

    it('should return 400 if pageGuid has invalid format', async () => {
      const event: APIGatewayProxyEvent = {
        pathParameters: {
          pageGuid: 'invalid-guid',
          filename: 'test-file.pdf',
        },
      } as any;

      const result = await handler(event, {} as any);

      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body).error).toContain('Invalid GUID format');
    });

    it('should accept pageGuid parameter with filename', async () => {
      const pageGuid = '550e8400-e29b-41d4-a716-446655440000';
      const filename = 'test-file.pdf';
      (mockPlugin.deleteAttachment as any).mockResolvedValue(undefined);

      const event: APIGatewayProxyEvent = {
        pathParameters: { pageGuid, filename },
      } as any;

      const result = await handler(event, {} as any);

      expect(result.statusCode).toBe(200);
      expect(mockPlugin.deleteAttachment).toHaveBeenCalledWith(pageGuid, filename);
    });

    it('should accept guid parameter as fallback for pageGuid', async () => {
      const pageGuid = '550e8400-e29b-41d4-a716-446655440000';
      const filename = 'test-file.pdf';
      (mockPlugin.deleteAttachment as any).mockResolvedValue(undefined);

      const event: APIGatewayProxyEvent = {
        pathParameters: { guid: pageGuid, filename },
      } as any;

      const result = await handler(event, {} as any);

      expect(result.statusCode).toBe(200);
      expect(mockPlugin.deleteAttachment).toHaveBeenCalledWith(pageGuid, filename);
    });

    it('should accept attachmentGuid parameter as fallback for filename', async () => {
      const pageGuid = '550e8400-e29b-41d4-a716-446655440000';
      const filename = 'test-file.pdf';
      (mockPlugin.deleteAttachment as any).mockResolvedValue(undefined);

      const event: APIGatewayProxyEvent = {
        pathParameters: { pageGuid, attachmentGuid: filename },
      } as any;

      const result = await handler(event, {} as any);

      expect(result.statusCode).toBe(200);
      expect(mockPlugin.deleteAttachment).toHaveBeenCalledWith(pageGuid, filename);
    });
  });

  describe('Successful Deletion', () => {
    it('should delete attachment and return success response', async () => {
      const pageGuid = '550e8400-e29b-41d4-a716-446655440000';
      const filename = 'test-document.pdf';
      (mockPlugin.deleteAttachment as any).mockResolvedValue(undefined);

      const event: APIGatewayProxyEvent = {
        pathParameters: { pageGuid, filename },
      } as any;

      const result = await handler(event, {} as any);

      expect(result.statusCode).toBe(200);
      expect(result.headers?.['Content-Type']).toBe('application/json');
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.message).toBe('Attachment deleted successfully');
    });

    it('should call deleteAttachment with correct parameters', async () => {
      const pageGuid = '550e8400-e29b-41d4-a716-446655440000';
      const filename = 'test-document.pdf';
      (mockPlugin.deleteAttachment as any).mockResolvedValue(undefined);

      const event: APIGatewayProxyEvent = {
        pathParameters: { pageGuid, filename },
      } as any;

      await handler(event, {} as any);

      expect(mockPlugin.deleteAttachment).toHaveBeenCalledTimes(1);
      expect(mockPlugin.deleteAttachment).toHaveBeenCalledWith(pageGuid, filename);
    });
  });

  describe('Error Handling', () => {
    it('should return 500 when storage plugin throws error', async () => {
      const pageGuid = '550e8400-e29b-41d4-a716-446655440000';
      const filename = 'test-document.pdf';
      (mockPlugin.deleteAttachment as any).mockRejectedValue(new Error('S3 deletion failed'));

      const event: APIGatewayProxyEvent = {
        pathParameters: { pageGuid, filename },
      } as any;

      const result = await handler(event, {} as any);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.error).toContain('S3 deletion failed');
    });

    it('should handle attachment not found error', async () => {
      const pageGuid = '550e8400-e29b-41d4-a716-446655440000';
      const filename = 'test-document.pdf';
      const notFoundError: any = new Error('Attachment not found');
      notFoundError.code = 'ATTACHMENT_NOT_FOUND';
      notFoundError.statusCode = 404;

      (mockPlugin.deleteAttachment as any).mockRejectedValue(notFoundError);

      const event: APIGatewayProxyEvent = {
        pathParameters: { pageGuid, filename },
      } as any;

      const result = await handler(event, {} as any);

      expect(result.statusCode).toBe(404);
      const body = JSON.parse(result.body);
      expect(body.error).toContain('Attachment not found');
      expect(body.code).toBe('ATTACHMENT_NOT_FOUND');
    });

    it('should handle page not found error', async () => {
      const pageGuid = '550e8400-e29b-41d4-a716-446655440000';
      const filename = 'test-document.pdf';
      const pageNotFoundError: any = new Error('Page not found');
      pageNotFoundError.code = 'PAGE_NOT_FOUND';
      pageNotFoundError.statusCode = 404;

      (mockPlugin.deleteAttachment as any).mockRejectedValue(pageNotFoundError);

      const event: APIGatewayProxyEvent = {
        pathParameters: { pageGuid, filename },
      } as any;

      const result = await handler(event, {} as any);

      expect(result.statusCode).toBe(404);
      const body = JSON.parse(result.body);
      expect(body.error).toContain('Page not found');
      expect(body.code).toBe('PAGE_NOT_FOUND');
    });

    it('should handle errors with custom status codes', async () => {
      const pageGuid = '550e8400-e29b-41d4-a716-446655440000';
      const filename = 'test-document.pdf';
      const customError: any = new Error('Permission denied');
      customError.code = 'PERMISSION_DENIED';
      customError.statusCode = 403;

      (mockPlugin.deleteAttachment as any).mockRejectedValue(customError);

      const event: APIGatewayProxyEvent = {
        pathParameters: { pageGuid, filename },
      } as any;

      const result = await handler(event, {} as any);

      expect(result.statusCode).toBe(403);
      const body = JSON.parse(result.body);
      expect(body.error).toContain('Permission denied');
      expect(body.code).toBe('PERMISSION_DENIED');
    });

    it('should handle non-Error objects', async () => {
      const pageGuid = '550e8400-e29b-41d4-a716-446655440000';
      const filename = 'test-document.pdf';
      (mockPlugin.deleteAttachment as any).mockRejectedValue('String error');

      const event: APIGatewayProxyEvent = {
        pathParameters: { pageGuid, filename },
      } as any;

      const result = await handler(event, {} as any);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.error).toBe('Failed to delete attachment');
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
      '550e8400-e29b-61d4-a716-446655440000', // Invalid version (6 instead of 1-5)
    ];

    validGuids.forEach((guid) => {
      it(`should accept valid pageGuid: ${guid}`, async () => {
        (mockPlugin.deleteAttachment as any).mockResolvedValue(undefined);
        const filename = 'test-document.pdf';

        const event: APIGatewayProxyEvent = {
          pathParameters: { pageGuid: guid, filename },
        } as any;

        const result = await handler(event, {} as any);

        expect(result.statusCode).toBe(200);
        expect(mockPlugin.deleteAttachment).toHaveBeenCalledWith(guid, filename);
      });
    });

    invalidGuids.forEach((guid) => {
      it(`should reject invalid pageGuid: ${guid}`, async () => {
        const filename = 'test-document.pdf';

        const event: APIGatewayProxyEvent = {
          pathParameters: { pageGuid: guid, filename },
        } as any;

        const result = await handler(event, {} as any);

        expect(result.statusCode).toBe(400);
        expect(mockPlugin.deleteAttachment).not.toHaveBeenCalled();
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle deletion of already deleted attachment', async () => {
      const pageGuid = '550e8400-e29b-41d4-a716-446655440000';
      const filename = 'test-document.pdf';
      const error: any = new Error('Attachment not found');
      error.code = 'ATTACHMENT_NOT_FOUND';
      error.statusCode = 404;

      (mockPlugin.deleteAttachment as any).mockRejectedValue(error);

      const event: APIGatewayProxyEvent = {
        pathParameters: { pageGuid, filename },
      } as any;

      const result = await handler(event, {} as any);

      expect(result.statusCode).toBe(404);
    });

    it('should handle deletion with special characters in GUID (uppercase)', async () => {
      const pageGuid = '550E8400-E29B-41D4-A716-446655440000';
      const filename = 'test-document.pdf';
      (mockPlugin.deleteAttachment as any).mockResolvedValue(undefined);

      const event: APIGatewayProxyEvent = {
        pathParameters: { pageGuid, filename },
      } as any;

      const result = await handler(event, {} as any);

      expect(result.statusCode).toBe(200);
      expect(mockPlugin.deleteAttachment).toHaveBeenCalledWith(pageGuid, filename);
    });
  });
});
