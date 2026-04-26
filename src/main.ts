// src/main.ts
import './style.css';
import { seedLessons, getLessons, createProfile, getProgressForStudent, saveProgress } from './db';
import { initOfflineSync } from '../utils/offline';
import { preloadLessons } from './preload';
import { renderOnboarding, state as onboardingState } from './screens/onboarding';
import { renderDashboard } from './screens/dashboard';
import { renderSubjectPage, renderSettingsPlaceholder } from './screens/subject';
import { renderProgressPage } from './screens/progress';
import { renderSidebar } from './components/sidebar';
import type { StudentProfile, Lesson, Grade, Language, Subject, Progress } from './types';
import { renderLessonScreen } from './screens/lesson';  
import { startQuiz, submitQuiz, renderQuizScreen, renderQuizSummary } from './screens/quiz';

// ── App State ─────────────────────────────────────────────────────────────────

type Page = 'dashboard' | 'onboarding' | 'lesson' | 'progress' | 'settings' | 'math' | 'ela';

let currentPage: Page = 'onboarding';
let currentSubject: Subject = 'math';
let currentLessonId: number | null = null;
let app: HTMLElement;
let profile: StudentProfile | null = null;
let lessons: Lesson[] = [];
let recentProgress: Progress[] = [];

// ── Navigation ───────────────────────────────────────────────────────────────

async function navigateTo(page: string): Promise<void> {
  if (page === 'math' || page === 'ela') {
    currentSubject = page as Subject;
    if (profile) {
      lessons = await getLessons(profile.grade, page as Subject, 'en');
    }
    currentPage = page as Page;
  } else if (page === 'dashboard' || page === 'progress' || page === 'settings') {
    currentPage = page as Page;
  }
  render();
}

// ── Render ─────────────────────────────────────────────────────────────────

function render(): void {
  app.innerHTML = '';
  const isOnline = navigator.onLine;

  if (currentPage === 'onboarding') {
    app.appendChild(renderOnboarding());
    setupOnboardingHandlers();
    return;
  }

  const layout = document.createElement('div');
  layout.className = 'app-layout';

  const sidebar = renderSidebar({
    profile,
    currentPage,
    isOnline,
    onNavigate: (page) => { void navigateTo(page); }
  });

  let mainContent: HTMLElement;

  if (currentPage === 'math' || currentPage === 'ela') {
    mainContent = renderSubjectPage({
      subject: currentSubject,
      lessons: lessons.filter(l => l.subject === currentSubject),
      profile,
      isOnline,
      onSelectLesson: (lessonId: number) => {
        currentLessonId = lessonId;
        currentPage = 'lesson';
        render();
      },
      onStartBoss:    (_subject: Subject)  => { void _subject; },
      onGoBack: () => navigateTo('dashboard'),
    });
    setupSubjectPageHandlers();
  } else if (currentPage === 'lesson' && currentLessonId) {
    const selectedLesson = lessons.find(l => l.id === currentLessonId);
    if (selectedLesson) {
      mainContent = renderLessonScreen({
        lesson: selectedLesson,
        profile,
        isOnline,
        messages: [],
        isTutorThinking: false,
        onGoBack: () => {
          currentPage = currentSubject as Page;
          currentLessonId = null;
          render();
        },
        onTakeQuiz: async () => {
          const lesson = lessons.find(l => l.id === currentLessonId);
          if (lesson && profile) {
            app.innerHTML = '';
            const quizState = await startQuiz(lesson, { hintsRemaining: 3 });
            const renderQuizWithHandlers = () => {
              const screen = renderQuizScreen({
                onSelectAnswer: (idx: number) => {
                  quizState.answers[quizState.currentQuestionIndex] = idx;
                  quizState.answers = [...quizState.answers];
                },
                onUseHint: () => {
                  if (quizState.hintsRemaining > 0) {
                    quizState.hintsUsed++;
                    quizState.hintsRemaining--;
                  }
                },
                onNext: () => {
                  if (quizState.currentQuestionIndex < quizState.lesson.questions.length - 1) {
                    quizState.currentQuestionIndex++;
                    app.innerHTML = '';
                    app.appendChild(renderQuizWithHandlers());
                  }
                },
                onFinish: async () => {
                  const currentProfile = profile;
                  if (!currentProfile) return;
                  const result = await submitQuiz(currentProfile.nickname, lesson.title, lesson.subject);
                  await saveProgressRecord(lesson, result.score, result.xpEarned, result.hintsUsed);
                  recentProgress = await getProgressForStudent(currentProfile.nickname);
                  const summary = renderQuizSummary(result.score, result.xpEarned, result.hintsUsed, lesson.questions.length, () => {
                    currentPage = currentSubject as Page;
                    render();
                  });
                  app.innerHTML = '';
                  app.appendChild(summary);
                },
                onGoBack: () => {
                  render();
                }
              });
              return screen;
            };
            app.appendChild(renderQuizWithHandlers());
          }
        },
        onSendMessage: async (prompt: string) => {
          console.log('Tutor message:', prompt);
        }
      });
    } else {
      currentPage = currentSubject as Page;
      currentLessonId = null;
      render();
      return;
    }
  } else if (currentPage === 'progress') {
    mainContent = renderProgressPage({
      profile,
      lessons,
      recentProgress,
      isOnline,
      onNavigate: (subject) => { void navigateTo(subject); }
    });
    setupProgressPageHandlers();
  } else if (currentPage === 'settings') {
    mainContent = renderSettingsPlaceholder();
  } else {
    mainContent = renderDashboard({
      profile,
      lessons,
      isOnline,
      onOpenLesson: (subject) => { void navigateTo(subject); }
    });
  }

  layout.appendChild(sidebar);
  layout.appendChild(mainContent);
  app.appendChild(layout);
}

