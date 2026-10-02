/** Local-only pilot events and ratings (docs/PILOT.md §3). Nothing here is ever sent anywhere. */
import { newId, type CastMethod } from './records.ts';
import type { FeedbackEntry, PilotEvent } from './repository.ts';

type Session = { id: string; startedAt: number; hiddenMs: number; hiddenSince: number | null; started: boolean; left: boolean };
const fresh = (now: number, started: boolean): Session =>
  ({ id: newId(), startedAt: now, hiddenMs: 0, hiddenSince: typeof document !== 'undefined' && document.hidden ? now : null, started, left: false });
let session: Session = fresh(Date.now(), false);

/** A fresh random ID per casting flow; not an account, device or record identifier. */
export function startPilotSession(now = Date.now()): void {
  session = fresh(now, true);
}

/** Time the page spent in the background is not operating time (docs/PILOT.md §3). */
export function notePageHidden(hidden: boolean, now = Date.now()): void {
  if (hidden && session.hiddenSince === null) session.hiddenSince = now;
  else if (!hidden && session.hiddenSince !== null) {
    session.hiddenMs += Math.max(0, now - session.hiddenSince);
    session.hiddenSince = null;
  }
}
export function activeElapsedMs(now = Date.now()): number {
  const hiddenNow = session.hiddenSince === null ? 0 : Math.max(0, now - session.hiddenSince);
  return Math.max(0, now - session.startedAt - session.hiddenMs - hiddenNow);
}
/** True once per started session: the caller records `session_left` only then. */
export function takeSessionLeft(): boolean {
  if (!session.started || session.left) return false;
  session.left = true;
  return true;
}
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => notePageHidden(document.hidden));
}

export function makePilotEvent(
  name: PilotEvent['name'],
  extra: { method?: CastMethod; rowIndex?: number; errorCode?: string } = {},
): FeedbackEntry {
  const event: PilotEvent = {
    schemaVersion: 1, sessionId: session.id, name,
    // Background time excluded; see notePageHidden.
    elapsedMs: activeElapsedMs(),
    ...(extra.method ? { method: extra.method } : {}),
    ...(extra.rowIndex ? { rowIndex: extra.rowIndex } : {}),
    ...(extra.errorCode ? { errorCode: extra.errorCode } : {}),
  };
  return { id: newId(), createdAt: new Date().toISOString(), kind: 'event', event };
}

export const IMPROVE_MAX = 500;
export function makeRating(ease: number, clarity: number, improve: string): FeedbackEntry {
  return { id: newId(), createdAt: new Date().toISOString(), kind: 'rating', ease, clarity, improve: improve.slice(0, IMPROVE_MAX) };
}

export function buildFeedbackExport(entries: FeedbackEntry[], now: string): { filename: string; text: string } {
  const body = {
    format: 'geomancy-feedback', schemaVersion: 1, exportedAt: now,
    note: 'elapsedMs 已扣除頁面在背景的時間。session_left 在關閉或離開頁面時盡力記錄，瀏覽器可能來不及寫入；缺少它不代表使用者不滿。',
    ratings: entries.filter(e => e.kind === 'rating').map(e => ({ createdAt: e.createdAt, ease: e.ease, clarity: e.clarity, improve: e.improve })),
    events: entries.filter(e => e.kind === 'event').map(e => e.event),
  };
  return { filename: `geomancy-feedback-${now.slice(0, 10)}.json`, text: JSON.stringify(body, null, 2) };
}
