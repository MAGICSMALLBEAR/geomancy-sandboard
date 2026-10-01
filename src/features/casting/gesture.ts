/**
 * Pure tap judgement for the sand tray (SPEC §6). A dot is only added on a valid pointerup;
 * the DOM layer must never add dots from `click`, `pointerdown` or cancelled gestures.
 * The thresholds are product choices, not geomantic tradition. Movement was 12 px until 2026-10-01;
 * quick repeated taps on phones drift further than that (DECISIONS D21).
 */
export const TAP_MAX_MOVE_PX = 30;
export const TAP_MAX_MS = 1500;

export type TapCandidate = { pointerId: number; x: number; y: number; startedAt: number; maxMove: number };
export type PointerStart = { pointerId: number; isPrimary: boolean; button: number; x: number; y: number; time: number };
export type PointerEnd = { pointerId: number; x: number; y: number; time: number; inside: boolean };
export type ReleaseVerdict = 'tap' | 'moved' | 'too-long' | 'outside' | 'ignored';

/** Second fingers, non-primary mouse buttons and pen side buttons never start a candidate. */
export function beginTap(active: TapCandidate | null, e: PointerStart): TapCandidate | null {
  if (active || !e.isPrimary || e.button !== 0) return active;
  return { pointerId: e.pointerId, x: e.x, y: e.y, startedAt: e.time, maxMove: 0 };
}

export function trackTap(active: TapCandidate | null, pointerId: number, x: number, y: number): TapCandidate | null {
  if (!active || active.pointerId !== pointerId) return active;
  const moved = Math.hypot(x - active.x, y - active.y);
  return moved > active.maxMove ? { ...active, maxMove: moved } : active;
}

export function judgeRelease(active: TapCandidate | null, e: PointerEnd): ReleaseVerdict {
  if (!active || active.pointerId !== e.pointerId) return 'ignored';
  const maxMove = Math.max(active.maxMove, Math.hypot(e.x - active.x, e.y - active.y));
  if (maxMove > TAP_MAX_MOVE_PX) return 'moved';
  if (e.time - active.startedAt > TAP_MAX_MS) return 'too-long';
  if (!e.inside) return 'outside';
  return 'tap';
}
