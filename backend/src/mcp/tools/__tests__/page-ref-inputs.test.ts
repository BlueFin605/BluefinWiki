/**
 * The generic MCP page/comment tools accept a ticket key wherever they take a
 * page GUID: the key resolves before validation, and the resolved GUID is what
 * reaches storage / the comments service / S3 / DynamoDB.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { GUID, PARENT, COMMENT, KEYS, storage, comments, getPageFileKey, s3Send, ddbSend } = vi.hoisted(() => {
  const GUID = '3f2b8a0e-5c1d-4e7a-9b36-1a2b3c4d5e6f';
  const PARENT = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
  const COMMENT = '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d';
  const KEYS: Record<string, string> = { 'BGT-12': GUID, 'BGT-1': PARENT };
  
  const reached = (what: string) => (...args: unknown[]) => {
    throw new Error(`reached ${what} ${JSON.stringify(args)}`);
  };
  
  const storage = {
    loadPage: vi.fn(reached('loadPage')),
    listChildren: vi.fn(reached('listChildren')),
    getPageFileKey: (g: string) => getPageFileKey(g),
  };
  const comments = {
    listComments: vi.fn(reached('listComments')),
    addComment: vi.fn(reached('addComment')),
    updateComment: vi.fn(reached('updateComment')),
    deleteComment: vi.fn(reached('deleteComment')),
  };
  const getPageFileKey = vi.fn();
  const s3Send = vi.fn();
  const ddbSend = vi.fn();
  return { GUID, PARENT, COMMENT, KEYS, storage, comments, getPageFileKey, s3Send, ddbSend };
});

vi.mock('../../../ticket-keys/ticket-keys-service.js', () => ({
  isTicketKey: (r: string) => /^[A-Za-z][A-Za-z0-9]*-\d+$/.test(r.trim()),
  resolvePageRef: vi.fn(async (r: string) => {
    if (!/^[A-Za-z][A-Za-z0-9]*-\d+$/.test(r)) return r;
    const g = KEYS[r.toUpperCase()];
    if (!g) throw new Error(`unknown ticket key "${r.toUpperCase()}"`);
    return g;
  }),
  keyForNewPage: vi.fn(),
  recordKey: vi.fn(),
}));
vi.mock('../../../storage/StoragePluginRegistry.js', () => ({ getStoragePlugin: () => storage }));
vi.mock('../../../pages/comments-service.js', () => comments);
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: class { send = (c: unknown) => s3Send(c); },
  GetObjectCommand: class { constructor(public input: unknown) {} },
}));
vi.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: class { send = (c: unknown) => ddbSend(c); },
  QueryCommand: class { constructor(public input: unknown) {} },
  BatchGetItemCommand: class { constructor(public input: unknown) {} },
}));
vi.mock('../../../pages/page-type-validation.js', () => ({
  validatePageType: vi.fn().mockResolvedValue({ warnings: [] }),
  validateChildTypeConstraint: vi.fn().mockResolvedValue({ warnings: [] }),
}));

import { updatePage } from '../update-page.js';
import { movePage } from '../move-page.js';
import { deletePage } from '../delete-page.js';
import { createPage } from '../create-page.js';
import { getBacklinks } from '../get-backlinks.js';
import { getPage } from '../get-page.js';
import { listComments } from '../list-comments.js';
import { addComment } from '../add-comment.js';
import { updateComment } from '../update-comment.js';
import { deleteComment } from '../delete-comment.js';

beforeEach(() => vi.clearAllMocks());

describe('MCP tools accept ticket keys as page references', () => {
  it('update_page', async () => {
    await expect(updatePage({ pageGuid: 'bgt-12', title: 'x' })).rejects.toThrow(`reached loadPage ["${GUID}"]`);
  });

  it('delete_page', async () => {
    await expect(deletePage({ pageGuid: 'BGT-12' })).rejects.toThrow(`reached loadPage ["${GUID}"]`);
  });

  it('move_page resolves both the page and the new parent', async () => {
    storage.loadPage.mockResolvedValueOnce({} as never);
    await expect(movePage({ pageGuid: 'BGT-12', newParentGuid: 'BGT-1' })).rejects.toThrow(`reached loadPage ["${PARENT}"]`);
    expect(storage.loadPage).toHaveBeenNthCalledWith(1, GUID);
  });

  it('create_page resolves parentGuid', async () => {
    await expect(createPage({ title: 'T', parentGuid: 'BGT-1' })).rejects.toThrow(`reached listChildren ["${PARENT}"]`);
  });

  it('get_backlinks queries by the resolved GUID', async () => {
    ddbSend.mockResolvedValue({ Items: [] });
    expect(await getBacklinks('BGT-12')).toEqual([]);
    const query = ddbSend.mock.calls[0][0] as { input: { ExpressionAttributeValues: Record<string, { S: string }> } };
    expect(query.input.ExpressionAttributeValues[':targetGuid'].S).toBe(GUID);
  });

  it('get_page reads the S3 key of a keyed page', async () => {
    getPageFileKey.mockResolvedValue(`${GUID}/${GUID}.md`);
    s3Send.mockResolvedValue({ Body: { transformToString: async () => '---\nstatus: published\n---\nhi' } });
    expect(await getPage('BGT-12')).toContain('hi');
    expect(getPageFileKey).toHaveBeenCalledWith(GUID);
    expect((s3Send.mock.calls[0][0] as { input: { Key: string } }).input.Key).toBe(`${GUID}/${GUID}.md`);
  });

  it('get_page still takes a raw S3 key, and a bare GUID', async () => {
    s3Send.mockResolvedValue({ Body: { transformToString: async () => '---\nstatus: published\n---\n' } });
    await getPage('a/b.md');
    expect(getPageFileKey).not.toHaveBeenCalled();
    getPageFileKey.mockResolvedValue('x/x.md');
    await getPage(GUID);
    expect(getPageFileKey).toHaveBeenCalledWith(GUID);
  });

  it('get_page reports an indexed miss as not found', async () => {
    getPageFileKey.mockResolvedValue(null);
    await expect(getPage('BGT-12')).rejects.toThrow('Page not found: BGT-12');
  });

  it('list_comments', async () => {
    await expect(listComments({ pageGuid: 'BGT-12' })).rejects.toThrow(`reached listComments ["${GUID}"]`);
  });

  it('add_comment', async () => {
    await expect(addComment({ pageGuid: 'BGT-12', body: 'hi' })).rejects.toThrow(`reached addComment ["${GUID}"`);
  });

  it('update_comment leaves the comment id alone', async () => {
    await expect(updateComment({ pageGuid: 'BGT-12', commentId: COMMENT, body: 'hi' }))
      .rejects.toThrow(`reached updateComment ["${GUID}","${COMMENT}"`);
  });

  it('delete_comment', async () => {
    await expect(deleteComment({ pageGuid: 'BGT-12', commentId: COMMENT })).rejects.toThrow(`reached deleteComment ["${GUID}","${COMMENT}"`);
  });

  it('an unknown key is an error, not a GUID-format error', async () => {
    await expect(deletePage({ pageGuid: 'NOPE-9' })).rejects.toThrow('unknown ticket key "NOPE-9"');
  });
});
