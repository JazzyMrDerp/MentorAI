// src/main.ts
import { initOfflineSync, registerSyncCallbacks } from '../utils/offline';
import { preloadLessons } from './preload';
import { getAllLessons } from './db';
import { renderLoading, renderOffline, renderDashboard } from './app';

const app = document.getElementById('app')!;

function showToast(message: string): void {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

registerSyncCallbacks({
  onSyncStart: () => {
    document.querySelector('.sync-badge')?.setAttribute('data-status', 'syncing');
  },
  onSyncComplete: (count: number) => {
    document.querySelector('.sync-badge')?.setAttribute('data-status', 'online');
    if (count > 0) showToast(`✨ Synced ${count} new items`);
  },
  onStatusChange: (online: boolean) => {
    document.querySelector('.sync-badge')?.setAttribute('data-status', online ? 'online' : 'offline');
    showToast(online
      ? '🟢 Back online — syncing...'
      : '🔴 Offline mode — progress still saves'
    );
  }
});

async function initApp(): Promise<void> {
  renderLoading();

  await initOfflineSync();

  if (!navigator.onLine) {
    renderOffline();
    return;
  }

  await preloadLessons((current: number, total: number) => {
    console.log(`[Preload] ${current}/${total} lessons ready`);
  });

  const lessons = await getAllLessons();
  
  if (lessons.length === 0) {
    app.innerHTML = `
      <div class="no-lessons">
        <h1>Welcome to MentorAI!</h1>
        <p>No lessons found. Check your connection and refresh.</p>
      </div>
    `;
    return;
  }
  
  renderDashboard(lessons);
}

initApp();