import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { APIGatewayProxyResult } from 'aws-lambda';

const send = vi.hoisted(() => vi.fn());

vi.mock('@aws-sdk/client-dynamodb', () => ({ DynamoDBClient: class {} }));
vi.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: { from: () => ({ send }) },
  GetCommand: class { constructor(public input: unknown) {} },
  UpdateCommand: class { constructor(public input: unknown) {} },
}));
vi.mock('../../middleware/auth.js', () => ({
  withAuth: (h: unknown) => h,
  withRole: (_roles: string[], h: unknown) => h,
  getUserContext: () => ({ userId: 'admin-1' }),
}));

import { handler } from '../admin-revoke-invitation.js';

const call = (pathParameters: Record<string, string> | null): Promise<APIGatewayProxyResult> =>
  (handler as unknown as (e: unknown) => Promise<APIGatewayProxyResult>)({ pathParameters });

describe('admin-revoke-invitation path parameter', () => {
  beforeEach(() => send.mockReset());

  // API Gateway (CDK) and the local Express route both name the param `invitationCode`.
  it('reads the invitationCode path parameter and revokes a pending invitation', async () => {
    send
      .mockResolvedValueOnce({ Item: { inviteCode: 'ABCD1234', status: 'pending' } })
      .mockResolvedValueOnce({});
    const res = await call({ invitationCode: 'ABCD1234' });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).inviteCode).toBe('ABCD1234');
  });

  it('returns 404 for a well-formed unknown code', async () => {
    send.mockResolvedValueOnce({});
    const res = await call({ invitationCode: 'ZZZZ9999' });
    expect(res.statusCode).toBe(404);
  });

  it('returns 400 invalid format for a malformed code', async () => {
    const res = await call({ invitationCode: 'bad' });
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error).toBe('Invalid invitation code format');
  });

  it('returns 400 required when no code is present', async () => {
    const res = await call({});
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error).toBe('Invitation code is required');
  });
});
