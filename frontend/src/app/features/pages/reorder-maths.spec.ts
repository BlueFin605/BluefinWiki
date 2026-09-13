import { computeReorder, type ReorderSibling } from './reorder-maths';

/** Build a sibling list from guid strings (the maths only reads `guid`). */
function sibs(guids: string[]): ReorderSibling[] {
  return guids.map((guid) => ({ guid }));
}

describe('computeReorder', () => {
  describe('same parent (moving page is already in the list)', () => {
    it('moving down: splices the page in AFTER the target', () => {
      const result = computeReorder(sibs(['a', 'b', 'c', 'd']), 'a', 'c', 'after');
      expect(result).toEqual({ crossParent: false, orderedGuids: ['b', 'c', 'a', 'd'] });
    });

    it('moving up: splices the page in BEFORE the target', () => {
      const result = computeReorder(sibs(['a', 'b', 'c', 'd']), 'd', 'b', 'before');
      expect(result).toEqual({ crossParent: false, orderedGuids: ['a', 'd', 'b', 'c'] });
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
    it('flags crossParent and splices the page before the target in the new parent ordering', () => {
      const result = computeReorder(sibs(['x', 'y', 'z']), 'm', 'y', 'before');
      expect(result).toEqual({ crossParent: true, orderedGuids: ['x', 'm', 'y', 'z'] });
    });

    it('after the target in the new parent', () => {
      const result = computeReorder(sibs(['x', 'y', 'z']), 'm', 'z', 'after');
      expect(result).toEqual({ crossParent: true, orderedGuids: ['x', 'y', 'z', 'm'] });
    });

    it('an empty target parent yields just the moving page', () => {
      const result = computeReorder(sibs([]), 'm', 'x', 'before');
      expect(result).toEqual({ crossParent: true, orderedGuids: ['m'] });
    });
  });

  /**
   * Stale payload: the drop request named a target row that is no longer among
   * the freshly fetched siblings (it was moved/deleted server-side since the
   * tree rendered). `targetIdx === -1`, so the moving page is appended. The
   * result must NOT try to re-derive a parent from the stale list — the caller
   * owns the parent guid, so the only thing that changes is the ordering.
   */
  describe('stale payload (target guid missing from the sibling list)', () => {
    it('cross-parent: appends the moving page and still reports crossParent', () => {
      const result = computeReorder(sibs(['x', 'y']), 'm', 'gone', 'before');
      expect(result).toEqual({ crossParent: true, orderedGuids: ['x', 'y', 'm'] });
    });

    it('same parent: appends the moving page at the end, crossParent stays false', () => {
      const result = computeReorder(sibs(['a', 'b', 'c']), 'a', 'gone', 'after');
      expect(result).toEqual({ crossParent: false, orderedGuids: ['b', 'c', 'a'] });
    });

    it('never reports a parent to move to — the caller decides that', () => {
      const result = computeReorder(sibs(['x', 'y']), 'm', 'gone', 'after');
      expect(result).not.toHaveProperty('moveTo');
    });
  });
});
