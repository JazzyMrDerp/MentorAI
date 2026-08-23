// src/router.ts
import type { Subject } from './types';

// ── Routes ────────────────────────────────────────────────────────────────────

/**
 * Every screen the URL can address.
 *
 * Onboarding is deliberately absent. It is the one screen that exists because
 * there is no student yet, so there is nothing to link to and nothing to come
 * back to — main.ts shows it whenever no profile exists, whatever the hash says.
 */
export type RoutePage =
  | 'dashboard'
  | 'math'
  | 'ela'
  | 'lesson'
  | 'quiz'
  | 'boss'
  | 'progress'
  | 'settings';

/**
 * A parsed location.
 *
 * The three fields mirror the three pieces of navigation state main.ts holds,
 * so applying a route is an assignment rather than a translation. Both extras
 * are optional because the URL genuinely does not always carry them: `#/math`
 * names a subject and no lesson, `#/lesson/7` names a lesson and no subject —
 * the subject comes from the lesson record once it resolves.
 */
export interface Route {
  page:     RoutePage;
  subject?: Subject;
  lessonId?: number;
}

/** Where anything unparseable lands. */
const HOME: Route = { page: 'dashboard' };

function isSubject(value: string): value is Subject {
  return value === 'math' || value === 'ela';
}

/**
 * Ids come from Dexie's auto-increment, so anything that is not a positive
 * whole number cannot name a lesson. Number(), not parseInt(): parseInt('7abc')
 * happily returns 7, which would route a typo to a real lesson.
 */
function parseId(raw: string | undefined): number | null {
  if (!raw) return null;
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// ── Parsing ───────────────────────────────────────────────────────────────────

/**
 * Turn a location hash into a Route. Total: every input resolves to something.
 *
 * A student's URL bar is untrusted input like any other. Nothing here throws,
 * and anything unrecognised — a stale link, a typo, a hand-edited hash — falls
 * back to the dashboard rather than rendering an empty frame.
 */
export function parseHash(hash: string): Route {
  const segments = hash
    .replace(/^#/, '')
    .split('/')
    .map(segment => segment.trim().toLowerCase())
    .filter(Boolean);

  const [head, tail] = segments;

  if (!head) return HOME;

  if (isSubject(head)) return { page: head, subject: head };
  if (head === 'progress' || head === 'settings') return { page: head };

  if (head === 'lesson' || head === 'quiz') {
    const lessonId = parseId(tail);
    return lessonId === null ? HOME : { page: head, lessonId };
  }

  if (head === 'boss') {
    return tail && isSubject(tail) ? { page: 'boss', subject: tail } : HOME;
  }

  return HOME;
}

/** The inverse of parseHash, for every route parseHash can produce. */
export function toHash(route: Route): string {
  switch (route.page) {
    case 'math':
    case 'ela':      return `#/${route.page}`;
    case 'lesson':
    case 'quiz':     return `#/${route.page}/${route.lessonId}`;
    case 'boss':     return `#/boss/${route.subject ?? 'math'}`;
    case 'progress':
    case 'settings': return `#/${route.page}`;
    default:         return '#/';
  }
}

/** The route the address bar is currently showing. */
export function currentRoute(): Route {
  return parseHash(window.location.hash);
}

// ── Navigation ────────────────────────────────────────────────────────────────

let onRouteChange: ((route: Route) => void) | null = null;
let listening = false;

/**
 * Begin resolving the hash, and hand every change to `handler`.
 *
 * Does not resolve the current hash — boot does that itself, after it knows
 * whether there is a profile to route for.
 *
 * Binds one listener for the module's lifetime and swaps the handler behind it,
 * so calling this twice replaces the handler rather than firing two renders per
 * hashchange.
 */
export function startRouter(handler: (route: Route) => void): void {
  onRouteChange = handler;
  if (listening) return;
  listening = true;
  window.addEventListener('hashchange', () => {
    const route = currentRoute();
    // A hash that did not parse cleanly resolved to something else — a typo, a
    // stale link, a hand-edited bar. Rewrite it so the address names the screen
    // actually showing instead of the one that was asked for and refused.
    replaceHash(route);
    onRouteChange?.(route);
  });
}

/**
 * Go to a route. The hash is the only navigation state; setting it is what
 * triggers a render, via the hashchange listener above.
 */
export function navigate(route: Route): void {
  const hash = toHash(route);

  if (window.location.hash === hash) {
    // Assigning the hash the value it already holds fires no event, and the
    // caller still asked to land here — pressing Dashboard while on the
    // dashboard should reload it, not do nothing. Dispatch by hand.
    onRouteChange?.(route);
    return;
  }

  window.location.hash = hash;
}

/**
 * Go to a route without leaving the current one in the history.
 *
 * For redirects: a URL that cannot be honoured — a lesson this device does not
 * have, a quiz with nothing left in memory to resume — should not stay in the
 * history as an entry that Back bounces off. replaceState fires no hashchange,
 * so the handler is called directly.
 */
export function redirect(route: Route): void {
  window.history.replaceState(null, '', toHash(route));
  onRouteChange?.(route);
}

/**
 * Rewrite the address bar to match a route, changing nothing else.
 *
 * Boot uses this to normalise before rendering, so a hand-typed or stale hash
 * ends up showing the address of the screen it actually resolved to.
 */
export function replaceHash(route: Route): void {
  window.history.replaceState(null, '', toHash(route));
}
