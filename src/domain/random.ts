import { AUTO_MIN_DOTS, type CastSource } from './geomancy.ts';

type Fill = (bytes: Uint8Array<ArrayBuffer>) => void;
const deviceFill: Fill = bytes => {
  if (!globalThis.crypto?.getRandomValues) throw new Error('RNG_UNAVAILABLE');
  globalThis.crypto.getRandomValues(bytes);
};

/** Call in an explicit cast action, never render/effect. Persist this result before reveal. */
export function drawQuickSource(fill: Fill = deviceFill): Extract<CastSource, { kind: 'quick' }> {
  const bytes = new Uint8Array(2);
  fill(bytes);
  return { kind: 'quick', algorithm: 'webcrypto-16bits-v1', bytes: [bytes[0], bytes[1]] };
}

/** Automatic sand. Same rule as `drawQuickSource`: one call, from the button handler only, saved before display. */
export function drawAutoSource(fill: Fill = deviceFill): Extract<CastSource, { kind: 'auto' }> {
  const bytes = new Uint8Array(16);
  fill(bytes);
  return { kind: 'auto', algorithm: 'webcrypto-counts-v1', counts: Array.from(bytes, b => AUTO_MIN_DOTS + (b & 15)) };
}
