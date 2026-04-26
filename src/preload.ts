// src/preload.ts
import { bulkSaveLessons } from './db';
import { generateLesson } from './gemini';
import { db } from './db';
import type { Lesson, Subject, Grade, Language } from './types';

const BUNDLED_LESSON_COUNT = 10;
const CALL_DELAY_MS = 600;

const GEMINI_TOPICS: { subject: Subject; grade: Grade; topic: string; language: Language }[] = [
  { subject: 'math', grade: 6, topic: 'multiplying and dividing fractions', language: 'en' },
  { subject: 'math', grade: 7, topic: 'solving two-step equations',         language: 'en' },
  { subject: 'math', grade: 7, topic: 'inequalities and number lines',      language: 'en' },
  { subject: 'math', grade: 8, topic: 'the Pythagorean theorem',            language: 'en' },
  { subject: 'math', grade: 8, topic: 'systems of equations',               language: 'en' },
  { subject: 'ela',  grade: 6, topic: 'comparing and contrasting texts',    language: 'en' },
  { subject: 'ela',  grade: 6, topic: 'context clues and vocabulary',       language: 'en' },
  { subject: 'ela',  grade: 7, topic: 'point of view and author purpose',   language: 'en' },
  { subject: 'ela',  grade: 7, topic: 'text structure and organization',    language: 'en' },
  { subject: 'ela',  grade: 8, topic: 'evaluating evidence in arguments',   language: 'en' },
];

export async function preloadLessons(
  onProgress?: (current: number, total: number) => void
): Promise<void> {
  const existingCount = await db.lessons.count();
  if (existingCount > BUNDLED_LESSON_COUNT) {
    console.log('[Preload] Gemini lessons already exist — skipping.');
    return;
  }

  if (!navigator.onLine) {
    console.log('[Preload] Offline — skipping Gemini preload. Bundled lessons available.');
    return;
  }

  const total = GEMINI_TOPICS.length;
  const generated: Omit<Lesson, 'id'>[] = [];

  console.log(`[Preload] Generating ${total} Gemini lessons...`);

  for (let i = 0; i < total; i++) {
    const { subject, grade, topic, language } = GEMINI_TOPICS[i];

    if (!navigator.onLine) {
      console.warn('[Preload] Lost connection mid-preload — saving partial results.');
      break;
    }

    try {
      const lesson = await generateLesson(subject, grade, topic, language);
      generated.push({ ...lesson, isPreloaded: true });
      onProgress?.(i + 1, total);
      console.log(`[Preload] ✓ "${topic}"`);
    } catch (err) {
      console.error(`[Preload] ✗ Failed "${topic}":`, err);
      onProgress?.(i + 1, total);
    }

    if (i < total - 1) await delay(CALL_DELAY_MS);
  }

  if (generated.length > 0) {
    await bulkSaveLessons(generated);
    console.log(`[Preload] Saved ${generated.length}/${total} Gemini lessons to DB.`);
  }
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}