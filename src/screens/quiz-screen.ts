import type { Lesson, Question, Subject } from '../types';
import { getLesson, getLessonsBySubject, markQuestionAnswered, updateProfile, getProfile, saveProgress } from '../db';
import confetti from 'canvas-confetti';

export interface QuizScreenState {
  lesson: Lesson;
  currentIndex: number;
  answers: (number | null)[];
  hintsUsed: number;
  startTime: number;
}

export interface BossModeState {
  questions: { lessonId: number; lessonTitle: string; question: Question; questionIndex: number }[];
  currentIndex: number;
  answers: (number | null)[];
  missed: { lessonTitle: string; prompt: string; correctAnswer: string }[];
  startTime: number;
  timerInterval: ReturnType<typeof setInterval> | null;
  timeRemaining: number;
}

let quizState: QuizScreenState | null = null;
let bossState: BossModeState | null = null;
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
  if (bossState) {
    return bossState.questions[bossState.currentIndex]?.question ?? null;
  }
  if (!quizState) return null;
  return quizState.lesson.questions[quizState.currentIndex];
}

export function getQuestionNumber(): number {
  if (bossState) return bossState.currentIndex + 1;
  return quizState ? quizState.currentIndex + 1 : 0;
}

export function getTotalQuestions(): number {
  if (bossState) return bossState.questions.length;
  return quizState?.lesson.questions.length || 0;
}

export function isLastQuestion(): boolean {
  if (bossState) return bossState.currentIndex === bossState.questions.length - 1;
  if (!quizState) return true;
  return quizState.currentIndex === quizState.lesson.questions.length - 1;
}

export function isBossMode(): boolean {
  return bossState !== null;
}

function calculateXP(difficulty: number): number {
  return difficulty * 10;
}

async function handleAnswer(selectedIndex: number): Promise<{ correct: boolean; xp: number; hint?: string }> {
  if (!quizState && !bossState) throw new Error('No active quiz');
  
  if (bossState) {
    return handleBossAnswer(selectedIndex);
  }
  
  const question = quizState!.lesson.questions[quizState!.currentIndex];
  const isCorrect = selectedIndex === question.correctIndex;
  const xpEarned = isCorrect ? calculateXP(question.difficulty || 1) : 0;
  
  quizState!.answers[quizState!.currentIndex] = selectedIndex;
  
  await markQuestionAnswered(
    quizState!.lesson.id!,
    quizState!.currentIndex,
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

async function handleBossAnswer(selectedIndex: number): Promise<{ correct: boolean; xp: number; hint?: string }> {
  if (!bossState) throw new Error('No active boss quiz');
  
  const currentQ = bossState.questions[bossState.currentIndex];
  const question = currentQ.question;
  const isCorrect = selectedIndex === question.correctIndex;
  
  bossState.answers[bossState.currentIndex] = selectedIndex;
  
  await markQuestionAnswered(
    currentQ.lessonId,
    currentQ.questionIndex,
    isCorrect
  );
  
  if (!isCorrect) {
    bossState.missed.push({
      lessonTitle: currentQ.lessonTitle,
      prompt: question.prompt,
      correctAnswer: question.choices[question.correctIndex],
    });
  }
  
  return { correct: isCorrect, xp: 0, hint: undefined };
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
      correctIndex: q.correctIndex,
    }))
    .filter((q, i) => quizState!.answers[i] !== q.correctIndex)
    .map(({ index, prompt, correctAnswer }) => ({ index, prompt, correctAnswer }));
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

// ==================== BOSS MODE ====================

export async function initBossMode(subject: Subject, nickname: string): Promise<boolean> {
  currentNickname = nickname;
  
  if (bossState && bossState.timerInterval) {
    clearInterval(bossState.timerInterval);
  }
  bossState = null;
  
  if (quizState) {
    quizState = null;
  }
  
  const lessons = await getLessonsBySubject(subject);
  
  if (lessons.length === 0) return false;
  
  const allQuestions: { lessonId: number; lessonTitle: string; question: Question; questionIndex: number }[] = [];
  
  for (const lesson of lessons) {
    if (!lesson.questions) continue;
    
    for (let i = 0; i < lesson.questions.length; i++) {
      const q = lesson.questions[i];
      if (!q.answered || !q.correct) {
        allQuestions.push({
          lessonId: lesson.id!,
          lessonTitle: lesson.title,
          question: { ...q, answered: false, correct: undefined },
          questionIndex: i,
        });
      }
    }
  }
  
  if (allQuestions.length === 0) {
    for (const lesson of lessons) {
      if (!lesson.questions) continue;
      for (let i = 0; i < lesson.questions.length; i++) {
        allQuestions.push({
          lessonId: lesson.id!,
          lessonTitle: lesson.title,
          question: { ...lesson.questions[i], answered: false, correct: undefined },
          questionIndex: i,
        });
      }
    }
  }
  
  if (allQuestions.length === 0) return false;
  
  bossState = {
    questions: allQuestions,
    currentIndex: 0,
    answers: new Array(allQuestions.length).fill(null),
    missed: [],
    startTime: Date.now(),
    timerInterval: null,
    timeRemaining: 60,
  };
  
  return true;
}

