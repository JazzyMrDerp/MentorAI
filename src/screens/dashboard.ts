import { gsap } from 'gsap';
import { createIcons, icons } from 'lucide';

import { getCopy } from '../copy.ts';
import type { CreateProfileInput } from '../router.ts';
import type { Language, Lesson, StudentProfile, Subject } from '../types.ts';

interface DashboardScreenOptions {
  profile: StudentProfile | null;
  lessons: Lesson[];
  isOnline: boolean;
  onCreateProfile: (input: CreateProfileInput) => Promise<void>;
  onOpenLesson: (subject: Subject) => void;
  onSetLanguage: (language: Language) => Promise<void>;
}

type SubjectView = {
  subject: Subject;
  icon: string;
  accentClass: string;
  title: string;
  xp: number;
  progress: number;
  count: number;
  nextLesson: Lesson | null;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function levelProgress(profile: StudentProfile | null): { width: number; remaining: number } {
  if (!profile) {
    return { width: 24, remaining: 80 };
  }

  const xpWindow = 200;
  const carry = profile.totalXP % xpWindow;
  const width = Math.max(12, (carry / xpWindow) * 100);
  const remaining = xpWindow - carry;
  return { width, remaining };
}

function subjectViews(profile: StudentProfile | null, lessons: Lesson[], language: Language): SubjectView[] {
  const copy = getCopy(language);

  return [
    {
      subject: 'math',
      icon: 'atom',
      accentClass: 'subject-card--math',
      title: copy.subjects.math,
      xp: profile?.mathXP ?? 0,
      progress: Math.min(100, Math.max(20, (profile?.mathXP ?? 30) / 3)),
      count: lessons.filter((lesson) => lesson.subject === 'math').length,
      nextLesson: lessons.find((lesson) => lesson.subject === 'math') ?? null,
    },
    {
      subject: 'ela',
      icon: 'book-open-text',
      accentClass: 'subject-card--ela',
      title: copy.subjects.ela,
      xp: profile?.elaXP ?? 0,
      progress: Math.min(100, Math.max(20, (profile?.elaXP ?? 24) / 3)),
      count: lessons.filter((lesson) => lesson.subject === 'ela').length,
      nextLesson: lessons.find((lesson) => lesson.subject === 'ela') ?? null,
    },
  ];
}

export function renderDashboardScreen(options: DashboardScreenOptions): {
  element: HTMLElement;
  afterMount: () => void;
} {
  const language = options.profile?.language ?? 'en';
  const copy = getCopy(language);
  const progress = levelProgress(options.profile);
  const subjects = subjectViews(options.profile, options.lessons, language);
  const screen = document.createElement('section');

  screen.className = 'screen dashboard';
  screen.innerHTML = `
    <section class="dashboard__hero glass-panel">
      <div class="dashboard__hero-copy">
        <div class="dashboard__hero-badges">
          <span class="app-brand">
            <span class="app-brand__mark pulse-glow"><i data-lucide="sparkles"></i></span>
            ${copy.brand}
          </span>
          <span class="status-pill ${options.isOnline ? 'status-pill--online' : 'status-pill--offline'}">
            <i data-lucide="${options.isOnline ? 'wifi' : 'wifi-off'}"></i>
            ${options.isOnline ? copy.status.online : copy.status.offline}
          </span>
        </div>
        <p class="eyebrow">${copy.hero.eyebrow}</p>
        <h1 class="section-title">${copy.hero.title}</h1>
        <p>${copy.hero.body}</p>
        <div class="button-row">
          <button class="button" type="button" data-open-subject="math" ${options.profile ? '' : 'disabled'}>
            <i data-lucide="rocket"></i>
            ${copy.hero.primaryCta}
          </button>
          <button class="ghost-button" type="button" data-open-subject="ela" ${options.profile ? '' : 'disabled'}>
            <i data-lucide="book-marked"></i>
            ${copy.hero.secondaryCta}
          </button>
        </div>
      </div>
      <aside class="dashboard__stats">
        <div class="dashboard__stats-head">
          <div class="dashboard__nickname">
            <span>${copy.profile.eyebrow}</span>
            <strong>${escapeHtml(options.profile?.nickname ?? copy.profile.placeholderName)}</strong>
          </div>
          <span class="pill" style="background: linear-gradient(135deg, rgba(255, 215, 0, 0.15), rgba(255, 215, 0, 0.08)); border-color: rgba(255, 215, 0, 0.25);">
            <i data-lucide="award" style="color: var(--gold);"></i>
            ${copy.profile.level} ${options.profile?.currentLevel ?? 1}
          </span>
        </div>
        <div class="dashboard__xp">
          <div class="dashboard__xp-bar">
            <div class="dashboard__xp-fill" data-fill="${progress.width.toFixed(1)}%"></div>
          </div>
          <div class="dashboard__xp-meta">
            <span style="color: var(--gold);">${copy.profile.totalXp}: ${options.profile?.totalXP ?? 0}</span>
            <span>${copy.profile.nextLevel}: ${progress.remaining} XP</span>
          </div>
        </div>
        <div class="dashboard__stat-grid">
          <div class="stat-tile">
            <strong>${options.profile?.streak ?? 0}</strong>
            <span>${copy.profile.streak}</span>
          </div>
          <div class="stat-tile">
            <strong>${options.lessons.length}</strong>
            <span>${copy.profile.savedLessons}</span>
          </div>
          <div class="stat-tile">
            <strong>${options.profile?.grade ?? 7}</strong>
            <span>${copy.profile.grade}</span>
          </div>
        </div>
      </aside>
    </section>

    <section class="dashboard__panel-row">
      <section class="dashboard__panel glass-panel">
        ${
          options.profile
            ? `
              <p class="eyebrow">${copy.profile.controlEyebrow}</p>
              <h2>${copy.profile.controlTitle}</h2>
              <p>${copy.profile.controlBody}</p>
              <div class="field">
                <label>${copy.profile.languageLabel}</label>
                <div class="segmented" data-language-switcher>
                  <button class="segmented__option ${language === 'en' ? 'is-active' : ''}" type="button" data-language="en">English</button>
                  <button class="segmented__option ${language === 'es' ? 'is-active' : ''}" type="button" data-language="es">Español</button>
                </div>
              </div>
              <div class="button-row" style="margin-top: 18px;">
                <span class="chip" style="background: linear-gradient(135deg, rgba(72, 209, 204, 0.12), rgba(72, 209, 204, 0.06)); border-color: rgba(72, 209, 204, 0.25);">
                  <i data-lucide="badge-check" style="color: var(--teal);"></i>
                  ${copy.profile.deviceSafe}
                </span>
                <span class="chip" style="background: linear-gradient(135deg, rgba(108, 99, 255, 0.12), rgba(108, 99, 255, 0.06)); border-color: rgba(108, 99, 255, 0.25);">
                  <i data-lucide="shield" style="color: var(--purple);"></i>
                  ${copy.profile.privacySafe}
                </span>
              </div>
            `
            : `
              <p class="eyebrow">${copy.onboarding.eyebrow}</p>
              <h2>${copy.onboarding.title}</h2>
              <p>${copy.onboarding.body}</p>
              <form class="dashboard__form" data-profile-form>
                <div class="field">
                  <label for="nickname">${copy.onboarding.nicknameLabel}</label>
                  <input class="text-input" id="nickname" name="nickname" type="text" maxlength="18" placeholder="${copy.onboarding.nicknamePlaceholder}" required />
                </div>
                <div class="field">
                  <label>${copy.onboarding.gradeLabel}</label>
                  <div class="segmented" data-grade-picker>
                    <button class="segmented__option" type="button" data-grade="6">Grade 6</button>
                    <button class="segmented__option is-active" type="button" data-grade="7">Grade 7</button>
                    <button class="segmented__option" type="button" data-grade="8">Grade 8</button>
                  </div>
                </div>
                <div class="field">
                  <label>${copy.onboarding.languageLabel}</label>
                  <div class="segmented" data-language-picker>
                    <button class="segmented__option is-active" type="button" data-language="en">English</button>
                    <button class="segmented__option" type="button" data-language="es">Español</button>
                  </div>
                </div>
                <input type="hidden" name="grade" value="7" />
                <input type="hidden" name="language" value="en" />
                <button class="button button--teal" type="submit" style="margin-top: 8px;">
                  <i data-lucide="user-round-plus"></i>
                  ${copy.onboarding.submit}
                </button>
              </form>
            `
        }
      </section>
    </section>

    <section class="dashboard__subjects">
      <p class="eyebrow">${copy.subjects.eyebrow}</p>
      <h2>${copy.subjects.title}</h2>
      <p class="dashboard__subjects-intro">${copy.subjects.body}</p>
      <div class="dashboard__subject-grid">
        ${subjects
          .map(
            (subject) => `
              <article class="subject-card ${subject.accentClass} floating" style="animation-delay: ${subject.subject === 'math' ? '0s' : '0.2s'};">
                <div class="subject-card__head">
                  <div class="subject-card__label">
                    <span class="subject-card__icon ${subject.subject === 'math' ? 'subject-card__icon--math' : 'subject-card__icon--ela'}">
                      <i data-lucide="${subject.icon}"></i>
                    </span>
                    <div>
                      <p class="eyebrow" style="color: ${subject.subject === 'math' ? '#c4bdff' : '#b3fff8'};">${subject.title}</p>
                      <strong style="font-size: 1rem;">${subject.count} ${copy.subjects.lessonCountLabel}</strong>
                    </div>
                  </div>
                  <span class="meta-pill" style="background: ${subject.subject === 'math' ? 'rgba(108, 99, 255, 0.15)' : 'rgba(72, 209, 204, 0.15)'}; border-color: ${subject.subject === 'math' ? 'rgba(108, 99, 255, 0.3)' : 'rgba(72, 209, 204, 0.3)'}; color: ${subject.subject === 'math' ? '#c4bdff' : '#b3fff8'};">
                    ${subject.xp} XP
                  </span>
                </div>
                <div class="subject-card__body">
                  <strong>${escapeHtml(subject.nextLesson?.title ?? copy.subjects.waitingTitle)}</strong>
                  <p style="font-size: 0.9rem;">${escapeHtml(subject.nextLesson?.content.split(/\n+/)[0] ?? copy.subjects.waitingBody)}</p>
                </div>
                <div class="subject-card__progress">
                  <div class="subject-card__track">
                    <span style="width: ${subject.progress}%"></span>
                  </div>
                  <p class="muted" style="font-size: 0.82rem;">${copy.subjects.progressLabel}</p>
                </div>
                <div class="subject-card__footer">
                  <span style="font-size: 0.85rem;">${copy.subjects.footer}</span>
                  <button class="button" type="button" data-open-subject="${subject.subject}" ${options.profile ? '' : 'disabled'} style="min-height: 40px; padding: 0 16px;">
                    <i data-lucide="arrow-right"></i>
                    ${copy.subjects.open}
                  </button>
                </div>
              </article>
            `,
          )
          .join('')}
      </div>
    </section>
  `;

  createIcons({ icons, root: screen });

  const profileForm = screen.querySelector<HTMLFormElement>('[data-profile-form]');
  if (profileForm) {
    const gradeInput = profileForm.querySelector<HTMLInputElement>('input[name="grade"]');
    const languageInput = profileForm.querySelector<HTMLInputElement>('input[name="language"]');
    const gradeButtons = profileForm.querySelectorAll<HTMLButtonElement>('[data-grade]');
    const languageButtons = profileForm.querySelectorAll<HTMLButtonElement>('[data-language]');

    gradeButtons.forEach((button) => {
      button.addEventListener('click', () => {
        gradeInput!.value = button.dataset.grade ?? '7';
        gradeButtons.forEach((item) => item.classList.toggle('is-active', item === button));
      });
    });

    languageButtons.forEach((button) => {
      button.addEventListener('click', () => {
        languageInput!.value = button.dataset.language ?? 'en';
        languageButtons.forEach((item) => item.classList.toggle('is-active', item === button));
      });
    });

    profileForm.addEventListener('submit', async (event) => {
      event.preventDefault();

      const formData = new FormData(profileForm);
      const nickname = `${formData.get('nickname') ?? ''}`.trim();
      const grade = Number(formData.get('grade')) as 6 | 7 | 8;
      const formLanguage = `${formData.get('language') ?? 'en'}` as Language;

      if (!nickname) {
        return;
      }

      await options.onCreateProfile({
        nickname,
        grade,
        language: formLanguage,
      });
    });
  }

  const openButtons = screen.querySelectorAll<HTMLButtonElement>('[data-open-subject]');
  openButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const subject = button.dataset.openSubject as Subject;
      if (subject) {
        options.onOpenLesson(subject);
      }
    });
  });

  const switcher = screen.querySelector('[data-language-switcher]');
  if (switcher) {
    switcher.querySelectorAll<HTMLButtonElement>('[data-language]').forEach((button) => {
      button.addEventListener('click', async () => {
        const nextLanguage = button.dataset.language as Language | undefined;
        if (!nextLanguage || nextLanguage === language) {
          return;
        }

        await options.onSetLanguage(nextLanguage);
      });
    });
  }

  return {
    element: screen,
    afterMount: () => {
      gsap.from(screen.querySelectorAll('.dashboard__hero-copy > *'), {
        duration: 0.8,
        opacity: 0,
        y: 20,
        stagger: 0.1,
        ease: 'power3.out',
      });

      gsap.from('.dashboard__stats', {
        duration: 0.9,
        opacity: 0,
        x: 30,
        ease: 'power3.out',
        delay: 0.2,
      });

      gsap.from(screen.querySelectorAll('.dashboard__panel, .subject-card, .stat-tile'), {
        duration: 0.75,
        opacity: 0,
        y: 24,
        stagger: 0.1,
        ease: 'power3.out',
        delay: 0.35,
      });

      gsap.from('.subject-card', {
        duration: 0.6,
        scale: 0.95,
        stagger: 0.15,
        ease: 'back.out(1.7)',
        delay: 0.5,
      });

      const xpFill = screen.querySelector<HTMLElement>('.dashboard__xp-fill');
      const targetWidth = xpFill?.dataset.fill;
      if (xpFill && targetWidth) {
        gsap.to(xpFill, {
          duration: 1.4,
          width: targetWidth,
          ease: 'elastic.out(1, 0.75)',
          delay: 0.6,
        });
      }
    },
  };
}