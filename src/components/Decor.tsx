/** Decorative pieces of the visual layer (0.8.0). All aria-hidden: they never carry information on their own. */
import { useMemo } from 'react';
import { constructChart, fromDots, PARENTS, VISUAL_ROWS, type Mothers, type NodeId } from '../domain/geomancy.ts';
import { glyphDots } from './FigureGlyph.tsx';

/** Brand mark: the figure Fortuna Major in a rounded tile. */
export function BrandMark() {
  return (
    <svg className="brand-mark" viewBox="0 0 30 30" aria-hidden="true">
      <rect width="30" height="30" rx="8" />
      {glyphDots(fromDots('2211'), 15, 6.5, 5.6, 4).map((d, i) => <circle key={i} cx={d.x} cy={d.y} r="1.9" />)}
    </svg>
  );
}

const ICON_PATHS: Record<'new' | 'journal' | 'learn' | 'settings', string> = {
  new: 'M12 5v14M5 12h14',
  journal: 'M6 4h10a2 2 0 0 1 2 2v14H8a2 2 0 0 1-2-2zM6 18a2 2 0 0 1 2-2h10M10 8h5',
  learn: 'M3 7l9-4 9 4-9 4zM7 9v5c0 1.5 2.5 3 5 3s5-1.5 5-3V9',
  settings: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1',
};
export function NavIcon({ name }: { name: keyof typeof ICON_PATHS }) {
  return <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path d={ICON_PATHS[name]} /></svg>;
}

/** A fixed, real chart (the teaching example's mothers) drawn small for the home page. */
const HERO_MOTHERS = ['1121', '2111', '2221', '2212'].map(fromDots) as unknown as Mothers;
const HW = 34, HH = 50;
const HERO_X = [[30, 80, 130, 180, 230, 280, 330, 380], [55, 155, 255, 355], [105, 305], [205]];

export function HeroShield() {
  const chart = useMemo(() => constructChart(HERO_MOTHERS), []);
  const pos = useMemo(() => {
    const map = {} as Record<NodeId, { x: number; y: number }>;
    VISUAL_ROWS.slice(0, 4).forEach((row, r) => row.forEach((node, i) => { map[node] = { x: HERO_X[r][i], y: 40 + r * 74 }; }));
    return map;
  }, []);
  const nodes = VISUAL_ROWS.slice(0, 4).flat();
  const order = (node: NodeId) => ['M1', 'M2', 'M3', 'M4', 'D1', 'D2', 'D3', 'D4', 'N1', 'N2', 'N3', 'N4', 'RW', 'LW', 'J'].indexOf(node);
  // Sand grains drifting around the chart; positions are fixed so nothing here is random.
  const grains = [[14, 280], [60, 300], [120, 290], [190, 305], [250, 296], [320, 302], [395, 288], [40, 12], [365, 8], [205, 2]];
  return (
    <svg className="hero-shield" viewBox="0 0 410 320" aria-hidden="true" focusable="false">
      <ellipse className="hs-glow" cx="205" cy="262" rx="42" ry="36" />
      {nodes.filter(n => !n.startsWith('M') && !n.startsWith('D')).flatMap(child => (PARENTS[child] ?? []).map(parent => {
        const a = pos[parent], b = pos[child];
        return <path key={`${parent}-${child}`} className="hs-line" d={`M ${a.x} ${a.y + HH / 2} L ${b.x} ${b.y - HH / 2}`} />;
      }))}
      {nodes.map(node => {
        const { x, y } = pos[node];
        return (
          <g key={node} className={`hs-node${node === 'J' ? ' is-judge' : ''}`} style={{ animationDelay: `${order(node) * 120}ms` }}>
            <g transform={`translate(${x - HW / 2} ${y - HH / 2})`}>
              <rect width={HW} height={HH} rx="7" />
              {glyphDots(chart[node], HW / 2, 9, 10.5, 6).map((d, i) => <circle key={i} cx={d.x} cy={d.y} r="2.6" />)}
            </g>
          </g>
        );
      })}
      {grains.map(([x, y], i) => <circle key={i} className="hs-grain" cx={x} cy={y} r={i % 3 === 0 ? 2.2 : 1.5} style={{ animationDelay: `${i * 0.7}s` }} />)}
    </svg>
  );
}
