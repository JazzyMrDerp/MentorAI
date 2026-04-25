// src/app.ts
// Minimal app renderer - Person 2 will replace with full UI

import './style.css';
import type { Lesson } from './types';

function getApp(): HTMLElement {
  const el = document.getElementById('app');
  if (!el) throw new Error('#app element not found');
  return el;
}

export function renderDashboard(lessons: Lesson[]): void {
  const app = getApp();
  const total = lessons.length;
  const math = lessons.filter(l => l.subject === 'math').length;
  const ela = lessons.filter(l => l.subject === 'ela').length;

  app.innerHTML = `
    <div class="dashboard">
      <header>
        <h1>MentorAI</h1>
        <span class="sync-badge" data-status="online"></span>
      </header>
      <main>
        <section class="stats">
          <div class="stat-card">
            <span class="stat-value">${total}</span>
            <span class="stat-label">Total Lessons</span>
          </div>
          <div class="stat-card">
            <span class="stat-value">${math}</span>
            <span class="stat-label">Math</span>
          </div>
          <div class="stat-card">
            <span class="stat-value">${ela}</span>
            <span class="stat-label">ELA</span>
          </div>
        </section>
        <section class="lessons-grid">
          ${lessons.map(l => `
            <div class="lesson-card" data-subject="${l.subject}">
              <h3>${l.title}</h3>
              <p>Grade ${l.grade} • ${l.language.toUpperCase()}</p>
            </div>
          `).join('')}
        </section>
      </main>
    </div>
  `;
}

export function renderOffline(): void {
  getApp().innerHTML = `
    <div class="offline-message">
      <h1>🔴 Offline</h1>
      <p>Lessons will load when you're back online.</p>
    </div>
  `;
}

export function renderLoading(): void {
  getApp().innerHTML = `
    <div class="loading">
      <h1>Loading...</h1>
    </div>
  `;
}