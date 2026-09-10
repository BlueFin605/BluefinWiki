import { computeReorder, type ReorderSibling } from './reorder-maths';

/** Build a sibling list under one parent from a guid string. */
function sibs(guids: string[], parentGuid: string | null = 'p'): ReorderSibling[] {
  return guids.map((guid) => ({ guid, parentGuid }));
}

describe('computeReorder', () => {
  describe('same parent (moving page is already in the list)', () => {
    it('moving down: splices the page in AFTER the target', () => {
      const result = computeReorder(sibs(['a', 'b', 'c', 'd']), 'a', 'c', 'after');
      expect(result).toEqual({ orderedGuids: ['b', 'c', 'a', 'd'] });
      expect(result).not.toHaveProperty('moveTo');
    });

    it('moving up: splices the page in BEFORE the target', () => {
      const result = computeReorder(sibs(['a', 'b', 'c', 'd']), 'd', 'b', 'before');
      expect(result).toEqual({ orderedGuids: ['a', 'd', 'b', 'c'] });
    });

    it('before the first sibling', () => {
      const result = computeReorder(sibs(['a', 'b', 'c']), 'c', 'a', 'before');
      expect(result.orderedGuids).toEqual(['c', 'a', 'b']);
    });

    it('after the last sibling', () => {
      const result = computeReorder(sibs(['a', 'b', 'c']), 'a', 'c', 'after');
      expect(result.orderedGuids).toEqual(['b', 'c', 'a']);
    });

    it('a no-op-ish drop next to the current position still yields a full ordering', () => {
      const result = computeReorder(sibs(['a', 'b', 'c']), 'b', 'a', 'after');
      expect(result.orderedGuids).toEqual(['a', 'b', 'c']);
    });
  });

  describe('different parent (moving page is NOT in the target list)', () => {
    it('returns moveTo (the target parent guid) plus the new parent ordering, page spliced before the target', () => {
      const result = computeReorder(sibs(['x', 'y', 'z'], 'np'), 'm', 'y', 'before');
      expect(result).toEqual({ moveTo: 'np', orderedGuids: ['x', 'm', 'y', 'z'] });
    });

    it('after the target in the new parent', () => {
      const result = computeReorder(sibs(['x', 'y', 'z'], 'np'), 'm', 'z', 'after');
      expect(result).toEqual({ moveTo: 'np', orderedGuids: ['x', 'y', 'z', 'm'] });
    });

    it('cross-parent to the root level yields moveTo: null', () => {
      const result = computeReorder(sibs(['x'], null), 'm', 'x', 'before');
      expect(result).toEqual({ moveTo: null, orderedGuids: ['m', 'x'] });
    });
  });
});
