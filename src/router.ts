import { getCopy } from './copy.ts';
import { renderDashboardScreen } from './screens/dashboard.ts';
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
}

type RouteName = 'dashboard' | 'lesson';

type ScreenBuild = {
  element: HTMLElement;
  afterMount?: () => void;
};

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

function initialTutorMessages(lesson: Lesson, language: Language, isOnline: boolean): TutorMessage[] {
  const copy = getCopy(language);

  return [
    {
      id: uniqueMessageId(),
      role: 'mentor',
      text: isOnline ? copy.lesson.chatWelcomeOnline : copy.lesson.chatWelcomeOffline,
      tone: isOnline ? 'Live layer' : 'Offline fallback',
    },
    {
      id: uniqueMessageId(),
      role: 'mentor',
      text:
        language === 'es'
          ? `Hoy vamos a trabajar ${lesson.title.toLowerCase()}. Pideme un resumen, una pista o que practiquemos una idea clave.`
          : `Today we are working on ${lesson.title.toLowerCase()}. Ask for a summary, a hint, or a practice explanation any time.`,
      tone: 'Lesson guide',
    },
  ];
}

function nextTutorReply(prompt: string, lesson: Lesson, language: Language, isOnline: boolean): string {
  const normalized = prompt.trim().toLowerCase();
  const firstParagraph = lesson.content.split(/\n+/).find(Boolean) ?? lesson.content;
  const firstHint = lesson.questions[0]?.hint;
  const quizCount = lesson.questions.length;

  if (language === 'es') {
    if (normalized.includes('pista') || normalized.includes('ayuda') || normalized.includes('atas')) {
      return firstHint
        ? `Claro. Una buena pista es esta: ${firstHint}`
        : 'Claro. Empieza por identificar la idea principal de la leccion y luego conecta cada ejemplo con esa idea.';
    }

    if (normalized.includes('resumen') || normalized.includes('explica') || normalized.includes('que significa')) {
      return `Resumen rapido: ${firstParagraph}`;
    }

    if (normalized.includes('pregunta') || normalized.includes('quiz') || normalized.includes('prueba')) {
      return `Tu practica tiene ${quizCount} preguntas guardadas para esta leccion. Lee con calma, detecta el patron y usa una pista solo si de verdad la necesitas.`;
    }

    return isOnline
      ? 'La capa visual ya esta lista. Cuando Gemini se conecte, esta caja enviara respuestas mas personalizadas. Por ahora, toma una idea del texto y conviertela en tu propia explicacion.'
      : 'Sigues cubierto sin internet. Usa las pistas guardadas, relee la primera parte de la leccion y busca una palabra clave que se repita.';
  }

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
    ? initialTutorMessages(
        snapshot.state.currentLesson,
        languageForState(snapshot.state),
        snapshot.state.isOnline,
      )
    : [];
  let tutorThinking = false;

  async function swapScreen(nextScreen: ScreenBuild): Promise<void> {
    if (activeScreen) {
      activeScreen.remove();
    }

    contentHost.appendChild(nextScreen.element);
    activeScreen = nextScreen.element;
    nextScreen.afterMount?.();
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
    tutorMessages = initialTutorMessages(nextLesson, languageForState(snapshot.state), snapshot.state.isOnline);
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

  async function createStudentProfile(input: CreateProfileInput): Promise<void> {
    snapshot = cloneSnapshot(await options.onCreateProfile(input));
    currentRoute = 'dashboard';
    tutorThinking = false;
    await render();
  }

  async function setLanguage(language: Language): Promise<void> {
    const nextSnapshot = cloneSnapshot(await options.onSetLanguage(language));
    snapshot = withCurrentLesson(nextSnapshot);

    if (snapshot.state.currentLesson) {
      tutorMessages = initialTutorMessages(
        snapshot.state.currentLesson,
        languageForState(snapshot.state),
        snapshot.state.isOnline,
      );
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
          languageForState(snapshot.state),
          snapshot.state.isOnline,
        ),
        tone: snapshot.state.isOnline ? 'Live layer' : 'Offline fallback',
      },
    ];
    tutorThinking = false;
    await render();
  }

  function buildScreen(): ScreenBuild {
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
        onSendMessage: async (prompt) => {
          await sendTutorMessage(prompt);
        },
      });
    }

    currentRoute = 'dashboard';

    return renderDashboardScreen({
      profile: snapshot.state.profile,
      lessons: snapshot.lessons,
      isOnline: snapshot.state.isOnline,
      onCreateProfile: async (input) => {
        await createStudentProfile(input);
      },
      onOpenLesson: (subject) => {
        void openLesson(subject);
      },
      onSetLanguage: async (language) => {
        await setLanguage(language);
      },
    });
  }

  async function render(): Promise<void> {
    const nextScreen = buildScreen();
    await swapScreen(nextScreen);
  }

  return {
    mount: async () => {
      await render();
    },
    setOnlineStatus: async (isOnline) => {
      if (snapshot.state.isOnline === isOnline) {
        return;
      }

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
            tone: isOnline ? 'Connection restored' : 'Connection lost',
          },
        ];
      }

      await render();
    },
    setSnapshot: async (nextSnapshot) => {
      snapshot = cloneSnapshot(nextSnapshot);
      await render();
    },
  };
}
