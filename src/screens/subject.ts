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
        <div class="progress-header">
          <button class="btn-back" data-action="back">&larr; Back</button>
          <h1>
            <span class="subject-icon ${isMath ? 'math' : 'ela'}">${subjectIcon}</span>
            ${subjectTitle}
          </h1>
          <p>Choose a lesson to begin learning</p>
        </div>

        <div class="progress-stats-grid">
          <div class="stat-card">
            <div class="stat-icon ${isMath ? 'purple' : 'teal'}">${subjectIcon}</div>
            <div class="stat-info">
              <div class="stat-label">Available Lessons</div>
              <div class="stat-value">${options.lessons.length}</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon gold">⭐</div>
            <div class="stat-info">
              <div class="stat-label">Your Level</div>
              <div class="stat-value">${currentLevel}</div>
            </div>
          </div>
        </div>

        <div class="progress-section">
          <h2>${subjectTitle} Lessons</h2>
          
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
        </div>

        <div class="progress-section">
          <h2>${subjectTitle} Boss Battle</h2>
          <div class="mastery-card">
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
      <div class="page-center">
        <div class="progress-header">
          <h1>Settings</h1>
          <p>Customize your experience</p>
        </div>
        <div class="mastery-card">
          <div class="placeholder-icon">⚙️</div>
          <h2>Settings Coming Soon</h2>
          <p>Customize your preferences and profile coming soon.</p>
        </div>
      </div>
    </div>
  `;
  return container;
}