/**
 * list_page_types reads the live table on every call: a warm MCP Lambda must
 * not keep serving the page types it saw at cold start.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PageTypeDefinition } from '../../../types/index.js';

const { serviceList } = vi.hoisted(() => ({ serviceList: vi.fn() }));

vi.mock('../../../page-types/page-types-service.js', () => ({
  listPageTypes: serviceList,
}));

import { listPageTypes } from '../list-page-types.js';

function bugType(propertyName: string): PageTypeDefinition {
  return {
    guid: 'bug-guid',
    name: 'Bug',
    icon: '🐞',
    properties: [{ name: propertyName, type: 'string', required: false }],
    allowedChildTypes: [],
    allowWikiPageChildren: true,
    allowedParentTypes: [],
    allowAnyParent: true,
    createdBy: 'u',
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-05T18:56:00Z',
  } as PageTypeDefinition;
}

describe('list_page_types', () => {
  beforeEach(() => serviceList.mockReset());

  it('sees an updated definition on the next call (no warm-Lambda cache)', async () => {
    serviceList.mockResolvedValueOnce([bugType('statue')]);
    const first = await listPageTypes();
    expect(first[0].properties[0].name).toBe('statue');

    serviceList.mockResolvedValueOnce([bugType('state')]);
    const second = await listPageTypes();
    expect(second[0].properties[0].name).toBe('state');
  });

  it('returns the summary fields only', async () => {
    serviceList.mockResolvedValueOnce([bugType('state')]);
    const [type] = await listPageTypes();
    expect(type).toEqual({
      guid: 'bug-guid',
      name: 'Bug',
      icon: '🐞',
      properties: [{ name: 'state', type: 'string', required: false }],
      allowedChildTypes: [],
    });
  });
});
