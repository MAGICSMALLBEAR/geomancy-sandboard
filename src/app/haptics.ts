/**
 * Optional vibration feedback (plan §10). Off by default, like sound. Decoration only: unsupported devices
 * (iPhone Safari has no Vibration API) and any failure are silently ignored and never block casting.
 */
export const hapticsSupported = (): boolean => typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';

/** One short tick for a counted dot. */
export function buzzTap(): void { buzz(10); }
/** A double tick when a row or press is stored. */
export function buzzConfirm(): void { buzz([14, 50, 14]); }

function buzz(pattern: number | number[]): void {
  try { if (hapticsSupported()) navigator.vibrate(pattern); } catch { /* decoration only */ }
}
