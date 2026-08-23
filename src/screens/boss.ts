import type { Lesson, Question, Subject } from '../types';
import { escapeHtml } from '../utils/escape';

/**
 * One question in the boss pool, with the lesson it came from.
 *
 * The pool used to be a bare Question[] built by flatMap, which threw away which
 * lesson each question belonged to — so a boss answer could not be attributed and
 * never reached markQuestionAnswered. Keeping the lesson id and the question's
 * index within that lesson is what lets the boss path feed the sync queue on the
 * same terms as the quiz path.
 */
export interface BossQuestion {
  question:      Question;
  lessonId:      number;
  questionIndex: number;
}

export interface BossState {
  subject: Subject;
  questions: BossQuestion[];
  currentQuestionIndex: number;
  /**
   * Every answer given, in order — an attempt log, not one slot per question.
   * The boss cycles back through the pool until its health is gone, so the same
   * question can legitimately be answered more than once in a battle.
   */
  answers: (number | null)[];
  /** The answer to the question on screen right now, cleared on advance. */
  answeredCurrent: number | null;
  hintsUsed: number;
  startTime: number;
  hintsRemaining: number;
  maxHealth: number;
  currentHealth: number;
  correctAnswers: number;
  timeLimit: number; // 180 seconds = 3 minutes
}

let currentBoss: BossState | null = null;

export interface BossRenderOptions {
  subject: Subject;
  onSelectAnswer: (index: number) => void;
  onUseHint: () => void;
  onNext: () => void;
  onFinish: () => void;
  onTimeUp: () => void;
  onGoBack: () => void;
}

export function startBossBattle(lessons: Lesson[], subject: Subject): BossState {
  // An unsaved lesson has no id to attribute an answer to, so it cannot join the
  // pool. In practice every lesson here came out of IndexedDB and has one.
  const pool = lessons
    .filter(l => l.subject === subject && l.id !== undefined)
    .flatMap(l => l.questions.map((question, questionIndex) => ({
      question,
      lessonId: l.id as number,
      questionIndex,
    })));

  // Shuffle questions and use all of them (not just 10)
  const bossQuestions = [...pool].sort(() => Math.random() - 0.5);

  currentBoss = {
    subject,
    questions: bossQuestions,
    currentQuestionIndex: 0,
    answers: [],
    answeredCurrent: null,
    hintsUsed: 0,
    startTime: Date.now(),
    hintsRemaining: 3,
    maxHealth: 100,
    currentHealth: 100,
    correctAnswers: 0,
    timeLimit: 180, // 3 minutes
  };
  
  return currentBoss;
}

/** The question on screen, for rendering. */
export function getCurrentBossQuestion(): Question | null {
  return getCurrentBossEntry()?.question ?? null;
}

/**
 * The question on screen together with where it came from.
 *
 * main.ts needs the lesson id and the question's index within that lesson to
 * record the answer; the render path only needs the question itself.
 */
export function getCurrentBossEntry(): BossQuestion | null {
  if (!currentBoss) return null;
  return currentBoss.questions[currentBoss.currentQuestionIndex] ?? null;
}

export function getBossQuestionIndex(): number {
  if (!currentBoss) return 0;
  return currentBoss.currentQuestionIndex;
}

export function getBossTotalQuestions(): number {
  if (!currentBoss) return 0;
  return currentBoss.questions.length;
}

export function selectBossAnswer(answerIndex: number): void {
  if (!currentBoss) return;
  const entry = currentBoss.questions[currentBoss.currentQuestionIndex];
  if (answerIndex === entry.question.correctIndex) {
    currentBoss.correctAnswers++;
    // Boss health goes DOWN when you answer correctly!
    const healthLost = 100 / currentBoss.questions.length;
    currentBoss.currentHealth = Math.max(0, currentBoss.currentHealth - healthLost);
  }
  // Append to the attempt log, and remember it as the answer to the question
  // currently on screen so a re-render can restore the selection.
  currentBoss.answers.push(answerIndex);
  currentBoss.answeredCurrent = answerIndex;
}

/**
 * The answer to the question on screen, or null if it has not been answered.
 *
 * This used to return the last entry in the attempt log regardless of which
 * question was showing. Advancing re-rendered the screen, so a fresh question
 * arrived with the previous question's choice already highlighted and the Next
 * button already enabled — the student could skip it without answering.
 */
export function getBossSelectedAnswer(): number | null {
  return currentBoss?.answeredCurrent ?? null;
}

export function useBossHint(): boolean {
  if (!currentBoss || currentBoss.hintsRemaining <= 0) return false;
  currentBoss.hintsUsed++;
  currentBoss.hintsRemaining--;
  return true;
}

export function getBossHint(): string | null {
  return getCurrentBossEntry()?.question.hint ?? null;
}

