/**
 * MCP Tool: update_comment
 *
 * Edit a comment. MCP authors all its comments as the fixed pseudo-user
 * "mcp-client" (see `add-comment.ts`), and the shared comments-service
 * ownership check means this only succeeds for comments MCP itself created
 * — never a human's comment.
 */

import { updateComment as updateCommentService } from '../../pages/comments-service.js';
import { Comment } from '../../types/index.js';
import { resolvePageRef } from '../../ticket-keys/ticket-keys-service.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface UpdateCommentInput {
  pageGuid: string;
  commentId: string;
  body: string;
}

export async function updateComment(input: UpdateCommentInput): Promise<Comment> {
  const { pageGuid: pageRef, commentId, body } = input;
  const pageGuid = pageRef ? await resolvePageRef(pageRef) : pageRef;

  if (!pageGuid || !UUID_REGEX.test(pageGuid)) {
    throw new Error('Invalid page GUID format');
  }
  if (!commentId || !UUID_REGEX.test(commentId)) {
    throw new Error('Invalid comment GUID format');
  }
  if (!body || !body.trim()) {
    throw new Error('Comment body is required');
  }

  return updateCommentService(pageGuid, commentId, body, 'mcp-client');
}
