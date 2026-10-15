import { describe, it, expect } from 'vitest';
import { nextBoardOrder, BOARD_ORDER_STEP } from '../board-order.js';

/**
 * Shape-only stand-ins: `nextBoardOrder` reads nothing but `boardOrder`, so
 * the tests pass the minimum rather than full `PageSummary` objects.
 */
const card = (boardOrder?: number) => ({ boardOrder });

describe('nextBoardOrder', () => {
  it('appends one step past the highest sibling', () => {
    expect(nextBoardOrder([card(1000), card(2000), card(3000)])).toBe(4000);
  });

  it('starts at one step when there are no siblings at all', () => {
    expect(nextBoardOrder([])).toBe(BOARD_ORDER_STEP);
  });

  it('starts at one step when no sibling carries a boardOrder', () => {
    expect(nextBoardOrder([card(), card(), card()])).toBe(BOARD_ORDER_STEP);
  });

  it('ignores siblings without a boardOrder when taking the max', () => {
    expect(nextBoardOrder([card(1000), card(), card(7000), card()])).toBe(8000);
  });

  it('does not assume the siblings are sorted', () => {
    expect(nextBoardOrder([card(31000), card(2000), card(10000)])).toBe(32000);
  });

  it('steps past a non-multiple max rather than snapping to a grid', () => {
    // Midpoint inserts leave values like 1500 behind; appending must still
    // land strictly above the max, not round down to it.
    expect(nextBoardOrder([card(1000), card(1500)])).toBe(2500);
  });

  it('handles a zero boardOrder as a real value, not as absent', () => {
    expect(nextBoardOrder([card(0)])).toBe(1000);
  });

  it('handles negative boardOrders (left-end inserts go below zero)', () => {
    // `computeBoardOrder`'s `after` branch yields `after - 1000`, so a card
    // repeatedly dropped at the top of a column can go negative.
    expect(nextBoardOrder([card(-2000), card(-1000)])).toBe(0);
  });

  it('returns an integer for fractional inputs, so the zod int schema accepts it', () => {
    const result = nextBoardOrder([card(1000.5)]);
    expect(Number.isInteger(result)).toBe(true);
    expect(result).toBe(2001);
  });
});
