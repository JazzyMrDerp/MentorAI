// src/main.ts
import { initOfflineSync, registerSyncCallbacks } from '../utils/offline';
import { preloadLessons } from './preload';
import { createRouter, type AppSnapshot, type CreateProfileInput, type MentorRouter } from './router';
import db, { createProfile, updateProfile } from './db';
import type { Language, Lesson, StudentProfile } from './types';

function showToast(message: string): void {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

let router: MentorRouter | null = null;

registerSyncCallbacks({
  onSyncStart: () => {
    document.querySelector('.sync-badge')?.setAttribute('data-status', 'syncing');
  },
  onSyncComplete: (count: number) => {
    document.querySelector('.sync-badge')?.setAttribute('data-status', 'online');
    if (count > 0) showToast(`✨ Synced ${count} new items`);
  },
  onStatusChange: async (online: boolean) => {
    document.querySelector('.sync-badge')?.setAttribute('data-status', online ? 'online' : 'offline');
    showToast(online
      ? '🟢 Back online — syncing...'
      : '🔴 Offline mode — progress still saves'
    );

    if (router) {
      await router.setOnlineStatus(online);
    }
  }
});

initOfflineSync();

async function getSavedProfile(): Promise<StudentProfile | null> {
  return (await db.studentProfile.toCollection().first()) ?? null;
}

async function getLessonsForProfile(profile: StudentProfile | null): Promise<Lesson[]> {
  const allLessons = await db.lessons.toArray();
  if (!profile) return [];
  return allLessons.filter(
    (lesson) => lesson.grade === profile.grade && lesson.language === profile.language,
  );
}

async function buildSnapshot(profile: StudentProfile | null): Promise<AppSnapshot> {
  const lessons = await getLessonsForProfile(profile);
  return {
    lessons,
    state: {
      profile,
      currentLesson: null,
      isOnline: navigator.onLine,
    },
  };
}

async function handleCreateProfile(input: CreateProfileInput): Promise<AppSnapshot> {
  const id = await createProfile({
    nickname: input.nickname,
    grade: input.grade,
    language: input.language,
    totalXP: 0,
    currentLevel: 1,
    streak: 0,
    lastActive: new Date().toISOString(),
    mathXP: 0,
    elaXP: 0,
  });

  const profile = await db.studentProfile.get(id);
  return buildSnapshot(profile ?? null);
}

async function handleSetLanguage(language: Language): Promise<AppSnapshot> {
  const profile = await getSavedProfile();
  if (!profile) {
    return buildSnapshot(null);
  }

  await updateProfile(profile.nickname, { language });
  const updatedProfile = await db.studentProfile.get(profile.id as number);
  return buildSnapshot(updatedProfile ?? profile);
}

async function startApp(): Promise<void> {
  const root = document.getElementById('app');
  if (!root) {
    throw new Error('App root element not found');
  }

  const profile = await getSavedProfile();
  const snapshot = await buildSnapshot(profile);

  router = createRouter({
    root,
    snapshot,
    onCreateProfile: handleCreateProfile,
    onSetLanguage: handleSetLanguage,
  });

  await router.mount();

  preloadLessons((current: number, total: number) => {
    console.log(`[Preload] ${current}/${total} lessons ready`);
  }).then(async () => {
    if (!router) return;
    const updatedProfile = await getSavedProfile();
    await router.setSnapshot(await buildSnapshot(updatedProfile));
  }).catch((error) => {
    console.error('[Preload] failed to preload lessons', error);
  });
}

void startApp();