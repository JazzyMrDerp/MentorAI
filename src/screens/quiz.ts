import type { Lesson, Question, Progress, Subject } from '../types';
import { saveProgress } from '../db';

export interface QuizState {
  lesson: Lesson;
  currentQuestionIndex: number;
  answers: (number | null)[];
  hintsUsed: number;
  startTime: number;
  hintsRemaining: number;
}

let currentQuiz: QuizState | null = null;

export function getHintTokenCount(profile: { hintsRemaining: number }): number {
  return profile.hintsRemaining || 0;
}

export async function startQuiz(lesson: Lesson, profile: { hintsRemaining: number }): Promise<QuizState> {
  currentQuiz = {
    lesson,
    currentQuestionIndex: 0,
    answers: new Array(lesson.questions.length).fill(null),
    hintsUsed: 0,
    startTime: Date.now(),
    hintsRemaining: profile.hintsRemaining,
  };
  return currentQuiz;
}

export function getCurrentQuestion(): Question | null {
  if (!currentQuiz) return null;
  return currentQuiz.lesson.questions[currentQuiz.currentQuestionIndex];
}

export function getCurrentQuestionIndex(): number {
  if (!currentQuiz) return 0;
  return currentQuiz.currentQuestionIndex;
}

export function getTotalQuestions(): number {
  if (!currentQuiz) return 0;
  return currentQuiz.lesson.questions.length;
}

export function selectAnswer(answerIndex: number): void {
  if (!currentQuiz) return;
  currentQuiz.answers[currentQuiz.currentQuestionIndex] = answerIndex;
}

export function getSelectedAnswer(): number | null {
  if (!currentQuiz) return null;
  return currentQuiz.answers[currentQuiz.currentQuestionIndex];
}

export function getHint(): string | null {
  if (!currentQuiz) return null;
  const question = getCurrentQuestion();
  return question?.hint || null;
}

export function useHint(): boolean {
  if (!currentQuiz) return false;
  if (currentQuiz.hintsRemaining <= 0) return false;
  if (currentQuiz.hintsUsed >= 1) return false;
  
  currentQuiz.hintsUsed++;
  currentQuiz.hintsRemaining--;
  return true;
}

export function goToNextQuestion(): boolean {
  if (!currentQuiz) return false;
  if (!hasAnsweredCurrent()) return false;
  if (currentQuiz.currentQuestionIndex >= currentQuiz.lesson.questions.length - 1) {
    return false;
  }
  currentQuiz.currentQuestionIndex++;
  return true;
}

export function goToPreviousQuestion(): boolean {
  if (!currentQuiz) return false;
  if (currentQuiz.currentQuestionIndex <= 0) return false;
  currentQuiz.currentQuestionIndex--;
  return true;
}

export function hasAnsweredCurrent(): boolean {
  if (!currentQuiz) return false;
  return currentQuiz.answers[currentQuiz.currentQuestionIndex] !== null;
}

export function allQuestionsAnswered(): boolean {
  if (!currentQuiz) return false;
  return currentQuiz.answers.every(a => a !== null);
}

export function calculateScore(): number {
  if (!currentQuiz) return 0;
  
  let correct = 0;
  for (let i = 0; i < currentQuiz.lesson.questions.length; i++) {
    const question = currentQuiz.lesson.questions[i];
    if (currentQuiz.answers[i] === question.correctIndex) {
      correct++;
    }
  }
  
  return Math.round((correct / currentQuiz.lesson.questions.length) * 100);
}

export function calculateXP(score: number): number {
  if (score >= 100) return 50;
  if (score >= 80) return 40;
  if (score >= 60) return 25;
  if (score >= 40) return 15;
  return 10;
}

export async function submitQuiz(
  nickname: string,
  lessonTitle: string,
  subject: Subject
): Promise<{ score: number; xpEarned: number; hintsUsed: number }> {
  if (!currentQuiz) throw new Error('No active quiz');
  
  const score = calculateScore();
  const xpEarned = calculateXP(score);
  const attempts = 1;
  const hintsUsed = currentQuiz.hintsUsed;
  
  const progress: Omit<Progress, 'id'> = {
    nickname,
    lessonId: currentQuiz.lesson.id,
    lessonTitle,
    subject,
    score,
    xpEarned,
    attempts,
    hintsUsed,
    completedAt: new Date().toISOString(),
  };
  
  await saveProgress(progress);
  
  currentQuiz = null;
  
  return { score, xpEarned, hintsUsed };
}

export function getQuizProgress(): QuizState | null {
  return currentQuiz;
}

export function getQuestionProgress(): { current: number; total: number; answered: number } {
  if (!currentQuiz) return { current: 0, total: 0, answered: 0 };
  return {
    current: currentQuiz.currentQuestionIndex + 1,
    total: currentQuiz.lesson.questions.length,
    answered: currentQuiz.answers.filter(a => a !== null).length,
  };
}