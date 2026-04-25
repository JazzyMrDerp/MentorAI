import './style.css';
import type { StudentProfile, Subject } from './types';
import { db, getProfile, updateProfile, createProfile, calculateLevel, calculateStreak } from './db';
import { calculateScore, selectAnswer, goToNextQuestion, useHint, getQuestionProgress } from './screens/quiz';
import { loadTeacherData, renderTeacherDashboard } from './screens/teacher';

let appContainer: HTMLElement | null = null;
let currentNickname: string = '';

const XP_THRESHOLDS = [0, 250, 450, 700, 1000, 1500];
const LEVEL_TITLES = ['Newcomer', 'Learner', 'Scholar', 'Ace', 'Master', 'Champion'];

function getLevelTitle(level: number): string {
  return LEVEL_TITLES[Math.min(level, LEVEL_TITLES.length - 1)];
}

function getXPProgress(currentXP: number): number {
  const level = calculateLevel(currentXP);
  if (level >= XP_THRESHOLDS.length - 1) return 100;
  const currentThreshold = XP_THRESHOLDS[level];
  const nextThreshold = XP_THRESHOLDS[level + 1];
  return Math.round(((currentXP - currentThreshold) / (nextThreshold - currentThreshold)) * 100);
}

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
  const mathXP = profile.mathXP || 0;
  const elaXP = profile.elaXP || 0;
  
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
        <div class="xp-bar">
          <div class="xp-fill" style="width: ${xpProgress}%"></div>
        </div>
        <p class="xp-text">${profile.totalXP} XP — ${XP_THRESHOLDS[profile.currentLevel] || 0} / ${XP_THRESHOLDS[profile.currentLevel + 1] || 'MAX'} to next level</p>
      </div>
      
      <div class="streak-display">
        <span class="streak-icon">🔥</span>
        <span class="streak-count">${profile.streak}</span>
        <span class="streak-label">day streak</span>
      </div>
      
      <div class="subject-cards">
        <div class="subject-card math" data-subject="math">
          <div class="subject-icon">🔢</div>
          <h2>Math</h2>
          <p class="subject-xp">${mathXP} XP</p>
          <button class="btn-subject" data-subject="math">Start Lesson</button>
        </div>
        <div class="subject-card ela" data-subject="ela">
          <div class="subject-icon">📚</div>
          <h2>ELA</h2>
          <p class="subject-xp">${elaXP} XP</p>
          <button class="btn-subject" data-subject="ela">Start Lesson</button>
        </div>
      </div>
    </div>
  `;
}

function renderQuizScreen(lesson: { title: string; questions: { prompt: string; choices: string[]; hint: string }[] }): string {
  const progress = getQuestionProgress();
  const question = lesson.questions[progress.current - 1];
  
  return `
    <div class="quiz-screen">
      <header class="quiz-header">
        <button class="btn-back" data-screen="dashboard">← Back</button>
        <h2>${lesson.title}</h2>
        <div class="question-counter">${progress.current}/${progress.total}</div>
      </header>
      
      <div class="progress-dots">
        ${lesson.questions.map((_, i) => `
          <span class="dot ${i < progress.current - 1 ? 'completed' : i === progress.current - 1 ? 'current' : ''}"></span>
        `).join('')}
      </div>
      
      <div class="question-container">
        <p class="question-prompt">${question.prompt}</p>
        
        <div class="choices">
          ${question.choices.map((choice, i) => `
            <button class="choice-btn" data-index="${i}">${choice}</button>
          `).join('')}
        </div>
        
        <button class="btn-hint" id="hint-btn">💡 Use Hint</button>
      </div>
      
      <div class="quiz-navigation">
        <button class="btn-nav prev" id="prev-btn" ${progress.current === 1 ? 'disabled' : ''}>← Previous</button>
        <button class="btn-nav next" id="next-btn" ${progress.current === progress.total ? 'disabled' : ''}>Next →</button>
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
          <p class="score">${score}%</p>
          <p class="score-label">Quiz Score</p>
        </div>
        <div class="xp-earned">
          <p class="xp-gained">+${xpEarned} XP</p>
        </div>
        <button class="btn-primary" data-screen="dashboard">Continue</button>
      </div>
    </div>
  `;
}

function navigate(screen: string, data?: unknown): void {
  if (!appContainer) return;
  
  switch (screen) {
    case 'setup':
      appContainer.innerHTML = renderSetupScreen();
      break;
    case 'dashboard':
      getProfile(currentNickname).then(profile => {
        if (profile) {
          appContainer!.innerHTML = renderDashboard(profile);
        }
      });
      break;
    case 'quiz':
      appContainer!.innerHTML = renderQuizScreen(data as { title: string; questions: { prompt: string; choices: string[]; hint: string }[] });
      break;
    case 'results':
      const result = data as { score: number; xpEarned: number };
      appContainer!.innerHTML = renderQuizResults(result.score, result.xpEarned);
      break;
    case 'teacher':
      getProfile(currentNickname).then(profile => {
        if (profile) {
          loadTeacherData(currentNickname).then(stats => {
            if (stats) {
              appContainer!.innerHTML = renderTeacherDashboard(stats, profile);
            }
          });
        }
      });
      break;
  }
}

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
      
      await createProfile({
        nickname,
        grade,
        language,
        totalXP: 0,
        currentLevel: 1,
        streak: 1,
        lastActive: new Date().toISOString(),
        mathXP: 0,
        elaXP: 0,
      });
      
      currentNickname = nickname;
      navigate('dashboard');
    }
  });
  
  appContainer.addEventListener('click', async (e: Event) => {
    const target = e.target as HTMLElement;
    
    if (target.dataset.screen) {
      navigate(target.dataset.screen);
      return;
    }
    
    if (target.dataset.subject) {
      const subject = target.dataset.subject as Subject;
      alert(`Lesson loading for ${subject}... (Demo)`);
      return;
    }
    
    if (target.classList.contains('choice-btn')) {
      const index = parseInt(target.dataset.index || '0');
      selectAnswer(index);
      
      const buttons = appContainer?.querySelectorAll('.choice-btn');
      buttons?.forEach((btn) => {
        btn.classList.toggle('selected', btn === target);
      });
      return;
    }
    
    if (target.id === 'next-btn') {
      const hasNext = goToNextQuestion();
      if (!hasNext) {
        const score = calculateScore();
        const xpEarned = Math.floor(score / 10) + 10;
        navigate('results', { score, xpEarned });
      }
      return;
    }
    
    if (target.id === 'hint-btn') {
      const used = useHint();
      if (used) {
        const { getHint } = await import('./screens/quiz');
        alert('Hint: ' + getHint());
        target.setAttribute('disabled', 'true');
      }
      return;
    }
  });
}

async function init(): Promise<void> {
  appContainer = document.querySelector<HTMLDivElement>('#app');
  if (!appContainer) return;
  
  const existingProfile = await db.studentProfile.toCollection().first();
  
  if (existingProfile) {
    currentNickname = existingProfile.nickname;
    
    const updatedStreak = calculateStreak(existingProfile.lastActive, existingProfile.streak);
    if (updatedStreak !== existingProfile.streak) {
      await updateProfile(existingProfile.nickname, {
        streak: updatedStreak,
        lastActive: new Date().toISOString(),
      });
    }
    
    navigate('dashboard');
  } else {
    navigate('setup');
  }
  
  setupEventListeners();
}

init().catch(console.error);

export { navigate, currentNickname };