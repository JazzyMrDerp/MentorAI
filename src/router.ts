import { getCopy } from './copy.ts';
import { renderDashboard } from './screens/dashboard.ts';
import { renderLessonScreen, type TutorMessage } from './screens/lesson.ts';
import type { AppState, Grade, Language, Lesson, Subject } from './types.ts';

export interface CreateProfileInput {
  nickname: string;
  grade: Grade;
  language: Language;
}

export interface AppSnapshot {
  state: AppState;
  lessons: Lesson[];
}

interface RouterOptions {
  root: HTMLElement;
  snapshot: AppSnapshot;
  onCreateProfile: (input: CreateProfileInput) => Promise<AppSnapshot>;
  onSetLanguage: (language: Language) => Promise<AppSnapshot>;
}

export interface MentorRouter {
  mount: () => Promise<void>;
  setOnlineStatus: (isOnline: boolean) => Promise<void>;
  setSnapshot: (snapshot: AppSnapshot) => Promise<void>;
  navigate: (page: string) => Promise<void>;
}

type RouteName = 'dashboard' | 'lesson' | 'progress' | 'settings' | 'subject';

function uniqueMessageId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function cloneSnapshot(snapshot: AppSnapshot): AppSnapshot {
  return {
    lessons: [...snapshot.lessons],
    state: {
      ...snapshot.state,
    },
  };
}

function languageForState(state: AppState): Language {
  return state.profile?.language ?? state.currentLesson?.language ?? 'en';
}

function chooseLesson(lessons: Lesson[], subject: Subject): Lesson | null {
  return lessons.find((lesson) => lesson.subject === subject) ?? null;
}

function initialTutorMessages(lesson: Lesson, isOnline: boolean): TutorMessage[] {
  const copy = getCopy('en');

  return [
    {
      id: uniqueMessageId(),
      role: 'mentor',
      text: isOnline ? copy.lesson.chatWelcomeOnline : copy.lesson.chatWelcomeOffline,
    },
    {
      id: uniqueMessageId(),
      role: 'mentor',
      text: `Today we are working on ${lesson.title.toLowerCase()}. Ask for a summary, a hint, or a practice explanation any time.`,
    },
  ];
}

function nextTutorReply(prompt: string, lesson: Lesson, isOnline: boolean): string {
  const normalized = prompt.trim().toLowerCase();
  const firstParagraph = lesson.content.split(/\n+/).find(Boolean) ?? lesson.content;
  const firstHint = lesson.questions[0]?.hint;
  const quizCount = lesson.questions.length;

  if (normalized.includes('hint') || normalized.includes('help') || normalized.includes('stuck')) {
    return firstHint
      ? `Try this hint: ${firstHint}`
      : 'Start with the main idea of the lesson, then connect each example back to that core idea.';
  }

  if (
    normalized.includes('summary') ||
    normalized.includes('explain') ||
    normalized.includes('what does') ||
    normalized.includes('review')
  ) {
    return `Quick recap: ${firstParagraph}`;
  }

  if (normalized.includes('question') || normalized.includes('quiz') || normalized.includes('test')) {
    return `This lesson is paired with ${quizCount} saved practice questions. Slow down, look for the pattern, and spend a hint only when it unlocks the next step.`;
  }

  return isOnline
    ? 'The UI layer is ready for the Gemini handoff. Until that endpoint is wired in, try restating one key idea from the lesson in your own words and checking whether the examples still fit.'
    : 'You are still covered offline. Lean on the saved lesson text, reread the first paragraph, and look for the key word or relationship that repeats.';
}

