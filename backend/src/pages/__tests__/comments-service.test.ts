/**
 * Unit tests for the comments service: ownership enforcement, one-level
 * reply nesting, soft-delete-with-replies vs. hard-delete, and the
 * ETag-conditional-write retry loop.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Comment } from '../../types/index.js';
import type { StoragePlugin } from '../../storage/StoragePlugin.js';

vi.mock('../../storage/StoragePluginRegistry.js', () => ({
  getStoragePlugin: vi.fn(),
}));

const { getStoragePlugin } = await import('../../storage/StoragePluginRegistry.js');
const {
  listComments,
  addComment,
  updateComment,
  deleteComment,
} = await import('../comments-service.js');

const PAGE_GUID = '550e8400-e29b-41d4-a716-446655440000';

function makeComment(overrides: Partial<Comment> & { id: string }): Comment {
  return {
    parentId: null,
    authorId: 'user-1',
    authorName: 'User One',
    body: 'hello',
    createdAt: '2026-01-01T00:00:00Z',
    editedAt: null,
    deletedAt: null,
    ...overrides,
  };
}

describe('comments-service', () => {
  let store: { comments: Comment[]; etag: string | null };
  let mockPlugin: Partial<StoragePlugin>;

  beforeEach(() => {
    vi.clearAllMocks();
    store = { comments: [], etag: null };

    mockPlugin = {
      getComments: vi.fn(async () => ({ comments: store.comments, etag: store.etag })),
      saveComments: vi.fn(async (_guid: string, comments: Comment[], expectedEtag: string | null) => {
        if (expectedEtag !== store.etag) {
          const err = new Error('Comments were modified concurrently') as Error & { code: string };
          err.code = 'COMMENTS_CONFLICT';
          throw err;
        }
        store.comments = comments;
        store.etag = `etag-${comments.length}-${Math.random()}`;
        return { etag: store.etag };
      }),
    };

    (getStoragePlugin as any).mockReturnValue(mockPlugin);
  });

  describe('addComment', () => {
    it('creates a top-level comment', async () => {
      const comment = await addComment(
        PAGE_GUID,
        { body: 'Nice page!' },
        { authorId: 'user-1', authorName: 'User One' }
      );

      expect(comment.parentId).toBeNull();
      expect(comment.body).toBe('Nice page!');
      expect(comment.authorId).toBe('user-1');
      expect(store.comments).toHaveLength(1);
    });

    it('rejects an empty body', async () => {
      await expect(
        addComment(PAGE_GUID, { body: '   ' }, { authorId: 'user-1', authorName: 'User One' })
      ).rejects.toThrow(/comment body is required/i);
    });

    it('creates a reply to a top-level comment', async () => {
      store.comments = [makeComment({ id: 'top-1' })];

      const reply = await addComment(
        PAGE_GUID,
        { body: 'Agreed', parentId: 'top-1' },
        { authorId: 'user-2', authorName: 'User Two' }
      );

      expect(reply.parentId).toBe('top-1');
      expect(store.comments).toHaveLength(2);
    });

    it('rejects a reply to a nonexistent parent', async () => {
      await expect(
        addComment(
          PAGE_GUID,
          { body: 'Agreed', parentId: 'does-not-exist' },
          { authorId: 'user-2', authorName: 'User Two' }
        )
      ).rejects.toThrow(/parent comment not found/i);
    });

    it('rejects replying to a reply (only one level of nesting)', async () => {
      store.comments = [
        makeComment({ id: 'top-1' }),
        makeComment({ id: 'reply-1', parentId: 'top-1' }),
      ];

      await expect(
        addComment(
          PAGE_GUID,
          { body: 'Reply to a reply', parentId: 'reply-1' },
          { authorId: 'user-3', authorName: 'User Three' }
        )
      ).rejects.toThrow(/only one level of nesting/i);
    });
  });

  describe('updateComment', () => {
    it("lets the author edit their own comment", async () => {
      store.comments = [makeComment({ id: 'c1', authorId: 'user-1', body: 'original' })];

      const updated = await updateComment(PAGE_GUID, 'c1', 'edited text', 'user-1');

      expect(updated.body).toBe('edited text');
      expect(updated.editedAt).not.toBeNull();
      expect(store.comments[0].body).toBe('edited text');
    });

    it('rejects editing someone else\'s comment', async () => {
      store.comments = [makeComment({ id: 'c1', authorId: 'user-1' })];

      await expect(updateComment(PAGE_GUID, 'c1', 'edited', 'user-2')).rejects.toMatchObject({
        code: 'NOT_COMMENT_AUTHOR',
        statusCode: 403,
      });
    });

    it('rejects editing a nonexistent comment', async () => {
      await expect(updateComment(PAGE_GUID, 'missing', 'edited', 'user-1')).rejects.toMatchObject({
        code: 'COMMENT_NOT_FOUND',
        statusCode: 404,
      });
    });

    it('rejects editing an already-deleted comment', async () => {
      store.comments = [
        makeComment({ id: 'c1', authorId: 'user-1', body: '', deletedAt: '2026-01-02T00:00:00Z' }),
      ];

      await expect(updateComment(PAGE_GUID, 'c1', 'edited', 'user-1')).rejects.toMatchObject({
        code: 'COMMENT_NOT_FOUND',
      });
    });
  });

  describe('deleteComment', () => {
    it('hard-deletes a leaf comment with no replies', async () => {
      store.comments = [makeComment({ id: 'c1', authorId: 'user-1' })];

      await deleteComment(PAGE_GUID, 'c1', 'user-1', false);

      expect(store.comments).toHaveLength(0);
    });

    it('soft-deletes a comment that has replies, keeping the row', async () => {
      store.comments = [
        makeComment({ id: 'c1', authorId: 'user-1', body: 'parent' }),
        makeComment({ id: 'c2', authorId: 'user-2', parentId: 'c1', body: 'a reply' }),
      ];

      await deleteComment(PAGE_GUID, 'c1', 'user-1', false);

      expect(store.comments).toHaveLength(2);
      const softDeleted = store.comments.find((c) => c.id === 'c1')!;
      expect(softDeleted.body).toBe('');
      expect(softDeleted.deletedAt).not.toBeNull();
      // The reply survives untouched.
      expect(store.comments.find((c) => c.id === 'c2')!.deletedAt).toBeNull();
    });

    it("rejects deleting someone else's comment when not an Admin", async () => {
      store.comments = [makeComment({ id: 'c1', authorId: 'user-1' })];

      await expect(deleteComment(PAGE_GUID, 'c1', 'user-2', false)).rejects.toMatchObject({
        code: 'NOT_COMMENT_AUTHOR',
        statusCode: 403,
      });
    });

    it('lets an Admin delete any comment', async () => {
      store.comments = [makeComment({ id: 'c1', authorId: 'user-1' })];

      await deleteComment(PAGE_GUID, 'c1', 'admin-user', true);

      expect(store.comments).toHaveLength(0);
    });
  });

  describe('listComments', () => {
    it('returns the flat comment list as stored', async () => {
      store.comments = [makeComment({ id: 'c1' }), makeComment({ id: 'c2', parentId: 'c1' })];

      const result = await listComments(PAGE_GUID);

      expect(result).toHaveLength(2);
    });
  });

  describe('conflict retry', () => {
    it('re-reads and retries once when the sidecar changed between read and write', async () => {
      store.comments = [];
      store.etag = 'etag-initial';

      let getCallCount = 0;
      (mockPlugin.getComments as any).mockImplementation(async () => {
        getCallCount += 1;
        if (getCallCount === 1) {
          // First read: stale snapshot. A "concurrent" comment lands before the write.
          return { comments: [], etag: 'etag-initial' };
        }
        // Second read (after conflict): reflects the concurrent write.
        return { comments: store.comments, etag: store.etag };
      });

      let saveCallCount = 0;
      (mockPlugin.saveComments as any).mockImplementation(
        async (_guid: string, comments: Comment[], expectedEtag: string | null) => {
          saveCallCount += 1;
          if (saveCallCount === 1) {
            // Simulate the concurrent write landing first.
            store.comments = [makeComment({ id: 'concurrent', authorId: 'user-2' })];
            store.etag = 'etag-after-concurrent-write';
            const err = new Error('Comments were modified concurrently') as Error & { code: string };
            err.code = 'COMMENTS_CONFLICT';
            throw err;
          }
          if (expectedEtag !== store.etag) {
            throw new Error('unexpected etag on retry');
          }
          store.comments = comments;
          store.etag = 'etag-final';
          return { etag: store.etag };
        }
      );

      const result = await addComment(
        PAGE_GUID,
        { body: 'mine' },
        { authorId: 'user-1', authorName: 'User One' }
      );

      expect(saveCallCount).toBe(2);
      // Both the concurrently-written comment and the new one survive.
      expect(store.comments.map((c) => c.id)).toContain('concurrent');
      expect(store.comments.map((c) => c.id)).toContain(result.id);
    });
  });
});
