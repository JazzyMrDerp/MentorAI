import type { Lesson, Question, Subject } from '../types';
import { db, getLesson, markQuestionAnswered, updateProfile, getProfile, saveProgress } from '../db';
import confetti from 'canvas-confetti';

export interface QuizScreenState {
  lesson: Lesson;
  currentIndex: number;
  answers: (number | null)[];
  hintsUsed: number;
  startTime: number;
}

let quizState: QuizScreenState | null = null;
let currentNickname = '';

export async function initQuizScreen(lessonId: number, nickname: string): Promise<Lesson | null> {
  currentNickname = nickname;
  const lesson = await getLesson(lessonId);
  
  if (!lesson) return null;
  
  quizState = {
    lesson,
    currentIndex: 0,
    answers: new Array(lesson.questions.length).fill(null),
    hintsUsed: 0,
    startTime: Date.now(),
  };
  
  return lesson;
}

export function getCurrentQuestion(): Question | null {
  if (!quizState) return null;
  return quizState.lesson.questions[quizState.currentIndex];
}

export function getQuestionNumber(): number {
  return quizState ? quizState.currentIndex + 1 : 0;
}

export function getTotalQuestions(): number {
  return quizState?.lesson.questions.length || 0;
}

export function isLastQuestion(): boolean {
  if (!quizState) return true;
  return quizState.currentIndex === quizState.lesson.questions.length - 1;
}

function calculateXP(difficulty: number): number {
  return difficulty * 10;
}

async function handleAnswer(selectedIndex: number): Promise<{ correct: boolean; xp: number; hint?: string }> {
  if (!quizState) throw new Error('No active quiz');
  
  const question = quizState.lesson.questions[quizState.currentIndex];
  const isCorrect = selectedIndex === question.correctIndex;
  const xpEarned = isCorrect ? calculateXP(question.difficulty || 1) : 0;
  
  quizState.answers[quizState.currentIndex] = selectedIndex;
  
  await markQuestionAnswered(
    quizState.lesson.id!,
    quizState.currentIndex,
    isCorrect
  );
  
  if (isCorrect) {
    const profile = await getProfile(currentNickname);
    if (profile) {
      const newXP = profile.totalXP + xpEarned;
      await updateProfile(currentNickname, { totalXP: newXP });
    }
  }
  
  return { correct: isCorrect, xp: xpEarned, hint: isCorrect ? undefined : question.hint };
}

export async function submitAnswer(selectedIndex: number): Promise<{
  correct: boolean;
  xp: number;
  hint?: string;
  isLast: boolean;
}> {
  const result = await handleAnswer(selectedIndex);
  return { ...result, isLast: isLastQuestion() };
}

function getScore(): number {
  if (!quizState) return 0;
  
  let correct = 0;
  for (let i = 0; i < quizState.lesson.questions.length; i++) {
    const question = quizState.lesson.questions[i];
    if (quizState.answers[i] === question.correctIndex) {
      correct++;
    }
  }
  
  return Math.round((correct / quizState.lesson.questions.length) * 100);
}

function getMissedQuestions(): { index: number; prompt: string; correctAnswer: string }[] {
  if (!quizState) return [];
  
  return quizState.lesson.questions
    .map((q, i) => ({
      index: i,
      prompt: q.prompt,
      correctAnswer: q.choices[q.correctIndex],
    }))
    .filter((q, i) => quizState!.answers[i] !== q.correctIndex);
}

export async function endQuiz(): Promise<{ score: number; xpTotal: number; missed: { index: number; prompt: string; correctAnswer: string }[] }> {
  if (!quizState) throw new Error('No active quiz');
  
  const score = getScore();
  const missed = getMissedQuestions();
  const allCorrect = missed.length === 0;
  
  let xpTotal = 0;
  if (allCorrect) {
    xpTotal = 50;
  } else if (score >= 80) {
    xpTotal = 40;
  } else if (score >= 60) {
    xpTotal = 25;
  } else {
    xpTotal = 10;
  }
  
  await saveProgress({
    nickname: currentNickname,
    lessonId: quizState.lesson.id!,
    lessonTitle: quizState.lesson.title,
    subject: quizState.lesson.subject as Subject,
    score,
    xpEarned: xpTotal,
    attempts: 1,
    hintsUsed: quizState.hintsUsed,
    completedAt: new Date().toISOString(),
  });
  
  const result = { score, xpTotal, missed };
  quizState = null;
  
  return result;
}

