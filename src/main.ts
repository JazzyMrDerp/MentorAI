// src/main.ts
import './style.css';
import { seedLessons, getLessons, createProfile } from './db';
import { initOfflineSync } from '../utils/offline';
import { preloadLessons } from './preload';
import { renderOnboarding, state as onboardingState } from './screens/onboarding';
import { renderDashboard } from './screens/dashboard';
import { renderSubjectPage, renderProgressPlaceholder, renderSettingsPlaceholder } from './screens/subject';
import { renderSidebar } from './components/sidebar';
import type { StudentProfile, Lesson, Grade, Language, Subject } from './types';
import { renderLessonScreen } from './screens/lesson';  
import { startQuiz, renderQuizScreen, renderQuizSummary, selectAnswer, useHint, goToNextQuestion, submitQuiz, getQuizProgress, calculateScore, calculateXP } from './screens/quiz';
import { startBossBattle, renderBossScreen, renderBossSummary, selectBossAnswer, useBossHint, goToNextBossQuestion, calculateBossScore, calculateBossXP, isBossDefeated } from './screens/boss';

// ── App State ─────────────────────────────────────────────────────────────────

type Page = 'dashboard' | 'onboarding' | 'lesson' | 'quiz' | 'boss' | 'progress' | 'settings' | 'math' | 'ela';

let currentPage: Page = 'onboarding';
let currentSubject: Subject = 'math';
let currentLessonId: number | null = null;
let currentQuiz: ReturnType<typeof getQuizProgress> = null;
let currentBoss: ReturnType<typeof startBossBattle> | null = null;
let app: HTMLElement;
let profile: StudentProfile | null = null;
let lessons: Lesson[] = [];

// ── Navigation ────────────────────────────────────────────────────────────────

async function navigateTo(page: string): Promise<void> {
  if (page === 'math' || page === 'ela') {
    currentSubject = page as Subject;
    if (profile) {
      lessons = await getLessons(profile.grade, page as Subject, 'en');
    }
    currentPage = page as Page;
  } else if (page === 'dashboard' || page === 'progress' || page === 'settings') {
    currentPage = page as Page;
  }
  render();
}

// ── Render ────────────────────────────────────────────────────────────────────

