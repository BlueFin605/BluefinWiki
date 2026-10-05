import { describe, it, expect, vi, beforeEach } from 'vitest';

const savePage = vi.fn();
const keyForNewPage = vi.fn();
const recordKey = vi.fn();

vi.mock('../../storage/StoragePluginRegistry.js', () => ({
  getStoragePlugin: () => ({ listChildren: vi.fn().mockResolvedValue([]), savePage }),
}));
vi.mock('../../ticket-keys/ticket-keys-service.js', () => ({
  keyForNewPage: (...a: unknown[]) => keyForNewPage(...a),
  recordKey: (...a: unknown[]) => recordKey(...a),
}));
vi.mock('../page-type-validation.js', () => ({
  validatePageType: vi.fn().mockResolvedValue({ warnings: [] }),
  validateChildTypeConstraint: vi.fn().mockResolvedValue({ warnings: [] }),
}));
vi.mock('../link-extraction.js', () => ({
  extractWikiLinks: () => [],
  updatePageLinks: vi.fn(),
}));
vi.mock('../../middleware/auth.js', () => ({
  withAuth: (fn: unknown) => fn,
  getUserContext: () => ({ userId: 'u1' }),
}));
vi.mock('../../tags/tags-service.js', () => ({
  autoRegisterTagsFromProperties: vi.fn().mockResolvedValue(undefined),
  autoRegisterPageTags: vi.fn().mockResolvedValue(undefined),
}));

import { handler } from '../pages-create.js';

const PARENT = '3f2b8a0e-5c1d-4e7a-9b36-1a2b3c4d5e6f';
const TYPE = '7c9e6679-7425-40de-944b-e07fc1f90ae7';

async function create() {
  const event = { body: JSON.stringify({ title: 'T', parentGuid: PARENT, pageType: TYPE }) };
  const res = await (handler as unknown as (e: unknown) => Promise<{ statusCode: number; body: string }>)(event);
  return { res, body: JSON.parse(res.body) };
}

describe('pages-create ticket key', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('assigns and records a key', async () => {
    keyForNewPage.mockResolvedValue('BGT-3');
    const { res, body } = await create();
    expect(res.statusCode).toBe(201);
    expect(keyForNewPage).toHaveBeenCalledWith(PARENT, TYPE);
    expect(savePage.mock.calls[0][2]).toMatchObject({ ticketKey: 'BGT-3' });
    expect(recordKey).toHaveBeenCalledWith('BGT-3', savePage.mock.calls[0][0]);
    expect(savePage.mock.invocationCallOrder[0]).toBeLessThan(recordKey.mock.invocationCallOrder[0]);
    expect(body.ticketKey).toBe('BGT-3');
  });

  it('creates unkeyed when no key is assigned', async () => {
    keyForNewPage.mockResolvedValue(undefined);
    const { body } = await create();
    expect('ticketKey' in savePage.mock.calls[0][2]).toBe(false);
    expect(recordKey).not.toHaveBeenCalled();
    expect('ticketKey' in body).toBe(false);
  });
});
