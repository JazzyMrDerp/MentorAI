import './style.css';
import type { StudentProfile, Subject } from './types';
import { db, getProfile, updateProfile, createProfile, calculateLevel, calculateStreak } from './db';
import { startQuiz, calculateScore, selectAnswer, goToNextQuestion, getQuestionProgress, getCurrentQuestion } from './screens/quiz';
import { loadTeacherData, renderTeacherDashboard } from './screens/teacher';
import confetti from 'canvas-confetti';

let appContainer: HTMLElement | null = null;
let currentNickname: string = '';
let currentLessonData: { title: string; questions: { prompt: string; choices: string[]; hint: string }[] } | null = null;

const XP_THRESHOLDS = [0, 250, 450, 700, 1000, 1500];
const LEVEL_TITLES = ['Newcomer', 'Learner', 'Scholar', 'Ace', 'Master', 'Champion'];

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
        <div class="xp-bar">
          <div class="xp-fill" style="width: ${xpProgress}%"></div>
        </div>
        <p class="xp-text">${xpProgressed} / ${xpNeeded} XP to next level</p>
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

function getCurrentLessonData(): { title: string; questions: { prompt: string; choices: string[]; hint: string }[] } {
  return currentLessonData || { title: 'Lesson', questions: [] };
}

function triggerConfettiAnimation(): void {
  confetti({
    particleCount: 100,
    spread: 70,
    origin: { y: 0.6 },
    colors: ['#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6']
  });
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
    padding: 0.75rem 1rem;
    margin-top: 0.75rem;
    border-radius: 8px;
    font-weight: 500;
    text-align: center;
    animation: slideIn 0.3s ease;
    ${isHint ? 'background: #fef3c7; color: #92400e; border: 2px solid #f59e0b;' : 'background: #fef2f2; color: #991b1b; border: 2px solid #ef4444;'}
  `;
  
  questionContainer.appendChild(feedback);
  
  if (isHint) {
    const hintBtn = document.getElementById('hint-btn');
    if (hintBtn) (hintBtn as HTMLButtonElement).disabled = true;
  }
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
      currentLessonData = data as { title: string; questions: { prompt: string; choices: string[]; hint: string }[] };
      appContainer!.innerHTML = renderQuizScreen(currentLessonData);
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
      const demoLesson = {
        id: 1,
        subject,
        grade: 6,
        language: 'en',
        title: subject === 'math' ? 'Introduction to Fractions' : 'Finding the Main Idea',
        content: subject === 'math' ? 'Learn about fractions!' : 'Learn about reading comprehension!',
        isPreloaded: true,
        createdAt: new Date().toISOString(),
        questions: [
          {
            prompt: subject === 'math' ? 'What is 1/2 + 1/4?' : 'What is the main idea of this passage?',
            choices: subject === 'math' ? ['1/6', '3/4', '2/6', '1/3'] : ['The weather', 'The adventure', 'Friendship', 'The ending'],
            correctIndex: 1,
            hint: subject === 'math' ? 'Find a common denominator first.' : 'Look for the central message.'
          },
          {
            prompt: subject === 'math' ? 'What is 3/4 + 1/4?' : 'Which detail supports the main idea?',
            choices: subject === 'math' ? ['1', '4/4', '2/4', '1/2'] : ['The weather changed', 'They learned a lesson', 'It was raining', 'Everyone cheered'],
            correctIndex: 1,
            hint: subject === 'math' ? 'Add the numerators.' : 'Find the detail that explains the main idea.'
          },
          {
            prompt: subject === 'math' ? 'What is 1 - 1/3?' : 'What is a summmary of the passage?',
            choices: subject === 'math' ? ['2/3', '1/3', '1/9', '0'] : ['A story about animals', 'A story about friends', 'A story about food', 'A story about travel'],
            correctIndex: 0,
            hint: subject === 'math' ? 'Subtract the numerators.' : 'Combine all key points.'
          },
          {
            prompt: subject === 'math' ? 'What is 2/3 × 3?' : 'The author most likely wrote this to:',
            choices: subject === 'math' ? ['6', '2', '6/3', '1'] : ['Entertain', 'Complain', 'Advertise', 'Argue'],
            correctIndex: 0,
            hint: subject === 'math' ? 'Multiply the numerator by 3.' : 'Think about the purpose.'
          },
          {
            prompt: subject === 'math' ? 'Which is equivalent to 1/2?' : 'What type of passage is this?',
            choices: subject === 'math' ? ['2/4', '1/4', '3/4', '1/3'] : ['Fiction', 'Non-fiction', 'Poetry', 'Drama'],
            correctIndex: 0,
            hint: subject === 'math' ? 'Multiply top and bottom by 2.' : 'Look at the structure.'
          }
        ]
      };
      
      startQuiz(demoLesson as any, { hintsRemaining: 3 }).then(() => {
        navigate('quiz', demoLesson);
      });
      return;
    }
    
    if (target.classList.contains('choice-btn')) {
      const index = parseInt(target.dataset.index || '0');
      selectAnswer(index);
      
      const buttons = appContainer?.querySelectorAll('.choice-btn');
      const allButtons = Array.from(buttons || []);
      
      const isCorrect = index === 1;
      
      if (isCorrect) {
        allButtons.forEach((btn) => {
          btn.classList.remove('selected');
          btn.classList.remove('correct', 'incorrect');
          (btn as HTMLButtonElement).disabled = true;
        });
        
        allButtons[index]?.classList.add('correct');
        
        setTimeout(() => {
          const progress = getQuestionProgress();
          const isLastQuestion = progress.current === progress.total;
          
          const nextBtn = document.getElementById('next-btn');
          if (nextBtn) {
            if (isLastQuestion) {
              nextBtn.textContent = 'Finish Quiz';
              nextBtn.style.background = '#22c55e';
            } else {
              nextBtn.textContent = 'Next →';
              nextBtn.style.background = '';
            }
          }
        }, 500);
      } else {
        showAttemptMessage('Incorrect. Try again!');
        
        allButtons.forEach((btn) => {
          btn.classList.remove('selected');
          (btn as HTMLButtonElement).disabled = false;
        });
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
          
          await updateProfile(currentNickname, {
            totalXP: newXP,
            currentLevel: newLevel,
            lastActive: new Date().toISOString()
          });
          
          if (newLevel > oldLevel) {
            setTimeout(() => triggerConfettiAnimation(), 300);
          }
        }
        
        appContainer!.innerHTML = renderQuizResults(score, xpEarned);
      } else {
        const progress = getQuestionProgress();
        
        if (progress.current < progress.total) {
          const hasNext = goToNextQuestion();
          if (hasNext) {
            const lesson = getCurrentLessonData();
            appContainer!.innerHTML = renderQuizScreen(lesson);
          }
        }
      }
      return;
    }
    
    if (target.id === 'hint-btn') {
      const question = getCurrentQuestion();
      if (question) {
        showAttemptMessage('💡 Hint: ' + question.hint, true);
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