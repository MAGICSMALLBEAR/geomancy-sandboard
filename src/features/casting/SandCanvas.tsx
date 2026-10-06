import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

/**
 * Decoration only. Marks and particles mirror what the controller already counted;
 * nothing drawn here is ever read back as casting data.
 */
export type SandCanvasHandle = {
  addMark: (x: number, y: number) => void;
  /** Deterministic scatter for dots added with the keyboard button. */
  addMarkAuto: () => void;
  setPending: (point: { x: number; y: number } | null) => void;
  /** Pair-and-fade the marks down to one (odd) or two (even). */
  reduce: (keep: 1 | 2) => void;
  clear: () => void;
};

type Mark = { x: number; y: number };
type Particle = { x: number; y: number; dx: number; dy: number; born: number };
const MAX_DRAWN_MARKS = 300;
const MAX_PARTICLES = 300;
const PARTICLE_MS = 220;
export const REDUCE_MS = 520;
/** Lite mode starts when animated frames average slower than this (about 22 fps)... */
const SLOW_FRAME_MS = 45;
/** ...measured over this many consecutive animated frames. */
const SLOW_SAMPLE = 12;

/** Few cores or little memory: start in lite mode (plan §11: weak devices get a static tray). */
export function looksLowPower(nav: { hardwareConcurrency?: number; deviceMemory?: number } = navigator): boolean {
  return (typeof nav.hardwareConcurrency === 'number' && nav.hardwareConcurrency > 0 && nav.hardwareConcurrency <= 2)
    || (typeof nav.deviceMemory === 'number' && nav.deviceMemory > 0 && nav.deviceMemory <= 2);
}

/** Colours come from the theme's CSS tokens (app.css), so the tray follows the chosen theme. */
const palette = (el: Element) => {
  const style = getComputedStyle(el);
  const v = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback;
  return {
    base: v('--sand-base', '#E6D3AE'), grain: v('--sand-grain', 'rgba(114, 80, 33, 0.10)'),
    rim: v('--dot-rim', '#F2E6CC'), mid: v('--dot-mid', '#8A6A3B'), core: v('--dot-core', '#5E4520'),
    glow: Number(v('--dot-glow', '0')) || 0, particle: v('--particle', '#A88757'),
  };
};

/** Small deterministic hash in [0,1): decorative jitter without touching any random source. */
const jitter = (n: number): number => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

