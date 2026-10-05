import { describe, it, expect, vi, afterEach } from 'vitest';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';
import { setBroadcaster } from '../../realtime/broadcaster.js';
import {
  createPageType,
  updatePageType,
  deletePageType,
  serializePageType,
} from '../page-types-service.js';
import type { PageTypeDefinition } from '../../types/index.js';

const base: PageTypeDefinition = {
  guid: '11111111-1111-4111-8111-111111111111', name: 'Initiative', icon: 'x',
  properties: [], allowedChildTypes: [], allowWikiPageChildren: true,
  allowedParentTypes: [], allowAnyParent: true,
  createdBy: 'u', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
};
const TYPE_TAGS = ['page-types:list', `page-type:${base.guid}`];

function stubDynamo(impl: () => Promise<unknown>) {
  return vi.spyOn(DynamoDBClient.prototype, 'send').mockImplementation(impl as never);
}

function installPublish() {
  const publish = vi.fn().mockResolvedValue(undefined);
  setBroadcaster({ publish });
  return publish;
}

afterEach(() => {
  setBroadcaster(null);
  vi.restoreAllMocks();
});

describe('page-type writes publish change tags', () => {
  it('createPageType publishes after a successful put', async () => {
    const publish = installPublish();
    stubDynamo(async () => ({}));
    await createPageType(base);
    expect(publish).toHaveBeenCalledTimes(1);
    expect(publish.mock.calls[0][0].tags).toEqual(TYPE_TAGS);
  });

  it('createPageType does not publish when the put fails', async () => {
    const publish = installPublish();
    stubDynamo(async () => { throw new Error('dynamo down'); });
    await expect(createPageType(base)).rejects.toThrow('dynamo down');
    expect(publish).not.toHaveBeenCalled();
  });

  it('updatePageType publishes when the update returns the item', async () => {
    const publish = installPublish();
    stubDynamo(async () => ({ Attributes: marshall(serializePageType(base), { removeUndefinedValues: true }) }));
    await expect(updatePageType(base.guid, { name: 'Renamed' })).resolves.not.toBeNull();
    expect(publish.mock.calls.map((c) => c[0].tags)).toEqual([TYPE_TAGS]);
  });

  it('updatePageType does not publish when nothing was updated or the write fails', async () => {
    const publish = installPublish();
    stubDynamo(async () => ({}));
    await expect(updatePageType(base.guid, { name: 'Renamed' })).resolves.toBeNull();
    await updatePageType(base.guid, {}); // no fields: a read, not a write
    vi.restoreAllMocks();
    stubDynamo(async () => { throw new Error('ConditionalCheckFailed'); });
    await expect(updatePageType(base.guid, { name: 'x' })).rejects.toThrow();
    expect(publish).not.toHaveBeenCalled();
  });

  it('deletePageType publishes only when an item was deleted', async () => {
    const publish = installPublish();
    stubDynamo(async () => ({}));
    await expect(deletePageType(base.guid)).resolves.toBe(true);
    vi.restoreAllMocks();
    stubDynamo(async () => { throw Object.assign(new Error('gone'), { name: 'ConditionalCheckFailedException' }); });
    await expect(deletePageType(base.guid)).resolves.toBe(false);
    expect(publish.mock.calls.map((c) => c[0].tags)).toEqual([TYPE_TAGS]);
  });
});
