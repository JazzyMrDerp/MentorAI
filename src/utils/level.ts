// src/utils/level.ts

/**
 * Map cumulative XP to a level, 1 through 5.
 *
 * One definition, because there used to be four. `db.ts` wrote this thresholded
 * version into `StudentProfile.currentLevel`, while the sidebar, the progress page
 * and the subject page each carried a private `Math.floor(xp / 200) + 1` — an
 * unbounded formula that disagreed with the stored column and with the badge tiers
 * on the progress page. The screens now render the same number the database holds.
 */
export function calculateLevel(xp: number): number {
  if (xp >= 1000) return 5;
  if (xp >= 700)  return 4;
  if (xp >= 450)  return 3;
  if (xp >= 250)  return 2;
  return 1;
}