export const SandCanvas = forwardRef<SandCanvasHandle, { reducedMotion: boolean }>(function SandCanvas({ reducedMotion }, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scheduleRef = useRef<() => void>(() => undefined);
  const model = useRef({
    marks: [] as Mark[], total: 0, particles: [] as Particle[], pending: null as Mark | null,
    reduce: null as { start: number; keep: 1 | 2 } | null, frame: 0, reduced: reducedMotion,
    /** No particles and no blur; set from the device or from measured slow frames, never cleared mid-session. */
    lite: looksLowPower(),
  });

  useEffect(() => { model.current.reduced = reducedMotion; }, [reducedMotion]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const m = model.current;

    let colors = palette(canvas);
    // The sand texture is static: drawn once per size and theme, then copied each frame.
    let texture: { canvas: HTMLCanvasElement; key: string } | null = null;
    const backdrop = (w: number, h: number, dpr: number) => {
      const key = `${w}x${h}@${dpr}|${colors.base}|${colors.grain}`;
      if (texture?.key !== key) {
        const tile = texture?.canvas ?? document.createElement('canvas');
        tile.width = Math.round(w * dpr);
        tile.height = Math.round(h * dpr);
        const c = tile.getContext('2d');
        if (!c) return null;
        c.setTransform(dpr, 0, 0, dpr, 0, 0);
        c.fillStyle = colors.base;
        c.fillRect(0, 0, w, h);
        c.fillStyle = colors.grain;
        for (let i = 0; i < 140; i++) c.fillRect(jitter(i) * w, jitter(i + 500) * h, 1.5, 1.5);
        texture = { canvas: tile, key };
      }
      return texture.canvas;
    };

    const draw = (now: number) => {
      const context = canvas.getContext('2d');
      if (!context) return false;
      const w = canvas.clientWidth, h = canvas.clientHeight, dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      const tile = backdrop(w, h, dpr);
      context.setTransform(1, 0, 0, 1, 0, 0);
      if (tile) context.drawImage(tile, 0, 0);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!tile) { context.fillStyle = colors.base; context.fillRect(0, 0, w, h); }

      const progress = m.reduce ? Math.min(1, (now - m.reduce.start) / (m.reduced ? 1 : REDUCE_MS)) : 0;
      const marks = m.marks.slice(-MAX_DRAWN_MARKS);
      const keep = m.reduce ? m.reduce.keep : 0;
      marks.forEach((mark, i) => {
        let x = mark.x * w, y = mark.y * h, alpha = 1;
        if (m.reduce) {
          const fromEnd = marks.length - 1 - i;
          if (fromEnd < keep) {
            const targetX = keep === 1 ? w / 2 : w / 2 + (fromEnd === 0 ? 22 : -22);
            x += (targetX - x) * progress;
            y += (h / 2 - y) * progress;
          } else {
            // Pairs fade together, earliest pairs first.
            const pair = Math.floor(i / 2), pairs = Math.max(1, Math.ceil((marks.length - keep) / 2));
            alpha = 1 - Math.min(1, Math.max(0, progress * 1.6 - (pair / pairs) * 0.6));
          }
        }
        if (alpha <= 0) return;
        context.globalAlpha = alpha;
        context.fillStyle = colors.rim;
        context.beginPath(); context.arc(x, y + 1.5, 10, 0, Math.PI * 2); context.fill();
        context.shadowColor = colors.mid;
        context.shadowBlur = m.lite ? 0 : colors.glow;
        context.fillStyle = colors.mid;
        context.beginPath(); context.arc(x, y, 8, 0, Math.PI * 2); context.fill();
        context.shadowBlur = 0;
        context.fillStyle = colors.core;
        context.beginPath(); context.arc(x, y + 1, 5, 0, Math.PI * 2); context.fill();
      });
      context.globalAlpha = 1;

      if (m.pending) {
        context.strokeStyle = 'rgba(94, 69, 32, 0.55)';
        context.lineWidth = 2;
        context.beginPath(); context.arc(m.pending.x * w, m.pending.y * h, 11, 0, Math.PI * 2); context.stroke();
      }
      m.particles = m.particles.filter(p => now - p.born < PARTICLE_MS);
      for (const p of m.particles) {
        const t = (now - p.born) / PARTICLE_MS;
        context.globalAlpha = 1 - t;
        context.fillStyle = colors.particle;
        context.fillRect(p.x * w + p.dx * t, p.y * h + p.dy * t, 2, 2);
      }
      context.globalAlpha = 1;
      return m.particles.length > 0 || (m.reduce !== null && progress < 1);
    };

    // Frame-time watchdog: only gaps between consecutive animated frames count, not idle time.
    let last = 0, slow = 0, sampled = 0;
    const tick = (now: number) => {
      m.frame = 0;
      const animating = draw(now) && !document.hidden;
      if (animating && last && !m.lite) {
        sampled += 1;
        slow += now - last;
        if (sampled >= SLOW_SAMPLE) {
          if (slow / sampled > SLOW_FRAME_MS) { m.lite = true; m.particles = []; canvas.dataset.lite = 'true'; }
          sampled = 0; slow = 0;
        }
      }
      last = animating ? now : 0;
      if (animating) m.frame = requestAnimationFrame(tick);
    };
    const schedule = () => { if (!m.frame) m.frame = requestAnimationFrame(tick); };
    scheduleRef.current = schedule;

    const observer = new ResizeObserver(schedule);
    observer.observe(canvas);
    // Redraw when the theme changes while the tray is open.
    const themeWatch = new MutationObserver(() => { colors = palette(canvas); schedule(); });
    themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    document.addEventListener('visibilitychange', schedule);
    if (m.lite) canvas.dataset.lite = 'true';
    schedule();
    return () => {
      observer.disconnect();
      themeWatch.disconnect();
      document.removeEventListener('visibilitychange', schedule);
      cancelAnimationFrame(m.frame);
      m.frame = 0;
    };
  }, []);

  useImperativeHandle(ref, () => {
    const m = model.current;
    const schedule = () => scheduleRef.current();
    const addMark = (x: number, y: number) => {
      m.total += 1;
      m.marks.push({ x, y });
      if (m.marks.length > MAX_DRAWN_MARKS) m.marks.shift();
      if (!m.reduced && !m.lite) {
        const born = performance.now();
        for (let i = 0; i < 6 && m.particles.length < MAX_PARTICLES; i++) {
          const angle = jitter(m.total * 7 + i) * Math.PI * 2, distance = 10 + jitter(m.total * 13 + i) * 14;
          m.particles.push({ x, y, dx: Math.cos(angle) * distance, dy: Math.sin(angle) * distance, born });
        }
      }
      schedule();
    };
    return {
      addMark,
      addMarkAuto: () => addMark(0.12 + jitter(m.total * 3 + 1) * 0.76, 0.15 + jitter(m.total * 5 + 2) * 0.7),
      setPending: point => { m.pending = point; schedule(); },
      reduce: keep => { m.pending = null; m.reduce = { start: performance.now(), keep }; schedule(); },
      clear: () => { m.marks = []; m.total = 0; m.particles = []; m.pending = null; m.reduce = null; schedule(); },
    };
  }, []);

  return <canvas ref={canvasRef} className="sand-canvas" aria-hidden="true" />;
});
