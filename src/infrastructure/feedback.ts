/** Local-only pilot events and ratings (docs/PILOT.md §3). Nothing here is ever sent anywhere. */
import { newId, type CastMethod } from './records.ts';
import type { FeedbackEntry, PilotEvent } from './repository.ts';

let session = { id: newId(), startedAt: Date.now() };

/** A fresh random ID per casting flow; not an account, device or record identifier. */
export function startPilotSession(): void {
  session = { id: newId(), startedAt: Date.now() };
}

export function makePilotEvent(
  name: PilotEvent['name'],
  extra: { method?: CastMethod; rowIndex?: number; errorCode?: string } = {},
): FeedbackEntry {
  const event: PilotEvent = {
    schemaVersion: 1, sessionId: session.id, name,
    // Raw elapsed time including any time spent in the background.
    elapsedMs: Math.max(0, Date.now() - session.startedAt),
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
    note: 'elapsedMs 為原始經過時間，未扣除背景停留。',
    ratings: entries.filter(e => e.kind === 'rating').map(e => ({ createdAt: e.createdAt, ease: e.ease, clarity: e.clarity, improve: e.improve })),
    events: entries.filter(e => e.kind === 'event').map(e => e.event),
  };
  return { filename: `geomancy-feedback-${now.slice(0, 10)}.json`, text: JSON.stringify(body, null, 2) };
}
