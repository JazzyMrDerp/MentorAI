import type { Language } from './types.ts';

type UiCopy = {
  brand: string;
  status: {
    online: string;
    offline: string;
  };
  hero: {
    eyebrow: string;
    title: string;
    body: string;
    primaryCta: string;
    secondaryCta: string;
  };
  onboarding: {
    eyebrow: string;
    title: string;
    body: string;
    nicknameLabel: string;
    nicknamePlaceholder: string;
    gradeLabel: string;
    languageLabel: string;
    submit: string;
  };
  profile: {
    eyebrow: string;
    placeholderName: string;
    level: string;
    totalXp: string;
    nextLevel: string;
    streak: string;
    savedLessons: string;
    grade: string;
    controlEyebrow: string;
    controlTitle: string;
    controlBody: string;
    languageLabel: string;
    deviceSafe: string;
    privacySafe: string;
  };
  subjects: {
    eyebrow: string;
    title: string;
    body: string;
    math: string;
    ela: string;
    lessonCountLabel: string;
    waitingTitle: string;
    waitingBody: string;
    progressLabel: string;
    footer: string;
    open: string;
  };
  lesson: {
    eyebrow: string;
    back: string;
    grade: string;
    hintTokens: string;
    questionSprint: string;
    previewEyebrow: string;
    previewTitle: string;
    previewBody: string;
    quizComing: string;
    chatEyebrow: string;
    chatTitle: string;
    chatModeOnline: string;
    chatModeOffline: string;
    chatMentor: string;
    chatStudent: string;
    chatThinking: string;
    chatPromptLabel: string;
    chatPlaceholder: string;
    chatSend: string;
    chatFooterOnline: string;
    chatFooterOffline: string;
    askForHint: string;
    chatWelcomeOnline: string;
    chatWelcomeOffline: string;
    chatBackOnline: string;
    chatDroppedOffline: string;
  };
};

