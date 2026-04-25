// utils/offline.ts
import {
  getPendingSyncItems,
  clearSyncItem,
  incrementSyncRetry,
  saveLesson,
  updateProfile,
} from '../src/db';
import { generateLesson, generateProgressReport, getTutorResponse } from '../src/gemini';
import type { SyncQueueItem, Language, Subject, Grade } from '../src/types';

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_RETRIES    = 3;
const RETRY_DELAY_MS = 2000;
const SYNC_DEBOUNCE  = 1500;

// ── Sync State ────────────────────────────────────────────────────────────────

let syncInProgress    = false;
let syncDebounceTimer: ReturnType<typeof setTimeout> | null = null;

// ── UI Callbacks ──────────────────────────────────────────────────────────────
// Person 2 wires these up via registerSyncCallbacks() to show status in the UI

export let onSyncStart:    () => void                  = () => {};
export let onSyncComplete: (count: number) => void     = () => {};
export let onSyncError:    (msg: string) => void       = () => {};
export let onStatusChange: (online: boolean) => void   = () => {};

/**
 * Call this once in main.ts to connect the sync engine to your UI.
 * Each callback is optional — only pass the ones you need.
 */
export function registerSyncCallbacks(callbacks: {
  onSyncStart?:    () => void;
  onSyncComplete?: (count: number) => void;
  onSyncError?:    (msg: string) => void;
  onStatusChange?: (online: boolean) => void;
}): void {
  if (callbacks.onSyncStart)    onSyncStart    = callbacks.onSyncStart;
  if (callbacks.onSyncComplete) onSyncComplete = callbacks.onSyncComplete;
  if (callbacks.onSyncError)    onSyncError    = callbacks.onSyncError;
  if (callbacks.onStatusChange) onStatusChange = callbacks.onStatusChange;
}

// ── Connection Helpers ────────────────────────────────────────────────────────

/** Returns true if the browser believes it has internet */
export function isOnline(): boolean {
  return navigator.onLine;
}

/**
 * Returns the current connection + sync status.
 * Person 2 uses this to drive the status badge in the UI.
 */
export function getConnectionStatus(): 'online' | 'offline' | 'syncing' {
  if (syncInProgress) return 'syncing';
  return isOnline() ? 'online' : 'offline';
}

// ── Init ──────────────────────────────────────────────────────────────────────

/**
 * Call this ONCE in main.ts on app startup.
 * Registers online/offline listeners and attempts an immediate sync if online.
 */
export function initOfflineSync(): void {
  window.addEventListener('online', () => {
    onStatusChange(true);
    if (syncDebounceTimer) clearTimeout(syncDebounceTimer);
    // Wait 1.5s before syncing to avoid flaky connections
    syncDebounceTimer = setTimeout(() => flushSyncQueue(), SYNC_DEBOUNCE);
  });

  window.addEventListener('offline', () => {
    onStatusChange(false);
    if (syncDebounceTimer) clearTimeout(syncDebounceTimer);
  });

  // Also sync when user returns to the tab after being away
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && isOnline()) {
      flushSyncQueue();
    }
  });

  // Sync immediately if already online at launch
  if (isOnline()) flushSyncQueue();
}

// ── Sync Queue Processor ──────────────────────────────────────────────────────

/**
 * Processes every pending item in the sync queue.
 * Called automatically on reconnect — safe to call manually too.
 */
export async function flushSyncQueue(): Promise<void> {
  if (syncInProgress || !isOnline()) return;
  syncInProgress = true;

  let processedCount = 0;

  try {
    const queue = await getPendingSyncItems();
    if (queue.length === 0) { syncInProgress = false; return; }

    onSyncStart();
    console.log(`[Sync] Processing ${queue.length} queued items...`);

    for (const item of queue) {
      if (!isOnline()) {
        console.log('[Sync] Lost connection mid-sync — pausing.');
        break;
      }

      // Skip items that have failed too many times
      if ((item.retries ?? 0) >= MAX_RETRIES) {
        console.warn(`[Sync] Item ${item.id} hit max retries — clearing.`);
        await clearSyncItem(item.id);
        continue;
      }

      const success = await processSyncItem(item);

      if (success) {
        await clearSyncItem(item.id);
        processedCount++;
        console.log(`[Sync] ✓ ${item.type} (id: ${item.id})`);
      } else {
        await incrementSyncRetry(item.id);
        console.warn(`[Sync] ✗ ${item.type} failed — retry ${(item.retries ?? 0) + 1}`);
        await delay(RETRY_DELAY_MS);
      }
    }

    onSyncComplete(processedCount);
    console.log(`[Sync] Done — ${processedCount} items synced.`);

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown sync error';
    onSyncError(message);
    console.error('[Sync] Fatal error:', err);
  } finally {
    syncInProgress = false;
  }
}

// ── Item Router ───────────────────────────────────────────────────────────────

/**
 * Routes a single queued item to the correct Gemini handler.
 * Returns true on success, false on any failure.
 */
async function processSyncItem(item: SyncQueueItem): Promise<boolean> {
  try {
    switch (item.type) {

      case 'generate_lesson': {
        const { subject, grade, topic, language } = item.payload as {
          subject:  Subject;
          grade:    Grade;
          topic:    string;
          language: Language;
        };
        const lesson = await generateLesson(subject, grade, topic, language);
        await saveLesson(lesson);
        return true;
      }

      case 'progress_report': {
        const { nickname, scores } = item.payload as {
          nickname: string;
          scores:   { lessonTitle: string; score: number; subject: Subject }[];
        };
        const report = await generateProgressReport(nickname, scores);
        await updateProfile(nickname, { lastProgressReport: report } as any);
        return true;
      }

      case 'get_feedback': {
        const { question, studentAnswer, lessonContext, grade, language } = item.payload as {
          question:      string;
          studentAnswer: string;
          lessonContext: string;
          grade:         Grade;
          language:      Language;
        };
        const feedback = await getTutorResponse(
          `Student answered: "${studentAnswer}" to: ${question}`,
          lessonContext,
          grade,
          language
        );
        // Dispatch event so Person 3's quiz screen can display the feedback
        window.dispatchEvent(new CustomEvent('mentor:feedback', {
          detail: { feedback, question }
        }));
        return true;
      }

      default:
        console.warn(`[Sync] Unknown type: ${item.type} — clearing.`);
        return true;
    }
  } catch (err) {
    console.error(`[Sync] Error on item ${item.id}:`, err);
    return false;
  }
}

// ── Public Helper ─────────────────────────────────────────────────────────────

/**
 * Wraps any action with offline-aware logic.
 * If online: runs the action immediately.
 * If offline: runs the fallback (usually addToSyncQueue) instead.
 *
 * Usage (Person 3 calls this after quiz):
 *   await withOfflineSupport(
 *     () => generateProgressReport(nickname, scores),
 *     () => addToSyncQueue('progress_report', { nickname, scores })
 *   );
 */
export async function withOfflineSupport<T>(
  onlineAction: () => Promise<T>,
  offlineFallback: () => Promise<void>
): Promise<T | null> {
  if (isOnline()) {
    try {
      return await onlineAction();
    } catch {
      await offlineFallback();
      return null;
    }
  } else {
    await offlineFallback();
    return null;
  }
}

// ── Private Util ──────────────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}