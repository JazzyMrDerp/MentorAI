// src/utils/progress.ts
import type { Progress } from '../types';

/**
 * Boss rows written before Progress.kind existed used this sentinel in place of a
 * lesson id. Nothing writes it any more; it is read so an existing student's
 * history keeps counting correctly.
 */
const LEGACY_BOSS_LESSON_ID = 99999;

/**
 * Does this row record a boss battle rather than a single lesson's quiz?
 *
 * Boss battles have no lesson to point at, which matters wherever progress rows
 * are counted as lessons: the progress page's "Lessons Completed" was a Set of
 * lessonId and the 99999 sentinel silently added one to it, so a student who had
 * fought the boss saw a lesson count one higher than the lessons they had done.
 */
export function isBossAttempt(p: Progress): boolean {
  return p.kind === 'boss' || p.lessonId === LEGACY_BOSS_LESSON_ID;
}

/** The lesson rows only — everything that legitimately maps to a Lesson.id. */
export function lessonAttempts(progress: Progress[]): Progress[] {
  return progress.filter(p => !isBossAttempt(p) && p.lessonId !== undefined);
}
