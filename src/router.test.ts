// src/router.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { parseHash, toHash, currentRoute, navigate, redirect, startRouter, type Route } from './router';

// ── parseHash ─────────────────────────────────────────────────────────────────

describe('parseHash', () => {
  it('resolves the root to the dashboard', () => {
    expect(parseHash('#/')).toEqual({ page: 'dashboard' });
  });

  it('resolves an absent hash to the dashboard', () => {
    // A bare URL with no fragment at all — the first visit, and the shape the
    // address bar is in before boot normalises it.
    expect(parseHash('')).toEqual({ page: 'dashboard' });
    expect(parseHash('#')).toEqual({ page: 'dashboard' });
  });

  it('resolves subject pages, carrying the subject', () => {
    expect(parseHash('#/math')).toEqual({ page: 'math', subject: 'math' });
    expect(parseHash('#/ela')).toEqual({ page: 'ela', subject: 'ela' });
  });

  it('resolves the flat pages', () => {
    expect(parseHash('#/progress')).toEqual({ page: 'progress' });
    expect(parseHash('#/settings')).toEqual({ page: 'settings' });
  });

  it('resolves a lesson and its id', () => {
    expect(parseHash('#/lesson/7')).toEqual({ page: 'lesson', lessonId: 7 });
  });

  it('resolves a quiz and its id', () => {
    expect(parseHash('#/quiz/7')).toEqual({ page: 'quiz', lessonId: 7 });
  });

  it('resolves a boss battle and its subject', () => {
    expect(parseHash('#/boss/math')).toEqual({ page: 'boss', subject: 'math' });
    expect(parseHash('#/boss/ela')).toEqual({ page: 'boss', subject: 'ela' });
  });

  it('ignores case and surrounding slashes', () => {
    expect(parseHash('#/MATH')).toEqual({ page: 'math', subject: 'math' });
    expect(parseHash('#/math/')).toEqual({ page: 'math', subject: 'math' });
    expect(parseHash('#Lesson/7')).toEqual({ page: 'lesson', lessonId: 7 });
  });

  it('falls back to the dashboard on an unknown page', () => {
    expect(parseHash('#/teacher')).toEqual({ page: 'dashboard' });
    expect(parseHash('#/../../etc/passwd')).toEqual({ page: 'dashboard' });
  });

  it('falls back to the dashboard on a boss with no real subject', () => {
    expect(parseHash('#/boss')).toEqual({ page: 'dashboard' });
    expect(parseHash('#/boss/science')).toEqual({ page: 'dashboard' });
  });

  // Dexie ids are positive integers. Everything else names no lesson, and the
  // point of checking rather than coercing is that Number('7abc') is NaN where
  // parseInt('7abc') would have routed a typo to lesson 7.
  it.each([
    ['#/lesson',        'no id at all'],
    ['#/lesson/',       'an empty id'],
    ['#/lesson/abc',    'a non-numeric id'],
    ['#/lesson/7abc',   'a partly-numeric id'],
    ['#/lesson/0',      'zero'],
    ['#/lesson/-1',     'a negative id'],
    ['#/lesson/1.5',    'a fractional id'],
    ['#/lesson/NaN',    'NaN'],
    ['#/lesson/1e400',  'an id past the float range'],
  ])('falls back to the dashboard for %s (%s)', (hash) => {
    expect(parseHash(hash)).toEqual({ page: 'dashboard' });
  });

  it('never throws, whatever is in the bar', () => {
    const nonsense = ['#', '#//////', '#/%%%', '#/lesson/'.repeat(50), '#/🔥'];
    for (const hash of nonsense) {
      expect(() => parseHash(hash)).not.toThrow();
      expect(parseHash(hash).page).toBeTypeOf('string');
    }
  });
});

// ── toHash ────────────────────────────────────────────────────────────────────

describe('toHash', () => {
  it('addresses every page', () => {
    expect(toHash({ page: 'dashboard' })).toBe('#/');
    expect(toHash({ page: 'math', subject: 'math' })).toBe('#/math');
    expect(toHash({ page: 'ela', subject: 'ela' })).toBe('#/ela');
    expect(toHash({ page: 'lesson', lessonId: 7 })).toBe('#/lesson/7');
    expect(toHash({ page: 'quiz', lessonId: 7 })).toBe('#/quiz/7');
    expect(toHash({ page: 'boss', subject: 'ela' })).toBe('#/boss/ela');
    expect(toHash({ page: 'progress' })).toBe('#/progress');
    expect(toHash({ page: 'settings' })).toBe('#/settings');
  });
});

// ── Round trip ────────────────────────────────────────────────────────────────

describe('round trip', () => {
  const routes: Route[] = [
    { page: 'dashboard' },
    { page: 'math', subject: 'math' },
    { page: 'ela', subject: 'ela' },
    { page: 'lesson', lessonId: 1 },
    { page: 'lesson', lessonId: 4242 },
    { page: 'quiz', lessonId: 7 },
    { page: 'boss', subject: 'math' },
    { page: 'boss', subject: 'ela' },
    { page: 'progress' },
    { page: 'settings' },
  ];

  it.each(routes)('survives state → hash → state for %j', (route) => {
    expect(parseHash(toHash(route))).toEqual(route);
  });
});

// ── Navigation ────────────────────────────────────────────────────────────────

describe('navigation', () => {
  /** Let jsdom deliver any pending hashchange before the next assertion. */
  const flush = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 0));

  beforeEach(async () => {
    window.location.hash = '';
    await flush();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reads the current route out of the address bar', () => {
    window.location.hash = '#/boss/ela';
    expect(currentRoute()).toEqual({ page: 'boss', subject: 'ela' });
  });

  it('sets the hash, and the hashchange listener reports the new route', async () => {
    const seen: Route[] = [];
    startRouter((route) => { seen.push(route); });

    navigate({ page: 'lesson', lessonId: 7 });
    await flush();

    expect(window.location.hash).toBe('#/lesson/7');
    expect(seen).toEqual([{ page: 'lesson', lessonId: 7 }]);
  });

  it('still dispatches when the target is the hash already showing', async () => {
    // Pressing Dashboard while on the dashboard fires no hashchange. Without
    // the direct dispatch the click would do nothing at all, where before the
    // router it reloaded the screen's data.
    window.location.hash = '#/progress';
    await flush();

    const seen: Route[] = [];
    startRouter((route) => { seen.push(route); });

    navigate({ page: 'progress' });
    await flush();

    expect(seen).toEqual([{ page: 'progress' }]);
  });

  it('binds one listener however often it is started', async () => {
    const seen: Route[] = [];
    startRouter(() => { throw new Error('replaced handler still bound'); });
    startRouter((route) => { seen.push(route); });

    navigate({ page: 'settings' });
    await flush();

    expect(seen).toEqual([{ page: 'settings' }]);
  });

  it('rewrites a hash that did not parse, so the bar names the screen showing', async () => {
    const seen: Route[] = [];
    startRouter((route) => { seen.push(route); });

    window.location.hash = '#/teacher';
    await flush();

    expect(seen).toEqual([{ page: 'dashboard' }]);
    expect(window.location.hash).toBe('#/');
  });

  it('redirects without leaving an entry for Back to bounce off', async () => {
    const replaceState = vi.spyOn(window.history, 'replaceState');
    const seen: Route[] = [];
    startRouter((route) => { seen.push(route); });

    redirect({ page: 'lesson', lessonId: 3 });
    await flush();

    expect(replaceState).toHaveBeenCalledWith(null, '', '#/lesson/3');
    expect(seen).toEqual([{ page: 'lesson', lessonId: 3 }]);
  });
});
