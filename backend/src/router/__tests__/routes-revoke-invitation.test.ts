import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import type { APIGatewayProxyEvent, Context } from 'aws-lambda';

const ddb = mockClient(DynamoDBDocumentClient);
const adminClaims = { sub: 'admin-1', email: 'a@example.com', 'custom:role': 'Admin', 'custom:displayName': 'Admin' };

async function loadRouter() {
  // Deployed mode: withAuth trusts API Gateway's authorizer claims.
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('COGNITO_USER_POOL_ID', 'ap-southeast-2_TestPool');
  vi.stubEnv('COGNITO_CLIENT_ID', 'test-client');
  const { createRouter } = await import('../dispatch.js');
  const { ROUTES } = await import('../routes.js');
  return createRouter(ROUTES.filter((r) => r.deployment === 'router'), { log: () => {} });
}

function revokeEvent(code: string): APIGatewayProxyEvent {
  return {
    httpMethod: 'DELETE', path: `/admin/invitations/${code}`, resource: '/admin/{proxy+}',
    pathParameters: { proxy: `invitations/${code}` }, headers: {}, multiValueHeaders: {}, body: null,
    isBase64Encoded: false, queryStringParameters: null, multiValueQueryStringParameters: null, stageVariables: null,
    requestContext: { requestId: 'r1', authorizer: { claims: adminClaims } } as unknown as APIGatewayProxyEvent['requestContext'],
  };
}

beforeEach(() => {
  ddb.reset();
  vi.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe('DELETE /admin/invitations/{invitationCode} through the router', () => {
  it('revokes a pending invitation', async () => {
    ddb.on(GetCommand).resolves({ Item: { inviteCode: 'ABCD1234', status: 'pending', role: 'Standard', createdBy: 'x', createdAt: '', expiresAt: '' } });
    ddb.on(UpdateCommand).resolves({});
    const router = await loadRouter();
    const res = await router(revokeEvent('ABCD1234'), {} as Context);
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toMatchObject({ message: 'Invitation revoked successfully', inviteCode: 'ABCD1234' });
    expect(ddb.commandCalls(GetCommand)[0].args[0].input.Key).toEqual({ inviteCode: 'ABCD1234' });
  });

  it('returns the handler 404 for an unknown code', async () => {
    ddb.on(GetCommand).resolves({});
    const router = await loadRouter();
    const res = await router(revokeEvent('ZZZZ9999'), {} as Context);
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body)).toEqual({ error: 'Invitation not found' });
  });
});
