import { describe, it, expect, vi } from 'vitest';

vi.mock('../../middleware/auth.js', () => ({
  withAuth: (fn: any) => fn,
  getUserContext: vi.fn(),
}));

const { BoardConfigSchema } = await import('../pages-update.js');
const G1 = '11111111-1111-4111-8111-111111111111';
const G2 = '22222222-2222-4222-8222-222222222222';

describe('BoardConfigSchema', () => {
  it('accepts targetTypeGuids and leafTypes', () => {
    expect(BoardConfigSchema.safeParse({ targetTypeGuids: [G1, G2], depth: 3 }).success).toBe(true);
    expect(BoardConfigSchema.safeParse({ leafTypes: true, depth: 10 }).success).toBe(true);
  });

  it('still accepts the legacy targetTypeGuid', () => {
    expect(BoardConfigSchema.safeParse({ targetTypeGuid: G1 }).success).toBe(true);
  });

  it('rejects a non-uuid or empty targetTypeGuids list', () => {
    expect(BoardConfigSchema.safeParse({ targetTypeGuids: ['nope'] }).success).toBe(false);
    expect(BoardConfigSchema.safeParse({ targetTypeGuids: [] }).success).toBe(false);
  });

  it('accepts a valid keyPrefix and rejects invalid ones', () => {
    expect(BoardConfigSchema.safeParse({ keyPrefix: 'BGT' }).success).toBe(true);
    expect(BoardConfigSchema.safeParse({ keyPrefix: 'B2C9' }).success).toBe(true);
    for (const bad of ['b', 'bgt', '1AB', 'A', 'ABCDEFGHIJK', 'BG-T']) {
      expect(BoardConfigSchema.safeParse({ keyPrefix: bad }).success).toBe(false);
    }
  });

  it('strips keyPrefix from page-type board defaults', async () => {
    const { PageTypeBoardDefaultsSchema } = await import('../board-config-schema.js');
    expect(PageTypeBoardDefaultsSchema.parse({ keyPrefix: 'BGT', depth: 3 })).toEqual({ depth: 3 });
  });
});
