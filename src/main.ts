// src/main.ts
import './style.css';
import { seedLessons, getLessons, createProfile } from './db';
import { renderOnboarding, state as onboardingState } from './screens/onboarding.ts';
import { renderDashboard } from './screens/dashboard.ts';
import { renderSubjectPage, renderProgressPlaceholder, renderSettingsPlaceholder } from './screens/subject.ts';
import { renderLessonScreen, type TutorMessage } from './screens/lesson.ts'; // ← added TutorMessage
import { renderSidebar } from './components/sidebar.ts';
import { getTutorResponse } from './gemini.ts'; // ← new
import type { StudentProfile, Lesson, Grade, Language, Subject } from './types';


// ── Event Delegation ─────────────────────────────────────────────────────────
document.addEventListener('click', (e) => {
  const target = e.target as HTMLElement;
  const button = target.closest('[data-page]') || target.closest('[data-action]') || target.closest('[data-route]');
  if (!button) return;
  
  const page = (button as HTMLElement).dataset.page;
  const route = (button as HTMLElement).dataset.route;
  const _action = (button as HTMLElement).dataset.action;
  
  if (page || route) {
    const targetPage = page || route || 'dashboard';
    handleRouteClick(targetPage);
  }
  
  if (_action) {
    handleActionClick(_action);
  }
});


async function handleRouteClick(page: string): Promise<void> {
  if (page === 'dashboard') {
    currentPage = 'dashboard';
    render();
  } else if (page === 'progress') {
    currentPage = 'progress';
    render();
  } else if (page === 'settings') {
    currentPage = 'settings';
    render();
  } else if (page === 'math' || page === 'ela') {
    currentSubject = page as Subject;
    if (profile) {
      lessons = await getLessons(profile.grade, page as Subject, 'en');
    }
    currentPage = page as Page;
    render();
  } else if (page.startsWith('lesson-')) {
    const lessonId = parseInt(page.replace('lesson-', ''), 10);
    if (lessonId) {
      currentLessonId = lessonId;
      currentPage = 'lesson';
      render();
    }
  }
}


function handleActionClick(_action: string): void {
  void _action;
  if (_action.startsWith('start-lesson-')) {
    const lessonId = parseInt(_action.replace('start-lesson-', ''), 10);
    if (lessonId) {
      currentLessonId = lessonId;
      currentPage = 'lesson';
      render();
    }
  } else if (_action === 'back') {
    if (currentPage === 'lesson') {
      tutorMessages = []; // ← reset chat on back
      currentPage = currentSubject as Page;
      currentLessonId = null;
    } else {
      currentPage = 'dashboard';
    }
    render();
  } else if (_action === 'continue-math') {
    currentSubject = 'math';
    currentPage = 'math';
    render();
  } else if (_action === 'continue-ela') {
    currentSubject = 'ela';
    currentPage = 'ela';
    render();
  }
}


// ── App state ─────────────────────────────────────────────────────────

type Page = 'dashboard' | 'onboarding' | 'lesson' | 'progress' | 'settings' | 'math' | 'ela';

let currentPage: Page = 'onboarding';

declare global {
  interface Window {
    DEBUG_SUBJECT: Subject;
  }
}

let currentSubject: Subject = 'math';
let currentLessonId: number | null = null;

Object.defineProperty(window, 'DEBUG_SUBJECT', {
  get: () => currentSubject,
  set: (v) => { currentSubject = v; },
  configurable: true
});

let app: HTMLElement;
let profile: StudentProfile | null = null;
let lessons: Lesson[] = [];

// ── Chat state ────────────────────────────────────────────────────────────────
let tutorMessages: TutorMessage[] = [];
let isTutorThinking = false;

function uniqueMessageId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}


// ── App boot ──────────────────────────────────────────────────────────────────

async function init(): Promise<void> {
  app = document.querySelector('#app')!;
  await seedLessons();
  currentPage = 'onboarding';
  profile = null;
  console.log('[MentorAI] Boot complete');
  render();
  setupOnboardingHandlers();
}


