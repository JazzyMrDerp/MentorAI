import './style.css';

import { createProfile, db, getLessons, getProfile, updateProfile } from './db.ts';
import { createRouter, type AppSnapshot, type CreateProfileInput } from './router.ts';
import type {
  AppState,
  Language,
  Lesson,
  Question,
  StudentProfile,
  Subject,
} from './types.ts';

const PROFILE_STORAGE_KEY = 'mentorai:nickname';

type LessonBlueprint = {
  subject: Subject;
  grade: 6 | 7 | 8;
  title: Record<Language, string>;
  content: Record<Language, string>;
  questions: Record<Language, Question[]>;
};

const FALLBACK_BLUEPRINTS: LessonBlueprint[] = [
  {
    subject: 'math',
    grade: 6,
    title: {
      en: 'Ratio Moves',
      es: 'Movimientos con razones',
    },
    content: {
      en: 'Ratios compare two quantities. A ratio like 2:3 tells us that for every 2 of one thing, there are 3 of another.\n\nYou can show ratios with words, fractions, or a colon. When a recipe or scale model changes size, ratios help the relationship stay balanced.',
      es: 'Las razones comparan dos cantidades. Una razon como 2:3 nos dice que por cada 2 de una cosa, hay 3 de otra.\n\nPuedes mostrar razones con palabras, fracciones o dos puntos. Cuando una receta o una maqueta cambian de tamano, las razones ayudan a mantener la relacion equilibrada.',
    },
    questions: {
      en: [
        {
          prompt: 'Which ratio matches 4 red beads and 6 blue beads?',
          choices: ['4:6', '6:4', '10:4', '24:1'],
          correctIndex: 0,
          hint: 'Place red first and blue second.',
        },
        {
          prompt: 'What fraction is equivalent to the ratio 3:5?',
          choices: ['3/5', '5/3', '8/3', '15/1'],
          correctIndex: 0,
          hint: 'Read the ratio from left to right.',
        },
        {
          prompt: 'If a mix uses 2 cups of juice for every 1 cup of water, how much water is needed for 6 cups of juice?',
          choices: ['2 cups', '3 cups', '4 cups', '6 cups'],
          correctIndex: 1,
          hint: 'Scale both parts by the same factor.',
        },
      ],
      es: [
        {
          prompt: 'Que razon representa 4 cuentas rojas y 6 azules?',
          choices: ['4:6', '6:4', '10:4', '24:1'],
          correctIndex: 0,
          hint: 'Coloca primero rojo y despues azul.',
        },
        {
          prompt: 'Que fraccion es equivalente a la razon 3:5?',
          choices: ['3/5', '5/3', '8/3', '15/1'],
          correctIndex: 0,
          hint: 'Lee la razon de izquierda a derecha.',
        },
        {
          prompt: 'Si una mezcla usa 2 tazas de jugo por cada 1 de agua, cuanta agua se necesita para 6 tazas de jugo?',
          choices: ['2 tazas', '3 tazas', '4 tazas', '6 tazas'],
          correctIndex: 1,
          hint: 'Multiplica las dos partes por el mismo factor.',
        },
      ],
    },
  },
  {
    subject: 'ela',
    grade: 6,
    title: {
      en: 'Finding Main Idea',
      es: 'Encontrar la idea principal',
    },
    content: {
      en: 'The main idea is the biggest point the author wants you to remember. Details support that main idea by adding facts, examples, or explanations.\n\nWhen you read a paragraph, ask yourself: what is this mostly about? Then look at how the supporting details connect back to that answer.',
      es: 'La idea principal es el punto mas importante que el autor quiere que recuerdes. Los detalles apoyan esa idea principal con hechos, ejemplos o explicaciones.\n\nCuando leas un parrafo, preguntate: de que trata principalmente? Luego observa como los detalles apoyan esa respuesta.',
    },
    questions: {
      en: [
        {
          prompt: 'What do supporting details do?',
          choices: ['Hide the topic', 'Support the main idea', 'Replace the title', 'Ask questions'],
          correctIndex: 1,
          hint: 'Think about how details help the writer explain more.',
        },
        {
          prompt: 'Which question helps you find the main idea?',
          choices: ['Who wrote this?', 'What is this mostly about?', 'How many pages are there?', 'Where is the picture?'],
          correctIndex: 1,
          hint: 'Look for the biggest point, not the small facts.',
        },
        {
          prompt: 'If a paragraph lists three reasons recess helps students focus, what is likely the main idea?',
          choices: ['Students like recess', 'Recess helps students focus', 'School days are long', 'There are three reasons'],
          correctIndex: 1,
          hint: 'Turn the repeated idea into one clear sentence.',
        },
      ],
      es: [
        {
          prompt: 'Que hacen los detalles de apoyo?',
          choices: ['Esconden el tema', 'Apoyan la idea principal', 'Reemplazan el titulo', 'Hacen preguntas'],
          correctIndex: 1,
          hint: 'Piensa en como los detalles ayudan al autor a explicar.',
        },
        {
          prompt: 'Que pregunta te ayuda a encontrar la idea principal?',
          choices: ['Quien escribio esto?', 'De que trata principalmente?', 'Cuantas paginas hay?', 'Donde esta la imagen?'],
          correctIndex: 1,
          hint: 'Busca el punto mas grande, no el detalle pequeno.',
        },
        {
          prompt: 'Si un parrafo da tres razones por las que el recreo ayuda a concentrarse, cual es la idea principal?',
          choices: ['A los estudiantes les gusta el recreo', 'El recreo ayuda a concentrarse', 'Los dias escolares son largos', 'Hay tres razones'],
          correctIndex: 1,
          hint: 'Convierte la idea repetida en una frase clara.',
        },
      ],
    },
  },
  {
    subject: 'math',
    grade: 7,
    title: {
      en: 'Fraction Confidence',
      es: 'Confianza con fracciones',
    },
    content: {
      en: 'Fractions describe parts of a whole. To add or subtract fractions, you need a common denominator so the pieces are the same size.\n\nOnce the denominators match, combine the numerators and simplify if possible. Visualizing pizza slices or grid blocks can help you see why common denominators matter.',
      es: 'Las fracciones describen partes de un todo. Para sumar o restar fracciones, necesitas un denominador comun para que las partes tengan el mismo tamano.\n\nCuando los denominadores coinciden, combinas los numeradores y simplificas si es posible. Imaginar rebanadas de pizza o cuadriculas puede ayudarte a ver por que importa el denominador comun.',
    },
    questions: {
      en: [
        {
          prompt: 'What is 1/2 + 1/4?',
          choices: ['1/6', '3/4', '2/6', '1/3'],
          correctIndex: 1,
          hint: 'Convert 1/2 into fourths first.',
        },
        {
          prompt: 'Why do you need a common denominator?',
          choices: ['To make the numerator bigger', 'To compare equal-sized parts', 'To change the fraction to a decimal', 'To multiply faster'],
          correctIndex: 1,
          hint: 'The pieces must be the same size before you combine them.',
        },
        {
          prompt: 'Which fraction is equivalent to 2/3?',
          choices: ['4/6', '3/4', '5/8', '6/4'],
          correctIndex: 0,
          hint: 'Multiply top and bottom by the same number.',
        },
      ],
      es: [
        {
          prompt: 'Cuanto es 1/2 + 1/4?',
          choices: ['1/6', '3/4', '2/6', '1/3'],
          correctIndex: 1,
          hint: 'Convierte 1/2 en cuartos primero.',
        },
        {
          prompt: 'Por que necesitas un denominador comun?',
          choices: ['Para agrandar el numerador', 'Para comparar partes del mismo tamano', 'Para cambiar a decimal', 'Para multiplicar mas rapido'],
          correctIndex: 1,
          hint: 'Las partes deben tener el mismo tamano antes de sumarlas.',
        },
        {
          prompt: 'Que fraccion es equivalente a 2/3?',
          choices: ['4/6', '3/4', '5/8', '6/4'],
          correctIndex: 0,
          hint: 'Multiplica arriba y abajo por el mismo numero.',
        },
      ],
    },
  },
  {
    subject: 'ela',
    grade: 7,
    title: {
      en: 'Context Clue Detective',
      es: 'Detective de pistas de contexto',
    },
    content: {
      en: 'Context clues are hints around an unfamiliar word. Authors often place definitions, examples, or contrasting ideas nearby so readers can infer meaning.\n\nWhen a new word appears, read the whole sentence and the ones around it. Ask what meaning would make the sentence make sense.',
      es: 'Las pistas de contexto son senales alrededor de una palabra desconocida. Los autores suelen incluir definiciones, ejemplos o ideas opuestas para que el lector pueda inferir el significado.\n\nCuando aparezca una palabra nueva, lee toda la oracion y las que la rodean. Preguntate que significado haria que la oracion tuviera sentido.',
    },
    questions: {
      en: [
        {
          prompt: 'What are context clues?',
          choices: ['Pictures in a book', 'Hints near an unknown word', 'Titles of chapters', 'Words in a dictionary'],
          correctIndex: 1,
          hint: 'They help you infer meaning without leaving the text.',
        },
        {
          prompt: 'If a character is described as gloomy, sad, and silent, what does gloomy most likely mean?',
          choices: ['Energetic', 'Cheerful', 'Downhearted', 'Hungry'],
          correctIndex: 2,
          hint: 'Use the nearby describing words as hints.',
        },
        {
          prompt: 'What should you read when you find a tricky word?',
          choices: ['Only the word itself', 'Only the title', 'The sentence and nearby sentences', 'The last page'],
          correctIndex: 2,
          hint: 'Context lives around the word, not inside it.',
        },
      ],
      es: [
        {
          prompt: 'Que son las pistas de contexto?',
          choices: ['Imagenes en un libro', 'Senales cerca de una palabra desconocida', 'Titulos de capitulos', 'Palabras en un diccionario'],
          correctIndex: 1,
          hint: 'Te ayudan a inferir el significado sin salir del texto.',
        },
        {
          prompt: 'Si un personaje es gloomy, triste y silencioso, que significa probablemente gloomy?',
          choices: ['Energetico', 'Alegre', 'Desanimado', 'Hambriento'],
          correctIndex: 2,
          hint: 'Usa las palabras cercanas como pista.',
        },
        {
          prompt: 'Que debes leer cuando aparece una palabra dificil?',
          choices: ['Solo la palabra', 'Solo el titulo', 'La oracion y las cercanas', 'La ultima pagina'],
          correctIndex: 2,
          hint: 'El contexto vive alrededor de la palabra.',
        },
      ],
    },
  },
  {
    subject: 'math',
    grade: 8,
    title: {
      en: 'Geometry in Motion',
      es: 'Geometria en movimiento',
    },
    content: {
      en: 'Geometry helps us describe shapes, angles, and space. Triangles, rectangles, and circles each follow useful rules that let us measure and compare them.\n\nWhen solving geometry problems, start by naming what you know. Then connect that information to a formula or relationship, like perimeter, area, or angle sum.',
      es: 'La geometria nos ayuda a describir formas, angulos y espacio. Los triangulos, rectangulos y circulos siguen reglas utiles que permiten medirlos y compararlos.\n\nCuando resuelvas problemas de geometria, empieza por nombrar lo que sabes. Luego conecta esa informacion con una formula o relacion, como perimetro, area o suma de angulos.',
    },
    questions: {
      en: [
        {
          prompt: 'What is the sum of the angles in a triangle?',
          choices: ['90 degrees', '180 degrees', '270 degrees', '360 degrees'],
          correctIndex: 1,
          hint: 'Three angles in a triangle always make a straight angle.',
        },
        {
          prompt: 'Which measurement tells the distance around a shape?',
          choices: ['Area', 'Volume', 'Perimeter', 'Radius'],
          correctIndex: 2,
          hint: 'Think about walking around the outside edge.',
        },
        {
          prompt: 'A rectangle is 5 units by 3 units. What is its area?',
          choices: ['8', '15', '16', '30'],
          correctIndex: 1,
          hint: 'Multiply length by width.',
        },
      ],
      es: [
        {
          prompt: 'Cual es la suma de los angulos de un triangulo?',
          choices: ['90 grados', '180 grados', '270 grados', '360 grados'],
          correctIndex: 1,
          hint: 'Los tres angulos forman un angulo llano.',
        },
        {
          prompt: 'Que medida indica la distancia alrededor de una figura?',
          choices: ['Area', 'Volumen', 'Perimetro', 'Radio'],
          correctIndex: 2,
          hint: 'Imagina caminar por el borde exterior.',
        },
        {
          prompt: 'Un rectangulo mide 5 por 3 unidades. Cual es su area?',
          choices: ['8', '15', '16', '30'],
          correctIndex: 1,
          hint: 'Multiplica largo por ancho.',
        },
      ],
    },
  },
  {
    subject: 'ela',
    grade: 8,
    title: {
      en: 'Essay Structure Studio',
      es: 'Taller de estructura del ensayo',
    },
    content: {
      en: 'Strong essays follow a clear structure: introduction, body paragraphs, and conclusion. The introduction presents a claim, the body proves it, and the conclusion leaves the reader with a final takeaway.\n\nEach body paragraph should focus on one reason or piece of evidence. Good transitions help the writing feel connected instead of random.',
      es: 'Los ensayos solidos siguen una estructura clara: introduccion, parrafos de desarrollo y conclusion. La introduccion presenta una idea central, el desarrollo la prueba y la conclusion deja una idea final.\n\nCada parrafo del desarrollo debe concentrarse en una razon o evidencia. Las buenas transiciones hacen que el texto se sienta conectado y no al azar.',
    },
    questions: {
      en: [
        {
          prompt: 'What is the job of the introduction?',
          choices: ['List every detail', 'Present the main claim', 'Repeat the body paragraph', 'Add a citation'],
          correctIndex: 1,
          hint: 'The opening sets up the essay’s direction.',
        },
        {
          prompt: 'What should each body paragraph focus on?',
          choices: ['One reason or piece of evidence', 'A random fact', 'A new unrelated topic', 'The author biography'],
          correctIndex: 0,
          hint: 'Body paragraphs work best when they stay focused.',
        },
        {
          prompt: 'Why are transitions useful in an essay?',
          choices: ['They make the essay longer', 'They connect ideas smoothly', 'They remove evidence', 'They change the topic'],
          correctIndex: 1,
          hint: 'Transitions act like bridges between ideas.',
        },
      ],
      es: [
        {
          prompt: 'Cual es la funcion de la introduccion?',
          choices: ['Listar cada detalle', 'Presentar la idea principal', 'Repetir el desarrollo', 'Agregar una cita'],
          correctIndex: 1,
          hint: 'La apertura marca la direccion del ensayo.',
        },
        {
          prompt: 'En que debe centrarse cada parrafo del desarrollo?',
          choices: ['Una razon o evidencia', 'Un dato al azar', 'Un tema nuevo sin relacion', 'La biografia del autor'],
          correctIndex: 0,
          hint: 'Los parrafos funcionan mejor cuando se mantienen enfocados.',
        },
        {
          prompt: 'Por que son utiles las transiciones?',
          choices: ['Hacen el ensayo mas largo', 'Conectan ideas con fluidez', 'Eliminan evidencia', 'Cambian el tema'],
          correctIndex: 1,
          hint: 'Las transiciones son puentes entre ideas.',
        },
      ],
    },
  },
];

