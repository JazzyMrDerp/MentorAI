// src/main.ts
import './style.css';
import { seedLessons, getLessons, createProfile } from './db';
import { renderOnboarding, state as onboardingState } from './screens/onboarding.ts';
import { renderDashboard } from './screens/dashboard.ts';
import { renderSidebar } from './compenents/sidebar.ts';
import type { StudentProfile, Lesson, Grade, Language, Subject } from './types';

// ── App state ─────────────────────────────────────────────────────────

type Page = 'dashboard' | 'onboarding' | 'lesson';

let currentPage: Page = 'onboarding';
let currentSubject: Subject = 'math';
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
  render();
  setupOnboardingHandlers();
}

function render(): void {
  app.innerHTML = '';
  const isOnline = navigator.onLine;
  
  if (currentPage !== 'dashboard') {
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
      console.log('Navigate to:', page);
      currentSubject = page === 'ela' ? 'ela' : 'math';
      if (currentSubject === 'ela') {
        lessons = await getLessons(profile!.grade, 'ela', 'en');
      } else {
        lessons = await getLessons(profile!.grade, 'math', 'en');
      }
      render();
    }
  });
  
  const mainContent = renderDashboard({
    profile,
    lessons,
    isOnline,
    onOpenLesson: (subject) => {
      console.log('Open lesson:', subject);
      currentSubject = subject;
    }
  });
  
  layout.appendChild(sidebar);
  layout.appendChild(mainContent);
  app.appendChild(layout);
}

function setupOnboardingHandlers(): void {
  // Wait for DOM to be ready
  setTimeout(() => {
    const nicknameInput = document.getElementById('nickname-input');
    const startBtn = document.getElementById('start-btn');
    
    if (!startBtn || !nicknameInput) {
      console.log('Elements not found, retrying...');
      setTimeout(setupOnboardingHandlers, 200);
      return;
    }
    
    console.log('Setting up onboarding handlers');
    
    startBtn.addEventListener('click', async () => {
      console.log('Start button clicked');
      
      if (!onboardingState.nickname || !onboardingState.grade) {
        console.log('Missing nickname or grade');
        return;
      }
      
      const newProfile: Omit<StudentProfile, 'id'> = {
        nickname: onboardingState.nickname,
        grade: onboardingState.grade as Grade,
        language: 'en' as Language,
        totalXP: 0,
        mathXP: 0,
        elaXP: 0,
        currentLevel: 1,
        streak: 0,
        lastActive: new Date().toISOString(),
      };
      
      await createProfile(newProfile);
      profile = { ...newProfile, id: 1 } as StudentProfile;
      
      lessons = await getLessons(profile.grade, 'math', 'en');
      currentPage = 'dashboard';
      render();
    });
  }, 100);
}

init().catch(console.error);

export {};