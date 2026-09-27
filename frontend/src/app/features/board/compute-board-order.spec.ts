import { computeBoardOrder } from './compute-board-order';

describe('computeBoardOrder', () => {
  it('inserts between two neighbours at their midpoint', () => {
    const columnCards = [
      { guid: 'a', boardOrder: 1000 },
      { guid: 'mover', boardOrder: 999 }, // ignored — only position/guid matter
      { guid: 'b', boardOrder: 2000 },
    ];
    expect(computeBoardOrder(columnCards, 1)).toEqual({ value: 1500 });
  });

  it('at the top of the column, goes 1000 below the sole neighbour', () => {
    const columnCards = [
      { guid: 'mover' },
      { guid: 'a', boardOrder: 1000 },
      { guid: 'b', boardOrder: 2000 },
    ];
    expect(computeBoardOrder(columnCards, 0)).toEqual({ value: 0 }); // 1000 - 1000
  });

  it('at the bottom of the column, goes 1000 above the sole neighbour', () => {
    const columnCards = [
      { guid: 'a', boardOrder: 1000 },
      { guid: 'b', boardOrder: 2000 },
      { guid: 'mover' },
    ];
    expect(computeBoardOrder(columnCards, 2)).toEqual({ value: 3000 });
  });

  it('uses a base value of 1000 for an empty column', () => {
    const columnCards = [{ guid: 'mover' }];
    expect(computeBoardOrder(columnCards, 0)).toEqual({ value: 1000 });
  });

  it('renumbers the whole column when neighbours are too close to fit a distinct midpoint', () => {
    const columnCards = [
      { guid: 'a', boardOrder: 1000 },
      { guid: 'mover' },
      { guid: 'b', boardOrder: 1001 },
    ];
    // 'a' renumbers to 1000, which is what it already was — since its value
    // didn't actually change, it's omitted from the renumber array so the
    // caller doesn't PUT an unchanged card. 'mover' and 'b' genuinely change.
    expect(computeBoardOrder(columnCards, 1)).toEqual({
      renumber: [
        { guid: 'mover', value: 2000 },
        { guid: 'b', value: 3000 },
      ],
    });
  });

  it('does not renumber when the gap is exactly 2 (a distinct integer midpoint exists)', () => {
    const columnCards = [
      { guid: 'a', boardOrder: 1000 },
      { guid: 'mover' },
      { guid: 'b', boardOrder: 1002 },
    ];
    expect(computeBoardOrder(columnCards, 1)).toEqual({ value: 1001 });
  });

  it('renumbers when neighbours have equal boardOrder (zero gap)', () => {
    const columnCards = [
      { guid: 'a', boardOrder: 1000 },
      { guid: 'mover' },
      { guid: 'b', boardOrder: 1000 },
    ];
    // 'a' again renumbers back to its own existing value (1000) and is
    // omitted; 'b' starts at the same value but renumbers to a genuinely
    // different one (3000), so it stays in.
    expect(computeBoardOrder(columnCards, 1)).toEqual({
      renumber: [
        { guid: 'mover', value: 2000 },
        { guid: 'b', value: 3000 },
      ],
    });
  });

  it('omits every card from the renumber array whose renumbered value equals its current one, even several at once', () => {
    const columnCards = [
      { guid: 'w', boardOrder: 1000 },
      { guid: 'a', boardOrder: 2000 },
      { guid: 'mover', boardOrder: 9000 },
      { guid: 'b', boardOrder: 2001 },
    ];
    // Trigger is the close gap between 'a' (2000) and 'b' (2001) around the
    // mover. Renumbering assigns w->1000, a->2000, mover->3000, b->4000:
    // 'w' and 'a' land back on their own existing values and are omitted;
    // 'mover' and 'b' genuinely change and stay in.
    expect(computeBoardOrder(columnCards, 2)).toEqual({
      renumber: [
        { guid: 'mover', value: 3000 },
        { guid: 'b', value: 4000 },
      ],
    });
  });

  it('renumbers when a neighbour has no boardOrder at all, rather than treating it as 0', () => {
    const columnCards = [
      { guid: 'a' }, // no explicit boardOrder
      { guid: 'mover' },
      { guid: 'b', boardOrder: 2000 },
    ];
    // Treating 'a' as 0 used to yield a midpoint of 1000 for the mover,
    // leaving 'a' with no boardOrder at all — which `groupByState` then
    // sorts AFTER both ordered cards, contradicting the drop. Renumbering
    // normalises the whole column instead. 'b' renumbers 2000 -> 3000.
    expect(computeBoardOrder(columnCards, 1)).toEqual({
      renumber: [
        { guid: 'a', value: 1000 },
        { guid: 'mover', value: 2000 },
        { guid: 'b', value: 3000 },
      ],
    });
  });

  it('renumbers on a bottom drop into an all-unordered column (the corruption case)', () => {
    // The regression this guard exists for: column [A, B, C] where no card
    // has ever been positioned, and the user drags A to the bottom. The old
    // `(before.boardOrder ?? 0) + 1000` gave the mover 1000 while B and C
    // kept no order — `groupByState` then rendered the mover FIRST, so the
    // card visibly jumped to the top and persisted there.
    const columnCards = [
      { guid: 'b' },
      { guid: 'c' },
      { guid: 'mover' },
    ];
    expect(computeBoardOrder(columnCards, 2)).toEqual({
      renumber: [
        { guid: 'b', value: 1000 },
        { guid: 'c', value: 2000 },
        { guid: 'mover', value: 3000 },
      ],
    });
  });

  it('renumbers on a bottom drop into a partially-ordered column whose tail is unordered', () => {
    const columnCards = [
      { guid: 'a', boardOrder: 1000 },
      { guid: 'b' }, // never positioned
      { guid: 'mover' },
    ];
    // 'a' renumbers back onto its own 1000 and is omitted; 'b' and the mover
    // both gain an explicit order, so the column is fully normalised.
    expect(computeBoardOrder(columnCards, 2)).toEqual({
      renumber: [
        { guid: 'b', value: 2000 },
        { guid: 'mover', value: 3000 },
      ],
    });
  });

  it('leaves the mover\'s own missing boardOrder alone — only other cards trigger normalising', () => {
    const columnCards = [
      { guid: 'a', boardOrder: 1000 },
      { guid: 'mover' }, // the mover's own order is never read
      { guid: 'b', boardOrder: 2000 },
    ];
    expect(computeBoardOrder(columnCards, 1)).toEqual({ value: 1500 });
  });

  it('rounds a non-integer midpoint to the nearest integer', () => {
    const columnCards = [
      { guid: 'a', boardOrder: 1000 },
      { guid: 'mover' },
      { guid: 'b', boardOrder: 1003 },
    ];
    // (1000 + 1003) / 2 = 1001.5 -> rounds to 1002, still strictly between.
    expect(computeBoardOrder(columnCards, 1)).toEqual({ value: 1002 });
  });
});
