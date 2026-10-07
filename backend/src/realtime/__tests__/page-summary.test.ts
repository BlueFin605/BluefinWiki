import { describe, it, expect } from 'vitest';
import { toPageSummary } from '../page-summary.js';
import type { PageContent } from '../../types/index.js';

const base: PageContent = {
  guid: 'g',
  title: 'Title',
  content: '# body',
  folderId: 'p',
  tags: [],
  status: 'published',
  createdBy: 'creator',
  modifiedBy: 'modifier',
  createdAt: '2026-01-01T00:00:00.000Z',
  modifiedAt: '2026-01-02T00:00:00.000Z',
};

describe('toPageSummary', () => {
  it('maps core fields and never carries content', () => {
    const s = toPageSummary(base, 'p');
    expect(s).toEqual({
      guid: 'g',
      title: 'Title',
      parentGuid: 'p',
      status: 'published',
      createdBy: 'creator',
      modifiedAt: '2026-01-02T00:00:00.000Z',
      modifiedBy: 'modifier',
    });
    expect(s).not.toHaveProperty('content');
    expect(s).not.toHaveProperty('hasChildren');
  });

  it('omits empty tags and properties, keeps non-empty ones', () => {
    expect(toPageSummary({ ...base, tags: [], properties: {} }, 'p')).not.toHaveProperty('tags');
    expect(toPageSummary({ ...base, properties: {} }, 'p')).not.toHaveProperty('properties');
    const properties = { state: { type: 'string' as const, value: 'Ready' } };
    const s = toPageSummary({ ...base, tags: ['dean'], properties }, 'p');
    expect(s.tags).toEqual(['dean']);
    expect(s.properties).toBe(properties);
  });

  it('normalises an empty parentGuid to null', () => {
    expect(toPageSummary(base, '').parentGuid).toBeNull();
    expect(toPageSummary(base, null).parentGuid).toBeNull();
  });

  it('passes ordering, key and page type through when set', () => {
    const s = toPageSummary({ ...base, sortOrder: 0, boardOrder: 3, ticketKey: 'BW-1', pageType: 'pt' }, 'p');
    expect(s).toMatchObject({ sortOrder: 0, boardOrder: 3, ticketKey: 'BW-1', pageType: 'pt' });
  });

  it('reports a deleted page as archived', () => {
    expect(toPageSummary({ ...base, status: 'deleted' }, 'p').status).toBe('archived');
  });
});
