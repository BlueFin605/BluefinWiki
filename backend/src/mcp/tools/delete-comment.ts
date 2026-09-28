/**
 * MCP Tool: delete_comment
 *
 * Delete a comment. MCP authors all its comments as the fixed pseudo-user
 * "mcp-client" (see `add-comment.ts`) and is never treated as Admin, so —
 * via the shared comments-service ownership check — this only succeeds for
 * comments MCP itself created, never a human's comment.
 */

import { deleteComment as deleteCommentService } from '../../pages/comments-service.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface DeleteCommentInput {
  pageGuid: string;
  commentId: string;
}

export interface DeleteCommentResult {
  pageGuid: string;
  commentId: string;
  deleted: true;
}

export async function deleteComment(input: DeleteCommentInput): Promise<DeleteCommentResult> {
  const { pageGuid, commentId } = input;

  if (!pageGuid || !UUID_REGEX.test(pageGuid)) {
    throw new Error('Invalid page GUID format');
  }
  if (!commentId || !UUID_REGEX.test(commentId)) {
    throw new Error('Invalid comment GUID format');
  }

  await deleteCommentService(pageGuid, commentId, 'mcp-client', false);

  return { pageGuid, commentId, deleted: true };
}
