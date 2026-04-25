// src/preload.ts
// Runs once on first app launch when online.
// Pre-generates lessons via Gemini and stores them offline for later use.

import { hasPreloadedLessons, bulkSaveLessons } from './db';
import { generateLesson } from './gemini';
import type { Lesson, Subject, Grade, Language } from './types';

// Topics to generate on first launch — covers both languages
const LESSON_TOPICS: { subject: Subject; grade: Grade; topic: string; language: Language }[] = [
  { subject: 'math', grade: 6, topic: 'adding and subtracting fractions',    language: 'en' },
  { subject: 'math', grade: 6, topic: 'multiplicación de fracciones',        language: 'es' },
  { subject: 'math', grade: 7, topic: 'solving one-step equations',          language: 'en' },
  { subject: 'math', grade: 7, topic: 'ecuaciones de un paso',               language: 'es' },
  { subject: 'math', grade: 8, topic: 'slope and linear equations',          language: 'en' },
  { subject: 'ela',  grade: 6, topic: 'identifying main idea and details',   language: 'en' },
  { subject: 'ela',  grade: 6, topic: 'idea principal y detalles',           language: 'es' },
  { subject: 'ela',  grade: 7, topic: 'figurative language and metaphors',   language: 'en' },
  { subject: 'ela',  grade: 7, topic: 'lenguaje figurativo y metáforas',     language: 'es' },
  { subject: 'ela',  grade: 8, topic: 'analyzing argumentative writing',     language: 'en' },
];

/**
 * Called once from main.ts on first launch when online.
 * Generates all lessons via Gemini and saves them to IndexedDB.
 * Skips silently if lessons already exist.
 */
export async function preloadLessons(
  onProgress?: (current: number, total: number) => void
): Promise<void> {
  if (await hasPreloadedLessons()) return;
  if (!navigator.onLine) return;

  const total = LESSON_TOPICS.length;
  const lessons: Omit<Lesson, 'id'>[] = [];

  for (let i = 0; i < total; i++) {
    const { subject, grade, topic, language } = LESSON_TOPICS[i];

    try {
      const lesson = await generateLesson(subject, grade, topic, language);
      lessons.push({ ...lesson, isPreloaded: true });
      onProgress?.(i + 1, total);
    } catch (err) {
      console.error(`Failed to preload "${topic}":`, err);
    }
  }

  if (lessons.length > 0) {
    await bulkSaveLessons(lessons);
    console.log(`[Preload] Saved ${lessons.length} lessons to local database.`);
  }
}