import './style.css';
import type { StudentProfile, Subject } from './types';
import { db, getProfile, updateProfile, createProfile, calculateLevel, calculateStreak, seedLessons } from './db';
import { initOfflineSync, registerSyncCallbacks } from '../utils/offline';
import { preloadLessons } from './preload';
import { startQuiz, calculateScore, selectAnswer, goToNextQuestion, getQuestionProgress, getCurrentQuestion } from './screens/quiz';
import { loadTeacherData, renderTeacherDashboard } from './screens/teacher';
import confetti from 'canvas-confetti';

let appContainer: HTMLElement | null = null;
let currentNickname: string = '';
let currentLessonData: { title: string; questions: { prompt: string; choices: string[]; hint: string; correctIndex: number }[] } | null = null;

const XP_THRESHOLDS = [0, 250, 450, 700, 1000, 1500];
const LEVEL_TITLES = ['Newcomer', 'Learner', 'Scholar', 'Ace', 'Master', 'Champion'];

// ── Toast helper ──────────────────────────────────────────────────────────────

function showToast(message: string): void {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

function getLevelTitle(level: number): string {
  return LEVEL_TITLES[Math.min(level, LEVEL_TITLES.length - 1)];
}

function getXPProgress(currentXP: number): number {
  const level = calculateLevel(currentXP);
  if (level >= XP_THRESHOLDS.length - 1) return 100;
  if (level < 1) return currentXP;
  const currentThreshold = XP_THRESHOLDS[level - 1];
  const nextThreshold = XP_THRESHOLDS[level];
  return Math.round(((currentXP - currentThreshold) / (nextThreshold - currentThreshold)) * 100);
}

// ── Sync callbacks (wires sync engine → UI) ───────────────────────────────────

registerSyncCallbacks({
  onSyncStart: () => {
    document.querySelector('.sync-badge')?.setAttribute('data-status', 'syncing');
  },
  onSyncComplete: (count: number) => {
    document.querySelector('.sync-badge')?.setAttribute('data-status', 'online');
    if (count > 0) showToast(`✨ Synced ${count} new items`);
  },
  onStatusChange: (online: boolean) => {
    document.querySelector('.sync-badge')?.setAttribute('data-status', online ? 'online' : 'offline');
    showToast(online ? '🟢 Back online — syncing...' : '🔴 Offline mode — progress still saves');
  },
});

// ── Screen renderers ───────────────────────────────────────────────────────

function renderSetupScreen(): string {
  return `
    <div class="setup-screen">
      <h1>Welcome to MentorAI</h1>
      <p class="tagline">Your AI-powered tutor for Math & ELA</p>
      <form id="setup-form" class="setup-form">
        <div class="form-group">
          <label for="nickname">Choose your nickname</label>
          <input type="text" id="nickname" name="nickname" placeholder="StarCoder99" required maxlength="20" />
        </div>
        <div class="form-group">
          <label for="grade">Your grade</label>
          <select id="grade" name="grade" required>
            <option value="">Select grade</option>
            <option value="6">Grade 6</option>
            <option value="7">Grade 7</option>
            <option value="8">Grade 8</option>
          </select>
        </div>
        <div class="form-group">
          <label for="language">Language</label>
          <select id="language" name="language" required>
            <option value="en">English</option>
            <option value="es">Español</option>
          </select>
        </div>
        <button type="submit" class="btn-primary">Start Learning</button>
      </form>
    </div>
  `;
}

function renderDashboard(profile: StudentProfile): string {
  const xpProgress = getXPProgress(profile.totalXP);
  const currentLvl = profile.currentLevel;
  const currentThresh = currentLvl > 1 ? XP_THRESHOLDS[currentLvl - 1] : 0;
  const nextThresh = XP_THRESHOLDS[currentLvl] || 'MAX';
  const xpNeeded = typeof nextThresh === 'number' ? nextThresh - currentThresh : 0;
  const xpProgressed = profile.totalXP - currentThresh;
  
  return `
    <div class="dashboard">
      <header class="dashboard-header">
        <div class="profile-info">
          <h1>Hey, ${profile.nickname}! 👋</h1>
          <p class="level-title">${getLevelTitle(profile.currentLevel)}</p>
        </div>
        <button class="btn-icon teacher-btn" data-screen="teacher">📊</button>
      </header>
      <div class="xp-container">
        <div class="xp-bar"><div class="xp-fill" style="width: ${xpProgress}%"></div></div>
        <p class="xp-text">${xpProgressed} / ${xpNeeded} XP to next level</p>
      </div>
      <div class="streak-display">
        <span class="streak-icon">🔥</span>
        <span class="streak-count">${profile.streak}</span>
        <span class="streak-label">day streak</span>
      </div>
      <div class="subject-cards">
        <div class="subject-card math" data-subject="math" data-difficulty="easy">
          <div class="subject-icon">🔢</div><h2>Math - Easy</h2><p class="subject-xp">Grade 6</p>
          <button class="btn-subject" data-subject="math" data-difficulty="easy">Start Lesson</button>
        </div>
        <div class="subject-card math" data-subject="math" data-difficulty="medium">
          <div class="subject-icon">📐</div><h2>Math - Medium</h2><p class="subject-xp">Grade 7</p>
          <button class="btn-subject" data-subject="math" data-difficulty="medium">Start Lesson</button>
        </div>
        <div class="subject-card math" data-subject="math" data-difficulty="hard">
          <div class="subject-icon">📊</div><h2>Math - Hard</h2><p class="subject-xp">Grade 8</p>
          <button class="btn-subject" data-subject="math" data-difficulty="hard">Start Lesson</button>
        </div>
        <div class="subject-card ela" data-subject="ela" data-difficulty="easy">
          <div class="subject-icon">📖</div><h2>ELA - Easy</h2><p class="subject-xp">Grade 6</p>
          <button class="btn-subject" data-subject="ela" data-difficulty="easy">Start Lesson</button>
        </div>
        <div class="subject-card ela" data-subject="ela" data-difficulty="medium">
          <div class="subject-icon">📝</div><h2>ELA - Medium</h2><p class="subject-xp">Grade 7</p>
          <button class="btn-subject" data-subject="ela" data-difficulty="medium">Start Lesson</button>
        </div>
        <div class="subject-card ela" data-subject="ela" data-difficulty="hard">
          <div class="subject-icon">✍️</div><h2>ELA - Hard</h2><p class="subject-xp">Grade 8</p>
          <button class="btn-subject" data-subject="ela" data-difficulty="hard">Start Lesson</button>
        </div>
      </div>
    </div>
  `;
}

function renderQuizScreen(lesson: { title: string; questions: { prompt: string; choices: string[]; hint: string; correctIndex: number }[] }): string {
  const progress = getQuestionProgress();
  const question = lesson.questions[progress.current - 1];
  const isLastQ = progress.current === progress.total;
  const nextText = isLastQ ? 'Finish Quiz' : 'Next →';
  const nextBg = isLastQ ? '#22c55e' : '';
  
  return `
    <div class="quiz-screen">
      <header class="quiz-header">
        <button class="btn-back" data-screen="dashboard">← Back</button>
        <h2>${lesson.title}</h2>
        <div class="question-counter">${progress.current}/${progress.total}</div>
      </header>
      <div class="progress-dots">
        ${lesson.questions.map((_, i) => `<span class="dot ${i < progress.current - 1 ? 'completed' : i === progress.current - 1 ? 'current' : ''}"></span>`).join('')}
      </div>
      <div class="question-container">
        <p class="question-prompt">${question.prompt}</p>
        <div class="choices">
          ${question.choices.map((choice, i) => `<button class="choice-btn" data-index="${i}">${choice}</button>`).join('')}
        </div>
        <button class="btn-hint" id="hint-btn">💡 Use Hint</button>
      </div>
      <div class="quiz-navigation">
        <button class="btn-nav prev" id="prev-btn" ${progress.current === 1 ? 'disabled' : ''}>← Previous</button>
        <button class="btn-nav next" id="next-btn" style="background: ${nextBg || ''}">${nextText}</button>
      </div>
    </div>
  `;
}

function renderQuizResults(score: number, xpEarned: number): string {
  const passed = score >= 60;
  const emoji = passed ? '🎉' : '💪';
  const message = passed ? 'Great job!' : 'Keep practicing!';
  
  return `
    <div class="results-screen">
      <div class="results-content">
        <div class="results-emoji">${emoji}</div>
        <h1>${message}</h1>
        <div class="score-display">
          <p class="score">${score}%</p><p class="score-label">Quiz Score</p>
        </div>
        <div class="xp-earned"><p class="xp-gained">+${xpEarned} XP</p></div>
        <button class="btn-primary" data-screen="dashboard">Continue</button>
      </div>
    </div>
  `;
}

function getCurrentLessonData() {
  return currentLessonData || { title: 'Lesson', questions: [] };
}

function triggerConfettiAnimation(): void {
  confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 }, colors: ['#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6'] });
}

