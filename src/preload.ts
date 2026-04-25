// src/preload.ts
// Runs once on first app launch when online.
// Loads lessons from local JSON files and stores them in IndexedDB.

import { hasPreloadedLessons, bulkSaveLessons } from './db';
import type { Lesson, Subject, Grade, Language } from './types';

const LESSON_FILES = [
  'ela-context-clues-grade6.json',
  'ela-essay-structure-grade8.json',
  'ela-figurative-language-grade8.json',
  'ela-main-idea-grade6.json',
  'ela-summarizing-grade7.json',
  'math-decimals-grade6.json',
  'math-fractions-grade7.json',
  'math-geometry-grade7.json',
  'math-prealgebra-grade8.json',
  'math-word-problems-grade8.json',
];

async function loadLessonFromFile(filename: string): Promise<Omit<Lesson, 'id'> | null> {
  try {
    const res = await fetch(`/lessons/${filename}`);
    if (!res.ok) return null;
    const data = await res.json();
    return {
      ...data,
      createdAt: new Date().toISOString(),
      isPreloaded: true,
    };
  } catch (err) {
    console.error(`Failed to load ${filename}:`, err);
    return null;
  }
}

export async function preloadLessons(
  onProgress?: (current: number, total: number) => void
): Promise<void> {
  if (await hasPreloadedLessons()) return;

  const total = LESSON_FILES.length;
  const lessons: Omit<Lesson, 'id'>[] = [];

  for (let i = 0; i < total; i++) {
    const lesson = await loadLessonFromFile(LESSON_FILES[i]);
    if (lesson) {
      lessons.push(lesson);
    }
    onProgress?.(i + 1, total);
  }

  if (lessons.length > 0) {
    await bulkSaveLessons(lessons);
    console.log(`[Preload] Saved ${lessons.length} lessons to local database.`);
  }
}