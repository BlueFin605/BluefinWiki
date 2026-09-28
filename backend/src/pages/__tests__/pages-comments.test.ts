/**
 * Handler-level tests for the pages-comments-* Lambda functions: request
 * validation, response shape, and error-code/status-code mapping. The
 * ownership/threading/soft-delete business rules themselves are covered by
 * comments-service.test.ts — these tests mock comments-service.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { APIGatewayProxyEvent } from 'aws-lambda';

vi.mock('../../middleware/auth.js', () => ({
  withAuth: (fn: any) => fn,
  getUserContext: () => ({
    userId: 'user-1',
    email: 'user@example.com',
    role: 'Standard',
    displayName: 'User One',
  }),
}));

vi.mock('../comments-service.js', () => ({
  listComments: vi.fn(),
  addComment: vi.fn(),
  updateComment: vi.fn(),
  deleteComment: vi.fn(),
}));

const commentsService = await import('../comments-service.js');
const { handler: listHandler } = await import('../pages-comments-list.js');
const { handler: createHandler } = await import('../pages-comments-create.js');
const { handler: updateHandler } = await import('../pages-comments-update.js');
const { handler: deleteHandler } = await import('../pages-comments-delete.js');

const PAGE_GUID = '550e8400-e29b-41d4-a716-446655440000';
const COMMENT_GUID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('pages-comments-list', () => {
  it('returns 400 for an invalid page GUID', async () => {
    const event = { pathParameters: { pageGuid: 'not-a-guid' } } as unknown as APIGatewayProxyEvent;
    const result = await listHandler(event, {} as any);
    expect(result.statusCode).toBe(400);
  });

  it('returns the comment list from the service', async () => {
    (commentsService.listComments as any).mockResolvedValue([{ id: 'c1' }]);
    const event = { pathParameters: { pageGuid: PAGE_GUID } } as unknown as APIGatewayProxyEvent;

    const result = await listHandler(event, {} as any);

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual({ comments: [{ id: 'c1' }] });
    expect(commentsService.listComments).toHaveBeenCalledWith(PAGE_GUID);
  });
});

describe('pages-comments-create', () => {
  it('returns 400 when the body is missing', async () => {
    const event = {
      pathParameters: { pageGuid: PAGE_GUID },
      body: null,
    } as unknown as APIGatewayProxyEvent;

    const result = await createHandler(event, {} as any);
    expect(result.statusCode).toBe(400);
  });

  it('returns 400 when validation fails (empty comment body)', async () => {
    const event = {
      pathParameters: { pageGuid: PAGE_GUID },
      body: JSON.stringify({ body: '' }),
    } as unknown as APIGatewayProxyEvent;

    const result = await createHandler(event, {} as any);
    expect(result.statusCode).toBe(400);
  });

  it('creates a comment authored as the signed-in user', async () => {
    (commentsService.addComment as any).mockResolvedValue({ id: 'new-comment' });
    const event = {
      pathParameters: { pageGuid: PAGE_GUID },
      body: JSON.stringify({ body: 'Nice page!' }),
    } as unknown as APIGatewayProxyEvent;

    const result = await createHandler(event, {} as any);

    expect(result.statusCode).toBe(201);
    expect(JSON.parse(result.body)).toEqual({ id: 'new-comment' });
    expect(commentsService.addComment).toHaveBeenCalledWith(
      PAGE_GUID,
      { body: 'Nice page!' },
      { authorId: 'user-1', authorName: 'User One' }
    );
  });
});

describe('pages-comments-update', () => {
  it('returns 400 for an invalid comment GUID', async () => {
    const event = {
      pathParameters: { pageGuid: PAGE_GUID, commentId: 'not-a-guid' },
      body: JSON.stringify({ body: 'edited' }),
    } as unknown as APIGatewayProxyEvent;

    const result = await updateHandler(event, {} as any);
    expect(result.statusCode).toBe(400);
  });

  it('maps a NOT_COMMENT_AUTHOR service error to 403', async () => {
    const err: any = new Error('You can only edit your own comments');
    err.code = 'NOT_COMMENT_AUTHOR';
    err.statusCode = 403;
    (commentsService.updateComment as any).mockRejectedValue(err);

    const event = {
      pathParameters: { pageGuid: PAGE_GUID, commentId: COMMENT_GUID },
      body: JSON.stringify({ body: 'edited' }),
    } as unknown as APIGatewayProxyEvent;

    const result = await updateHandler(event, {} as any);

    expect(result.statusCode).toBe(403);
    expect(JSON.parse(result.body).code).toBe('NOT_COMMENT_AUTHOR');
  });

  it('edits the comment on success', async () => {
    (commentsService.updateComment as any).mockResolvedValue({ id: COMMENT_GUID, body: 'edited' });
    const event = {
      pathParameters: { pageGuid: PAGE_GUID, commentId: COMMENT_GUID },
      body: JSON.stringify({ body: 'edited' }),
    } as unknown as APIGatewayProxyEvent;

    const result = await updateHandler(event, {} as any);

    expect(result.statusCode).toBe(200);
    expect(commentsService.updateComment).toHaveBeenCalledWith(PAGE_GUID, COMMENT_GUID, 'edited', 'user-1');
  });
});

describe('pages-comments-delete', () => {
  it('returns 400 when commentId is missing', async () => {
    const event = { pathParameters: { pageGuid: PAGE_GUID } } as unknown as APIGatewayProxyEvent;
    const result = await deleteHandler(event, {} as any);
    expect(result.statusCode).toBe(400);
  });

  it('passes isAdmin=false for a Standard-role user', async () => {
    (commentsService.deleteComment as any).mockResolvedValue(undefined);
    const event = {
      pathParameters: { pageGuid: PAGE_GUID, commentId: COMMENT_GUID },
    } as unknown as APIGatewayProxyEvent;

    const result = await deleteHandler(event, {} as any);

    expect(result.statusCode).toBe(200);
    expect(commentsService.deleteComment).toHaveBeenCalledWith(PAGE_GUID, COMMENT_GUID, 'user-1', false);
  });

  it('maps a COMMENT_NOT_FOUND service error to 404', async () => {
    const err: any = new Error('Comment not found');
    err.code = 'COMMENT_NOT_FOUND';
    err.statusCode = 404;
    (commentsService.deleteComment as any).mockRejectedValue(err);

    const event = {
      pathParameters: { pageGuid: PAGE_GUID, commentId: COMMENT_GUID },
    } as unknown as APIGatewayProxyEvent;

    const result = await deleteHandler(event, {} as any);

    expect(result.statusCode).toBe(404);
  });
});
