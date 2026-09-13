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
    expect(computeBoardOrder(columnCards, 1)).toEqual({
      renumber: [
        { guid: 'a', value: 1000 },
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
    expect(computeBoardOrder(columnCards, 1)).toEqual({
      renumber: [
        { guid: 'a', value: 1000 },
        { guid: 'mover', value: 2000 },
        { guid: 'b', value: 3000 },
      ],
    });
  });

  it('treats a neighbour with no boardOrder as 0 for gap/midpoint purposes', () => {
    const columnCards = [
      { guid: 'a' }, // no explicit boardOrder -> treated as 0
      { guid: 'mover' },
      { guid: 'b', boardOrder: 2000 },
    ];
    expect(computeBoardOrder(columnCards, 1)).toEqual({ value: 1000 });
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