function showAttemptMessage(message: string, isHint: boolean = false): void {
  const questionContainer = document.querySelector('.question-container');
  if (!questionContainer) return;
  
  const existing = document.querySelector('.feedback-message');
  if (existing) existing.remove();
  
  const feedback = document.createElement('div');
  feedback.className = 'feedback-message';
  feedback.textContent = message;
  feedback.style.cssText = `
    padding: 0.75rem 1rem; margin-top: 0.75rem; border-radius: 8px; font-weight: 500;
    text-align: center; animation: slideIn 0.3s ease;
    ${isHint ? 'background: #fef3c7; color: #92400e; border: 2px solid #f59e0b;' : 'background: #fef2f2; color: #991b1b; border: 2px solid #ef4444;'}
  `;
  questionContainer.appendChild(feedback);
  
  if (isHint) {
    const hintBtn = document.getElementById('hint-btn');
    if (hintBtn) (hintBtn as HTMLButtonElement).disabled = true;
  }
}

// ── Navigation ───────────────────────────────────────────────────────

function navigate(screen: string, data?: unknown): void {
  if (!appContainer) return;
  
  switch (screen) {
    case 'setup':
      appContainer.innerHTML = renderSetupScreen();
      break;
    case 'dashboard':
      getProfile(currentNickname).then(profile => {
        if (profile) appContainer!.innerHTML = renderDashboard(profile);
      });
      break;
    case 'quiz':
      currentLessonData = data as any;
      if (currentLessonData) appContainer!.innerHTML = renderQuizScreen(currentLessonData);
      break;
    case 'results':
      const result = data as { score: number; xpEarned: number };
      appContainer!.innerHTML = renderQuizResults(result.score, result.xpEarned);
      break;
    case 'teacher':
      getProfile(currentNickname).then(profile => {
        if (profile) {
          loadTeacherData(currentNickname).then(stats => {
            if (stats) appContainer!.innerHTML = renderTeacherDashboard(stats, profile);
          });
        }
      });
      break;
  }
}

