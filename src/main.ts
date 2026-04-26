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
  } else if (page === 'dashboard' || page === 'progress' || page === 'settings') {
    currentPage = page as Page;
  }
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
      onSelectLesson: (_lessonId) => { void _lessonId; },
      onStartBoss:    (_subject)  => { void _subject; },
      onGoBack: () => navigateTo('dashboard'),
    });
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