function render(): void {
  app.innerHTML = '';
  const isOnline = navigator.onLine;
  
  if (currentPage === 'onboarding') {
    const onboarding = renderOnboarding();
    app.appendChild(onboarding);
    return;
  }
  
  const layout = document.createElement('div');
  layout.className = 'app-layout';
  
  const sidebar = renderSidebar({
    profile,
    currentPage: currentPage,
    isOnline,
    onNavigate: async (page) => {
      if (page === 'dashboard') {
        currentPage = 'dashboard';
        render();
      } else if (page === 'progress') {
        currentPage = 'progress';
        render();
      } else if (page === 'settings') {
        currentPage = 'settings';
        render();
      } else if (page === 'math' || page === 'ela') {
        currentSubject = page as Subject;
        if (profile) {
          lessons = await getLessons(profile.grade, page as Subject, 'en');
        }
        currentPage = page as Page;
        render();
      } else {
        currentPage = 'dashboard';
        render();
      }
    }
  });
  
  let mainContent: HTMLElement;
  
  if (currentPage === 'math') {
    mainContent = renderSubjectPage({
      subject: 'math',
      lessons: lessons.filter(l => l.subject === 'math'),
      profile,
      isOnline,
      onSelectLesson: (lessonId) => {
        currentLessonId = lessonId;
        currentPage = 'lesson';
        render();
      },
      onStartBoss: (subject) => { void subject; },
      onGoBack: () => {
        currentPage = 'dashboard';
        render();
      }
    });
  } else if (currentPage === 'ela') {
    mainContent = renderSubjectPage({
      subject: 'ela',
      lessons: lessons.filter(l => l.subject === 'ela'),
      profile,
      isOnline,
      onSelectLesson: (lessonId) => {
        currentLessonId = lessonId;
        currentPage = 'lesson';
        render();
      },
      onStartBoss: (subject) => { void subject; },
      onGoBack: () => {
        currentPage = 'dashboard';
        render();
      }
    });
  } else if (currentPage === 'lesson' && currentLessonId) {
    const selectedLesson = lessons.find(l => l.id === currentLessonId);
    if (selectedLesson) {

      // Seed welcome message when entering a lesson fresh
      if (tutorMessages.length === 0) {
        tutorMessages = [
          {
            id: uniqueMessageId(),
            role: 'mentor',
            text: `Hi! I'm your MentorAI tutor. Today we're working on "${selectedLesson.title}". Ask me anything! 🧠`,
          },
        ];
      }

      mainContent = renderLessonScreen({
        lesson: selectedLesson,
        profile,
        isOnline,
        messages: tutorMessages,         // ← was []
        isTutorThinking: isTutorThinking, // ← was false
        onGoBack: () => {
          tutorMessages = [];             // ← reset chat
          isTutorThinking = false;
          currentPage = currentSubject as Page;
          currentLessonId = null;
          render();
        },
        onTakeQuiz: () => {
          console.log('Take Quiz clicked for lesson:', currentLessonId);
        },
        onSendMessage: async (prompt) => {
          tutorMessages = [
            ...tutorMessages,
            { id: uniqueMessageId(), role: 'student', text: prompt },
          ];
          isTutorThinking = true;
          render();

          try {
            const reply = await getTutorResponse(
              prompt,
              selectedLesson.content,
              selectedLesson.grade,
            );
            tutorMessages = [
              ...tutorMessages,
              { id: uniqueMessageId(), role: 'mentor', text: reply },
            ];
          } catch {
            tutorMessages = [
              ...tutorMessages,
              { id: uniqueMessageId(), role: 'mentor', text: "Sorry, I couldn't connect. Try again in a moment! 🔌" },
            ];
          } finally {
            isTutorThinking = false;
            render();
          }
        },
      });
    } else {
      currentPage = currentSubject as Page;
      currentLessonId = null;
      render();
      return;
    }
  } else if (currentPage === 'progress') {
    mainContent = renderProgressPlaceholder();
  } else if (currentPage === 'settings') {
    mainContent = renderSettingsPlaceholder();
  } else {
    mainContent = renderDashboard({
      profile,
      lessons,
      isOnline,
      onOpenLesson: (subject) => {
        currentSubject = subject;
        document.title = 'MentorAI - ' + subject.toUpperCase();
        currentPage = subject as Page;
        render();
      }
    });
  }
  
  layout.appendChild(sidebar);
  layout.appendChild(mainContent);
  app.appendChild(layout);
}


function setupOnboardingHandlers(): void {
  setTimeout(() => {
    const nicknameInput = document.getElementById('nickname-input');
    const startBtn = document.getElementById('start-btn');
    
    if (!startBtn || !nicknameInput) {
      console.log('Elements not found, retrying...');
      setTimeout(setupOnboardingHandlers, 200);
      return;
    }
    
    console.log('Setting up onboarding handlers');
    
    startBtn.addEventListener('click', async () => {
      console.log('Start button clicked');
      
      if (!onboardingState.nickname || !onboardingState.grade) {
        console.log('Missing nickname or grade');
        return;
      }
      
      const newProfile: Omit<StudentProfile, 'id'> = {
        nickname: onboardingState.nickname,
        grade: onboardingState.grade as Grade,
        language: 'en' as Language,
        totalXP: 0,
        mathXP: 0,
        elaXP: 0,
        currentLevel: 1,
        streak: 0,
        lastActive: new Date().toISOString(),
      };
      
      await createProfile(newProfile);
      profile = { ...newProfile, id: 1 } as StudentProfile;
      
      lessons = await getLessons(profile.grade, 'math', 'en');
      currentPage = 'dashboard';
      render();
    });
  }, 100);
}


init().catch(console.error);

export {};