// ── Event handlers ───────────────────────────────────────────────────

function setupEventListeners(): void {
  if (!appContainer) return;
  
  appContainer.addEventListener('submit', async (e: Event) => {
    const target = e.target as HTMLFormElement;
    if (target.id === 'setup-form') {
      e.preventDefault();
      const formData = new FormData(target);
      const nickname = formData.get('nickname') as string;
      const grade = parseInt(formData.get('grade') as string) as 6 | 7 | 8;
      const language = formData.get('language') as 'en' | 'es';
      
      await createProfile({ nickname, grade, language, totalXP: 0, currentLevel: 1, streak: 1, lastActive: new Date().toISOString(), mathXP: 0, elaXP: 0 });
      currentNickname = nickname;
      navigate('dashboard');
    }
  });
  
  appContainer.addEventListener('click', async (e: Event) => {
    const target = e.target as HTMLElement;
    
    if (target.dataset.screen) { navigate(target.dataset.screen); return; }
    
    if (target.dataset.subject) {
      const subject = target.dataset.subject as Subject;
      const difficulty = target.dataset.difficulty as string;
      
      const lessonFiles: Record<string, Record<string, string[]>> = {
        math: { easy: ['lessons/math-decimals-grade6.json', 'lessons/math-fractions-grade7.json'], medium: ['lessons/math-fractions-grade7.json', 'lessons/math-geometry-grade7.json'], hard: ['lessons/math-prealgebra-grade8.json', 'lessons/math-word-problems-grade8.json'] },
        ela: { easy: ['lessons/ela-main-idea-grade6.json', 'lessons/ela-context-clues-grade6.json'], medium: ['lessons/ela-summarizing-grade7.json', 'lessons/ela-figurative-language-grade8.json'], hard: ['lessons/ela-figurative-language-grade8.json', 'lessons/ela-essay-structure-grade8.json'] }
      };
      
      const files = (lessonFiles[subject] as Record<string, string[]>)[difficulty] || (lessonFiles[subject] as Record<string, string[]>)['easy'];
      const randomFile = files[Math.floor(Math.random() * files.length)];
      
      fetch(`/${randomFile}`).then(res => res.json()).then(lessonData => {
        startQuiz(lessonData as any, { hintsRemaining: 3 }).then(() => navigate('quiz', lessonData));
      }).catch(() => alert('Failed to load lesson. Please try again.'));
      return;
    }
    
    if (target.classList.contains('choice-btn')) {
      const index = parseInt(target.dataset.index || '0');
      selectAnswer(index);
      
      const buttons = appContainer?.querySelectorAll('.choice-btn');
      const allButtons = Array.from(buttons || []);
      const lessonData = getCurrentLessonData();
      const progress = getQuestionProgress();
      const question = lessonData.questions[progress.current - 1];
      const isCorrect = index === question.correctIndex;
      
      if (isCorrect) {
        allButtons.forEach(btn => { btn.classList.remove('selected', 'correct', 'incorrect'); (btn as HTMLButtonElement).disabled = true; });
        allButtons[index]?.classList.add('correct');
        setTimeout(() => {
          const progress = getQuestionProgress();
          const nextBtn = document.getElementById('next-btn');
          if (nextBtn) { nextBtn.textContent = progress.current === progress.total ? 'Finish Quiz' : 'Next →'; nextBtn.style.background = progress.current === progress.total ? '#22c55e' : ''; }
        }, 500);
      } else {
        showAttemptMessage('Incorrect!');
        allButtons.forEach((btn, i) => {
          (btn as HTMLButtonElement).disabled = true;
          if (i === question.correctIndex) btn.classList.add('correct');
          else if (i === index) btn.classList.add('incorrect');
        });
        setTimeout(() => {
          const progress = getQuestionProgress();
          const nextBtn = document.getElementById('next-btn');
          if (nextBtn) { nextBtn.textContent = progress.current === progress.total ? 'Finish Quiz' : 'Next →'; nextBtn.style.background = progress.current === progress.total ? '#22c55e' : ''; }
        }, 1000);
      }
      return;
    }
    
    if (target.id === 'next-btn') {
      const btnText = target.textContent?.trim() || '';
      const isFinish = btnText === 'Finish Quiz';
      
      if (isFinish) {
        const profile = await getProfile(currentNickname);
        const oldLevel = profile?.currentLevel || 1;
        const score = calculateScore();
        const xpEarned = Math.floor(score / 10) + 10;
        
        if (profile) {
          const newXP = profile.totalXP + xpEarned;
          const newLevel = calculateLevel(newXP);
          await updateProfile(currentNickname, { totalXP: newXP, currentLevel: newLevel, lastActive: new Date().toISOString() });
          if (newLevel > oldLevel) setTimeout(() => triggerConfettiAnimation(), 300);
        }
        appContainer!.innerHTML = renderQuizResults(score, xpEarned);
      } else {
        const progress = getQuestionProgress();
        if (progress.current < progress.total) {
          const hasNext = goToNextQuestion();
          if (hasNext) appContainer!.innerHTML = renderQuizScreen(getCurrentLessonData());
        }
      }
      return;
    }
    
    if (target.id === 'hint-btn') {
      const question = getCurrentQuestion();
      if (question) showAttemptMessage('💡 Hint: ' + question.hint, true);
      return;
    }
  });
}

// ── App boot ──────────────────────────────────────────────────────────────────

async function init(): Promise<void> {
  appContainer = document.querySelector<HTMLDivElement>('#app');
  if (!appContainer) return;
  
  // 1. Seed bundled JSON lessons — ALWAYS runs, works offline
  await seedLessons();
  
  // 2. Start sync engine (listens for WiFi reconnect)
  initOfflineSync();
  
  // 3. Check if a profile already exists
  const existingProfile = await db.studentProfile.toCollection().first();
  
  if (existingProfile) {
    currentNickname = existingProfile.nickname;
    const updatedStreak = calculateStreak(existingProfile.lastActive, existingProfile.streak);
    if (updatedStreak !== existingProfile.streak) {
      await updateProfile(existingProfile.nickname, { streak: updatedStreak, lastActive: new Date().toISOString() });
    }
    navigate('dashboard');
  } else {
    navigate('setup');
  }
  
  setupEventListeners();
  
  // 4. Generate extra Gemini lessons in background (non-blocking)
  if (navigator.onLine) {
    preloadLessons((current, total) => console.log(`[Preload] ${current}/${total} Gemini lessons ready`));
  }
  
  console.log('[MentorAI] Boot complete');
}

init().catch(console.error);

export { navigate, currentNickname };