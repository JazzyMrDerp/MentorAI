import { describe, it, expect } from 'vitest';
import { calculateLevel } from './level';

/**
 * The thresholds are asserted at their boundaries rather than at comfortable
 * mid-band values, because a boundary is the only place an off-by-one shows up.
 *
 * This function is worth pinning down: it used to exist in four copies giving
 * two different answers, and it is now read by the database (which stores the
 * level it returns) and by three screens that display it.
 */
describe('calculateLevel', () => {

  it('starts at level 1, including at zero XP', () => {
    expect(calculateLevel(0)).toBe(1);
    expect(calculateLevel(249)).toBe(1);
  });

  it.each([
    [250,  2],
    [449,  2],
    [450,  3],
    [699,  3],
    [700,  4],
    [999,  4],
    [1000, 5],
  ])('maps %i XP to level %i', (xp, level) => {
    expect(calculateLevel(xp)).toBe(level);
  });

  it('caps at 5 rather than growing without bound', () => {
    expect(calculateLevel(10_000)).toBe(5);
    expect(calculateLevel(Number.MAX_SAFE_INTEGER)).toBe(5);
  });

  it('does not go below 1 on a nonsensical total', () => {
    // XP is summed from progress rows and cannot be negative, but a level of 0
    // would render as "Level 0" rather than failing loudly, so pin the floor.
    expect(calculateLevel(-100)).toBe(1);
  });
});
