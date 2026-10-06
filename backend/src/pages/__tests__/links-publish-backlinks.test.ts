/**
 * updatePageLinks publishes `backlinks:any` once the link index is written.
 * The page save publishes it too, but before the index changes, so other tabs
 * refetching backlinks on that event would read the old links.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { setBroadcaster, type RealtimeEvent } from '../../realtime/broadcaster.js';
import { updatePageLinks } from '../link-extraction.js';

describe('updatePageLinks realtime publish', () => {
  const log: string[] = [];

  beforeEach(() => {
    log.length = 0;
    vi.spyOn(DynamoDBClient.prototype, 'send').mockImplementation(async (cmd: { constructor: { name: string } }) => {
      log.push(`db:${cmd.constructor.name}`);
      return { Items: [] };
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

  it('publishes even when the page has no links left', async () => {
    await updatePageLinks('src', []);
    expect(log.at(-1)).toBe('publish:backlinks:any');
  });
});
