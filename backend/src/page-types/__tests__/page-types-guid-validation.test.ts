import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../middleware/auth.js', () => ({
  withAuth: (fn: unknown) => fn,
  getUserContext: () => ({ userId: 'u' }),
  isAdmin: () => true,
}));
vi.mock('../page-types-service.js', () => ({
  getPageType: vi.fn(),
  updatePageType: vi.fn(),
  deletePageType: vi.fn(),
  getAllowedChildTypes: vi.fn(),
}));

import { handler as getHandler } from '../page-types-get.js';
import { handler as updateHandler } from '../page-types-update.js';
import { handler as deleteHandler } from '../page-types-delete.js';
import { handler as allowedChildrenHandler } from '../page-types-allowed-children.js';
import { getPageType } from '../page-types-service.js';

const GUID = '00000000-0000-4000-8000-000000000000';
const handlers = {
  get: getHandler,
  update: updateHandler,
  delete: deleteHandler,
  'allowed-children': allowedChildrenHandler,
} as Record<string, unknown>;

const call = (name: string, guid: string | undefined) =>
  (handlers[name] as any)(
    { pathParameters: guid === undefined ? null : { guid }, body: JSON.stringify({ name: 'x' }) },
    {},
  );

describe.each(Object.keys(handlers))('page-types-%s guid validation', (name) => {
  beforeEach(() => {
    vi.mocked(getPageType).mockReset().mockResolvedValue(null);
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('returns 400 "Invalid GUID format" for a non-GUID without hitting the store', async () => {
    const res = await call(name, 'not-a-guid');
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body)).toEqual({ error: 'Invalid GUID format' });
    expect(getPageType).not.toHaveBeenCalled();
  });

  it('returns 400 when the guid is missing', async () => {
    const res = await call(name, undefined);
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body)).toEqual({ error: 'Page type GUID is required' });
  });

  it('still returns 404 for a well-formed unknown GUID', async () => {
    const res = await call(name, GUID);
    expect(res.statusCode).toBe(404);
    expect(getPageType).toHaveBeenCalledWith(GUID);
  });
});