function buildFallbackLessons(language: Language): Lesson[] {
  return FALLBACK_BLUEPRINTS.map((blueprint, index) => ({
    id: 9000 + index,
    subject: blueprint.subject,
    grade: blueprint.grade,
    language,
    title: blueprint.title[language],
    content: blueprint.content[language],
    questions: blueprint.questions[language],
    createdAt: '2026-04-25T19:00:00.000Z',
    isPreloaded: true,
  }));
}

async function loadStoredProfile(): Promise<StudentProfile | null> {
  const rememberedNickname = window.localStorage.getItem(PROFILE_STORAGE_KEY);
  if (rememberedNickname) {
    const rememberedProfile = await getProfile(rememberedNickname);
    if (rememberedProfile) {
      return rememberedProfile;
    }
  }

  const firstProfile = await db.studentProfile.toCollection().first();
  if (firstProfile) {
    window.localStorage.setItem(PROFILE_STORAGE_KEY, firstProfile.nickname);
    return firstProfile;
  }

  return null;
}

async function loadLessonCatalog(profile: StudentProfile | null): Promise<Lesson[]> {
  const language = profile?.language ?? 'en';

  if (!profile) {
    return buildFallbackLessons(language);
  }

  const [mathLessons, elaLessons] = await Promise.all([
    getLessons(profile.grade, 'math', language),
    getLessons(profile.grade, 'ela', language),
  ]);

  const savedLessons = [...mathLessons, ...elaLessons];
  return savedLessons.length > 0 ? savedLessons : buildFallbackLessons(language);
}

