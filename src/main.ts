// src/main.ts
import './style.css';
import { seedLessons, getLessons, createProfile } from './db';
import { renderOnboarding, state as onboardingState } from './screens/onboarding.ts';
import { renderDashboard } from './screens/dashboard.ts';
import { renderSubjectPage, renderProgressPlaceholder, renderSettingsPlaceholder } from './screens/subject.ts';
import { renderSidebar } from './compenents/sidebar.ts';
import type { StudentProfile, Lesson, Grade, Language, Subject } from './types';

// ── Event Delegation ─────────────────────────────────────────────────────────
// Handle all clicks via delegation on document
document.addEventListener('click', (e) => {
  const target = e.target as HTMLElement;
  const button = target.closest('[data-page]') || target.closest('[data-action]') || target.closest('[data-route]');
  if (!button) return;
  
  const page = (button as HTMLElement).dataset.page;
  const route = (button as HTMLElement).dataset.route;
  const _action = (button as HTMLElement).dataset.action;
  
  if (page || route) {
    const targetPage = page || route || 'dashboard';
    handleRouteClick(targetPage);
  }
  
  if (_action) {
    handleActionClick(_action);
  }
});

async function handleRouteClick(page: string): Promise<void> {
  if (page === 'dashboard') {
    currentPage = 'dashboard';
    render();
  } else if (page === 'progress') {
    currentPage = 'progress';
    render();
  } else if (page === 'settings') {
    currentPage = 'settings';
    render();
  } else if (page === 'math' || page === 'ela') {
    currentSubject = page as Subject;
    if (profile) {
      lessons = await getLessons(profile.grade, page as Subject, 'en');
    }
    currentPage = page as Page;
    render();
  }
}

function handleActionClick(_action: string): void {
  void _action;
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
// Expose for debugging in browser console
Object.defineProperty(window, 'DEBUG_SUBJECT', {
  get: () => currentSubject,
  set: (v) => { currentSubject = v; },
  configurable: true
});
let app: HTMLElement;

async function init(): Promise<void> {
  app = document.getElementById('app')!;

  await seedLessons();
  initOfflineSync();

  // Show onboarding first — no profile yet
  const onboardingEl = renderOnboarding();
  app.innerHTML = '';
  app.appendChild(onboardingEl);

  setupOnboardingHandlers();
}

function render(): void {
  app.innerHTML = '';
  const isOnline = navigator.onLine;
  
  if (currentPage === 'onboarding') {
    const onboarding = renderOnboarding();
    app.appendChild(onboarding);
    return;
  }
  
  // Dashboard with sidebar
  const layout = document.createElement('div');
  layout.className = 'app-layout';
  
  const sidebar = renderSidebar({
    profile,
    currentPage: currentPage,
    isOnline,
    onNavigate: async (page) => {
      if (page === 'dashboard') {
        currentPage = 'dashboard';
        render();
      } else if (page === 'progress') {
        currentPage = 'progress';
        render();
      } else if (page === 'settings') {
        currentPage = 'settings';
        render();
      } else if (page === 'math' || page === 'ela') {
        currentSubject = page as Subject;
        if (profile) {
          lessons = await getLessons(profile.grade, page as Subject, 'en');
        }
        currentPage = page as Page;
        render();
      } else {
        currentPage = 'dashboard';
        render();
      }
    }
  });
  
  let mainContent: HTMLElement;
  
  if (currentPage === 'math') {
    mainContent = renderSubjectPage({
      subject: 'math',
      lessons: lessons.filter(l => l.subject === 'math'),
      profile,
      isOnline,
      onSelectLesson: (lessonId) => {
        void lessonId;
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
        void lessonId;
      },
      onStartBoss: (subject) => {
        void subject;
      },
      onGoBack: () => {
        currentPage = 'dashboard';
        render();
      }
    });
  } else if (currentPage === 'progress') {
    mainContent = renderProgressPlaceholder();
  } else if (currentPage === 'settings') {
    mainContent = renderSettingsPlaceholder();
  } else {
    // Default to dashboard
    mainContent = renderDashboard({
      profile,
      lessons,
      isOnline,
      onOpenLesson: (subject) => {
        currentSubject = subject;
        document.title = 'MentorAI - ' + subject.toUpperCase();
        currentPage = subject as Page;
        render();
      }
    });
  }
  
  layout.appendChild(sidebar);
  layout.appendChild(mainContent);
  app.appendChild(layout);
}

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
      const profile = newProfile as StudentProfile;
      const lessons = await getLessons(profile.grade, 'math', 'en');

      // Hand off to router — it owns everything from here
      const router = createRouter({
        root: app,
        snapshot: {
          state: { profile, currentLesson: null, isOnline: navigator.onLine },
          lessons,
        },
        onCreateProfile: async (input) => {
          const lessons = await getLessons(input.grade, 'math', 'en');
          return {
            state: { profile: { ...input, totalXP: 0, mathXP: 0, elaXP: 0,
              currentLevel: 1, streak: 0, lastActive: new Date().toISOString() },
              currentLesson: null, isOnline: navigator.onLine },
            lessons,
          };
        },
        onSetLanguage: async () => ({
          state: { profile, currentLesson: null, isOnline: navigator.onLine },
          lessons,
        }),
      });

      await router.mount();

      // Register online/offline updates
      window.addEventListener('online',  () => router.setOnlineStatus(true));
      window.addEventListener('offline', () => router.setOnlineStatus(false));

      // Start Gemini preload in background
      preloadLessons().catch(console.error);
    });
  }, 100);
}

init().catch(console.error);

export {};