/**
 * Unit tests for auth-change-password Lambda handler.
 *
 * Cognito's ChangePassword API requires the access token, not the ID token
 * that `Authorization` carries for every other endpoint. The frontend sends
 * the access token on a dedicated `X-Access-Token` header (see
 * frontend/src/app/core/auth/auth.ts's changePassword()); these tests pin
 * that the handler reads it from there (case-insensitively) and passes it
 * straight through to Cognito.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { APIGatewayProxyEvent } from 'aws-lambda';
import { mockClient } from 'aws-sdk-client-mock';
import {
  CognitoIdentityProviderClient,
  ChangePasswordCommand,
  NotAuthorizedException,
  InvalidPasswordException,
} from '@aws-sdk/client-cognito-identity-provider';
import { handler } from '../auth-change-password.js';

// Bypass ID-token verification entirely — that's `withAuth`'s job and it's
// exercised elsewhere. These tests are about what the handler does with the
// access token once it's authenticated.
vi.mock('../../middleware/auth.js', () => ({
  withAuth: (fn: any) => fn,
}));

const cognitoMock = mockClient(CognitoIdentityProviderClient);

function event(over: Partial<APIGatewayProxyEvent> = {}): APIGatewayProxyEvent {
  return {
    headers: { 'X-Access-Token': 'the-access-token' },
    body: JSON.stringify({ currentPassword: 'OldPass1!', newPassword: 'NewPass1!' }),
    requestContext: {},
    ...over,
  } as unknown as APIGatewayProxyEvent;
}

describe('auth-change-password', () => {
  beforeEach(() => {
    cognitoMock.reset();
  });

  it('returns 401 when X-Access-Token is missing', async () => {
    const result = await handler(event({ headers: {} }), {} as any);

    expect(result.statusCode).toBe(401);
    expect(JSON.parse(result.body).error).toBe('Missing access token');
    expect(cognitoMock.calls()).toHaveLength(0);
  });

  it('reads the header case-insensitively', async () => {
    cognitoMock.on(ChangePasswordCommand).resolves({});

    const result = await handler(
      event({ headers: { 'x-access-token': 'lowercase-token' } }),
      {} as any,
    );

    expect(result.statusCode).toBe(200);
    expect(cognitoMock.commandCalls(ChangePasswordCommand)[0]?.args[0].input).toMatchObject({
      AccessToken: 'lowercase-token',
    });
  });

  it('passes the access token (not the Authorization/ID token) to Cognito on success', async () => {
    cognitoMock.on(ChangePasswordCommand).resolves({});

    const result = await handler(
      event({
        headers: {
          'X-Access-Token': 'real-access-token',
          Authorization: 'Bearer some-id-token',
        },
      }),
      {} as any,
    );

    expect(result.statusCode).toBe(200);
    expect(cognitoMock.commandCalls(ChangePasswordCommand)[0]?.args[0].input).toEqual({
      AccessToken: 'real-access-token',
      PreviousPassword: 'OldPass1!',
      ProposedPassword: 'NewPass1!',
    });
  });

  it('maps Cognito NotAuthorizedException to 400 "Incorrect current password"', async () => {
    cognitoMock.on(ChangePasswordCommand).rejects(
      new NotAuthorizedException({ message: 'Incorrect username or password.', $metadata: {} }),
    );

    const result = await handler(event(), {} as any);

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).error).toBe('Incorrect current password');
  });

  it('maps Cognito InvalidPasswordException to 400 with a requirements message', async () => {
    cognitoMock.on(ChangePasswordCommand).rejects(
      new InvalidPasswordException({ message: 'Password did not conform to policy', $metadata: {} }),
    );

    const result = await handler(event(), {} as any);

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).error).toContain('does not meet requirements');
  });

  it('returns 400 for an invalid request body', async () => {
    const result = await handler(
      event({ body: JSON.stringify({ currentPassword: '', newPassword: 'short' }) }),
      {} as any,
    );

    expect(result.statusCode).toBe(400);
    expect(cognitoMock.calls()).toHaveLength(0);
  });
});
