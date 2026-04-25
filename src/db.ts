// db.ts
// Local IndexedDB database using Dexie.js.
// All data lives on the student's device — no server, fully offline.
// Import query functions from here instead of touching `db` directly.

import Dexie, { type EntityTable } from 'dexie';
import type { Lesson, Progress, StudentProfile, SyncQueueItem, Subject, Grade, Language } from './types';

// ── Database Setup ────────────────────────────────────────────────────────────

// Create the Dexie instance typed with our four tables.
// EntityTable<T, 'id'> tells Dexie that 'id' is the primary key for each table.
const db = new Dexie('MentorAIDB') as Dexie & {
  lessons:        EntityTable<Lesson,         'id'>;
  progress:       EntityTable<Progress,       'id'>;
  studentProfile: EntityTable<StudentProfile, 'id'>;
  syncQueue:      EntityTable<SyncQueueItem,  'id'>;
};

// Schema definition — only fields listed here are searchable/filterable.
// '++id' means auto-increment primary key (never set manually).
// Other listed fields become indexes so .where() queries work on them.
db.version(1).stores({
  lessons:        '++id, subject, grade, language, isPreloaded',
  progress:       '++id, nickname, lessonId, subject, completedAt',
  studentProfile: '++id, nickname',
  syncQueue:      '++id, type, timestamp',
});

export { db };

// ── Lessons ───────────────────────────────────────────────────────────────────

/**
 * Fetch all lessons matching a specific grade, subject, and language.
 * Used by Person 2's lesson screen to load available content offline.
 */
export async function getLessons(
  grade: Grade,
  subject: Subject,
  language: Language
): Promise<Lesson[]> {
  return db.lessons.where({ grade, subject, language }).toArray();
}

/**
 * Save a single Gemini-generated lesson to the local database.
 * Returns the auto-assigned numeric id of the new record.
 */
export async function saveLesson(lesson: Omit<Lesson, 'id'>): Promise<number> {
  return db.lessons.add(lesson as Lesson);
}

/**
 * Save multiple lessons at once — used on first launch to bulk-load
 * all pre-written lesson JSON files into the database in one operation.
 */
export async function bulkSaveLessons(lessons: Omit<Lesson, 'id'>[]): Promise<void> {
  await db.lessons.bulkAdd(lessons as Lesson[]);
}

/**
 * Returns true if pre-written lessons have already been loaded.
 * Called on startup to avoid re-inserting the same lessons every time.
 */
export async function hasPreloadedLessons(): Promise<boolean> {
  const count = await db.lessons.filter(l => l.isPreloaded === true).count();
  return count > 0;
}

// ── Progress ──────────────────────────────────────────────────────────────────

/**
 * Save a completed quiz attempt.
 * Called by Person 3's quiz engine immediately after the student finishes.
 * Works 100% offline — data stays local until sync runs.
 */
export async function saveProgress(progress: Omit<Progress, 'id'>): Promise<number> {
  return db.progress.add(progress as Progress);
}

/**
 * Get all quiz attempts for a student, newest first.
 * Used by Person 3's teacher dashboard to show recent activity.
 */
export async function getProgressForStudent(nickname: string): Promise<Progress[]> {
  return db.progress.where('nickname').equals(nickname).reverse().toArray();
}

/**
 * Get quiz attempts for a student filtered by subject (math or ela).
 * Used to show per-subject performance breakdowns on the dashboard.
 */
export async function getProgressBySubject(
  nickname: string,
  subject: Subject
): Promise<Progress[]> {
  return db.progress
    .where('nickname').equals(nickname)
    .filter(p => p.subject === subject)
    .toArray();
}

// ── Student Profile ───────────────────────────────────────────────────────────

/**
 * Load a student's profile by nickname.
 * Returns undefined if no profile exists yet (first launch).
 */
export async function getProfile(nickname: string): Promise<StudentProfile | undefined> {
  return db.studentProfile.where('nickname').equals(nickname).first();
}

/**
 * Create a brand new student profile on first launch.
 * Called after the student picks their nickname and grade.
 */
export async function createProfile(
  profile: Omit<StudentProfile, 'id'>
): Promise<number> {
  return db.studentProfile.add(profile as StudentProfile);
}

/**
 * Update specific fields on a student's profile.
 * Person 3 calls this after every quiz to update XP, level, and streak.
 * Pass only the fields you want to change — other fields stay untouched.
 *
 * Example: updateProfile('StarCoder99', { totalXP: 450, currentLevel: 3 })
 */
export async function updateProfile(
  nickname: string,
  updates: Partial<StudentProfile>
): Promise<void> {
  const profile = await getProfile(nickname);
  if (!profile) return;
  await db.studentProfile.update(profile.id as number, updates);
}

// ── Sync Queue ────────────────────────────────────────────────────────────────

/**
 * Add a Gemini API call to the queue when the device is offline.
 * The sync engine in utils/offline.ts will process this when WiFi returns.
 *
 * Example: addToSyncQueue('generate_lesson', { subject: 'math', grade: 7, ... })
 */
export async function addToSyncQueue(
  type: SyncQueueItem['type'],
  payload: Record<string, unknown>
): Promise<void> {
  await db.syncQueue.add({ type, payload, timestamp: Date.now(), retries: 0 } as SyncQueueItem);
}

/**
 * Get all unprocessed sync items, oldest first.
 * Called by utils/offline.ts when the device comes back online.
 */
export async function getPendingSyncItems(): Promise<SyncQueueItem[]> {
  return db.syncQueue.orderBy('timestamp').toArray();
}

/**
 * Remove a sync item after it has been successfully processed.
 * Called by the sync engine in utils/offline.ts after each successful Gemini call.
 */
export async function clearSyncItem(id: number): Promise<void> {
  await db.syncQueue.delete(id);
}

/**
 * Increment the retry count on a failed sync item.
 * The sync engine skips items that have failed 3+ times to avoid infinite loops.
 */
export async function incrementSyncRetry(id: number): Promise<void> {
  const item = await db.syncQueue.get(id);
  if (!item) return;
  await db.syncQueue.update(item.id as number, { retries: (item.retries ?? 0) + 1 });
}

/**
 * Wipe the entire sync queue.
 * Only used after a successful full sync where everything was processed.
 */
export async function clearAllSyncItems(): Promise<void> {
  await db.syncQueue.clear();
}

export default db;