async function render(): Promise<void> {
  app.innerHTML = '';
  const isOnline = navigator.onLine;

  if (currentPage === 'onboarding') {
    app.appendChild(renderOnboarding());
    setupOnboardingHandlers();
    return;
  }

  const layout = document.createElement('div');
  layout.className = 'app-layout';

  const sidebar = renderSidebar({
    profile,
    currentPage,
    isOnline,
    onNavigate: (page) => { void navigateTo(page); }
  });

  let mainContent: HTMLElement;

  if (currentPage === 'math' || currentPage === 'ela') {
    mainContent = renderSubjectPage({
      subject: currentSubject,
      lessons: lessons.filter(l => l.subject === currentSubject),
      profile,
      isOnline,
onSelectLesson: (lessonId) => {
        currentLessonId = lessonId;   // ← save the selected lesson id
        currentPage = 'quiz';          // ← navigate directly to quiz
        render();
      },
      onStartBoss: (subject) => {
        currentSubject = subject;
        currentPage = 'boss';
        currentBoss = null;
        render();
      },
      onGoBack: () => navigateTo('dashboard'),
    });
  } else if (currentPage === 'lesson' && currentLessonId) {
    const selectedLesson = lessons.find(l => l.id === currentLessonId);
    if (selectedLesson) {
      mainContent = renderLessonScreen({
        lesson: selectedLesson,
        profile,
        isOnline,
        messages: [],
        isTutorThinking: false,
        onGoBack: () => {
          currentPage = currentSubject as Page;
          currentLessonId = null;
          render();
        },
        onTakeQuiz: () => {
          currentPage = 'quiz';
          render();
        },
        onSendMessage: async (prompt: string) => {
          console.log('Tutor message:', prompt);
        }
      });
    } else {
      currentPage = currentSubject as Page;
      currentLessonId = null;
      render();
      return;
    }
  } else if (currentPage === 'progress') {
    mainContent = renderProgressPlaceholder();
  } else if (currentPage === 'settings') {
    mainContent = renderSettingsPlaceholder();
  } else if (currentPage === 'boss' && profile) {
    const subjectLessons = lessons.filter(l => l.subject === currentSubject);
    if (subjectLessons.length > 0) {
      const bossState = currentBoss || startBossBattle(subjectLessons, currentSubject);
      if (!currentBoss) currentBoss = bossState;
      
      const handleBossNext = () => {
        const defeated = isBossDefeated();
        // If boss is defeated, show victory screen
        if (defeated) {
          const bossScore = calculateBossScore();
          const answered = bossState.answers.length;
          const bossXP = calculateBossXP(bossScore, answered);
          app.innerHTML = '';
          app.appendChild(
            renderBossSummary(bossScore, bossXP, bossState.hintsUsed, answered, () => {
              currentPage = 'dashboard';
              currentBoss = null;
              render();
            })
          );
          return;
        }
        // Otherwise, move to next question
        const moved = goToNextBossQuestion();
        if (moved) {
          render();
        } else {
          // Time ran out or no more questions
          const bossScore = calculateBossScore();
          const answered = bossState.answers.length;
          const bossXP = calculateBossXP(bossScore, answered);
          app.innerHTML = '';
          app.appendChild(
            renderBossSummary(bossScore, bossXP, bossState.hintsUsed, answered, () => {
              currentPage = 'dashboard';
              currentBoss = null;
              render();
            })
          );
        }
      };
      
      mainContent = renderBossScreen({
        subject: currentSubject,
        onSelectAnswer: (index) => { selectBossAnswer(index); },
        onUseHint: () => { useBossHint(); },
        onNext: handleBossNext,
        onFinish: () => { handleBossNext(); },
        onTimeUp: () => {
          // Time's up - boss wins!
          app.innerHTML = '';
          app.appendChild(
            renderBossSummary(0, 0, bossState.hintsUsed, bossState.answers.length, () => {
              currentPage = 'dashboard';
              currentBoss = null;
              render();
            })
          );
        },
        onGoBack: () => {
          currentPage = 'dashboard';
          currentBoss = null;
          render();
        },
      });
    } else {
      mainContent = document.createElement('div');
      mainContent.textContent = 'No lessons available for boss battle';
    }
  } else if (currentPage === 'quiz' && currentLessonId && profile) {
    const selectedLesson = lessons.find(l => l.id === currentLessonId);
    if (selectedLesson && profile) {
      if (!currentQuiz) {
        currentQuiz = await startQuiz(selectedLesson, { hintsRemaining: 3 });
      }
      
      const handleNext = () => {
        const moved = goToNextQuestion();
        if (moved) {
          currentQuiz = getQuizProgress();
          render();
        } else {
          const quizState = getQuizProgress();
          if (quizState) {
            const score = calculateScore();
            const xpEarned = calculateXP(score);
            submitQuiz(profile!.nickname, selectedLesson.title, currentSubject);
            currentQuiz = null;
            app.innerHTML = '';
            app.appendChild(
              renderQuizSummary(score, xpEarned, quizState.hintsUsed, selectedLesson.questions.length, () => {
                currentPage = currentSubject as Page;
                currentLessonId = null;
                render();
              })
            );
            return;
          }
        }
      };
      
      mainContent = renderQuizScreen({
        onSelectAnswer: (index) => { selectAnswer(index); },
        onUseHint: () => { useHint(); },
        onNext: handleNext,
        onFinish: () => { handleNext(); },
        onGoBack: () => {
          currentPage = 'lesson';
          currentQuiz = null;
          render();
        },
      });
    } else {
      mainContent = document.createElement('div');
      mainContent.textContent = 'No lesson selected';
    }
  } else {
    mainContent = renderDashboard({
      profile,
      lessons,
      isOnline,
      onOpenLesson: (subject) => { void navigateTo(subject); }
    });
  }

  layout.appendChild(sidebar);
  layout.appendChild(mainContent);
  app.appendChild(layout);
}

// ── Onboarding ────────────────────────────────────────────────────────────────

function setupOnboardingHandlers(): void {
  setTimeout(() => {
    const startBtn = document.getElementById('start-btn');
    if (!startBtn) { setTimeout(setupOnboardingHandlers, 200); return; }

    startBtn.addEventListener('click', async () => {
      if (!onboardingState.nickname || !onboardingState.grade) return;

      const newProfile: Omit<StudentProfile, 'id'> = {
        nickname:     onboardingState.nickname,
        grade:        onboardingState.grade as Grade,
        language:     'en' as Language,
        totalXP:      0,
        mathXP:       0,
        elaXP:        0,
        currentLevel: 1,
        streak:       0,
        lastActive:   new Date().toISOString(),
      };

      await createProfile(newProfile);
      profile  = { ...newProfile, id: 1 } as StudentProfile;
      lessons  = await getLessons(profile.grade, 'math', 'en');
      currentPage = 'dashboard';
      render();
    });
  }, 100);
}

// ── Boot ──────────────────────────────────────────────────────────────────────

async function init(): Promise<void> {
  app = document.getElementById('app')!;

  await seedLessons();
  initOfflineSync();                        // ← registers online/offline listeners
  preloadLessons().catch(console.error);    // ← runs Gemini preload in background

  // keep online/offline dot in sidebar live
  window.addEventListener('online',  () => render());
  window.addEventListener('offline', () => render());

  console.log('[MentorAI] Boot complete');
  render();
}

init().catch(console.error);

export {};