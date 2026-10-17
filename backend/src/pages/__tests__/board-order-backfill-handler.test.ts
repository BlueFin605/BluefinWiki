import { describe, it, expect, beforeEach, vi } from 'vitest';

const { withRoleCalls } = vi.hoisted(() => ({ withRoleCalls: [] as string[][] }));

vi.mock('../../middleware/auth.js', () => ({
  withAuth: (fn: any) => fn,
  withRole: (roles: string[], fn: unknown) => {
    withRoleCalls.push(roles);
    return fn;
  },
}));
vi.mock('../board-order-backfill.js', () => ({ backfillBoardOrder: vi.fn() }));

import { handler } from '../board-order-backfill-handler.js';
import { backfillBoardOrder } from '../board-order-backfill.js';

const GUID = '0ea160d4-a8dd-46bc-b2e0-8236be2e0927';
const call = (guid: string | undefined) =>
  (handler as any)({ pathParameters: guid === undefined ? null : { guid } }, {});

describe('board-order-backfill-handler', () => {
  beforeEach(() => {
    vi.mocked(backfillBoardOrder).mockReset();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('is wrapped with withRole([Admin])', () => {
    expect(withRoleCalls).toEqual([['Admin']]);
  });

  it('200 with the backfill result', async () => {
    vi.mocked(backfillBoardOrder).mockResolvedValue({ updated: 2, examined: 5 });
    const res = await call(GUID);
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ updated: 2, examined: 5 });
    expect(backfillBoardOrder).toHaveBeenCalledWith(GUID);
  });

  it('400 when guid is missing', async () => {
    expect((await call(undefined)).statusCode).toBe(400);
    expect(backfillBoardOrder).not.toHaveBeenCalled();
  });

  it('400 for a non-GUID without touching storage', async () => {
    const res = await call('not-a-uuid');
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body)).toEqual({ error: 'Invalid GUID format' });
    expect(backfillBoardOrder).not.toHaveBeenCalled();
  });

  it('404 when the page is not found', async () => {
    vi.mocked(backfillBoardOrder).mockRejectedValue({ code: 'PAGE_NOT_FOUND' });
    const res = await call(GUID);
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body)).toEqual({ error: 'Page not found' });
  });

  it('500 on other errors', async () => {
    vi.mocked(backfillBoardOrder).mockRejectedValue(new Error('boom'));
    const res = await call(GUID);
    expect(res.statusCode).toBe(500);
    expect(JSON.parse(res.body)).toEqual({ error: 'Failed to backfill boardOrder' });
  });
});