export function goToNextBossQuestion(): boolean {
  if (!currentBoss) return false;
  // Keep rotating through questions until boss is defeated
  if (currentBoss.currentHealth <= 0) {
    return false; // Boss defeated!
  }
  // Cycle through questions (loop back to start if at end)
  currentBoss.currentQuestionIndex = (currentBoss.currentQuestionIndex + 1) % currentBoss.questions.length;
  currentBoss.answeredCurrent = null;
  return true;
}

export function isBossDefeated(): boolean {
  return currentBoss !== null && currentBoss.currentHealth <= 0;
}

export function calculateBossScore(): number {
  if (!currentBoss) return 0;
  return Math.round((currentBoss.correctAnswers / currentBoss.questions.length) * 100);
}

export function calculateBossXP(score: number, _totalQuestions: number): number {
  const baseXP = score * 2;
  const bonus = score >= 80 ? 50 : 0;
  return baseXP + bonus;
}

export function renderBossScreen(options: BossRenderOptions): HTMLElement {
  const container = document.createElement('div');
  container.className = 'app-layout';
  
const question = getCurrentBossQuestion();
  const questionIndex = getBossQuestionIndex();
  const totalQuestions = getBossTotalQuestions();
  const currentHint = getBossHint();
  const currentAnswered = currentBoss?.answers.filter(a => a !== null).length ?? 0;
  const progress = totalQuestions > 0 ? ((currentAnswered + 1) / totalQuestions) * 100 : 100;
  
  void totalQuestions; // Used in template
  if (!question) {
    return document.createElement('div');
  }
  
  const bossName = options.subject === 'math' ? 'Math Master' : 'ELA Champion';
  const currentHealth = currentBoss?.currentHealth ?? 100;
  const maxHealth = currentBoss?.maxHealth ?? 100;
  const now = Date.now();
  const startTime = currentBoss?.startTime ?? now;
  const timeLimit = currentBoss?.timeLimit ?? 180;
  const elapsed = Math.floor((now - startTime) / 1000);
  const remaining = Math.max(0, timeLimit - elapsed);
  const timer = `${Math.floor(remaining / 60)}:${(remaining % 60).toString().padStart(2, '0')}`;
  
  container.innerHTML = `
    <div class="main-content">
      <div class="boss-content">
        <div class="boss-header">
          <div class="boss-avatar">👹</div>
          <div class="boss-info">
            <h2>${bossName}</h2>
            <p>Question #${currentAnswered + 1}</p>
          </div>
          <div class="boss-timer ${remaining <= 30 ? 'timer-danger' : ''}">
            <span>⏱️ ${timer}</span>
          </div>
        </div>
        
        <div class="boss-health-label">
          <span>Boss Health: ${Math.round(currentHealth)}/${maxHealth}</span>
        </div>
        <div class="boss-health">
          <div class="boss-health-bar" style="width: ${(currentHealth / maxHealth) * 100}%"></div>
        </div>
        
        <div class="quiz-bar-track">
          <div class="quiz-bar-fill" style="width: ${progress}%"></div>
        </div>
        
        <div class="question-box">
          <p class="question-prompt">${escapeHtml(question.prompt)}</p>
        </div>
        
        <div class="choices-grid">
          ${question.choices.map((choice, idx) => `
            <button class="choice-btn" data-choice="${idx}" ${choice === question.choices[question.correctIndex] ? '' : ''}>
              <span class="choice-letter">${String.fromCharCode(65 + idx)}</span>
              <span class="choice-text">${escapeHtml(choice)}</span>
            </button>
          `).join('')}
        </div>
        
        <div class="boss-actions">
          <button class="btn-hint" id="hint-btn">💡 Use Hint (${currentBoss?.hintsRemaining ?? 0} left)</button>
          <button class="btn-next" id="next-btn" disabled>Next Question →</button>
        </div>
        
        <div class="hint-popup" id="hint-popup" style="display: none;">
          <strong>Hint:</strong> ${escapeHtml(currentHint || 'No hint available')}
        </div>
      </div>
    </div>
  `;
  
  setTimeout(() => {
    const progressFill = container.querySelector('.quiz-bar-fill') as HTMLElement;
    if (progressFill) {
      progressFill.style.width = progress + '%';
    }
  }, 100);
  
  // Update timer every second - count DOWN
  const timerSpan = container.querySelector('.boss-timer span');
  const timerContainer = container.querySelector('.boss-timer');
  if (timerSpan && currentBoss) {
    const startTime = currentBoss.startTime;
    const limit = currentBoss.timeLimit;
    setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const remaining = Math.max(0, limit - elapsed);
      const mins = Math.floor(remaining / 60);
      const secs = remaining % 60;
      if (timerSpan) {
        timerSpan.textContent = `⏱️ ${mins}:${secs.toString().padStart(2, '0')}`;
      }
      if (timerContainer && remaining <= 30) {
        timerContainer.classList.add('timer-danger');
      }
      // Time's up!
      if (remaining <= 0) {
        options.onTimeUp();
      }
    }, 1000);
  }
  
  const choiceBtns = container.querySelectorAll('.choice-btn');
  const nextBtn = container.querySelector('#next-btn') as HTMLButtonElement;
  const hintBtn = container.querySelector('#hint-btn') as HTMLButtonElement;
  const hintPopup = container.querySelector('#hint-popup') as HTMLElement;
  
  choiceBtns.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const target = e.currentTarget as HTMLButtonElement;
      const choiceIdx = parseInt(target.dataset.choice || '0');
      
      // Get the current state for health calculation
      const bossState = currentBoss;
      const correctIndex = question.correctIndex;
      const isCorrect = choiceIdx === correctIndex;
      
      choiceBtns.forEach(b => b.classList.remove('selected', 'correct', 'wrong'));
      
      if (isCorrect) {
        target.classList.add('correct');
      } else {
        target.classList.add('wrong');
        const correctBtn = container.querySelector(`[data-choice="${correctIndex}"]`);
        correctBtn?.classList.add('correct');
      }
      
      options.onSelectAnswer(choiceIdx);
      choiceBtns.forEach((b: Element) => (b as HTMLButtonElement).disabled = true);
      
      // Update health display immediately after selection
      const newHealth = bossState?.currentHealth ?? 100;
      const healthBar = container.querySelector('.boss-health-bar') as HTMLElement;
      const healthLabel = container.querySelector('.boss-health-label');
      if (healthBar) {
        healthBar.style.width = `${newHealth}%`;
      }
      if (healthLabel) {
        healthLabel.textContent = `Boss Health: ${Math.round(newHealth)}/${bossState?.maxHealth ?? 100}`;
      }
      
      // If boss is defeated, trigger finish immediately
      if (newHealth <= 0) {
        nextBtn.textContent = 'Boss Defeated! 🎉';
        nextBtn.disabled = false;
        // Auto-trigger finish after a short delay
        setTimeout(() => options.onFinish(), 500);
      }
      
      if (nextBtn) nextBtn.disabled = false;
    });
  });
  
  const savedAnswer = getBossSelectedAnswer();
  if (savedAnswer !== null) {
    const savedBtn = container.querySelector(`[data-choice="${savedAnswer}"]`);
    savedBtn?.classList.add('selected');
    if (nextBtn) nextBtn.disabled = false;
  }
  
  hintBtn?.addEventListener('click', () => {
    options.onUseHint();
    if (hintPopup && currentHint) {
      hintPopup.style.display = 'block';
      hintPopup.innerHTML = `<strong>Hint:</strong> ${escapeHtml(currentHint)}`;
    }
  });
  
  nextBtn?.addEventListener('click', () => {
    const bossDefeated = isBossDefeated();
    if (bossDefeated || questionIndex + 1 >= totalQuestions) {
      options.onFinish();
    } else {
      options.onNext();
    }
  });
  
  return container;
}