// ── Quiz Progress ─────────────────────────────────────────────────────────

async function saveProgressRecord(lesson: Lesson, score: number, xpEarned: number, hintsUsed: number): Promise<void> {
  const currentProfile = profile;
  if (!currentProfile) return;
  
  const lessonId = lesson.id!;
  
  await saveProgress({
    nickname: currentProfile.nickname,
    lessonId: lessonId,
    lessonTitle: lesson.title,
    subject: lesson.subject,
    score,
    xpEarned,
    attempts: lesson.questions.length,
    hintsUsed,
    completedAt: new Date().toISOString(),
  });
  
  currentProfile.totalXP += xpEarned;
  if (lesson.subject === 'math') {
    currentProfile.mathXP = (currentProfile.mathXP ?? 0) + xpEarned;
  } else {
    currentProfile.elaXP = (currentProfile.elaXP ?? 0) + xpEarned;
  }
}

// ── Onboarding ────────────────────────���───────────────────────────────────────

function setupOnboardingHandlers(): void {
  setTimeout(() => {
    const startBtn = document.getElementById('start-btn');
    if (!startBtn) { setTimeout(setupOnboardingHandlers, 200); return; }

    startBtn.addEventListener('click', async () => {
      if (!onboardingState.nickname || !onboardingState.grade) return;

      const newProfile: Omit<StudentProfile, 'id'> = {
        nickname:     onboardingState.nickname,
        grade:        onboardingState.grade as Grade,
        language:     'en' as Language,
        totalXP:      0,
        mathXP:       0,
        elaXP:        0,
        currentLevel: 1,
        streak:       0,
        lastActive:   new Date().toISOString(),
      };

      await createProfile(newProfile);
      profile  = { ...newProfile, id: 1 } as StudentProfile;
      lessons  = await getLessons(profile.grade, 'math', 'en');
      recentProgress = await getProgressForStudent(profile.nickname);
      currentPage = 'dashboard';
      render();
    });
  }, 100);
}

function setupSubjectPageHandlers(): void {
  setTimeout(() => {
    const backBtn = document.querySelector('[data-action="back"]');
    backBtn?.addEventListener('click', () => navigateTo('dashboard'));

    const startLessonBtns = document.querySelectorAll('[data-action^="start-lesson-"]');
    startLessonBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const lessonId = parseInt(target.dataset.action!.replace('start-lesson-', ''), 10);
        console.log('START LESSON CLICKED', lessonId);
        currentLessonId = lessonId;
        currentPage = 'lesson';
        render();
      });
    });
  }, 100);
}

function setupProgressPageHandlers(): void {
  setTimeout(() => {
    const continueMathBtn = document.querySelector('[data-action="continue-math"]');
    continueMathBtn?.addEventListener('click', () => {
      currentSubject = 'math';
      navigateTo('math');
    });

    const continueElaBtn = document.querySelector('[data-action="continue-ela"]');
    continueElaBtn?.addEventListener('click', () => {
      currentSubject = 'ela';
      navigateTo('ela');
    });
  }, 100);
}

// ── Event Delegation ─────────────────────────────────────────────────────────

document.addEventListener('click', (e) => {
  const target = e.target as HTMLElement;
  const button = target.closest('[data-page]') || target.closest('[data-action]') || target.closest('[data-route]');
  if (!button) return;
  const page = (button as HTMLElement).dataset.page || (button as HTMLElement).dataset.action || (button as HTMLElement).dataset.route;
  if (page) {
    e.preventDefault();
    void navigateTo(page);
  }
});

// ── Boot ──────────────────────────────────────────────────────────────────────

async function init(): Promise<void> {
  app = document.getElementById('app')!;

  await seedLessons();
  initOfflineSync();
  preloadLessons().catch(console.error);

  window.addEventListener('online',  () => render());
  window.addEventListener('offline', () => render());

  console.log('[MentorAI] Boot complete');
  render();
}

init().catch(console.error);

export {};