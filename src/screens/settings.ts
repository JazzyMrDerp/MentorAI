import type { StudentProfile } from '../types';
import { db } from '../db';

interface SettingsOptions {
  profile: StudentProfile;
  onResetData: () => void;
  onGoBack: () => void;
}

export function renderSettingsScreen(options: SettingsOptions): HTMLElement {
  const container = document.createElement('div');
  container.className = 'main-content';
  
  container.innerHTML = `
    <div class="settings-screen">
      <h1 class="settings-title">Settings</h1>
      
      <section class="settings-section">
        <h2>Profile</h2>
        <div class="settings-card">
          <div class="setting-item">
            <span class="setting-label">Nickname</span>
            <span class="setting-value">${options.profile.nickname}</span>
          </div>
          <div class="setting-item">
            <span class="setting-label">Grade</span>
            <span class="setting-value">Grade ${options.profile.grade}</span>
          </div>
          <div class="setting-item">
            <span class="setting-label">Total XP</span>
            <span class="setting-value">${options.profile.totalXP}</span>
          </div>
          <div class="setting-item">
            <span class="setting-label">Current Level</span>
            <span class="setting-value">Level ${options.profile.currentLevel}</span>
          </div>
        </div>
      </section>
      
      <section class="settings-section">
        <h2>Data</h2>
        <div class="settings-card">
          <button class="settings-btn danger" id="reset-data-btn">
            🗑️ Reset All Data
          </button>
        </div>
        <p class="settings-warning">This will delete all your progress, lessons, and profile data. This cannot be undone.</p>
      </section>
      
      <section class="settings-section">
        <h2>About</h2>
        <div class="settings-card">
          <div class="setting-item">
            <span class="setting-label">Version</span>
            <span class="setting-value">1.0.0</span>
          </div>
          <div class="setting-item">
            <span class="setting-label">Offline Mode</span>
            <span class="setting-value">Supported</span>
          </div>
        </div>
      </section>
    </div>
  `;
  
  const resetBtn = container.querySelector('#reset-data-btn');
  resetBtn?.addEventListener('click', async () => {
    if (confirm('Are you sure you want to reset all data? This cannot be undone.')) {
      await db.delete();
      options.onResetData();
    }
  });
  
  return container;
}

export async function getProfileStats(): Promise<{ lessons: number; progress: number }> {
  const lessons = await db.lessons.count();
  const progress = await db.progress.count();
  return { lessons, progress };
}