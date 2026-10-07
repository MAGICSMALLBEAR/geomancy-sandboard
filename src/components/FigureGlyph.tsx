import type { Figure } from '../domain/geomancy.ts';
import { useApp } from '../app/AppContext.tsx';

/** Dot positions for one figure inside a 40×64 box; reused by the shield chart SVG. */
export function glyphDots(figure: Figure, cx = 20, top = 8, rowGap = 16, spread = 8): { x: number; y: number }[] {
  return figure.flatMap((bit, row) => {
    const y = top + row * rowGap;
    return bit === 1 ? [{ x: cx, y }] : [{ x: cx - spread, y }, { x: cx + spread, y }];
  });
}

export function FigureGlyph({ figure, size = 40, decorative = false }: { figure: Figure; size?: number; decorative?: boolean }) {
  const { T } = useApp();
  return (
    <svg className="glyph" width={size} height={size * 1.6} viewBox="0 0 40 64"
      role={decorative ? undefined : 'img'} aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : T.figureAria(figure)}>
      {glyphDots(figure).map((dot, i) => <circle key={i} cx={dot.x} cy={dot.y} r="4.5" />)}
    </svg>
  );
}
