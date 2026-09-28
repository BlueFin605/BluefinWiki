/**
 * MCP Tool: add_comment
 *
 * Post a comment (or, with parentId, a reply) on a wiki page. MCP has no
 * real user identity (API-key auth only, no Cognito) — comments are
 * authored as the fixed pseudo-user "mcp-client", the same identity
 * `update_page` already attributes MCP edits to.
 */

import { addComment as addCommentService } from '../../pages/comments-service.js';
import { Comment } from '../../types/index.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface AddCommentInput {
  pageGuid: string;
  body: string;
  parentId?: string | null;
}

export async function addComment(input: AddCommentInput): Promise<Comment> {
  const { pageGuid, body, parentId = null } = input;

  if (!pageGuid || !UUID_REGEX.test(pageGuid)) {
    throw new Error('Invalid page GUID format');
  }
  if (!body || !body.trim()) {
    throw new Error('Comment body is required');
  }
  if (parentId !== null && !UUID_REGEX.test(parentId)) {
    throw new Error('Invalid parent comment GUID format');
  }

  return addCommentService(
    pageGuid,
    { body, parentId },
    { authorId: 'mcp-client', authorName: 'MCP Client' }
  );
}
