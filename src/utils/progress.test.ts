import { describe, it, expect } from 'vitest';
import { isBossAttempt, lessonAttempts } from './progress';
import type { Progress } from '../types';

function row(over: Partial<Progress>): Progress {
  return {
    nickname:    'aanya',
    lessonTitle: 'Introduction to Fractions',
    subject:     'math',
    score:       80,
    xpEarned:    80,
    attempts:    5,
    hintsUsed:   0,
    completedAt: '2026-08-22T12:00:00.000Z',
    ...over,
  };
}

describe('isBossAttempt', () => {

  it('recognises a boss row by its kind', () => {
    expect(isBossAttempt(row({ kind: 'boss' }))).toBe(true);
  });

  it('leaves a quiz row alone', () => {
    expect(isBossAttempt(row({ kind: 'quiz', lessonId: 3 }))).toBe(false);
  });

  /**
   * Boss rows written before Progress.kind existed carry lessonId 99999. Nothing
   * writes it any more, but a student who played before the change still has
   * those rows, and they must not start counting as a real lesson.
   */
  it('still recognises the legacy 99999 sentinel', () => {
    expect(isBossAttempt(row({ lessonId: 99999 }))).toBe(true);
  });

  it('treats an untagged row with a real lesson id as a quiz', () => {
    expect(isBossAttempt(row({ lessonId: 4 }))).toBe(false);
  });
});

describe('lessonAttempts', () => {

  it('keeps only rows that map to a real lesson', () => {
    const rows = [
      row({ kind: 'quiz', lessonId: 1 }),
      row({ kind: 'boss' }),
      row({ lessonId: 99999 }),
      row({ lessonId: 2 }),
    ];
    expect(lessonAttempts(rows).map(r => r.lessonId)).toEqual([1, 2]);
  });

  /**
   * This is what the progress page counts. A boss row leaking through put the
   * battle into the "Lessons Completed" Set and reported one lesson more than
   * the student had actually finished.
   */
  it('counts no completed lessons for a boss-only history', () => {
    const completed = new Set(
      lessonAttempts([row({ kind: 'boss' }), row({ lessonId: 99999 })]).map(r => r.lessonId)
    );
    expect(completed.size).toBe(0);
  });

  it('drops a row with no lesson id even if it is untagged', () => {
    expect(lessonAttempts([row({})])).toEqual([]);
  });
});
