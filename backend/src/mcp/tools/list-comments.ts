/**
 * MCP Tool: list_comments
 *
 * List all comments (and replies) on a wiki page, flat — the caller groups
 * by parentId. Soft-deleted comments are included with their body blanked.
 */

import { listComments as listCommentsService } from '../../pages/comments-service.js';
import { Comment } from '../../types/index.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface ListCommentsInput {
  pageGuid: string;
}

export async function listComments(input: ListCommentsInput): Promise<Comment[]> {
  const { pageGuid } = input;

  if (!pageGuid || !UUID_REGEX.test(pageGuid)) {
    throw new Error('Invalid page GUID format');
  }

  return listCommentsService(pageGuid);
}
