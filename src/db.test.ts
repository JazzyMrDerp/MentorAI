// src/db.test.ts
// Covers the local database layer the sync engine sits on top of.
//
// Dexie runs for real against fake-indexeddb (see vitest.setup.ts), so these
// assert against actual IndexedDB rows rather than a mock of them. The subject of
// most of this file is markQuestionAnswered, which is the only place in the app
// that decides to enqueue work — every job the sync engine ever drains starts here.
import { describe, it, expect, beforeEach } from 'vitest';
import {
  db,
  seedLessons,
  hasPreloadedLessons,
  markQuestionAnswered,
  saveProgress,
  getXPTotals,
  getProgressForStudent,
  createProfile,
  updateProfile,
  getProfile,
  countGeneratedLessons,
  getPendingSyncItems,
  calculateStreak,
} from './db';
import type { Lesson, Question, Progress, StudentProfile, SyncQueueItem } from './types';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function question(over: Partial<Question> = {}): Question {
  return {
    prompt:       '2 + 2 = ?',
    choices:      ['3', '4', '5', '6'],
    correctIndex: 1,
    hint:         'Count it out.',
    answered:     false,
    correct:      false,
    difficulty:   1,
    ...over,
  };
}

/** A three-question math lesson for grade 7, saved and given an id. */
async function seedLesson(over: Partial<Lesson> = {}): Promise<number> {
  return (await db.lessons.add({
    subject:     'math',
    grade:       7,
    language:    'en',
    title:       'Adding',
    content:     'Lesson body.',
    questions:   [question(), question(), question()],
    createdAt:   new Date().toISOString(),
    isPreloaded: true,
    ...over,
  } as Lesson)) as number;
}

function progressRow(over: Partial<Progress> = {}): Omit<Progress, 'id'> {
  return {
    nickname:    'aanya',
    kind:        'quiz',
    lessonId:    1,
    lessonTitle: 'Adding',
    subject:     'math',
    score:       80,
    xpEarned:    80,
    attempts:    3,
    hintsUsed:   0,
    completedAt: new Date().toISOString(),
    ...over,
  };
}

async function queued(): Promise<SyncQueueItem[]> {
  return getPendingSyncItems();
}

async function queuedTypes(): Promise<string[]> {
  return (await queued()).map(i => i.type);
}