export function startBossTimer(onTimeout: () => void): void {
  if (!bossState) return;
  
  bossState.timeRemaining = 60;
  
  bossState.timerInterval = setInterval(() => {
    if (!bossState) return;
    
    bossState.timeRemaining--;
    
    const timerEl = document.getElementById('boss-timer');
    if (timerEl) {
      timerEl.textContent = formatTime(bossState.timeRemaining);
      if (bossState.timeRemaining <= 10) {
        timerEl.classList.add('danger');
      } else {
        timerEl.classList.remove('danger');
      }
    }
    
    if (bossState.timeRemaining <= 0) {
      if (bossState.timerInterval) {
        clearInterval(bossState.timerInterval);
        bossState.timerInterval = null;
      }
      onTimeout();
    }
  }, 1000);
}

export function stopBossTimer(): void {
  if (bossState && bossState.timerInterval) {
    clearInterval(bossState.timerInterval);
    bossState.timerInterval = null;
  }
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return mins > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `${secs}`;
}

export async function submitBossAnswer(selectedIndex: number): Promise<{
  correct: boolean;
  isLast: boolean;
}> {
  stopBossTimer();
  
  const result = await handleAnswer(selectedIndex);
  return { correct: result.correct, isLast: isLastQuestion() };
}

export async function handleBossTimeout(): Promise<void> {
  if (!bossState) return;
  
  const currentQ = bossState.questions[bossState.currentIndex];
  
  bossState.answers[bossState.currentIndex] = -1;
  
  await markQuestionAnswered(
    currentQ.lessonId,
    currentQ.questionIndex,
    false
  );
  
  bossState.missed.push({
    lessonTitle: currentQ.lessonTitle,
    prompt: currentQ.question.prompt,
    correctAnswer: currentQ.question.choices[currentQ.question.correctIndex],
  });
}

export async function endBossMode(): Promise<{ allCorrect: boolean; missed: { lessonTitle: string; prompt: string; correctAnswer: string }[] }> {
  stopBossTimer();
  
  if (!bossState) throw new Error('No active boss mode');
  
  const allCorrect = bossState.missed.length === 0;
  const missed = bossState.missed;
  
  if (allCorrect) {
    const profile = await getProfile(currentNickname);
    if (profile) {
      const newXP = profile.totalXP + 150;
      await updateProfile(currentNickname, { totalXP: newXP });
    }
  }
  
  const result = { allCorrect, missed };
  bossState = null;
  
  return result;
}

export function triggerBossConfetti(): void {
  confetti({
    particleCount: 300,
    spread: 100,
    origin: { y: 0.5 },
    colors: ['#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899', '#ff6b6b'],
    shapes: ['square', 'circle'],
  });
}

export function renderBossModeScreen(container: HTMLElement): void {
  if (!bossState) return;
  
  const question = bossState.questions[bossState.currentIndex].question;
  const qNum = getQuestionNumber();
  const total = getTotalQuestions();
  const last = isLastQuestion();
  
  container.innerHTML = `
    <div class="boss-screen">
      <header class="boss-header">
        <div class="boss-title">🔥 BOSS BATTLE 🔥</div>
        <div class="boss-progress">${qNum}/${total}</div>
      </header>
      
      <div class="boss-timer-box">
        <span class="timer-label">Time:</span>
        <span class="timer-value" id="boss-timer">${formatTime(bossState.timeRemaining)}</span>
      </div>
      
      <div class="progress-dots-quiz">
        ${bossState.questions.map((_, i) => {
          let cls = 'dot-quiz';
          if (i < qNum - 1) {
            cls += bossState!.missed.some(m => m.prompt === bossState!.questions[i].question.prompt) ? ' missed' : ' completed';
          } else if (i === qNum - 1) cls += ' current';
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
      </div>
    </div>
  `;
}

export function renderBossResults(container: HTMLElement, allCorrect: boolean, missed: { lessonTitle: string; prompt: string; correctAnswer: string }[]): void {
  if (allCorrect) {
    triggerBossConfetti();
  }
  
  container.innerHTML = `
    <div class="results-screen">
      <div class="results-content">
        <div class="results-emoji">${allCorrect ? '👑' : '💪'}</div>
        <h1 class="results-title">
          ${allCorrect ? 'Boss Defeated!' : 'Try again'}
        </h1>
        
        ${allCorrect ? `
          <div class="xp-earned">
            <p class="xp-gained">+150 XP BONUS!</p>
          </div>
        ` : ''}
        
        ${!allCorrect && missed.length > 0 ? `
          <div class="missed-questions">
            <h3>Questions to review:</h3>
            <ul class="missed-list">
              ${missed.map(m => `
                <li class="missed-item">
                  <p class="missed-lesson">${m.lessonTitle}</p>
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

// ==================== NORMAL QUIZ RENDERING ====================

export function triggerQuizConfetti(): void {
  confetti({
    particleCount: 150,
    spread: 70,
    origin: { y: 0.6 },
    colors: ['#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899'],
  });
}

export function renderQuizScreen(container: HTMLElement): void {
  if (bossState) {
    renderBossModeScreen(container);
    return;
  }
  
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
  if (bossState) return bossState.answers[bossState.currentIndex] ?? null;
  return quizState?.answers[quizState.currentIndex] ?? null;
}