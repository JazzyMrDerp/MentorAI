import { gsap } from 'gsap';
import { createIcons, icons } from 'lucide';

import { getCopy } from '../copy.ts';
import type { Lesson, StudentProfile } from '../types.ts';

export interface TutorMessage {
  id: string;
  role: 'mentor' | 'student';
  text: string;
  tone?: string;
}

interface LessonScreenOptions {
  lesson: Lesson;
  profile: StudentProfile | null;
  isOnline: boolean;
  messages: TutorMessage[];
  isTutorThinking: boolean;
  onGoBack: () => void;
  onSendMessage: (prompt: string) => Promise<void>;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderLessonScreen(options: LessonScreenOptions): {
  element: HTMLElement;
  afterMount: () => void;
} {
  const language = options.profile?.language ?? options.lesson.language;
  const copy = getCopy(language);
  const lesson = options.lesson;
  const screen = document.createElement('section');
  const paragraphs = lesson.content.split(/\n+/).filter(Boolean);
  const hintTokens = 3;

  screen.className = 'screen lesson';
  screen.innerHTML = `
    <section class="lesson__toolbar glass-panel">
      <div class="lesson__toolbar-main">
        <button class="icon-button" type="button" data-action="back" aria-label="${copy.lesson.back}">
          <i data-lucide="arrow-left"></i>
        </button>
        <div>
          <p class="eyebrow">${copy.lesson.eyebrow}</p>
          <strong>${escapeHtml(lesson.title)}</strong>
        </div>
      </div>
      <div class="lesson__toolbar-actions">
        <span class="status-pill ${options.isOnline ? 'status-pill--online' : 'status-pill--offline'}">
          <i data-lucide="${options.isOnline ? 'satellite' : 'cloud-off'}"></i>
          ${options.isOnline ? copy.status.online : copy.status.offline}
        </span>
        <span class="pill">
          <i data-lucide="badge-plus"></i>
          ${hintTokens} ${copy.lesson.hintTokens}
        </span>
      </div>
    </section>

    <section class="lesson__layout">
      <article class="lesson__article glass-panel">
        <div class="lesson__hero">
          <p class="eyebrow">${copy.subjects[lesson.subject]} · ${copy.lesson.grade} ${lesson.grade}</p>
          <h2>${escapeHtml(lesson.title)}</h2>
          <p class="lesson__lede">${escapeHtml(paragraphs[0] ?? lesson.content)}</p>
          <div class="lesson__meta">
            <span class="meta-pill">
              <i data-lucide="languages"></i>
              ${lesson.language === 'es' ? 'Espanol' : 'English'}
            </span>
            <span class="meta-pill">
              <i data-lucide="list-checks"></i>
              ${lesson.questions.length} ${copy.lesson.questionSprint}
            </span>
          </div>
        </div>

        <div class="lesson__copy">
          ${paragraphs
            .map((paragraph, index) =>
              index === 0
                ? ''
                : `<p>${escapeHtml(paragraph)}</p>`,
            )
            .join('')}
        </div>

        <section class="lesson__quiz-preview">
          <div class="lesson__actions">
            <div>
              <p class="eyebrow">${copy.lesson.previewEyebrow}</p>
              <h2>${copy.lesson.previewTitle}</h2>
            </div>
            <button class="ghost-button" type="button" disabled>
              <i data-lucide="trophy"></i>
              ${copy.lesson.quizComing}
            </button>
          </div>
          <p class="lesson__quiz-note">${copy.lesson.previewBody}</p>
          <ol class="lesson__quiz-list">
            ${lesson.questions
              .slice(0, 3)
              .map(
                (question, index) => `
                  <li>
                    <span>${index + 1}</span>
                    <div>${escapeHtml(question.prompt)}</div>
                  </li>
                `,
              )
              .join('')}
          </ol>
        </section>
      </article>

      <aside class="lesson__tutor glass-panel">
        <div class="lesson__tutor-head">
          <div>
            <p class="eyebrow">${copy.lesson.chatEyebrow}</p>
            <h2>${copy.lesson.chatTitle}</h2>
          </div>
          <div class="lesson__tutor-status">
            <span class="chip">
              <i data-lucide="sparkles"></i>
              ${options.isOnline ? copy.lesson.chatModeOnline : copy.lesson.chatModeOffline}
            </span>
          </div>
        </div>

        <div class="chat-stream">
          ${options.messages
            .map(
              (message) => `
                <article class="chat-message chat-message--${message.role}">
                  <div class="chat-message__head">
                    <strong>${message.role === 'mentor' ? copy.lesson.chatMentor : copy.lesson.chatStudent}</strong>
                    ${message.tone ? `<span class="chat-message__tone">${escapeHtml(message.tone)}</span>` : ''}
                  </div>
                  <div class="chat-message__body">
                    <p>${escapeHtml(message.text)}</p>
                  </div>
                </article>
              `,
            )
            .join('')}
          ${
            options.isTutorThinking
              ? `
                <article class="chat-message chat-message--mentor">
                  <div class="chat-message__head">
                    <strong>${copy.lesson.chatMentor}</strong>
                    <span class="chat-message__tone">${copy.lesson.chatThinking}</span>
                  </div>
                  <div class="chat-message__body">
                    <div class="typing" aria-hidden="true">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                  </div>
                </article>
              `
              : ''
          }
        </div>

        <form class="chat-compose" data-chat-form>
          <label class="field">
            <span>${copy.lesson.chatPromptLabel}</span>
            <div class="chat-compose__row">
              <textarea
                class="chat-compose__textarea"
                name="prompt"
                placeholder="${copy.lesson.chatPlaceholder}"
                required
              ></textarea>
              <button class="button" type="submit">
                <i data-lucide="send"></i>
                ${copy.lesson.chatSend}
              </button>
            </div>
          </label>
          <div class="chat-compose__footer">
            <span>${options.isOnline ? copy.lesson.chatFooterOnline : copy.lesson.chatFooterOffline}</span>
            <button class="ghost-button" type="button" data-action="hint">
              <i data-lucide="lightbulb"></i>
              ${copy.lesson.askForHint}
            </button>
          </div>
        </form>
      </aside>
    </section>
  `;

  createIcons({ icons, root: screen });

  const backButton = screen.querySelector<HTMLButtonElement>('[data-action="back"]');
  backButton?.addEventListener('click', () => {
    options.onGoBack();
  });

  const chatForm = screen.querySelector<HTMLFormElement>('[data-chat-form]');
  chatForm?.addEventListener('submit', async (event) => {
    event.preventDefault();

    const formData = new FormData(chatForm);
    const prompt = `${formData.get('prompt') ?? ''}`.trim();
    if (!prompt) {
      return;
    }

    const textArea = chatForm.querySelector<HTMLTextAreaElement>('textarea[name="prompt"]');
    if (textArea) {
      textArea.value = '';
    }

    await options.onSendMessage(prompt);
  });

  const hintButton = screen.querySelector<HTMLButtonElement>('[data-action="hint"]');
  hintButton?.addEventListener('click', async () => {
    const hint = lesson.questions[0]?.hint;
    if (!hint) {
      return;
    }

    await options.onSendMessage(language === 'es' ? 'Necesito una pista.' : 'I need a hint.');
  });

  return {
    element: screen,
    afterMount: () => {
      gsap.from(screen.querySelectorAll('.lesson__toolbar > *, .lesson__hero > *'), {
        duration: 0.68,
        opacity: 0.84,
        y: 10,
        stagger: 0.08,
        ease: 'power3.out',
      });

      gsap.from(screen.querySelectorAll('.lesson__copy p, .lesson__quiz-list li, .chat-message'), {
        duration: 0.62,
        opacity: 0.86,
        y: 12,
        stagger: 0.06,
        ease: 'power3.out',
        delay: 0.12,
      });
    },
  };
}