export function renderBossSummary(
  score: number, 
  xpEarned: number, 
  hintsUsed: number, 
  totalQuestions: number,
  onBackToDashboard: () => void
): HTMLElement {
  const container = document.createElement('div');
  container.className = 'app-layout';
  
  // `score` is already a percentage — calculateBossScore returns 0-100 — so the
  // count is a fraction of it, and the grade compares against plain thresholds.
  // Both used to treat it as points out of totalQuestions * 100, which meant a
  // flawless battle scored 100 and reported "Try Again! Score: 1/10". Display
  // only; the XP and the progress row were always right.
  const correct = Math.round((score / 100) * totalQuestions);
  const grade = score >= 80 ? 'Legendary!' : score >= 60 ? 'Boss Slayer!' : score >= 40 ? 'Great Fight!' : 'Try Again!';
  const gradeEmoji = score >= 80 ? '🏆' : score >= 60 ? '⚔️' : score >= 40 ? '👍' : '💪';
  
  container.innerHTML = `
    <div class="main-content">
      <div class="summary-content">
        <div class="summary-icon">${gradeEmoji}</div>
        <h1>${grade}</h1>
        <p class="summary-score">Score: ${correct}/${totalQuestions}</p>
        <p class="summary-xp">+${xpEarned} XP Earned!</p>
        <p class="summary-hints">Hints used: ${hintsUsed}</p>
        
        <button class="btn-dashboard" id="back-btn">Back to Dashboard</button>
      </div>
    </div>
  `;
  
  const backBtn = container.querySelector('#back-btn');
  backBtn?.addEventListener('click', onBackToDashboard);
  
  return container;
}