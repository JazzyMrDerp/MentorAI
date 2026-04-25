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
          <strong style="font-size: 1.1rem;">${escapeHtml(lesson.title)}</strong>
        </div>
      </div>
      <div class="lesson__toolbar-actions">
        <span class="status-pill ${options.isOnline ? 'status-pill--online' : 'status-pill--offline'}">
          <i data-lucide="${options.isOnline ? 'satellite' : 'cloud-off'}"></i>
          ${options.isOnline ? copy.status.online : copy.status.offline}
        </span>
        <span class="pill" style="background: linear-gradient(135deg, rgba(255, 215, 0, 0.15), rgba(255, 215, 0, 0.08)); border-color: rgba(255, 215, 0, 0.3);">
          <i data-lucide="badge-plus" style="color: var(--gold);"></i>
          <strong style="color: var(--gold);">${hintTokens}</strong>
          ${copy.lesson.hintTokens}
        </span>
      </div>
    </section>

    <section class="lesson__layout">
      <article class="lesson__article glass-panel">
        <div class="lesson__hero">
          <p class="eyebrow">${copy.subjects[lesson.subject]} · ${copy.lesson.grade} ${lesson.grade}</p>
          <h2 style="font-size: 1.8rem; line-height: 1.2; margin-bottom: 12px;">${escapeHtml(lesson.title)}</h2>
          <p class="lesson__lede">${escapeHtml(paragraphs[0] ?? lesson.content)}</p>
          <div class="lesson__meta" style="display: flex; gap: 12px; flex-wrap: wrap; margin-top: 14px;">
            <span class="meta-pill" style="background: rgba(72, 209, 204, 0.1); border-color: rgba(72, 209, 204, 0.25); color: var(--teal);">
              <i data-lucide="languages"></i>
              ${lesson.language === 'es' ? 'Español' : 'English'}
            </span>
            <span class="meta-pill" style="background: rgba(255, 215, 0, 0.1); border-color: rgba(255, 215, 0, 0.25); color: var(--gold);">
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
                : `<p style="position: relative; padding-left: 20px; border-left: 3px solid var(--purple); background: rgba(108, 99, 255, 0.05); padding: 16px 16px 16px 20px; border-radius: 0 12px 12px 0;">${escapeHtml(paragraph)}</p>`,
            )
            .join('')}
        </div>

        <section class="lesson__quiz-preview" style="background: linear-gradient(135deg, rgba(108, 99, 255, 0.08), rgba(108, 99, 255, 0.04)); border: 1px solid rgba(108, 99, 255, 0.2); border-radius: 20px; padding: 22px; margin-top: 24px;">
          <div class="lesson__actions">
            <div>
              <p class="eyebrow" style="color: var(--purple);">${copy.lesson.previewEyebrow}</p>
              <h2 style="font-size: 1.25rem;">${copy.lesson.previewTitle}</h2>
            </div>
            <button class="ghost-button" type="button" disabled style="border-color: rgba(108, 99, 255, 0.3);">
              <i data-lucide="trophy" style="color: var(--gold);"></i>
              ${copy.lesson.quizComing}
            </button>
          </div>
          <p class="lesson__quiz-note" style="margin-top: 10px;">${copy.lesson.previewBody}</p>
          <ol class="lesson__quiz-list" style="margin-top: 16px;">
            ${lesson.questions
              .slice(0, 3)
              .map(
                (question, index) => `
                  <li style="background: rgba(255, 255, 255, 0.05); padding: 14px 16px; border-radius: 12px; border: 1px solid rgba(255, 255, 255, 0.08);">
                    <span style="background: linear-gradient(135deg, var(--purple), #7c85ff); color: white; box-shadow: 0 0 12px rgba(108, 99, 255, 0.3);">${index + 1}</span>
                    <div style="color: var(--text-soft);">${escapeHtml(question.prompt)}</div>
                  </li>
                `,
              )
              .join('')}
          </ol>
        </section>
      </article>

      <aside class="lesson__tutor glass-panel" style="background: linear-gradient(135deg, rgba(72, 209, 204, 0.06), rgba(108, 99, 255, 0.06)); border-color: rgba(108, 99, 255, 0.2);">
        <div class="lesson__tutor-head">
          <div style="display: flex; align-items: center; gap: 14px;">
            <div style="display: flex; align-items: center; justify-content: center; width: 44px; height: 44px; border-radius: 14px; background: linear-gradient(135deg, var(--purple), var(--teal)); box-shadow: var(--shadow-glow-purple);">
              <i data-lucide="bot" style="width: 22px; height: 22px; color: white;"></i>
            </div>
            <div>
              <p class="eyebrow">${copy.lesson.chatEyebrow}</p>
              <h2>${copy.lesson.chatTitle}</h2>
            </div>
          </div>
          <div class="lesson__tutor-status">
            <span class="chip ${options.isOnline ? '' : ''}" style="background: ${options.isOnline ? 'linear-gradient(135deg, rgba(108, 99, 255, 0.15), rgba(108, 99, 255, 0.08))' : 'linear-gradient(135deg, rgba(72, 209, 204, 0.12), rgba(72, 209, 204, 0.06))'}; border-color: ${options.isOnline ? 'rgba(108, 99, 255, 0.3)' : 'rgba(72, 209, 204, 0.25)'}; color: ${options.isOnline ? '#c4bdff' : 'var(--teal)'};">
              <i data-lucide="sparkles" style="color: ${options.isOnline ? '#c4bdff' : 'var(--teal)'};"></i>
              ${options.isOnline ? copy.lesson.chatModeOnline : copy.lesson.chatModeOffline}
            </span>
          </div>
        </div>

        <div class="chat-stream">
          ${options.messages
            .map(
              (message) => `
                <article class="chat-message chat-message--${message.role}" style="${message.role === 'student' ? 'transform: translateX(8px);' : ''}">
                  <div class="chat-message__head" style="display: flex; align-items: center; gap: 10px;">
                    <div style="display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 8px; background: ${message.role === 'mentor' ? 'linear-gradient(135deg, var(--purple), var(--teal))' : 'rgba(108, 99, 255, 0.2)'};">
                      <i data-lucide="${message.role === 'mentor' ? 'sparkles' : 'user'}" style="width: 14px; height: 14px; color: white;"></i>
                    </div>
                    <strong>${message.role === 'mentor' ? copy.lesson.chatMentor : copy.lesson.chatStudent}</strong>
                    ${message.tone ? `<span class="chat-message__tone" style="background: rgba(255, 255, 255, 0.08); padding: 2px 10px; border-radius: 999px;">${escapeHtml(message.tone)}</span>` : ''}
                  </div>
                  <div class="chat-message__body">
                    <p style="line-height: 1.65;">${escapeHtml(message.text)}</p>
                  </div>
                </article>
              `,
            )
            .join('')}
          ${
            options.isTutorThinking
              ? `
                <article class="chat-message chat-message--mentor" style="background: linear-gradient(135deg, rgba(108, 99, 255, 0.1), rgba(72, 209, 204, 0.08));">
                  <div class="chat-message__head" style="display: flex; align-items: center; gap: 10px;">
                    <div style="display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 8px; background: linear-gradient(135deg, var(--purple), var(--teal));">
                      <i data-lucide="bot" style="width: 14px; height: 14px; color: white;"></i>
                    </div>
                    <strong>${copy.lesson.chatMentor}</strong>
                    <span class="chat-message__tone" style="background: rgba(72, 209, 204, 0.15); color: var(--teal);">${copy.lesson.chatThinking}</span>
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

        <form class="chat-compose" data-chat-form style="background: rgba(255, 255, 255, 0.05); padding: 18px; border-radius: 20px; border: 1px solid rgba(255, 255, 255, 0.1);">
          <label class="field" style="gap: 8px;">
            <span style="font-weight: 600; font-size: 0.85rem;">${copy.lesson.chatPromptLabel}</span>
            <div class="chat-compose__row">
              <textarea
                class="chat-compose__textarea"
                name="prompt"
                placeholder="${copy.lesson.chatPlaceholder}"
                required
              ></textarea>
              <button class="button" type="submit" style="min-width: 52px;">
                <i data-lucide="send"></i>
              </button>
            </div>
          </label>
          <div class="chat-compose__footer" style="margin-top: 12px;">
            <span style="font-size: 0.8rem;">${options.isOnline ? copy.lesson.chatFooterOnline : copy.lesson.chatFooterOffline}</span>
            <button class="ghost-button" type="button" data-action="hint" style="min-height: 38px; padding: 0 14px; font-size: 0.85rem;">
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
      gsap.from(screen.querySelectorAll('.lesson__toolbar > *'), {
        duration: 0.7,
        opacity: 0,
        y: -15,
        stagger: 0.08,
        ease: 'power3.out',
      });

      gsap.from('.lesson__article', {
        duration: 0.85,
        opacity: 0,
        x: -30,
        ease: 'power3.out',
        delay: 0.15,
      });

      gsap.from('.lesson__tutor', {
        duration: 0.85,
        opacity: 0,
        x: 30,
        ease: 'power3.out',
        delay: 0.2,
      });

      gsap.from(screen.querySelectorAll('.lesson__copy p, .lesson__quiz-list li, .chat-message'), {
        duration: 0.6,
        opacity: 0,
        y: 18,
        stagger: 0.07,
        ease: 'power3.out',
        delay: 0.4,
      });
    },
  };
}