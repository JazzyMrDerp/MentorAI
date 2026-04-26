// src/main.ts
import { initOfflineSync, registerSyncCallbacks } from '../utils/offline';
import { preloadLessons } from './preload';
import { seedLessons } from './db';
import { getProfile } from './db';

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

async function init(): Promise<void> {
  // 1. Seed bundled JSON lessons — ALWAYS runs, works offline
  await seedLessons();

  // 2. Check if a profile already exists
  const app = document.querySelector<HTMLDivElement>('#app')!;
  const profile = await getProfile(''); // Person 2 will handle this properly

  // 3. Start sync engine (listens for WiFi reconnect)
  initOfflineSync();

  // 4. Generate extra Gemini lessons in background — non-blocking
  preloadLessons((current, total) => {
    console.log(`[Preload] ${current}/${total} Gemini lessons ready`);
  });

  // 5. Hand off to Person 2's router
  // renderRouter(app, profile);   ← Person 2 uncomments this
  console.log('[MentorAI] Boot complete');
}

init().catch(console.error);