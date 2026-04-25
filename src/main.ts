// src/main.ts
import { initOfflineSync, registerSyncCallbacks } from '../utils/offline';
import { preloadLessons } from './preload';

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

initOfflineSync();

preloadLessons((current: number, total: number) => {
  console.log(`[Preload] ${current}/${total} lessons ready`);
});