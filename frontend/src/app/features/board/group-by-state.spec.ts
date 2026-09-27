import { groupByState, getColumnColor, UNCATEGORISED } from './group-by-state';
import type { PageChildDetail } from '../pages/page.types';

function card(over: Partial<PageChildDetail>): PageChildDetail {
  return {
    guid: 'c',
    title: 'Card',
    parentGuid: 'p',
    status: 'published',
    modifiedAt: '2026-01-01T00:00:00Z',
    modifiedBy: 'u',
    hasChildren: false,
    ...over,
  };
}

describe('groupByState', () => {
  it('groups cards by their state property value', () => {
    const cards = [
      card({ guid: 'a', properties: { state: { type: 'string', value: 'To Do' } } }),
      card({ guid: 'b', properties: { state: { type: 'string', value: 'Done' } } }),
      card({ guid: 'c', properties: { state: { type: 'string', value: 'To Do' } } }),
    ];
    const result = groupByState(cards);
    expect(result.cardsByColumn['To Do'].map((c) => c.guid)).toEqual(['a', 'c']);
    expect(result.cardsByColumn['Done'].map((c) => c.guid)).toEqual(['b']);
  });

  it('routes cards without a state property to Uncategorised', () => {
    const cards = [card({ guid: 'a' }), card({ guid: 'b', properties: {} })];
    const result = groupByState(cards);
    expect(result.cardsByColumn[UNCATEGORISED].map((c) => c.guid)).toEqual(['a', 'b']);
    expect(result.columns).toEqual([UNCATEGORISED]);
  });

  it('returns columns in configured order when boardConfig.columns is set', () => {
    const cards = [
      card({ guid: 'a', properties: { state: { type: 'string', value: 'Done' } } }),
      card({ guid: 'b', properties: { state: { type: 'string', value: 'To Do' } } }),
    ];
    const result = groupByState(cards, { columns: ['To Do', 'In Progress', 'Done'] });
    expect(result.columns).toEqual(['To Do', 'In Progress', 'Done']);
  });

  it('falls back to alphabetical ordering when no boardConfig is provided', () => {
    const cards = [
      card({ guid: 'a', properties: { state: { type: 'string', value: 'Charlie' } } }),
      card({ guid: 'b', properties: { state: { type: 'string', value: 'Alpha' } } }),
      card({ guid: 'c', properties: { state: { type: 'string', value: 'Bravo' } } }),
    ];
    const result = groupByState(cards);
    expect(result.columns).toEqual(['Alpha', 'Bravo', 'Charlie']);
  });

  it('appends Uncategorised last only when it has cards', () => {
    const withUncat = groupByState([
      card({ guid: 'a', properties: { state: { type: 'string', value: 'Done' } } }),
      card({ guid: 'b' }),
    ]);
    expect(withUncat.columns[withUncat.columns.length - 1]).toBe(UNCATEGORISED);

    const withoutUncat = groupByState([
      card({ guid: 'a', properties: { state: { type: 'string', value: 'Done' } } }),
    ]);
    expect(withoutUncat.columns).not.toContain(UNCATEGORISED);
  });

  it('ensures configured columns exist even if empty', () => {
    const cards = [
      card({ guid: 'a', properties: { state: { type: 'string', value: 'Done' } } }),
    ];
    const result = groupByState(cards, { columns: ['To Do', 'In Progress', 'Done'] });
    expect(result.cardsByColumn['To Do']).toEqual([]);
    expect(result.cardsByColumn['In Progress']).toEqual([]);
    expect(result.cardsByColumn['Done'].map((c) => c.guid)).toEqual(['a']);
  });

  it('sorts cards within a column by boardOrder ascending then modifiedAt descending', () => {
    const cards = [
      card({ guid: 'no-order-old', modifiedAt: '2026-01-01T00:00:00Z',
        properties: { state: { type: 'string', value: 'X' } } }),
      card({ guid: 'no-order-new', modifiedAt: '2026-03-01T00:00:00Z',
        properties: { state: { type: 'string', value: 'X' } } }),
      card({ guid: 'order-10', boardOrder: 10,
        properties: { state: { type: 'string', value: 'X' } } }),
      card({ guid: 'order-5', boardOrder: 5,
        properties: { state: { type: 'string', value: 'X' } } }),
    ];
    const result = groupByState(cards);
    expect(result.cardsByColumn['X'].map((c) => c.guid)).toEqual([
      'order-5',
      'order-10',
      'no-order-new',
      'no-order-old',
    ]);
  });
});

describe('getColumnColor', () => {
  it('prefers a configured color over defaults', () => {
    expect(getColumnColor('To Do', { 'To Do': '#abcdef' })).toBe('#abcdef');
  });

  it('returns the default color for a well-known column name', () => {
    expect(getColumnColor('Done')).toBe('#22c55e');
  });

  it('falls back to a stable hash-based hsl color for unknown column names', () => {
    expect(getColumnColor('Random')).toMatch(/^hsl\(/);
    expect(getColumnColor('Random')).toBe(getColumnColor('Random'));
  });
});
