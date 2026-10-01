import type { CastSource } from './geomancy.ts';

/** Call in an explicit cast action, never render/effect. Persist this result before reveal. */
export function drawQuickSource(
  fill: (bytes: Uint8Array<ArrayBuffer>) => void = bytes => {
    if (!globalThis.crypto?.getRandomValues) throw new Error('RNG_UNAVAILABLE');
    globalThis.crypto.getRandomValues(bytes);
  },
): Extract<CastSource, { kind: 'quick' }> {
  const bytes = new Uint8Array(2);
  fill(bytes);
  return { kind: 'quick', algorithm: 'webcrypto-16bits-v1', bytes: [bytes[0], bytes[1]] };
}
