// src/main.ts
import './style.css';
import { seedLessons, getLessons, createProfile } from './db';
import { initOfflineSync } from '../utils/offline';
import { preloadLessons } from './preload';
import { createRouter } from './router';
import { renderOnboarding, state as onboardingState } from './screens/onboarding';
import type { StudentProfile, Grade, Language } from './types';

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