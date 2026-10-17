import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const send = vi.hoisted(() => vi.fn());

vi.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: { from: () => ({ send }) },
  UpdateCommand: class { constructor(public input: unknown) {} },
}));

import { seedLocalDevUser } from '../seed-local-user.js';

const client = {} as never;

describe('seedLocalDevUser', () => {
  beforeEach(() => {
    send.mockReset();
    send.mockResolvedValue({});
  });
  afterEach(() => vi.unstubAllEnvs());

  it('fills email, role Admin and status active for local-dev-user-id, only where missing', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    await expect(seedLocalDevUser(client, 'profiles')).resolves.toBe(true);
    const input = send.mock.calls[0][0].input;
    expect(input.TableName).toBe('profiles');
    expect(input.Key).toEqual({ cognitoUserId: 'local-dev-user-id' });
    expect(input.ExpressionAttributeValues).toMatchObject({
      ':email': 'dev@example.com',
      ':role': 'Admin',
      ':status': 'active',
    });
    expect(input.UpdateExpression).toContain('if_not_exists(#email');
    expect(input.UpdateExpression).toContain('if_not_exists(#role');
    expect(input.UpdateExpression).toContain('if_not_exists(#status');
  });

  it('does nothing outside local mode', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('USER_POOL_ID', 'us-east-1_Real');
    vi.stubEnv('COGNITO_USER_POOL_ID', '');
    await expect(seedLocalDevUser(client, 'profiles')).resolves.toBe(false);
    expect(send).not.toHaveBeenCalled();
  });
});
