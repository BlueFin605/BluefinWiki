import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBClient, ScanCommand, DeleteItemCommand } from '@aws-sdk/client-dynamodb';
import {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand,
  GoneException,
} from '@aws-sdk/client-apigatewaymanagementapi';
import { ApiGwBroadcaster } from '../apigw-broadcaster.js';
import type { RealtimeEvent } from '../broadcaster.js';

const dbMock = mockClient(DynamoDBClient);
const apiMock = mockClient(ApiGatewayManagementApiClient);

const event: RealtimeEvent = { type: 'invalidate', tags: ['page:g'], origin: 'tab-1' };

beforeEach(() => {
  dbMock.reset();
  apiMock.reset();
  dbMock.on(ScanCommand).resolves({
    Items: [{ connectionId: { S: 'a' } }, { connectionId: { S: 'b' } }],
  });
  dbMock.on(DeleteItemCommand).resolves({});
});

afterEach(() => vi.restoreAllMocks());

function make() {
  return new ApiGwBroadcaster('https://example.invalid/prod', 'connections-table');
}

describe('ApiGwBroadcaster.publish', () => {
  it('posts the JSON event to every stored connection', async () => {
    apiMock.on(PostToConnectionCommand).resolves({});
    await make().publish(event);

    const scan = dbMock.commandCalls(ScanCommand);
    expect(scan).toHaveLength(1);
    expect(scan[0].args[0].input).toMatchObject({
      TableName: 'connections-table',
      ProjectionExpression: 'connectionId',
    });
    const posts = apiMock.commandCalls(PostToConnectionCommand);
    expect(posts.map((c) => c.args[0].input.ConnectionId).sort()).toEqual(['a', 'b']);
    for (const p of posts) {
      expect(JSON.parse(Buffer.from(p.args[0].input.Data as Uint8Array).toString())).toEqual(event);
    }
  });

  it('deletes the row of a gone connection', async () => {
    apiMock
      .on(PostToConnectionCommand, { ConnectionId: 'a' })
      .rejects(new GoneException({ message: 'gone', $metadata: {} }))
      .on(PostToConnectionCommand, { ConnectionId: 'b' })
      .resolves({});

    await make().publish(event);

    const deletes = dbMock.commandCalls(DeleteItemCommand);
    expect(deletes).toHaveLength(1);
    expect(deletes[0].args[0].input).toEqual({
      TableName: 'connections-table',
      Key: { connectionId: { S: 'a' } },
    });
  });

  it('logs other post errors, still resolves, and keeps the row', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    apiMock
      .on(PostToConnectionCommand, { ConnectionId: 'a' })
      .rejects(new Error('throttled'))
      .on(PostToConnectionCommand, { ConnectionId: 'b' })
      .resolves({});

    await expect(make().publish(event)).resolves.toBeUndefined();

    expect(warn).toHaveBeenCalled();
    expect(dbMock.commandCalls(DeleteItemCommand)).toHaveLength(0);
    expect(apiMock.commandCalls(PostToConnectionCommand)).toHaveLength(2);
  });
});

describe('createEnvBroadcaster', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('uses ApiGwBroadcaster when both realtime env vars are set', async () => {
    vi.stubEnv('REALTIME_WS_ENDPOINT', 'https://example.invalid/prod');
    vi.stubEnv('REALTIME_CONNECTIONS_TABLE', 'connections-table');
    vi.resetModules();
    const { getBroadcaster } = await import('../broadcaster.js');
    const { ApiGwBroadcaster: Fresh } = await import('../apigw-broadcaster.js');
    expect(getBroadcaster()).toBeInstanceOf(Fresh);
  });

  it('falls back to the no-op broadcaster when either is missing', async () => {
    vi.stubEnv('REALTIME_WS_ENDPOINT', 'https://example.invalid/prod');
    vi.stubEnv('REALTIME_CONNECTIONS_TABLE', '');
    vi.resetModules();
    const { getBroadcaster } = await import('../broadcaster.js');
    const { ApiGwBroadcaster: Fresh } = await import('../apigw-broadcaster.js');
    expect(getBroadcaster()).not.toBeInstanceOf(Fresh);
  });
});
