import { describe, it, expect, vi } from 'vitest';
import type { APIGatewayProxyResult } from 'aws-lambda';

vi.mock('@aws-sdk/client-dynamodb', () => ({ DynamoDBClient: class {} }));
vi.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: { from: () => ({ send: vi.fn() }) },
  GetCommand: class {},
  PutCommand: class {},
  UpdateCommand: class {},
  ScanCommand: class {},
}));
vi.mock('@aws-sdk/client-cognito-identity-provider', () => ({
  CognitoIdentityProviderClient: class {},
  ListUsersCommand: class {},
  AdminUpdateUserAttributesCommand: class {},
}));
vi.mock('@aws-sdk/client-ses', () => ({ SESClient: class {}, SendEmailCommand: class {} }));
vi.mock('../activity-log.js', () => ({ logActivity: vi.fn() }));
vi.mock('../../middleware/auth.js', () => ({
  withAuth: (h: unknown) => h,
  withRole: (_roles: string[], h: unknown) => h,
  getUserContext: () => ({ userId: 'admin-1', email: 'a@example.com' }),
}));

import { handler as updateUser } from '../admin-users-update.js';
import { handler as listInvitations } from '../admin-list-invitations.js';
import { handler as listUsers } from '../admin-users-list.js';
import { handler as createInvitation } from '../admin-create-invitation.js';
import { handler as updateProfile } from '../auth-profile-update.js';

type Handler = (e: unknown) => Promise<APIGatewayProxyResult>;

// Zod 4 exposes `issues` on ZodError (`errors` was removed), so the 400 body must carry them as `details`.
const cases: Array<[string, Handler, Record<string, unknown>]> = [
  ['admin-users-update', updateUser as unknown as Handler, { pathParameters: { userId: 'u1' }, body: JSON.stringify({ role: 'Nope' }) }],
  ['admin-list-invitations', listInvitations as unknown as Handler, { queryStringParameters: { status: 'bogus' } }],
  ['admin-users-list', listUsers as unknown as Handler, { queryStringParameters: { role: 'bogus' } }],
  ['admin-create-invitation', createInvitation as unknown as Handler, { body: JSON.stringify({ email: 'not-an-email', role: 'Nope' }) }],
  ['auth-profile-update', updateProfile as unknown as Handler, { body: JSON.stringify({ displayName: '' }) }],
];

describe('zod validation failures include details', () => {
  it.each(cases)('%s returns 400 with non-empty details', async (_name, handler, event) => {
    const res = await handler(event);
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error).toBe('Validation error');
    expect(Array.isArray(body.details)).toBe(true);
    expect(body.details.length).toBeGreaterThan(0);
    expect(body.details[0]).toMatchObject({ message: expect.any(String), path: expect.any(Array) });
  });
});