/** Answer every question in a lesson correctly, in order. */
async function aceLesson(lessonId: number, count = 3): Promise<void> {
  for (let i = 0; i < count; i++) {
    await markQuestionAnswered(lessonId, i, true);
  }
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(async () => {
  await db.lessons.clear();
  await db.progress.clear();
  await db.studentProfile.clear();
  await db.syncQueue.clear();
});

// ── markQuestionAnswered ──────────────────────────────────────────────────────

describe('markQuestionAnswered', () => {

  it('records the answer on the lesson row', async () => {
    const id = await seedLesson();
    await markQuestionAnswered(id, 1, false);

    const lesson = await db.lessons.get(id);
    expect(lesson!.questions[1].answered).toBe(true);
    expect(lesson!.questions[1].correct).toBe(false);
    // The others are untouched — the whole array is rewritten on every answer,
    // so this is worth pinning.
    expect(lesson!.questions[0].answered).toBe(false);
  });

  it('queues a harder replacement when the answer is correct', async () => {
    const id = await seedLesson();
    await markQuestionAnswered(id, 0, true);

    const items = await queued();
    expect(items).toHaveLength(1);
    expect(items[0].type).toBe('replace_question');
    expect(items[0].payload).toMatchObject({
      lessonId: id, questionIndex: 0, subject: 'math', grade: 7, difficulty: 1,
    });
  });

  it('sends no topic with the replacement request', async () => {
    // On a generated lesson the title is model output, so passing it would feed
    // the model's own words back into the next prompt.
    const id = await seedLesson();
    await markQuestionAnswered(id, 0, true);

    expect((await queued())[0].payload).not.toHaveProperty('topic');
  });

  it('queues nothing when the answer is wrong', async () => {
    const id = await seedLesson();
    await markQuestionAnswered(id, 0, false);

    expect(await queuedTypes()).toEqual([]);
  });

  it('queues no replacement for a question already at max difficulty', async () => {
    const id = await seedLesson({ questions: [question({ difficulty: 3 })] });
    await markQuestionAnswered(id, 0, true);

    expect(await queuedTypes()).not.toContain('replace_question');
  });

  /**
   * The idempotence gate. Retaking a quiz re-answers questions that are already
   * correct; without this, a retake queues a replacement for every question, and
   * re-fires generate_lesson on every single answer once a lesson is fully aced.
   */
  it('does not re-queue when an already-correct question is answered again', async () => {
    const id = await seedLesson();
    await markQuestionAnswered(id, 0, true);
    await db.syncQueue.clear();

    await markQuestionAnswered(id, 0, true);

    expect(await queuedTypes()).toEqual([]);
  });

  it('does queue again when a previously wrong answer becomes correct', async () => {
    const id = await seedLesson();
    await markQuestionAnswered(id, 0, false);
    await markQuestionAnswered(id, 0, true);

    expect(await queuedTypes()).toEqual(['replace_question']);
  });

  it('queues a whole new lesson once every question is correct', async () => {
    const id = await seedLesson();
    await aceLesson(id);

    const generate = (await queued()).filter(i => i.type === 'generate_lesson');
    expect(generate).toHaveLength(1);
    expect(generate[0].payload).toMatchObject({ subject: 'math', grade: 7, topicIndex: 0 });
  });

  it('does not queue a new lesson while any question is still wrong', async () => {
    const id = await seedLesson();
    await markQuestionAnswered(id, 0, true);
    await markQuestionAnswered(id, 1, true);
    await markQuestionAnswered(id, 2, false);

    expect(await queuedTypes()).not.toContain('generate_lesson');
  });

  /**
   * topicIndex is the count of lessons already generated for this subject and
   * grade, and the catalogue in topics.ts holds three per pair. Past that there
   * is nothing left to ask for, and the proxy would reject the request anyway.
   */
  it('stops queueing new lessons once the topic catalogue is exhausted', async () => {
    for (let i = 0; i < 3; i++) {
      await seedLesson({ title: 'Generated ' + i, isPreloaded: false });
    }
    expect(await countGeneratedLessons('math', 7)).toBe(3);

    const id = await seedLesson();
    await aceLesson(id);

    expect(await queuedTypes()).not.toContain('generate_lesson');
  });

  it('counts generated lessons per subject and grade, not globally', async () => {
    await seedLesson({ isPreloaded: false });
    await seedLesson({ isPreloaded: false, subject: 'ela' });
    await seedLesson({ isPreloaded: false, grade: 8 });

    expect(await countGeneratedLessons('math', 7)).toBe(1);
    expect(await countGeneratedLessons('ela', 7)).toBe(1);
    expect(await countGeneratedLessons('math', 8)).toBe(1);
  });

  it('is a no-op for a lesson that does not exist', async () => {
    await markQuestionAnswered(9999, 0, true);
    expect(await queuedTypes()).toEqual([]);
  });

  it('is a no-op for a question index past the end of the lesson', async () => {
    const id = await seedLesson();
    await markQuestionAnswered(id, 99, true);

    expect(await queuedTypes()).toEqual([]);
    const lesson = await db.lessons.get(id);
    expect(lesson!.questions).toHaveLength(3);
  });
});

// ── getXPTotals ───────────────────────────────────────────────────────────────

describe('getXPTotals', () => {

  it('reports zeros for a student with no attempts', async () => {
    expect(await getXPTotals('nobody')).toEqual({ totalXP: 0, mathXP: 0, elaXP: 0 });
  });

  it('splits earned XP by subject', async () => {
    await saveProgress(progressRow({ subject: 'math', xpEarned: 120 }));
    await saveProgress(progressRow({ subject: 'ela',  xpEarned: 30 }));
    await saveProgress(progressRow({ subject: 'math', xpEarned: 100 }));

    expect(await getXPTotals('aanya')).toEqual({ totalXP: 250, mathXP: 220, elaXP: 30 });
  });

  it('counts boss rows, which have no lesson id', async () => {
    await saveProgress(progressRow({ kind: 'boss', lessonId: undefined, xpEarned: 250 }));

    expect(await getXPTotals('aanya')).toMatchObject({ totalXP: 250, mathXP: 250 });
  });

  it('ignores another student on the same device', async () => {
    await saveProgress(progressRow({ nickname: 'aanya', xpEarned: 100 }));
    await saveProgress(progressRow({ nickname: 'ravi',  xpEarned: 900 }));

    expect((await getXPTotals('aanya')).totalXP).toBe(100);
  });

  it('agrees with the rows getProgressForStudent returns', async () => {
    await saveProgress(progressRow({ xpEarned: 40 }));
    await saveProgress(progressRow({ xpEarned: 60, subject: 'ela' }));

    const rows = await getProgressForStudent('aanya');
    const summed = rows.reduce((n, r) => n + r.xpEarned, 0);
    expect((await getXPTotals('aanya')).totalXP).toBe(summed);
  });
});

// ── updateProfile ─────────────────────────────────────────────────────────────

describe('updateProfile', () => {

  async function newProfile(over: Partial<StudentProfile> = {}): Promise<void> {
    await createProfile({
      nickname: 'aanya', grade: 7, language: 'en',
      totalXP: 0, mathXP: 0, elaXP: 0, currentLevel: 1,
      streak: 1, lastActive: new Date().toISOString(),
      ...over,
    } as Omit<StudentProfile, 'id'>);
  }

  it('recalculates the level from the new XP', async () => {
    await newProfile();
    await updateProfile('aanya', { totalXP: 500 });

    expect((await getProfile('aanya'))!.currentLevel).toBe(3);
  });

  /**
   * The level is derived from the *stored* XP when the update does not carry one.
   * That is why the daily streak tick used to re-pin a student to level 1: it
   * passed only { streak, lastActive }, and the stored XP was always zero.
   */
  it('derives the level from stored XP when the update omits it', async () => {
    await newProfile({ totalXP: 800, currentLevel: 4 });
    await updateProfile('aanya', { streak: 5 });

    const profile = await getProfile('aanya');
    expect(profile!.streak).toBe(5);
    expect(profile!.currentLevel).toBe(4);
  });

  it('leaves fields the update does not mention alone', async () => {
    await newProfile({ streak: 3 });
    await updateProfile('aanya', { totalXP: 250 });

    expect((await getProfile('aanya'))!.streak).toBe(3);
  });

  it('is a no-op for a student who does not exist', async () => {
    await expect(updateProfile('ghost', { totalXP: 100 })).resolves.toBeUndefined();
  });
});

// ── calculateStreak ───────────────────────────────────────────────────────────

const DAY = 24 * 60 * 60 * 1000;
const agoMs = (ms: number): string => new Date(Date.now() - ms).toISOString();

describe('calculateStreak', () => {

  it('leaves the streak alone on a second visit the same day', () => {
    expect(calculateStreak(agoMs(2 * 60 * 60 * 1000), 4)).toBe(4);
  });

  it('increments after a day has passed', () => {
    expect(calculateStreak(agoMs(DAY + 1000), 4)).toBe(5);
  });

  it('resets to 1 after a longer gap', () => {
    expect(calculateStreak(agoMs(3 * DAY), 9)).toBe(1);
  });

  /**
   * Documents a real quirk rather than an intention: the comparison is elapsed
   * milliseconds, not calendar days. A student who plays at 9pm and again at 9am
   * the next morning is 12 hours apart, so the streak does not advance.
   */
  it('measures elapsed time, not calendar days', () => {
    expect(calculateStreak(agoMs(12 * 60 * 60 * 1000), 4)).toBe(4);
  });
});

// ── seedLessons ───────────────────────────────────────────────────────────────

describe('seedLessons', () => {

  it('loads the bundled lessons on first launch', async () => {
    expect(await hasPreloadedLessons()).toBe(false);
    await seedLessons();

    expect(await db.lessons.count()).toBeGreaterThan(0);
    expect(await hasPreloadedLessons()).toBe(true);
  });

  /**
   * It runs on every boot, so this is the difference between a stable library and
   * one that grows by ten lessons every time the student opens the app.
   */
  it('adds nothing on a second call', async () => {
    await seedLessons();
    const afterFirst = await db.lessons.count();

    await seedLessons();

    expect(await db.lessons.count()).toBe(afterFirst);
  });

  it('marks everything it seeds as preloaded', async () => {
    await seedLessons();
    const lessons = await db.lessons.toArray();

    expect(lessons.every(l => l.isPreloaded)).toBe(true);
    expect(await countGeneratedLessons('math', 7)).toBe(0);
  });
});