const COPY: Record<Language, UiCopy> = {
  en: {
    brand: 'MentorAI',
    status: {
      online: 'Online sync ready',
      offline: 'Offline mode active',
    },
    hero: {
      eyebrow: 'Offline-first tutoring for grades 6-8',
      title: 'A study cockpit that keeps moving when Wi-Fi disappears.',
      body: 'This UI gives students a calm dashboard, fast subject entry, and a guided lesson space that still feels alive when the connection drops.',
      primaryCta: 'Open math path',
      secondaryCta: 'Open ELA path',
    },
    onboarding: {
      eyebrow: 'Student setup',
      title: 'Create the learner profile on this device',
      body: 'Pick a nickname, grade, and language. MentorAI stores the setup locally so the app still opens instantly offline.',
      nicknameLabel: 'Nickname',
      nicknamePlaceholder: 'NovaLearner',
      gradeLabel: 'Grade',
      languageLabel: 'Language',
      submit: 'Save profile',
    },
    profile: {
      eyebrow: 'Active learner',
      placeholderName: 'Ready for launch',
      level: 'Level',
      totalXp: 'Total XP',
      nextLevel: 'Next level in',
      streak: 'Day streak',
      savedLessons: 'Saved lessons',
      grade: 'Grade track',
      controlEyebrow: 'Local controls',
      controlTitle: 'Tune the experience for this learner',
      controlBody: 'Language switching is already wired into the UI so the same dashboard and lesson flow can flip cleanly between English and Spanish.',
      languageLabel: 'Dashboard language',
      deviceSafe: 'Stored on this device',
      privacySafe: 'No account required',
    },
    subjects: {
      eyebrow: 'Launch lessons',
      title: 'Pick a subject and jump straight into saved content',
      body: 'Each card is built to surface the next lesson quickly, show progress, and feel distinct enough that judges remember the product.',
      math: 'Math',
      ela: 'ELA',
      lessonCountLabel: 'saved lessons',
      waitingTitle: 'Content queue warming up',
      waitingBody: 'Once lessons are written or generated, they land here automatically.',
      progressLabel: 'XP progress inside this subject',
      footer: 'Adaptive quiz and rewards connect here next.',
      open: 'Open lesson',
    },
    lesson: {
      eyebrow: 'Lesson view',
      back: 'Back to dashboard',
      grade: 'Grade',
      hintTokens: 'hint tokens',
      questionSprint: 'question sprint',
      previewEyebrow: 'Quiz preview',
      previewTitle: 'Practice route',
      previewBody: 'Person 3 can plug the quiz engine into this exact handoff without reworking the layout.',
      quizComing: 'Quiz engine next',
      chatEyebrow: 'MentorAI tutor',
      chatTitle: 'Adaptive help lane',
      chatModeOnline: 'Live-ready UI',
      chatModeOffline: 'Offline coaching',
      chatMentor: 'MentorAI',
      chatStudent: 'You',
      chatThinking: 'Thinking',
      chatPromptLabel: 'Ask for help',
      chatPlaceholder: 'Ask for a summary, a hint, or a simpler explanation...',
      chatSend: 'Send',
      chatFooterOnline: 'Online now. This box is ready for the Gemini handoff when Person 1 connects the endpoint.',
      chatFooterOffline: 'Offline now. The UI falls back to saved lesson guidance so students are never stranded.',
      askForHint: 'Use one hint',
      chatWelcomeOnline: 'You are online, so this tutor panel is staged for Gemini-backed answers as soon as the AI layer is wired.',
      chatWelcomeOffline: 'You are offline, but I can still coach from the lesson text and saved hints already on the device.',
      chatBackOnline: 'Connection restored. Live AI responses can resume as soon as the backend handoff is connected.',
      chatDroppedOffline: 'Connection dropped. Staying in offline coaching mode with saved lesson support.',
    },
  },
  es: {
    brand: 'MentorAI',
    status: {
      online: 'Sincronizacion lista',
      offline: 'Modo sin conexion activo',
    },
    hero: {
      eyebrow: 'Tutoria sin conexion para grados 6-8',
      title: 'Un panel de estudio que sigue funcionando cuando desaparece el Wi-Fi.',
      body: 'Esta interfaz da a los estudiantes un tablero claro, acceso rapido por materia y una vista de leccion guiada que se siente viva incluso sin internet.',
      primaryCta: 'Abrir ruta de matematicas',
      secondaryCta: 'Abrir ruta de ELA',
    },
    onboarding: {
      eyebrow: 'Configuracion del estudiante',
      title: 'Crea el perfil del estudiante en este dispositivo',
      body: 'Elige apodo, grado e idioma. MentorAI guarda la configuracion localmente para que la app abra al instante incluso sin conexion.',
      nicknameLabel: 'Apodo',
      nicknamePlaceholder: 'NovaLearner',
      gradeLabel: 'Grado',
      languageLabel: 'Idioma',
      submit: 'Guardar perfil',
    },
    profile: {
      eyebrow: 'Estudiante activo',
      placeholderName: 'Listo para despegar',
      level: 'Nivel',
      totalXp: 'XP total',
      nextLevel: 'Siguiente nivel en',
      streak: 'Racha diaria',
      savedLessons: 'Lecciones guardadas',
      grade: 'Ruta de grado',
      controlEyebrow: 'Controles locales',
      controlTitle: 'Ajusta la experiencia para este estudiante',
      controlBody: 'El cambio de idioma ya esta conectado en la interfaz para que el tablero y la leccion cambien limpiamente entre ingles y espanol.',
      languageLabel: 'Idioma del tablero',
      deviceSafe: 'Guardado en este dispositivo',
      privacySafe: 'Sin cuenta necesaria',
    },
    subjects: {
      eyebrow: 'Abrir lecciones',
      title: 'Elige una materia y entra directo al contenido guardado',
      body: 'Cada tarjeta muestra la siguiente leccion rapido, el progreso y una identidad visual clara para que el proyecto se recuerde en la demostracion.',
      math: 'Matematicas',
      ela: 'ELA',
      lessonCountLabel: 'lecciones guardadas',
      waitingTitle: 'El contenido aun se esta cargando',
      waitingBody: 'Cuando las lecciones esten listas o generadas, apareceran aqui.',
      progressLabel: 'Progreso de XP en esta materia',
      footer: 'El quiz adaptativo y las recompensas se conectan aqui despues.',
      open: 'Abrir leccion',
    },
    lesson: {
      eyebrow: 'Vista de leccion',
      back: 'Volver al tablero',
      grade: 'Grado',
      hintTokens: 'pistas',
      questionSprint: 'preguntas',
      previewEyebrow: 'Vista previa del quiz',
      previewTitle: 'Ruta de practica',
      previewBody: 'Person 3 puede conectar el motor del quiz en este punto sin rehacer el diseno.',
      quizComing: 'Quiz en camino',
      chatEyebrow: 'Tutor MentorAI',
      chatTitle: 'Canal de ayuda adaptativa',
      chatModeOnline: 'Interfaz lista para vivo',
      chatModeOffline: 'Ayuda sin conexion',
      chatMentor: 'MentorAI',
      chatStudent: 'Tu',
      chatThinking: 'Pensando',
      chatPromptLabel: 'Pide ayuda',
      chatPlaceholder: 'Pide un resumen, una pista o una explicacion mas simple...',
      chatSend: 'Enviar',
      chatFooterOnline: 'Con conexion. Esta caja ya esta preparada para el traspaso a Gemini cuando Person 1 conecte el endpoint.',
      chatFooterOffline: 'Sin conexion. La interfaz usa guia guardada para que el estudiante nunca se quede sin apoyo.',
      askForHint: 'Usar una pista',
      chatWelcomeOnline: 'Tienes conexion. Este panel ya esta preparado para respuestas de Gemini en cuanto la capa de IA quede conectada.',
      chatWelcomeOffline: 'No hay conexion, pero aun puedo ayudarte con el texto de la leccion y las pistas guardadas en el dispositivo.',
      chatBackOnline: 'La conexion regreso. Las respuestas de IA en vivo pueden volver en cuanto se conecte el endpoint.',
      chatDroppedOffline: 'La conexion se perdio. Seguimos en modo sin conexion con apoyo guardado.',
    },
  },
};

export function getCopy(language: Language): UiCopy {
  return COPY[language];
}
