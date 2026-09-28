/**
 * Comments Service
 *
 * Shared business logic for page comments (ownership, one-level-deep reply
 * validation, soft-delete-with-replies), used by both the REST handlers
 * (`pages-comments-*.ts`) and the MCP comment tools so the rules live in one
 * place. Comments are stored in a per-page S3 sidecar
 * (`{guid}.comments.json`), never the page's own frontmatter — see
 * `docs/superpowers/specs/2026-09-28-page-comments-design.md`.
 */

import { v4 as uuidv4 } from 'uuid';
import { getStoragePlugin } from '../storage/StoragePluginRegistry.js';
import { Comment } from '../types/index.js';

const MAX_WRITE_ATTEMPTS = 5;

export interface CommentServiceError extends Error {
  code: string;
  statusCode: number;
}

function serviceError(message: string, code: string, statusCode: number): CommentServiceError {
  const err = new Error(message) as CommentServiceError;
  err.code = code;
  err.statusCode = statusCode;
  return err;
}

/**
 * Read-mutate-write a page's comments sidecar with optimistic-concurrency
 * retry: on a `COMMENTS_CONFLICT` (the sidecar changed since it was read),
 * re-read and re-apply `mutate` rather than failing outright. `mutate` may
 * be invoked more than once, so it must be a pure function of the comment
 * list it's given — validation errors it throws (not-found, not-the-author,
 * etc.) propagate immediately and are never retried.
 */
async function withCommentsUpdate(
  pageGuid: string,
  mutate: (comments: Comment[]) => Comment[],
): Promise<Comment[]> {
  const storagePlugin = getStoragePlugin();

  for (let attempt = 1; attempt <= MAX_WRITE_ATTEMPTS; attempt++) {
    const { comments, etag } = await storagePlugin.getComments(pageGuid);
    const next = mutate(comments);

    try {
      await storagePlugin.saveComments(pageGuid, next, etag);
      return next;
    } catch (err: unknown) {
      const error = err as { code?: string };
      if (error.code === 'COMMENTS_CONFLICT' && attempt < MAX_WRITE_ATTEMPTS) {
        continue;
      }
      throw err;
    }
  }

  // Unreachable (the loop above always returns or throws) — satisfies TS's
  // control-flow analysis without an unused-after-loop return type.
  throw serviceError('Failed to save comments after retries', 'COMMENTS_CONFLICT', 409);
}

export async function listComments(pageGuid: string): Promise<Comment[]> {
  const storagePlugin = getStoragePlugin();
  const { comments } = await storagePlugin.getComments(pageGuid);
  return comments;
}

export interface CommentAuthor {
  authorId: string;
  authorName: string;
}

export interface AddCommentInput {
  body: string;
  parentId?: string | null;
}

export async function addComment(
  pageGuid: string,
  input: AddCommentInput,
  author: CommentAuthor,
): Promise<Comment> {
  const trimmedBody = input.body.trim();
  if (!trimmedBody) {
    throw serviceError('Comment body is required', 'INVALID_COMMENT', 400);
  }

  const parentId = input.parentId ?? null;
  const newComment: Comment = {
    id: uuidv4(),
    parentId,
    authorId: author.authorId,
    authorName: author.authorName,
    body: trimmedBody,
    createdAt: new Date().toISOString(),
    editedAt: null,
    deletedAt: null,
  };

  await withCommentsUpdate(pageGuid, (comments) => {
    if (parentId !== null) {
      const parent = comments.find((c) => c.id === parentId);
      if (!parent) {
        throw serviceError('Parent comment not found', 'PARENT_NOT_FOUND', 400);
      }
      if (parent.parentId !== null) {
        throw serviceError(
          'Cannot reply to a reply — only one level of nesting is allowed',
          'REPLY_TOO_DEEP',
          400
        );
      }
    }
    return [...comments, newComment];
  });

  return newComment;
}

export async function updateComment(
  pageGuid: string,
  commentId: string,
  body: string,
  userId: string,
): Promise<Comment> {
  const trimmedBody = body.trim();
  if (!trimmedBody) {
    throw serviceError('Comment body is required', 'INVALID_COMMENT', 400);
  }

  const editedAt = new Date().toISOString();
  let updated: Comment | undefined;

  await withCommentsUpdate(pageGuid, (comments) => {
    const existing = comments.find((c) => c.id === commentId);
    if (!existing || existing.deletedAt) {
      throw serviceError('Comment not found', 'COMMENT_NOT_FOUND', 404);
    }
    if (existing.authorId !== userId) {
      throw serviceError('You can only edit your own comments', 'NOT_COMMENT_AUTHOR', 403);
    }
    updated = { ...existing, body: trimmedBody, editedAt };
    return comments.map((c) => (c.id === commentId ? updated! : c));
  });

  return updated!;
}

export async function deleteComment(
  pageGuid: string,
  commentId: string,
  userId: string,
  isAdmin: boolean,
): Promise<void> {
  const deletedAt = new Date().toISOString();

  await withCommentsUpdate(pageGuid, (comments) => {
    const existing = comments.find((c) => c.id === commentId);
    if (!existing || existing.deletedAt) {
      throw serviceError('Comment not found', 'COMMENT_NOT_FOUND', 404);
    }
    if (existing.authorId !== userId && !isAdmin) {
      throw serviceError('You can only delete your own comments', 'NOT_COMMENT_AUTHOR', 403);
    }

    const hasReplies = comments.some((c) => c.parentId === commentId);
    if (hasReplies) {
      // Soft-delete: keep the row so replies stay anchored, blank the body.
      return comments.map((c) =>
        c.id === commentId ? { ...c, body: '', deletedAt } : c
      );
    }

    // No replies — remove it outright.
    return comments.filter((c) => c.id !== commentId);
  });
}
