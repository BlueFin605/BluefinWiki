/**
 * Tests for pages-attachments-upload Lambda: malformed multipart bodies are client errors (400).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { APIGatewayProxyEvent } from 'aws-lambda';
import { handler } from '../pages-attachments-upload.js';

vi.mock('../../storage/StoragePluginRegistry.js', () => ({
  getStoragePlugin: vi.fn(),
}));

vi.mock('../../middleware/auth.js', () => ({
  withAuth: (fn: unknown) => fn,
  getUserContext: () => ({ userId: 'test-user' }),
}));

const { getStoragePlugin } = await import('../../storage/StoragePluginRegistry.js');

const GUID = '550e8400-e29b-41d4-a716-446655440000';
const CONTENT_TYPE = 'multipart/form-data; boundary=testboundary';

function makeEvent(body: string | null): APIGatewayProxyEvent {
  return {
    pathParameters: { pageGuid: GUID },
    headers: { 'Content-Type': CONTENT_TYPE },
    body,
    isBase64Encoded: false,
  } as unknown as APIGatewayProxyEvent;
}

describe('pages-attachments-upload malformed multipart', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getStoragePlugin as ReturnType<typeof vi.fn>).mockReturnValue({
      uploadAttachment: vi.fn(),
      saveAttachmentMetadata: vi.fn(),
    });
  });

  it('returns 400 when the body has no parseable file part (LF-delimited)', async () => {
    const body = [
      '--testboundary',
      'Content-Disposition: form-data; name="file"; filename="a.txt"',
      'Content-Type: text/plain',
      '',
      'hello',
      '--testboundary--',
      '',
    ].join('\n');

    const result = await handler(makeEvent(body), {} as never);

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).error).toBe('No file found in multipart payload');
  });

  it('returns 400 when the multipart has only a non-file field', async () => {
    const body = [
      '--testboundary',
      'Content-Disposition: form-data; name="text"',
      '',
      'just text',
      '--testboundary--',
    ].join('\r\n');

    const result = await handler(makeEvent(body), {} as never);

    expect(result.statusCode).toBe(400);
  });

  it('returns 400 when the body is missing', async () => {
    const result = await handler(makeEvent(null), {} as never);

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).error).toBe('Request body is required');
  });

  it('returns 400 when the boundary is missing', async () => {
    const event = makeEvent('x');
    event.headers = { 'Content-Type': 'multipart/form-data' };

    const result = await handler(event, {} as never);

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).error).toBe('Missing multipart boundary');
  });
});
