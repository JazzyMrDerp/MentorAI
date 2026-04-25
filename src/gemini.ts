// src/gemini.ts
// All communication with the Google Gemini API lives here.
// Every function checks navigator.onLine before calling — 
// callers should queue via addToSyncQueue() if offline.

import type { Lesson, GeminiLessonResponse, Subject, Grade, Language } from './types';

const API_KEY = import.meta.env.VITE_GEMINI_KEY as string;
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`;
// ── Core Fetch ────────────────────────────────────────────────────────────────

/**
 * Base function that sends a prompt to Gemini and returns the text response.
 * All other functions in this file call this one.
 */
async function callGemini(prompt: string): Promise<string> {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }]
    })
  });

  if (!res.ok) throw new Error(`Gemini API error: ${res.status}`);

  const data = await res.json();
  return data.candidates[0].content.parts[0].text as string;
}

// ── Lesson Generation ─────────────────────────────────────────────────────────

/**
 * Ask Gemini to generate a full lesson for a given topic.
 * Returns a Lesson object ready to be saved directly into IndexedDB via saveLesson().
 *
 * Example: generateLesson('math', 7, 'solving one-step equations', 'en')
 */
export async function generateLesson(
  subject: Subject,
  grade: Grade,
  topic: string,
  language: Language
): Promise<Omit<Lesson, 'id'>> {
  const lang = language === 'es' ? 'Spanish' : 'English';

  const prompt = `
    You are creating educational content for a grade ${grade} student.
    Subject: ${subject === 'ela' ? 'English Language Arts' : 'Math'}
    Topic: "${topic}"
    Language: ${lang}

    Respond ONLY with valid JSON in exactly this shape:
    {
      "title": "short lesson title",
      "content": "2-3 paragraphs of lesson explanation, age-appropriate for grade ${grade}",
      "questions": [
        {
          "prompt": "question text",
          "choices": ["option A", "option B", "option C", "option D"],
          "correctIndex": 0,
          "hint": "one sentence hint"
        }
      ]
    }

    Rules:
    - Write exactly 5 questions
    - Keep language simple and engaging for middle school
    - correctIndex must be 0, 1, 2, or 3
    - Do not include any text outside the JSON
  `;

  const raw = await callGemini(prompt);

  // Strip markdown code fences if Gemini wraps the JSON in them
  const cleaned = raw.replace(/```json|```/g, '').trim();
  const parsed = JSON.parse(cleaned) as GeminiLessonResponse;

  return {
    subject,
    grade,
    language,
    title:       parsed.title,
    content:     parsed.content,
    questions:   parsed.questions,
    createdAt:   new Date().toISOString(),
    isPreloaded: false,
  };
}

// ── AI Tutor ──────────────────────────────────────────────────────────────────

/**
 * Get a tutor response from Gemini for a student's question.
 * Called by Person 2's lesson screen chat box.
 * Returns a friendly offline message if the device has no internet.
 */
export async function getTutorResponse(
  studentQuestion: string,
  lessonContext: string,
  grade: Grade,
  language: Language
): Promise<string> {
  if (!navigator.onLine) {
    return language === 'es'
      ? 'Sin conexión ahora mismo. ¡Intenta de nuevo cuando tengas internet! 🔌'
      : 'No internet right now — ask me again when you\'re connected! 🔌';
  }

  const lang = language === 'es' ? 'Spanish' : 'English';

  const prompt = `
    You are MentorAI, a helpful and encouraging tutor for a grade ${grade} student.
    Respond in ${lang}.
    Current lesson context: ${lessonContext}
    Student question: "${studentQuestion}"

    Rules:
    - Answer in 2-3 short sentences max
    - Use simple, clear language appropriate for grade ${grade}
    - Be encouraging and direct — like a smart older sibling, not a textbook
    - End with one actionable tip or follow-up thought
  `;

  return await callGemini(prompt);
}

// ── Progress Report ───────────────────────────────────────────────────────────

/**
 * Ask Gemini to write a plain-English progress report for a teacher or parent.
 * Called by utils/offline.ts sync engine when the device reconnects.
 *
 * @param nickname   - Student's chosen nickname
 * @param scores     - Array of recent quiz results with lesson title and score
 */
export async function generateProgressReport(
  nickname: string,
  scores: { lessonTitle: string; score: number; subject: Subject }[]
): Promise<string> {
  const scoreList = scores
    .map(s => `- ${s.lessonTitle} (${s.subject}): ${s.score}%`)
    .join('\n');

  const prompt = `
    Write a short teacher progress report (3-4 sentences) for a student nicknamed "${nickname}".

    Recent quiz scores:
    ${scoreList}

    Rules:
    - Highlight one specific strength based on the scores
    - Identify one specific area to improve
    - Suggest one concrete activity or focus for next session
    - Write in a warm, professional tone like a real teacher's note
    - Do NOT use the word "student" — use "${nickname}" instead
    - Keep it under 80 words
  `;

  return await callGemini(prompt);
}

// ── Writing Feedback ──────────────────────────────────────────────────────────

/**
 * Get Gemini to review a student's short written answer.
 * Called by Person 3's quiz engine for open-ended ELA questions.
 */
export async function getWritingFeedback(
  question: string,
  studentAnswer: string,
  grade: Grade,
  language: Language
): Promise<string> {
  if (!navigator.onLine) {
    return language === 'es'
      ? '¡Sin conexión! Tu respuesta fue guardada. 📝'
      : 'Offline! Your answer was saved — feedback coming when you reconnect. 📝';
  }

  const lang = language === 'es' ? 'Spanish' : 'English';

  const prompt = `
    You are reviewing a grade ${grade} student's written answer. Respond in ${lang}.
    Question: "${question}"
    Student's answer: "${studentAnswer}"

    Give exactly 2 pieces of feedback:
    1. One specific thing they did well
    2. One specific thing to improve

    Keep each point to one sentence. Be encouraging and specific.
  `;

  return await callGemini(prompt);
}