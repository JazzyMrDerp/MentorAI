// src/main.ts
import { initOfflineSync, registerSyncCallbacks } from '../utils/offline';
import { preloadLessons } from './preload';
import { seedLessons, db, getProfile, createProfile, updateProfile } from './db';
import { createRouter, type AppSnapshot } from './router';
import type { StudentProfile } from './types';


// ── Toast helper ──────────────────────────────────────────────────────────────

function showToast(message: string): void {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

// ── Sync callbacks (wires sync engine → UI) ───────────────────────────────────

registerSyncCallbacks({
  onSyncStart: () => {
    document.querySelector('.sync-badge')
      ?.setAttribute('data-status', 'syncing');
  },
  onSyncComplete: (count: number) => {
    document.querySelector('.sync-badge')
      ?.setAttribute('data-status', 'online');
    if (count > 0) showToast(`✨ Synced ${count} new items`);
  },
  onStatusChange: (online: boolean) => {
    document.querySelector('.sync-badge')
      ?.setAttribute('data-status', online ? 'online' : 'offline');
    showToast(online
      ? '🟢 Back online — syncing...'
      : '🔴 Offline mode — progress still saves'
    );
  },
});

// ── App boot ──────────────────────────────────────────────────────────────────

async function buildSnapshot(profile: StudentProfile | undefined): Promise<AppSnapshot> {
  const lessons = await db.lessons.toArray();
  return {
    lessons,
    state: {
      profile: profile ?? null,
      currentLesson: null,
      isOnline: navigator.onLine,
    },
  };
}

async function init(): Promise<void> {
  // 1. Seed bundled JSON lessons — ALWAYS runs, works offline
  await seedLessons();

  // 2. Check if a profile already exists
  const app = document.querySelector<HTMLDivElement>('#app')!;
  const existingProfile = await getProfile('');
  let currentNickname = existingProfile?.nickname ?? '';

  const router = createRouter({
    root: app,
    snapshot: await buildSnapshot(existingProfile),
    onCreateProfile: async (input) => {
      await createProfile({
        ...input,
        totalXP: 0,
        currentLevel: 1,
        streak: 0,
        lastActive: new Date().toISOString(),
        mathXP: 0,
        elaXP: 0,
      });

      currentNickname = input.nickname;
      const profile = await getProfile(input.nickname);
      return buildSnapshot(profile);
    },
    onSetLanguage: async (language) => {
      if (!currentNickname) {
        return buildSnapshot(undefined);
      }

      await updateProfile(currentNickname, { language });
      const profile = await getProfile(currentNickname);
      return buildSnapshot(profile);
    },
  });

  // 3. Start sync engine (listens for WiFi reconnect)
  initOfflineSync();

  // 4. Generate extra Gemini lessons in background — non-blocking
  preloadLessons((current, total) => {
    console.log(`[Preload] ${current}/${total} Gemini lessons ready`);
  });

  // 5. Hand off to the router
  await router.mount();
  console.log('[MentorAI] Boot complete');
}

init().catch(console.error);