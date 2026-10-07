/**
 * updatePageLinks publishes `backlinks:any` once the link index is written —
 * and only when the page's links actually changed. A visible page save no
 * longer publishes backlinks:any itself (it sends an upsert), so this is the
 * only signal other tabs get that backlinks moved.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';
import { setBroadcaster, type RealtimeEvent } from '../../realtime/broadcaster.js';
import { updatePageLinks } from '../link-extraction.js';

describe('updatePageLinks realtime publish', () => {
  const log: string[] = [];
  let existing: { targetGuid: string; linkText?: string }[] = [];

  beforeEach(() => {
    log.length = 0;
    existing = [];
    vi.spyOn(DynamoDBClient.prototype, 'send').mockImplementation(async (cmd: { constructor: { name: string } }) => {
      log.push(`db:${cmd.constructor.name}`);
      if (cmd.constructor.name !== 'QueryCommand') return {};
      return {
        Items: existing.map((l) => marshall({ sourceGuid: 'src', createdAt: 't', ...l }, { removeUndefinedValues: true })),
      };
    });
    setBroadcaster({
      publish: async (e: RealtimeEvent) => {
        log.push(`publish:${e.tags.join(',')}`);
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    setBroadcaster(null);
  });

  it('publishes backlinks:any after the link index writes', async () => {
    await updatePageLinks('src', [{ linkText: 'A', targetGuid: 'a' }]);

    expect(log).toEqual(['db:QueryCommand', 'db:PutItemCommand', 'publish:backlinks:any']);
  });

  it('publishes when the page loses its last link', async () => {
    existing = [{ targetGuid: 'a', linkText: 'A' }];
    await updatePageLinks('src', []);
    expect(log).toEqual(['db:QueryCommand', 'db:BatchWriteItemCommand', 'publish:backlinks:any']);
  });

  it('publishes when only the link text changes', async () => {
    existing = [{ targetGuid: 'a', linkText: 'A' }];
    await updatePageLinks('src', [{ linkText: 'Renamed', targetGuid: 'a' }]);
    expect(log.at(-1)).toBe('publish:backlinks:any');
  });

  it('writes and publishes nothing when the links are unchanged', async () => {
    existing = [
      { targetGuid: 'a', linkText: 'A' },
      { targetGuid: 'b', linkText: 'B' },
    ];
    await updatePageLinks('src', [
      { linkText: 'B', targetGuid: 'b' },
      { linkText: 'A', targetGuid: 'a' },
      { linkText: 'Unresolved', targetGuid: '' },
    ]);
    expect(log).toEqual(['db:QueryCommand']);
  });

  it('writes and publishes nothing for a page that had and has no links', async () => {
    await updatePageLinks('src', []);
    expect(log).toEqual(['db:QueryCommand']);
  });
});
