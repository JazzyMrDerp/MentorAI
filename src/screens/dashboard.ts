import type { Lesson, StudentProfile, Subject } from '../types.ts';

interface DashboardOptions {
  profile: StudentProfile | null;
  lessons: Lesson[];
  isOnline: boolean;
  onOpenLesson: (subject: Subject) => void;
}

function getLevelFromXP(xp: number): number {
  return Math.floor(xp / 200) + 1;
}

function formatDate(): string {
  const options: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'short', day: 'numeric' };
  return new Date().toLocaleDateString('en-US', options);
}

export function renderDashboard(options: DashboardOptions): HTMLElement {
  const container = document.createElement('div');
  
  const nickname = options.profile?.nickname ?? 'Student';
  const totalXP = options.profile?.totalXP ?? 0;
  const streak = options.profile?.streak ?? 0;
  const currentLevel = getLevelFromXP(totalXP);
  const xpInLevel = totalXP % 200;
  const xpProgress = Math.max(12, (xpInLevel / 200) * 100);
  
  const mathLessons = options.lessons.filter(l => l.subject === 'math');
  const elaLessons = options.lessons.filter(l => l.subject === 'ela');
  
  const mathLastScore = 0;
  const elaLastScore = 0;

  container.innerHTML = `
    <div class="main-content">
      <div class="page-center">
        <div class="dashboard-inner">
        <div class="dashboard-header">
        <div>
          <h1 class="dashboard-welcome">Welcome back, ${nickname}</h1>
          <p class="dashboard-sub">Ready to continue learning?</p>
        </div>
        <div class="dashboard-date">${formatDate()}</div>
      </div>

      <div class="stats-row">
        <div class="stat-card">
          <div class="stat-icon gold">🏆</div>
          <div>
            <div class="stat-label">Total XP</div>
            <div class="stat-value">${totalXP}</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon orange">🔥</div>
          <div>
            <div class="stat-label">Streak</div>
            <div class="stat-value">${streak}</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon teal">📚</div>
          <div>
            <div class="stat-label">Lessons</div>
            <div class="stat-value">${options.lessons.length}</div>
          </div>
        </div>
      </div>

      <div class="level-card">
        <div class="level-card-header">
          <div class="level-card-title">
            <span class="level-badge">⭐ Level ${currentLevel}</span>
          </div>
          <div class="level-xp-label">${xpInLevel} / 200 XP</div>
        </div>
        <div class="level-bar-track">
          <div class="level-bar-fill" style="width: 0%" data-xp-fill="${xpProgress}%"></div>
        </div>
      </div>

      <h2 class="section-title">Continue Learning</h2>
      
      <div class="continue-grid">
        <div class="continue-card" data-subject="math">
          <div class="continue-card-header">
            <div class="continue-icon math">📐</div>
            <div class="continue-last-score">
              <div class="continue-score-label">Last Score</div>
              <div class="continue-score-value">${mathLastScore}%</div>
            </div>
          </div>
          <div class="continue-title">Math</div>
          <div class="continue-meta">${mathLessons.length} lessons available</div>
          <button class="btn-continue-math" data-action="continue-math">
            Continue →
          </button>
        </div>

        <div class="continue-card" data-subject="ela">
          <div class="continue-card-header">
            <div class="continue-icon ela">📖</div>
            <div class="continue-last-score">
              <div class="continue-score-label">Last Score</div>
              <div class="continue-score-value">${elaLastScore}%</div>
            </div>
          </div>
          <div class="continue-title">ELA</div>
          <div class="continue-meta">${elaLessons.length} lessons available</div>
          <button class="btn-continue-ela" data-action="continue-ela">
            Continue →
          </button>
        </div>
      </div>
      </div>
    </div>
  `;

  setTimeout(() => {
    const xpFill = container.querySelector('[data-xp-fill]') as HTMLElement;
    if (xpFill && xpFill.dataset.xpFill) {
      xpFill.style.width = xpFill.dataset.xpFill;
    }
  }, 100);

  const mathCard = container.querySelector('[data-subject="math"]');
  const elaCard = container.querySelector('[data-subject="ela"]');

  mathCard?.addEventListener('click', () => {
    options.onOpenLesson('math');
  });
  elaCard?.addEventListener('click', () => {
    options.onOpenLesson('ela');
  });

  return container;
}

export function showDashboard(options: DashboardOptions): HTMLElement {
  const container = renderDashboard(options);
  return container;
}