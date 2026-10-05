import { describe, it, expect, vi } from 'vitest';

vi.mock('../../middleware/auth.js', () => ({
  withAuth: (fn: unknown) => fn,
  getUserContext: vi.fn(),
  isAdmin: vi.fn(),
}));

const { serializePageType, deserializePageType } = await import('../page-types-service.js');
const { CreatePageTypeSchema } = await import('../page-types-create.js');
const { UpdatePageTypeSchema } = await import('../page-types-update.js');
import type { PageTypeDefinition } from '../../types/index.js';

const base: PageTypeDefinition = {
  guid: '11111111-1111-4111-8111-111111111111', name: 'Initiative', icon: '🎯',
  properties: [], allowedChildTypes: [], allowWikiPageChildren: true,
  allowedParentTypes: [], allowAnyParent: true,
  createdBy: 'u', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
};

describe('page type boardDefaults', () => {
  it('round-trips through DynamoDB (de)serialisation', () => {
    const withDefaults = { ...base, boardDefaults: { columns: ['Ready', 'Done'], leafTypes: true, defaultView: 'board' as const } };
    expect(deserializePageType(serializePageType(withDefaults))).toEqual(withDefaults);
  });

  it('omits boardDefaults when unset', () => {
    expect(deserializePageType(serializePageType(base)).boardDefaults).toBeUndefined();
    expect('boardDefaults' in serializePageType(base)).toBe(false);
  });

  it('create and update schemas accept a valid boardDefaults and reject a bad one', () => {
    expect(UpdatePageTypeSchema.safeParse({ boardDefaults: { columns: ['A'], depth: 3 } }).success).toBe(true);
    expect(UpdatePageTypeSchema.safeParse({ boardDefaults: { depth: 99 } }).success).toBe(false);
    expect(CreatePageTypeSchema.safeParse({ name: 'X', icon: 'x', boardDefaults: { leafTypes: true } }).success).toBe(true);
  });
});
