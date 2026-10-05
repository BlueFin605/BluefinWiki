import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../ticket-keys-store.js');
vi.mock('../../storage/StoragePluginRegistry.js', () => ({ getStoragePlugin: vi.fn() }));
vi.mock('../../page-types/page-types-service.js', () => ({ getPageType: vi.fn() }));

import { allocateNumber, putMapping, getMapping } from '../ticket-keys-store.js';
import { getStoragePlugin } from '../../storage/StoragePluginRegistry.js';
import { getPageType } from '../../page-types/page-types-service.js';
import {
  isTicketKey,
  canonicalKey,
  isTicketType,
  keyForNewPage,
  recordKey,
  resolveKey,
} from '../ticket-keys-service.js';

type FakePage = { guid: string; folderId: string; pageType?: string; boardConfig?: { keyPrefix?: string } };

const types: Record<string, { name: string; properties: { name: string }[] }> = {
  't-init': { name: 'Initiative', properties: [{ name: 'state' }] },
  't-task': { name: 'Task', properties: [{ name: 'state' }] },
  't-note': { name: 'Note', properties: [] },
};

let pages: Record<string, FakePage>;
let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.resetAllMocks();
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  pages = {
    init: { guid: 'init', folderId: '', pageType: 't-init', boardConfig: { keyPrefix: 'BGT' } },
    epic: { guid: 'epic', folderId: 'init', pageType: 't-task' },
    orphan: { guid: 'orphan', folderId: '', pageType: 't-task' },
    bare: { guid: 'bare', folderId: '', pageType: 't-init' },
  };
  vi.mocked(getStoragePlugin).mockReturnValue({
    loadPage: async (g: string) => {
      if (!pages[g]) throw new Error(`not found ${g}`);
      return pages[g];
    },
  } as never);
  vi.mocked(getPageType).mockImplementation((async (g: string) => types[g] ?? null) as never);
  vi.mocked(allocateNumber).mockResolvedValue(7);
});

afterEach(() => {
  warnSpy.mockRestore();
});

describe('keyForNewPage', () => {
  it('allocates a key under the nearest Initiative prefix', async () => {
    expect(await keyForNewPage('epic', 't-task')).toBe('BGT-7');
    expect(allocateNumber).toHaveBeenCalledWith('BGT');
  });

  it('works when the parent is the Initiative itself', async () => {
    expect(await keyForNewPage('init', 't-task')).toBe('BGT-7');
  });

  it('returns undefined when the Initiative has no keyPrefix', async () => {
    expect(await keyForNewPage('bare', 't-task')).toBeUndefined();
    expect(allocateNumber).not.toHaveBeenCalled();
  });

  it('returns undefined when there is no Initiative ancestor', async () => {
    expect(await keyForNewPage('orphan', 't-task')).toBeUndefined();
    expect(await keyForNewPage(null, 't-task')).toBeUndefined();
    expect(allocateNumber).not.toHaveBeenCalled();
  });

  it('returns undefined for non-ticket types, missing type and Initiative type', async () => {
    expect(await keyForNewPage('epic', 't-note')).toBeUndefined();
    expect(await keyForNewPage('epic', undefined)).toBeUndefined();
    expect(await keyForNewPage('epic', 't-init')).toBeUndefined();
    expect(allocateNumber).not.toHaveBeenCalled();
  });

  it('never throws: warns and returns undefined when allocation fails', async () => {
    vi.mocked(allocateNumber).mockRejectedValue(new Error('boom'));
    expect(await keyForNewPage('epic', 't-task')).toBeUndefined();
    expect(warnSpy).toHaveBeenCalled();
  });
});

describe('recordKey', () => {
  it('stores the mapping', async () => {
    vi.mocked(putMapping).mockResolvedValue('created');
    await recordKey('BGT-7', 'g');
    expect(putMapping).toHaveBeenCalledWith('BGT-7', 'g');
  });

  it('never throws: warns when putMapping rejects', async () => {
    vi.mocked(putMapping).mockRejectedValue(new Error('boom'));
    await expect(recordKey('BGT-7', 'g')).resolves.toBeUndefined();
    expect(warnSpy).toHaveBeenCalled();
  });
});

describe('resolveKey', () => {
  it('canonicalises the key before lookup', async () => {
    vi.mocked(getMapping).mockResolvedValue('guid-1');
    expect(await resolveKey('bgt-7')).toBe('guid-1');
    expect(getMapping).toHaveBeenCalledWith('BGT-7');
  });

  it('returns null for non-key input without a lookup', async () => {
    expect(await resolveKey('abc')).toBeNull();
    expect(getMapping).not.toHaveBeenCalled();
  });
});

describe('helpers', () => {
  it('isTicketKey', () => {
    for (const ok of ['BGT-1', 'bgt-12', 'B2-3']) expect(isTicketKey(ok)).toBe(true);
    for (const bad of ['123e4567-e89b-12d3-a456-426614174000', 'BGT', '-1', 'BGT-', 'BGT-1a']) {
      expect(isTicketKey(bad)).toBe(false);
    }
  });

  it('canonicalKey upper-cases', () => {
    expect(canonicalKey(' bgt-12 ')).toBe('BGT-12');
  });

  it('isTicketType', () => {
    expect(isTicketType(types['t-task'])).toBe(true);
    expect(isTicketType(types['t-init'])).toBe(false);
    expect(isTicketType(types['t-note'])).toBe(false);
  });
});