export function triggerQuizConfetti(): void {
  confetti({
    particleCount: 150,
    spread: 70,
    origin: { y: 0.6 },
    colors: ['#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899'],
  });
}

export function renderQuizScreen(container: HTMLElement): void {
  if (!quizState) return;
  
  const question = getCurrentQuestion();
  if (!question) return;
  
  const qNum = getQuestionNumber();
  const total = getTotalQuestions();
  const last = isLastQuestion();
  
  container.innerHTML = `
    <div class="quiz-screen">
      <header class="quiz-header">
        <button class="btn-back-quiz" data-action="back">← Back</button>
        <h2 class="quiz-title">${quizState.lesson.title}</h2>
        <div class="question-counter">${qNum}/${total}</div>
      </header>
      
      <div class="progress-dots-quiz">
        ${quizState.lesson.questions.map((_, i) => {
          let cls = 'dot-quiz';
          if (i < qNum - 1) cls += ' completed';
          else if (i === qNum - 1) cls += ' current';
          return `<span class="${cls}"></span>`;
        }).join('')}
      </div>
      
      <div class="question-box">
        <p class="question-text">${question.prompt}</p>
        
        <div class="choices-quiz">
          ${question.choices.map((choice, i) => `
            <button class="choice-btn-quiz" data-index="${i}">${choice}</button>
          `).join('')}
        </div>
        
        <button class="btn-hint-quiz" id="hint-btn-quiz">💡 Use Hint</button>
      </div>
      
      <div class="quiz-nav">
        <button class="btn-nav-quiz prev" id="prev-btn-quiz" ${qNum === 1 ? 'disabled' : ''}>← Previous</button>
        <button class="btn-nav-quiz next" id="next-btn-quiz">${last ? 'Finish' : 'Next →'}</button>
      </div>
    </div>
  `;
}

export function renderQuizResults(container: HTMLElement, score: number, xpEarned: number, missed: { index: number; prompt: string; correctAnswer: string }[]): void {
  const allCorrect = missed.length === 0;
  const passed = score >= 60;
  
  if (allCorrect) {
    triggerQuizConfetti();
  }
  
  container.innerHTML = `
    <div class="results-screen">
      <div class="results-content">
        <div class="results-emoji">${allCorrect ? '🏆' : passed ? '🎉' : '💪'}</div>
        <h1 class="results-title">
          ${allCorrect ? 'Lesson Mastered!' : passed ? 'Great job!' : 'Keep practicing!'}
        </h1>
        
        <div class="score-display">
          <p class="score">${score}%</p>
          <p class="score-label">Quiz Score</p>
        </div>
        
        <div class="xp-earned">
          <p class="xp-gained">+${xpEarned} XP</p>
        </div>
        
        ${!allCorrect && missed.length > 0 ? `
          <div class="missed-questions">
            <h3>Questions to review:</h3>
            <ul class="missed-list">
              ${missed.map(m => `
                <li class="missed-item">
                  <p class="missed-prompt">${m.prompt}</p>
                  <p class="missed-answer">✓ ${m.correctAnswer}</p>
                </li>
              `).join('')}
            </ul>
          </div>
        ` : ''}
        
        <button class="btn-primary" data-action="continue">Continue</button>
      </div>
    </div>
  `;
}

export async function handleChoiceClick(index: number): Promise<{ correct: boolean; xp: number; hint?: string }> {
  return submitAnswer(index);
}

export function getCurrentAnswer(): number | null {
  return quizState?.answers[quizState.currentIndex] ?? null;
}