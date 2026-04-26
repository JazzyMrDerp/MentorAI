import type { Lesson, StudentProfile, Subject } from '../types';

interface SubjectPageOptions {
  subject: Subject;
  lessons: Lesson[];
  profile: StudentProfile | null;
  isOnline: boolean;
  onSelectLesson: (lessonId: number) => void;
  onStartBoss: (subject: Subject) => void;
  onGoBack: () => void;
}

function getLevelFromXP(xp: number): number {
  return Math.floor(xp / 200) + 1;
}

export function renderSubjectPage(options: SubjectPageOptions): HTMLElement {
  const container = document.createElement('div');
  
  const currentLevel = options.profile ? getLevelFromXP(options.profile.totalXP) : 1;
  const subjectTitle = options.subject === 'math' ? 'Math' : 'ELA';
  const subjectIcon = options.subject === 'math' ? '📐' : '📖';
  const isMath = options.subject === 'math';
  
container.innerHTML = `
    <div class="main-content">
      <div class="page-center">
        <div class="subject-inner">
          <div class="subject-header">
          <div>
            <button class="btn-back" data-action="back">&larr; Back</button>
            <h1 class="subject-title">
              <span class="subject-icon ${isMath ? 'math' : 'ela'}">${subjectIcon}</span>
              ${subjectTitle}
            </h1>
          </div>
        </div>
        
        <div class="subject-stats">
          <div class="stat-card">
            <div class="stat-icon ${isMath ? 'math' : 'ela'}">${subjectIcon}</div>
            <div>
              <div class="stat-label">Available Lessons</div>
              <div class="stat-value">${options.lessons.length}</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon gold">⭐</div>
            <div>
              <div class="stat-label">Your Level</div>
              <div class="stat-value">${currentLevel}</div>
            </div>
          </div>
        </div>
        
        <div class="lesson-grid">
          ${options.lessons.length > 0 ? options.lessons.map(lesson => `
            <div class="lesson-card" data-lesson-id="${lesson.id}">
              <div class="lesson-card-title">${lesson.title}</div>
              <div class="lesson-card-meta">Grade ${lesson.grade} • ${lesson.language.toUpperCase()}</div>
              <div class="lesson-card-questions">${lesson.questions.length} questions</div>
              <button class="btn-start-lesson ${isMath ? '' : 'ela'}" data-action="start-lesson-${lesson.id}">Start Lesson</button>
            </div>
          `).join('') : `
            <div class="empty-state">
              <p>No ${subjectTitle.toLowerCase()} lessons available yet.</p>
              <p>Check back soon!</p>
            </div>
          `}
        </div>
        
        <div class="boss-section">
          <h2>${subjectTitle} Boss Battle</h2>
          <p>Test your skills against the ${subjectTitle} boss!</p>
          <button class="btn-boss ${isMath ? '' : 'ela'}" data-action="boss-${options.subject}">
            🔥 Start ${subjectTitle} Boss
          </button>
        </div>
        </div>
      </div>
    </div>
  `;
  
  return container;
}

export function renderProgressPlaceholder(): HTMLElement {
  const container = document.createElement('div');
  container.innerHTML = `
    <div class="main-content">
      <div class="placeholder-screen">
        <div class="placeholder-icon">📊</div>
        <h1>Progress</h1>
        <p>Track your learning journey coming soon.</p>
      </div>
    </div>
  `;
  return container;
}

export function renderSettingsPlaceholder(): HTMLElement {
  const container = document.createElement('div');
  container.innerHTML = `
    <div class="main-content">
      <div class="placeholder-screen">
        <div class="placeholder-icon">⚙️</div>
        <h1>Settings</h1>
        <p>Customize your experience coming soon.</p>
      </div>
    </div>
  `;
  return container;
}