export function createRouter(options: RouterOptions): MentorRouter {
  const shell = document.createElement('div');
  shell.className = 'app-shell';

  const contentHost = document.createElement('div');
  contentHost.className = 'app-shell__content';

  shell.appendChild(contentHost);
  options.root.innerHTML = '';
  options.root.appendChild(shell);

  let snapshot = cloneSnapshot(options.snapshot);
  let currentRoute: RouteName = snapshot.state.currentLesson ? 'lesson' : 'dashboard';
  let activeScreen: HTMLElement | null = null;
  let tutorMessages: TutorMessage[] = snapshot.state.currentLesson
    ? initialTutorMessages(snapshot.state.currentLesson, snapshot.state.isOnline)
    : [];
  let tutorThinking = false;

  async function swapScreen(nextScreen: HTMLElement): Promise<void> {
    if (activeScreen) {
      activeScreen.remove();
    }

    contentHost.appendChild(nextScreen);
    activeScreen = nextScreen;
  }

  function withCurrentLesson(nextSnapshot: AppSnapshot): AppSnapshot {
    if (!snapshot.state.currentLesson) {
      return cloneSnapshot(nextSnapshot);
    }

    const currentLesson = snapshot.state.currentLesson;
    const replacement =
      nextSnapshot.lessons.find((lesson) => lesson.id === currentLesson.id) ??
      nextSnapshot.lessons.find(
        (lesson) => lesson.subject === currentLesson.subject && lesson.title === currentLesson.title,
      ) ??
      nextSnapshot.lessons.find((lesson) => lesson.subject === currentLesson.subject) ??
      null;

    return {
      lessons: [...nextSnapshot.lessons],
      state: {
        ...nextSnapshot.state,
        currentLesson: replacement,
      },
    };
  }

  async function openLesson(subject: Subject): Promise<void> {
    const nextLesson = chooseLesson(snapshot.lessons, subject);
    if (!nextLesson) {
      return;
    }

    snapshot = {
      lessons: [...snapshot.lessons],
      state: {
        ...snapshot.state,
        currentLesson: nextLesson,
      },
    };

    currentRoute = 'lesson';
    tutorThinking = false;
    tutorMessages = initialTutorMessages(nextLesson, snapshot.state.isOnline);
    await render();
  }

  async function openProgress(): Promise<void> {
    currentRoute = 'progress';
    await render();
  }

  async function openSettings(): Promise<void> {
    currentRoute = 'settings';
    await render();
  }

  async function returnToDashboard(): Promise<void> {
    snapshot = {
      lessons: [...snapshot.lessons],
      state: {
        ...snapshot.state,
        currentLesson: null,
      },
    };
    currentRoute = 'dashboard';
    tutorThinking = false;
    await render();
  }

  // Router options are kept for future extensibility
  void _createStudentProfile;
  void _setLanguage;

  async function _createStudentProfile(input: CreateProfileInput): Promise<void> {
    snapshot = cloneSnapshot(await options.onCreateProfile(input));
    currentRoute = 'dashboard';
    tutorThinking = false;
    await render();
  }

  async function _setLanguage(language: Language): Promise<void> {
    const nextSnapshot = cloneSnapshot(await options.onSetLanguage(language));
    snapshot = withCurrentLesson(nextSnapshot);

    if (snapshot.state.currentLesson) {
      tutorMessages = initialTutorMessages(snapshot.state.currentLesson, snapshot.state.isOnline);
      currentRoute = 'lesson';
    }

    await render();
  }

  async function sendTutorMessage(prompt: string): Promise<void> {
    if (!snapshot.state.currentLesson) {
      return;
    }

    tutorMessages = [
      ...tutorMessages,
      {
        id: uniqueMessageId(),
        role: 'student',
        text: prompt,
      },
    ];
    tutorThinking = true;
    await render();

    await new Promise((resolve) => {
      window.setTimeout(resolve, snapshot.state.isOnline ? 650 : 420);
    });

    tutorMessages = [
      ...tutorMessages,
      {
        id: uniqueMessageId(),
        role: 'mentor',
        text: nextTutorReply(
          prompt,
          snapshot.state.currentLesson,
          snapshot.state.isOnline,
        ),
      },
    ];
    tutorThinking = false;
    await render();
  }

  function buildScreen(): HTMLElement {
    if (currentRoute === 'progress') {
      const container = document.createElement('div');
      container.className = 'main-content';
      container.innerHTML = `
        <div class="placeholder-screen">
          <div class="placeholder-icon">📊</div>
          <h1>Progress</h1>
          <p>Track your learning journey coming soon.</p>
        </div>
      `;
      return container;
    }
    if (currentRoute === 'settings') {
      const container = document.createElement('div');
      container.className = 'main-content';
      container.innerHTML = `
        <div class="placeholder-screen">
          <div class="placeholder-icon">⚙️</div>
          <h1>Settings</h1>
          <p>Customize your experience coming soon.</p>
        </div>
      `;
      return container;
    }
    if (currentRoute === 'lesson' && snapshot.state.currentLesson) {
      return renderLessonScreen({
        lesson: snapshot.state.currentLesson,
        profile: snapshot.state.profile,
        isOnline: snapshot.state.isOnline,
        messages: tutorMessages,
        isTutorThinking: tutorThinking,
        onGoBack: () => {
          void returnToDashboard();
        },
        onTakeQuiz: () => {
          console.log('Quiz not yet implemented');
        },
        onSendMessage: async (prompt) => {
          await sendTutorMessage(prompt);
        },
      });
    }

    currentRoute = 'dashboard';

    return renderDashboard({
      profile: snapshot.state.profile,
      lessons: snapshot.lessons,
      isOnline: snapshot.state.isOnline,
      onOpenLesson: (subject: Subject) => {
        void openLesson(subject);
      },
    });
  }

  async function render(): Promise<void> {
    await swapScreen(buildScreen());
  }

return {
    mount: async () => {
      await render();
    },
    setOnlineStatus: async (isOnline) => {

      snapshot = {
        lessons: [...snapshot.lessons],
        state: {
          ...snapshot.state,
          isOnline,
        },
      };

      if (snapshot.state.currentLesson) {
        const copy = getCopy(languageForState(snapshot.state));
        tutorMessages = [
          ...tutorMessages,
          {
            id: uniqueMessageId(),
            role: 'mentor',
            text: isOnline ? copy.lesson.chatBackOnline : copy.lesson.chatDroppedOffline,
          },
        ];
      }

      await render();
    },
    setSnapshot: async (nextSnapshot) => {
      snapshot = cloneSnapshot(nextSnapshot);
      await render();
    },
    navigate: async (page: string) => {
      if (page === 'dashboard') {
        await returnToDashboard();
      } else if (page === 'progress') {
        await openProgress();
      } else if (page === 'settings') {
        await openSettings();
      } else if (page === 'math' || page === 'ela') {
        await openLesson(page as Subject);
      }
    },
  };
}
