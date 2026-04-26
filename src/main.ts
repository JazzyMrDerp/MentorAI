// src/main.ts
import './style.css';
import { seedLessons, getLessons, createProfile } from './db';
<<<<<<< HEAD
import { renderOnboarding, state as onboardingState } from './screens/onboarding.ts';
import { renderDashboard } from './screens/dashboard.ts';
import { renderSubjectPage, renderProgressPlaceholder, renderSettingsPlaceholder } from './screens/subject.ts';
import { renderLessonScreen } from './screens/lesson.ts';
import { renderSidebar } from './components/sidebar.ts';
=======
import { initOfflineSync } from '../utils/offline';
import { preloadLessons } from './preload';
import { renderOnboarding, state as onboardingState } from './screens/onboarding';
import { renderDashboard } from './screens/dashboard';
import { renderSubjectPage, renderProgressPlaceholder, renderSettingsPlaceholder } from './screens/subject';
import { renderSidebar } from './components/sidebar';
>>>>>>> feat/ai-layer
import type { StudentProfile, Lesson, Grade, Language, Subject } from './types';

// ── App State ─────────────────────────────────────────────────────────────────

type Page = 'dashboard' | 'onboarding' | 'lesson' | 'progress' | 'settings' | 'math' | 'ela';

let currentPage: Page = 'onboarding';
let currentSubject: Subject = 'math';
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
<<<<<<< HEAD
    render();
  } else if (page.startsWith('lesson-')) {
    const lessonId = parseInt(page.replace('lesson-', ''), 10);
    if (lessonId) {
      currentLessonId = lessonId;
      currentPage = 'lesson';
      render();
    }
  }
}

function handleActionClick(_action: string): void {
  void _action;
  if (_action.startsWith('start-lesson-')) {
    const lessonId = parseInt(_action.replace('start-lesson-', ''), 10);
    if (lessonId) {
      currentLessonId = lessonId;
      currentPage = 'lesson';
      render();
    }
  } else if (_action === 'back') {
    if (currentPage === 'lesson') {
      currentPage = currentSubject as Page;
      currentLessonId = null;
    } else {
      currentPage = 'dashboard';
    }
    render();
  } else if (_action === 'continue-math') {
    currentSubject = 'math';
    currentPage = 'math';
    render();
  } else if (_action === 'continue-ela') {
    currentSubject = 'ela';
    currentPage = 'ela';
    render();
  }
}

// ── App state ─────────────────────────────────────────────────────────

type Page = 'dashboard' | 'onboarding' | 'lesson' | 'progress' | 'settings' | 'math' | 'ela';

let currentPage: Page = 'onboarding';
// Routing state - used for tracking
declare global {
  interface Window {
    DEBUG_SUBJECT: Subject;
  }
}
let currentSubject: Subject = 'math';
let currentLessonId: number | null = null;
// Expose for debugging in browser console
Object.defineProperty(window, 'DEBUG_SUBJECT', {
  get: () => currentSubject,
  set: (v) => { currentSubject = v; },
  configurable: true
});
let app: HTMLElement;
let profile: StudentProfile | null = null;
let lessons: Lesson[] = [];

// ── App boot ──────────────────────────────────────────────────────────────────

async function init(): Promise<void> {
  app = document.querySelector('#app')!;
  
  await seedLessons();
  
  // Always start with onboarding for now
  currentPage = 'onboarding';
  profile = null;
  
  console.log('[MentorAI] Boot complete');
=======
  } else if (page === 'dashboard' || page === 'progress' || page === 'settings') {
    currentPage = page as Page;
  }
>>>>>>> feat/ai-layer
  render();
}

// ── Render ────────────────────────────────────────────────────────────────────

function render(): void {
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
<<<<<<< HEAD
      onSelectLesson: (lessonId) => {
        currentLessonId = lessonId;
        currentPage = 'lesson';
        render();
      },
      onStartBoss: (subject) => {
        void subject;
      },
      onGoBack: () => {
        currentPage = 'dashboard';
        render();
      }
    });
  } else if (currentPage === 'ela') {
    mainContent = renderSubjectPage({
      subject: 'ela',
      lessons: lessons.filter(l => l.subject === 'ela'),
      profile,
      isOnline,
      onSelectLesson: (lessonId) => {
        currentLessonId = lessonId;
        currentPage = 'lesson';
        render();
      },
      onStartBoss: (subject) => {
        void subject;
      },
      onGoBack: () => {
        currentPage = 'dashboard';
        render();
      }
=======
      onSelectLesson: (_lessonId) => { void _lessonId; },
      onStartBoss:    (_subject)  => { void _subject; },
      onGoBack: () => navigateTo('dashboard'),
>>>>>>> feat/ai-layer
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
          console.log('Take Quiz clicked for lesson:', currentLessonId);
        },
        onSendMessage: async (prompt) => {
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