import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { APIGatewayProxyEvent } from 'aws-lambda';

const dynamoSend = vi.hoisted(() => vi.fn());
const cognitoSend = vi.hoisted(() => vi.fn());

vi.mock('@aws-sdk/client-dynamodb', () => ({ DynamoDBClient: class {} }));
vi.mock('@aws-sdk/lib-dynamodb', () => {
  const cmd = () => class { constructor(public input: unknown) {} };
  return {
    DynamoDBDocumentClient: { from: () => ({ send: dynamoSend }) },
    GetCommand: cmd(),
    PutCommand: cmd(),
    QueryCommand: cmd(),
    UpdateCommand: cmd(),
  };
});
vi.mock('@aws-sdk/client-cognito-identity-provider', () => ({
  CognitoIdentityProviderClient: class { send = cognitoSend; },
  AdminCreateUserCommand: class { constructor(public input: unknown) {} },
  AdminSetUserPasswordCommand: class { constructor(public input: unknown) {} },
  MessageActionType: { SUPPRESS: 'SUPPRESS' },
}));

const invite = {
  inviteCode: 'ABCD1234',
  role: 'Standard',
  status: 'pending',
  expiresAt: String(Math.floor(Date.now() / 1000) + 3600),
};
const event = (): APIGatewayProxyEvent => ({
  path: '/auth/register',
  body: JSON.stringify({ inviteCode: 'ABCD1234', email: 'new@example.com', displayName: 'New', password: 'password123' }),
} as unknown as APIGatewayProxyEvent);

async function load() {
  vi.resetModules();
  return (await import('../auth-register.js')).handler;
}

describe('auth-register in local mode', () => {
  beforeEach(() => {
    dynamoSend.mockReset();
    cognitoSend.mockReset();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubEnv('NODE_ENV', 'development');
  });
  afterEach(() => vi.unstubAllEnvs());

  it('registers without calling Cognito and stores an active profile (201)', async () => {
    dynamoSend
      .mockResolvedValueOnce({ Item: invite }) // get invitation
      .mockResolvedValueOnce({ Items: [] }) // email lookup
      .mockResolvedValueOnce({}) // put profile
      .mockResolvedValueOnce({}); // mark invite used
    const res = await (await load())(event());
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.email).toBe('new@example.com');
    expect(body.userId).toMatch(/^[0-9a-f-]{36}$/);
    expect(cognitoSend).not.toHaveBeenCalled();
    const put = dynamoSend.mock.calls[2][0].input.Item;
    expect(put).toMatchObject({ cognitoUserId: body.userId, status: 'active', role: 'Standard' });
  });

  it('answers 409 when a live profile already has the email', async () => {
    dynamoSend
      .mockResolvedValueOnce({ Item: invite })
      .mockResolvedValueOnce({ Items: [{ email: 'new@example.com', status: 'active' }] });
    const res = await (await load())(event());
    expect(res.statusCode).toBe(409);
    expect(cognitoSend).not.toHaveBeenCalled();
  });

  it('ignores deleted profiles when checking for a duplicate', async () => {
    dynamoSend
      .mockResolvedValueOnce({ Item: invite })
      .mockResolvedValueOnce({ Items: [{ email: 'new@example.com', status: 'deleted' }] })
      .mockResolvedValue({});
    const res = await (await load())(event());
    expect(res.statusCode).toBe(201);
  });
});

describe('auth-register in a deployed Lambda', () => {
  beforeEach(() => {
    dynamoSend.mockReset();
    cognitoSend.mockReset();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    // Even with the local flags set, the Lambda runtime must win
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('AWS_LAMBDA_FUNCTION_NAME', 'bluefinwiki-auth-register-production');
  });
  afterEach(() => vi.unstubAllEnvs());

  it('still calls Cognito and creates a pending profile', async () => {
    cognitoSend
      .mockResolvedValueOnce({ User: { Username: 'new@example.com', Attributes: [{ Name: 'sub', Value: 'sub-1' }] } })
      .mockResolvedValueOnce({});
    dynamoSend
      .mockResolvedValueOnce({ Item: invite })
      .mockResolvedValue({});
    const res = await (await load())(event());
    expect(res.statusCode).toBe(201);
    expect(cognitoSend).toHaveBeenCalledTimes(2);
    const put = dynamoSend.mock.calls[1][0].input.Item;
    expect(put).toMatchObject({ cognitoUserId: 'sub-1', status: 'pending' });
  });

  it('maps a Cognito UsernameExistsException to 409', async () => {
    const err = new Error('exists');
    err.name = 'UsernameExistsException';
    cognitoSend.mockRejectedValueOnce(err);
    dynamoSend.mockResolvedValueOnce({ Item: invite });
    const res = await (await load())(event());
    expect(res.statusCode).toBe(409);
  });
});