function buildSnapshot(profile: StudentProfile | null, lessons: Lesson[]): AppSnapshot {
  const state: AppState = {
    profile,
    currentLesson: null,
    isOnline: navigator.onLine,
  };

  return { state, lessons };
}

async function persistProfile(input: CreateProfileInput): Promise<StudentProfile> {
  const existingProfile = await getProfile(input.nickname.trim());

  if (existingProfile) {
    await updateProfile(existingProfile.nickname, {
      grade: input.grade,
      language: input.language,
    });

    return {
      ...existingProfile,
      grade: input.grade,
      language: input.language,
    };
  }

  const newProfile = {
    nickname: input.nickname.trim(),
    grade: input.grade,
    language: input.language,
    totalXP: 120,
    currentLevel: 1,
    streak: 3,
    lastActive: new Date().toISOString(),
    mathXP: 60,
    elaXP: 60,
  } satisfies Omit<StudentProfile, 'id'>;

  const id = await createProfile(newProfile);
  return { id, ...newProfile };
}

async function bootstrap(): Promise<void> {
  const appRoot = document.querySelector<HTMLDivElement>('#app');
  if (!appRoot) {
    throw new Error('App root not found.');
  }

  const profile = await loadStoredProfile();
  const lessons = await loadLessonCatalog(profile);
  const router = createRouter({
    root: appRoot,
    snapshot: buildSnapshot(profile, lessons),
    onCreateProfile: async (input) => {
      const nextProfile = await persistProfile(input);
      window.localStorage.setItem(PROFILE_STORAGE_KEY, nextProfile.nickname);
      const nextLessons = await loadLessonCatalog(nextProfile);
      return buildSnapshot(nextProfile, nextLessons);
    },
    onSetLanguage: async (language) => {
      const activeProfile = await loadStoredProfile();
      if (!activeProfile) {
        return buildSnapshot(null, buildFallbackLessons(language));
      }

      await updateProfile(activeProfile.nickname, { language });
      const nextProfile: StudentProfile = { ...activeProfile, language };
      const nextLessons = await loadLessonCatalog(nextProfile);
      return buildSnapshot(nextProfile, nextLessons);
    },
  });

  await router.mount();

  window.addEventListener('online', () => {
    void router.setOnlineStatus(true);
  });

  window.addEventListener('offline', () => {
    void router.setOnlineStatus(false);
  });
}

bootstrap().catch((error) => {
  const appRoot = document.querySelector<HTMLDivElement>('#app');
  if (!appRoot) {
    return;
  }

  console.error(error);
  appRoot.innerHTML = `
    <section class="boot-error">
      <p class="boot-error__eyebrow">MentorAI</p>
      <h1>UI bootstrap failed</h1>
      <p>The app shell could not start. Check the console for details and reload after fixing the setup.</p>
    </section>
  `;
});
