// src/db.migration.test.ts
// Covers the version(1) -> version(2) upgrade that added the [grade+language]
// compound index.
//
// Deliberately its own file. Vitest gives each test file a fresh module registry
// and a fresh fake-indexeddb, which is the only way to get a database that has
// never been opened at version 2 — db.ts declares both versions, so any file that
// touches `db` first creates it already migrated.
//
// The comment in db.ts says a schema with no migration ever run is a migration
// path nobody has tested. This is that test.
import Dexie from 'dexie';
import { describe, it, expect, beforeAll } from 'vitest';
import { db, getLessonsForGrade, getProfile, getProgressForStudent } from './db';
import type { Question } from './types';

const QUESTION: Question = {
  prompt:       '3 x 4 = ?',
  choices:      ['7', '12', '9', '34'],
  correctIndex: 1,
  hint:         'Add three four times.',
  answered:     true,
  correct:      true,
  difficulty:   2,
};

/** The schema exactly as version 1 shipped it — no compound index. */
const V1_STORES = {
  lessons:        '++id, subject, grade, language, isPreloaded',
  progress:       '++id, nickname, lessonId, subject, completedAt',
  studentProfile: '++id, nickname',
  syncQueue:      '++id, type, timestamp',
};

function lessonRow(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    subject:     'math',
    grade:       7,
    language:    'en',
    title:       'Multiplication',
    content:     'Lesson body.',
    questions:   [QUESTION],
    createdAt:   '2026-04-25T19:00:00.000Z',
    isPreloaded: true,
    ...over,
  };
}

beforeAll(async () => {
  // Build the database the way a pre-upgrade app build left it: version 1, with a
  // student's lessons, profile, progress and a job still sitting in the queue.
  const v1 = new Dexie('MentorAIDB');
  v1.version(1).stores(V1_STORES);
  await v1.open();
  expect(v1.verno).toBe(1);

  await v1.table('lessons').bulkAdd([
    lessonRow(),
    lessonRow({ title: 'Fractions' }),
    lessonRow({ title: 'Main Idea', subject: 'ela' }),
    lessonRow({ title: 'Grade 8 Geometry', grade: 8 }),
  ]);
  await v1.table('studentProfile').add({
    nickname: 'aanya', grade: 7, language: 'en',
    totalXP: 310, mathXP: 300, elaXP: 10, currentLevel: 2,
    streak: 4, lastActive: '2026-08-20T09:00:00.000Z',
  });
  await v1.table('progress').add({
    nickname: 'aanya', lessonId: 1, lessonTitle: 'Multiplication',
    subject: 'math', score: 80, xpEarned: 80, attempts: 5, hintsUsed: 1,
    completedAt: '2026-08-20T09:05:00.000Z',
  });
  await v1.table('syncQueue').add({
    type: 'replace_question',
    payload: { lessonId: 1, questionIndex: 0, subject: 'math', grade: 7, difficulty: 2 },
    timestamp: Date.now(),
    retries: 1,
  });
  v1.close();

  // Opening the app's own instance is what runs the upgrade.
  await db.open();
});

describe('version 1 to version 2 upgrade', () => {

  it('lands on version 2', () => {
    expect(db.verno).toBe(2);
  });

  it('adds the [grade+language] compound index Dexie asked for', () => {
    const names = db.lessons.schema.indexes.map(i => i.name);
    expect(names).toContain('[grade+language]');
  });

  it('keeps the version 1 indexes on the upgraded table', () => {
    const names = db.lessons.schema.indexes.map(i => i.name);
    expect(names).toEqual(expect.arrayContaining(['subject', 'grade', 'language', 'isPreloaded']));
  });

  /**
   * Dexie rebuilds the index from the rows already there. If it did not, the
   * upgrade would silently empty a student's library — the worst outcome
   * available to an app whose pitch is that progress survives.
   */
  it('carries every existing lesson through the rebuild', async () => {
    expect(await db.lessons.count()).toBe(4);
  });

  it('answers the hot query through the new index', async () => {
    const lessons = await getLessonsForGrade(7, 'en');

    expect(lessons).toHaveLength(3);
    expect(lessons.map(l => l.title).sort())
      .toEqual(['Fractions', 'Main Idea', 'Multiplication']);
  });

  it('does not return another grade through it', async () => {
    expect(await getLessonsForGrade(8, 'en')).toHaveLength(1);
  });

  /**
   * Only the lessons table is restated in version 2. The other three carry
   * forward untouched, which is the part of a Dexie upgrade that is easy to
   * assume and expensive to get wrong.
   */
  it('leaves the three untouched tables intact', async () => {
    expect((await getProfile('aanya'))!.totalXP).toBe(310);
    expect(await getProgressForStudent('aanya')).toHaveLength(1);
    expect(await db.syncQueue.count()).toBe(1);
  });

  it('preserves the retry count on a job queued before the upgrade', async () => {
    const item = await db.syncQueue.toCollection().first();
    expect(item!.retries).toBe(1);
    expect(item!.type).toBe('replace_question');
  });
});
