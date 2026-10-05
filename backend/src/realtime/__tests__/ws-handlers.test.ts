import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBClient, PutItemCommand, DeleteItemCommand } from '@aws-sdk/client-dynamodb';

vi.mock('../../middleware/auth.js', () => ({
  verifyIdToken: vi.fn(),
}));

import { verifyIdToken } from '../../middleware/auth.js';
import { handler as connect } from '../ws-connect.js';
import { handler as disconnect } from '../ws-disconnect.js';
import { handler as wsDefault } from '../ws-default.js';

const dbMock = mockClient(DynamoDBClient);
const verify = vi.mocked(verifyIdToken);

function wsEvent(token?: string) {
  return {
    requestContext: { connectionId: 'conn-1', routeKey: '$connect' },
    queryStringParameters: token === undefined ? undefined : { token },
  } as never;
}

beforeEach(() => {
  dbMock.reset();
  verify.mockReset();
  vi.stubEnv('REALTIME_CONNECTIONS_TABLE', 'connections-table');
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('ws-connect', () => {
  it('stores the connection with a ~24h expiry for a valid token', async () => {
    verify.mockResolvedValue({ sub: 'user-1' } as never);
    dbMock.on(PutItemCommand).resolves({});
    const before = Math.floor(Date.now() / 1000);

    const res = await connect(wsEvent('good-token'));

    expect(res).toEqual({ statusCode: 200 });
    expect(verify).toHaveBeenCalledWith('good-token');
    const calls = dbMock.commandCalls(PutItemCommand);
    expect(calls).toHaveLength(1);
    const input = calls[0].args[0].input;
    expect(input.TableName).toBe('connections-table');
    expect(input.Item?.connectionId).toEqual({ S: 'conn-1' });
    expect(input.Item?.userId).toEqual({ S: 'user-1' });
    const expiresAt = Number(input.Item?.expiresAt?.N);
    expect(expiresAt).toBeGreaterThanOrEqual(before + 24 * 3600);
    expect(expiresAt).toBeLessThanOrEqual(before + 24 * 3600 + 5);
  });

  it('returns 401 without a token and stores nothing', async () => {
    const res = await connect(wsEvent());
    expect(res).toEqual({ statusCode: 401 });
    expect(verify).not.toHaveBeenCalled();
    expect(dbMock.commandCalls(PutItemCommand)).toHaveLength(0);
  });

  it('returns 401 for an invalid token and stores nothing', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    verify.mockRejectedValue(new Error('bad token'));
    const res = await connect(wsEvent('bad-token'));
    expect(res).toEqual({ statusCode: 401 });
    expect(dbMock.commandCalls(PutItemCommand)).toHaveLength(0);
  });
});

describe('ws-disconnect', () => {
  it('deletes the connection row and returns 200', async () => {
    dbMock.on(DeleteItemCommand).resolves({});
    const res = await disconnect(wsEvent());
    expect(res).toEqual({ statusCode: 200 });
    const calls = dbMock.commandCalls(DeleteItemCommand);
    expect(calls).toHaveLength(1);
    expect(calls[0].args[0].input).toEqual({
      TableName: 'connections-table',
      Key: { connectionId: { S: 'conn-1' } },
    });
  });
});

describe('ws-default', () => {
  it('returns 200', async () => {
    expect(await wsDefault()).toEqual({ statusCode: 200 });
  });
});
