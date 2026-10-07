import { describe, it, expect, beforeEach, vi } from 'vitest';

// withRole runs at import time; record its roles outside the mock, since
// vitest clears mock call history before each test (clearMocks default).
const { withRoleCalls } = vi.hoisted(() => ({ withRoleCalls: [] as string[][] }));

vi.mock('../../middleware/auth.js', () => ({
  withAuth: (fn: any) => fn,
  withRole: (roles: string[], fn: unknown) => {
    withRoleCalls.push(roles);
    return fn;
  },
}));
vi.mock('../ticket-keys-backfill.js', async (orig) => {
  const actual = await orig<typeof import('../ticket-keys-backfill.js')>();
  return { ...actual, backfillTicketKeys: vi.fn() };
});

import { handler } from '../ticket-keys-backfill-handler.js';
import { backfillTicketKeys, BackfillError } from '../ticket-keys-backfill.js';

const call = (guid: string | undefined) =>
  (handler as any)({ pathParameters: guid === undefined ? null : { guid } }, {});

describe('ticket-keys-backfill-handler', () => {
  beforeEach(() => {
    vi.mocked(backfillTicketKeys).mockReset();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('is wrapped with withRole([Admin])', () => {
    expect(withRoleCalls).toEqual([['Admin']]);
  });

  it('200 with the backfill result', async () => {
    vi.mocked(backfillTicketKeys).mockResolvedValue({ assigned: 3, repaired: 1 });
    const res = await call('init');
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ assigned: 3, repaired: 1 });
    expect(backfillTicketKeys).toHaveBeenCalledWith('init');
  });

  it('400 on BackfillError', async () => {
    vi.mocked(backfillTicketKeys).mockRejectedValue(new BackfillError('Not an Initiative', 400));
    const res = await call('x');
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body)).toEqual({ error: 'Not an Initiative' });
  });

  it('400 when guid is missing', async () => {
    expect((await call(undefined)).statusCode).toBe(400);
    expect(backfillTicketKeys).not.toHaveBeenCalled();
  });

  it('404 when the page is not found', async () => {
    vi.mocked(backfillTicketKeys).mockRejectedValue({ code: 'PAGE_NOT_FOUND' });
    const res = await call('x');
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body)).toEqual({ error: 'Page not found' });
  });

  it('500 on other errors', async () => {
    vi.mocked(backfillTicketKeys).mockRejectedValue(new Error('boom'));
    const res = await call('x');
    expect(res.statusCode).toBe(500);
    expect(JSON.parse(res.body)).toEqual({ error: 'Failed to backfill ticket keys' });
  });
});
