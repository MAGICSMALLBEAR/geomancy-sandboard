/** Optional tap sound. Off by default; any audio failure is silently ignored and never blocks casting. */
let context: AudioContext | null = null;

export function playTap(): void {
  try {
    context ??= new AudioContext();
    if (context.state === 'suspended') void context.resume();
    const now = context.currentTime;
    const oscillator = context.createOscillator(), gain = context.createGain();
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(180, now);
    oscillator.frequency.exponentialRampToValueAtTime(70, now + 0.08);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.1);
  } catch {
    // Audio is decoration only.
  }
}
