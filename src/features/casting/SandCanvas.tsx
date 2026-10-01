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
  });

  useEffect(() => { model.current.reduced = reducedMotion; }, [reducedMotion]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const m = model.current;

    const draw = (now: number) => {
      const context = canvas.getContext('2d');
      if (!context) return false;
      const w = canvas.clientWidth, h = canvas.clientHeight, dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      const colors = palette(canvas);
      context.fillStyle = colors.base;
      context.fillRect(0, 0, w, h);
      context.fillStyle = colors.grain;
      for (let i = 0; i < 140; i++) context.fillRect(jitter(i) * w, jitter(i + 500) * h, 1.5, 1.5);

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
        context.shadowBlur = colors.glow;
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

    const tick = (now: number) => {
      m.frame = 0;
      if (draw(now) && !document.hidden) m.frame = requestAnimationFrame(tick);
    };
    const schedule = () => { if (!m.frame) m.frame = requestAnimationFrame(tick); };
    scheduleRef.current = schedule;

    const observer = new ResizeObserver(schedule);
    observer.observe(canvas);
    // Redraw when the theme changes while the tray is open.
    const themeWatch = new MutationObserver(schedule);
    themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    document.addEventListener('visibilitychange', schedule);
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
      if (!m.reduced) {
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
