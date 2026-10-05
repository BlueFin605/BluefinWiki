import { describe, it, expect, vi, beforeEach } from 'vitest';

const savePage = vi.fn();
const keyForNewPage = vi.fn();
const recordKey = vi.fn();

vi.mock('../../../storage/StoragePluginRegistry.js', () => ({
  getStoragePlugin: () => ({ listChildren: vi.fn().mockResolvedValue([]), savePage }),
}));
vi.mock('../../../ticket-keys/ticket-keys-service.js', () => ({
  keyForNewPage: (...a: unknown[]) => keyForNewPage(...a),
  recordKey: (...a: unknown[]) => recordKey(...a),
}));
vi.mock('../../../pages/page-type-validation.js', () => ({
  validatePageType: vi.fn().mockResolvedValue({ warnings: [] }),
  validateChildTypeConstraint: vi.fn().mockResolvedValue({ warnings: [] }),
}));
vi.mock('../mcp-property-validation.js', () => ({
  validatePropertiesForCreate: vi.fn(async (_t: string, props: unknown) => ({ properties: props })),
}));
vi.mock('../../../pages/link-extraction.js', () => ({
  extractWikiLinks: () => [],
  updatePageLinks: vi.fn(),
}));

import { createPage } from '../create-page.js';

const PARENT = '3f2b8a0e-5c1d-4e7a-9b36-1a2b3c4d5e6f';
const TYPE = '7c9e6679-7425-40de-944b-e07fc1f90ae7';

describe('create_page ticket key', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('assigns and records a key', async () => {
    keyForNewPage.mockResolvedValue('BGT-3');
    const result = await createPage({ title: 'T', parentGuid: PARENT, pageType: TYPE });
    expect(keyForNewPage).toHaveBeenCalledWith(PARENT, TYPE);
    expect(savePage.mock.calls[0][2]).toMatchObject({ ticketKey: 'BGT-3' });
    expect(recordKey).toHaveBeenCalledWith('BGT-3', savePage.mock.calls[0][0]);
    expect(savePage.mock.invocationCallOrder[0]).toBeLessThan(recordKey.mock.invocationCallOrder[0]);
    expect(result.ticketKey).toBe('BGT-3');
  });

  it('creates unkeyed when no key is assigned', async () => {
    keyForNewPage.mockResolvedValue(undefined);
    const result = await createPage({ title: 'T', parentGuid: PARENT, pageType: TYPE });
    expect('ticketKey' in savePage.mock.calls[0][2]).toBe(false);
    expect(recordKey).not.toHaveBeenCalled();
    expect('ticketKey' in result).toBe(false);
  });
});
