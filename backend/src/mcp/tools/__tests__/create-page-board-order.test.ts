import { describe, it, expect, vi, beforeEach } from 'vitest';

const savePage = vi.fn();
const listChildren = vi.fn();

vi.mock('../../../storage/StoragePluginRegistry.js', () => ({
  getStoragePlugin: () => ({ listChildren, savePage }),
}));
vi.mock('../../../ticket-keys/ticket-keys-service.js', () => ({
  keyForNewPage: vi.fn().mockResolvedValue(undefined),
  recordKey: vi.fn(),
  resolvePageRef: async (r: string) => r,
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

/** The PageContent handed to savePage(guid, parentGuid, content). */
const saved = () => savePage.mock.calls[0][2];

describe('create_page boardOrder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listChildren.mockResolvedValue([]);
  });

  it('appends past the highest sibling boardOrder', async () => {
    listChildren.mockResolvedValue([
      { boardOrder: 1000, sortOrder: 1000 },
      { boardOrder: 3000, sortOrder: 2000 },
    ]);
    await createPage({ title: 'T', parentGuid: PARENT });
    expect(saved().boardOrder).toBe(4000);
  });

  it('starts at 1000 under a parent with no children', async () => {
    await createPage({ title: 'T', parentGuid: PARENT });
    expect(saved().boardOrder).toBe(1000);
  });

  it('starts at 1000 when no sibling carries a boardOrder', async () => {
    listChildren.mockResolvedValue([{ sortOrder: 1000 }, { sortOrder: 2000 }]);
    await createPage({ title: 'T', parentGuid: PARENT });
    expect(saved().boardOrder).toBe(1000);
  });

  it('ignores unordered siblings when taking the max', async () => {
    listChildren.mockResolvedValue([
      { boardOrder: 2000, sortOrder: 1000 },
      { sortOrder: 2000 },
      { boardOrder: 9000, sortOrder: 3000 },
    ]);
    await createPage({ title: 'T', parentGuid: PARENT });
    expect(saved().boardOrder).toBe(10000);
  });

  it('always persists a boardOrder — this is the defect being fixed', async () => {
    // A card saved without one arms compute-board-order's needsNormalising
    // guard, turning the next drag in its column into a full-column renumber.
    await createPage({ title: 'T', parentGuid: PARENT });
    expect(saved().boardOrder).toBeTypeOf('number');
  });

  it('reads siblings once, sharing the fetch with sortOrder', async () => {
    await createPage({ title: 'T', parentGuid: PARENT });
    expect(listChildren).toHaveBeenCalledTimes(1);
  });
});
