import { boardOverrides, effectiveBoardConfig, overriddenGroups, withPageOnly, withoutPageOnly } from './board-defaults';
import type { BoardConfig } from '../pages/page.types';

const D: BoardConfig = {
  columns: ['Ready', 'Done'], colors: { Done: '#22c55e' }, leafTypes: true, depth: 5,
  showParentTitle: true, defaultView: 'board',
};

describe('board-defaults', () => {
  it('no type defaults: the page config is used as-is', () => {
    expect(effectiveBoardConfig({ columns: ['X'] }, undefined)).toEqual({ columns: ['X'] });
    expect(effectiveBoardConfig(null, null)).toBeNull();
  });

  it('an untouched page gets the defaults', () => {
    expect(effectiveBoardConfig(null, D)).toEqual(D);
  });

  it('overrides replace whole groups and leave the rest following the defaults', () => {
    const eff = effectiveBoardConfig({ columns: ['Todo'] }, D)!;
    expect(eff.columns).toEqual(['Todo']);
    expect(eff.colors).toEqual(D.colors);
    expect(eff.leafTypes).toBe(true);
    expect(eff.defaultView).toBe('board');
  });

  it('the cards group is replaced whole (specific types suppress default leaf mode)', () => {
    const eff = effectiveBoardConfig({ targetTypeGuids: ['t'] }, D)!;
    expect(eff.targetTypeGuids).toEqual(['t']);
    expect(eff.leafTypes).toBeUndefined();
    expect(effectiveBoardConfig({ targetTypeGuid: 'legacy' }, D)!.leafTypes).toBeUndefined();
  });

  it('explicit off values override', () => {
    const eff = effectiveBoardConfig({ columns: [], leafTypes: false, defaultView: 'content' }, D)!;
    expect(eff.columns).toEqual([]);
    expect(eff.leafTypes).toBe(false);
    expect(eff.defaultView).toBe('content');
  });

  it('overriddenGroups lists the groups the page sets', () => {
    expect(overriddenGroups({ columns: [], targetTypeGuid: 'x', swapTitles: false })).toEqual(['columns', 'cards', 'swapTitles']);
    expect(overriddenGroups(null)).toEqual([]);
  });

  it('boardOverrides ignores colour key order', () => {
    const d: BoardConfig = { ...D, colors: { Ready: '#3b82f6', Done: '#22c55e' } };
    expect(boardOverrides({ ...d, colors: { Done: '#22c55e', Ready: '#3b82f6' } }, d)).toBeNull();
  });

  it('boardOverrides keeps only differing groups, written explicitly', () => {
    expect(boardOverrides({ ...D }, D)).toBeNull();
    expect(boardOverrides({ ...D, columns: ['Todo'] }, D)).toEqual({ columns: ['Todo'] });
    // dialog output omits off values; they must still be stored as overrides
    const rest: BoardConfig = { ...D };
    delete rest.defaultView;
    delete rest.leafTypes;
    expect(boardOverrides(rest, D)).toEqual({ leafTypes: false, defaultView: 'content' });
  });

  it('round-trips: effective(overrides(x, d), d) equals x after normalising', () => {
    const xs: BoardConfig[] = [
      { columns: ['A'], targetTypeGuids: ['t1', 't2'], depth: 2, swapTitles: true },
      { colors: {}, defaultView: 'content' },
      { ...D, showParentTitle: false },
    ];
    for (const x of xs) {
      const eff = effectiveBoardConfig(boardOverrides(x, D), D)!;
      expect(boardOverrides(eff, D)).toEqual(boardOverrides(x, D));
    }
  });
});

describe('page-only keyPrefix', () => {
  it('effectiveBoardConfig keeps the page keyPrefix over type defaults', () => {
    expect(effectiveBoardConfig({ keyPrefix: 'BGT' }, { depth: 3 })).toEqual({ depth: 3, keyPrefix: 'BGT' });
  });

  it('keyPrefix is not an overridden group', () => {
    expect(overriddenGroups({ keyPrefix: 'BGT' })).toEqual([]);
  });

  it('withPageOnly re-applies keyPrefix', () => {
    expect(withPageOnly(null, { keyPrefix: 'BGT' })).toEqual({ keyPrefix: 'BGT' });
    expect(withPageOnly({ depth: 2 }, { keyPrefix: 'BGT' })).toEqual({ depth: 2, keyPrefix: 'BGT' });
    expect(withPageOnly(null, {})).toBeNull();
    expect(withPageOnly(null, null)).toBeNull();
    expect(withPageOnly({ depth: 2 }, undefined)).toEqual({ depth: 2 });
  });

  it('withoutPageOnly strips keyPrefix', () => {
    expect(withoutPageOnly({ keyPrefix: 'X', depth: 1 })).toEqual({ depth: 1 });
  });
});
