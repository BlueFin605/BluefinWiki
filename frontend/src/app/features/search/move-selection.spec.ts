import { moveSelection } from './move-selection';

describe('moveSelection', () => {
  it('ArrowDown from -1 (nothing selected) moves to the first result', () => {
    expect(moveSelection(-1, 'ArrowDown', 5)).toBe(0);
  });

  it('ArrowDown at the last result clamps (does not wrap)', () => {
    expect(moveSelection(4, 'ArrowDown', 5)).toBe(4);
  });

  it('ArrowDown moves forward one at a time', () => {
    expect(moveSelection(1, 'ArrowDown', 5)).toBe(2);
  });

  it('ArrowUp at the first result clamps to 0 (does not wrap)', () => {
    expect(moveSelection(0, 'ArrowUp', 5)).toBe(0);
  });

  it('ArrowUp moves backward one at a time', () => {
    expect(moveSelection(2, 'ArrowUp', 5)).toBe(1);
  });

  it('Home jumps to the first result regardless of current position', () => {
    expect(moveSelection(3, 'Home', 5)).toBe(0);
  });

  it('End jumps to the last result regardless of current position', () => {
    expect(moveSelection(1, 'End', 5)).toBe(4);
  });

  it('returns -1 for an empty result list', () => {
    expect(moveSelection(-1, 'ArrowDown', 0)).toBe(-1);
    expect(moveSelection(0, 'End', 0)).toBe(-1);
  });
});
