import { useEffect, useRef } from 'react';
import { NODES, PARENTS, VISUAL_ROWS, type Chart, type NodeId } from '../domain/geomancy.ts';
import { figureOf } from '../content/labels.ts';
import { useApp } from '../app/AppContext.tsx';
import { glyphDots } from './FigureGlyph.tsx';

const W = 72, H = 108, TOP = 34;
/** Fixed visual positions (first mother on the right). Data order is never derived from this. */
const POSITION = (() => {
  const xs: number[][] = [[50, 150, 250, 350, 450, 550, 650, 750], [100, 300, 500, 700], [200, 600], [400], [400]];
  const map = {} as Record<NodeId, { x: number; y: number }>;
  VISUAL_ROWS.forEach((row, r) => row.forEach((node, i) => { map[node] = { x: xs[r][i], y: TOP + H / 2 + r * 140 }; }));
  return map;
})();

type Props = {
  chart: Chart;
  showReconciler: boolean;
  selected: NodeId | null;
  onSelect: (node: NodeId) => void;
  /** Decorative build-up only; the chart is already fixed and stored. */
  animate: boolean;
  markers?: Partial<Record<NodeId, string>>;
  /** Nodes on the Way of the Points, highlighted with the lines between them. */
  path?: readonly NodeId[];
};

export function ShieldChart({ chart, showReconciler, selected, onSelect, animate, markers = {}, path = [] }: Props) {
  const { L, T } = useApp();
  const scroller = useRef<HTMLDivElement>(null);
  // On narrow screens start at the right edge, where the first mother is.
  useEffect(() => {
    const element = scroller.current;
    if (element) element.scrollLeft = element.scrollWidth;
  }, []);
  const nodes = NODES.filter(n => showReconciler || n !== 'R');
  const parentsOfSelected = selected ? PARENTS[selected] ?? [] : [];
  const height = TOP + (showReconciler ? 5 : 4) * 140 - 16;
  const lines = nodes.flatMap(child => {
    if (child.startsWith('D') || child.startsWith('M')) return [];
    return (PARENTS[child] ?? []).map(parent => ({ child, parent }));
  });

  return (
    <div ref={scroller} className="shield-scroll" tabIndex={0} role="group" aria-label={L('盾盤概覽，可左右捲動；下方另有依位置瀏覽的列表', 'Shield chart overview; scroll sideways. A list by position follows below.')}>
      <svg className={`shield${animate ? ' is-animating' : ''}`} viewBox={`0 0 800 ${height}`} width="800" height={height}>
        <text className="shield-caption" x="200" y="16" textAnchor="middle">{L('四女象（由四母象轉置）', 'Daughters (the Mothers read across)')}</text>
        <text className="shield-caption" x="600" y="16" textAnchor="middle">{L('四母象（第一母象在最右）', 'Mothers (the First Mother on the right)')}</text>
        {lines.map(({ child, parent }) => {
          const a = POSITION[parent], b = POSITION[child];
          const active = selected === child;
          const long = child === 'R' && parent === 'M1';
          const onPath = path.includes(child) && path.includes(parent);
          return (
            <path key={`${parent}-${child}`} className={`shield-line${active ? ' is-active' : ''}${long ? ' is-long' : ''}${onPath ? ' is-path' : ''}`}
              d={long
                ? `M ${a.x} ${a.y + H / 2} L ${a.x} ${b.y} L ${b.x + W / 2} ${b.y}`
                : `M ${a.x} ${a.y + H / 2} L ${b.x} ${b.y - H / 2}`} />
          );
        })}
        {nodes.map(node => {
          const { x, y } = POSITION[node], figure = chart[node], info = figureOf(figure);
          const isSelected = selected === node, isParent = parentsOfSelected.includes(node);
          const marker = markers[node], onPath = path.includes(node);
          return (
            <g key={node} transform={`translate(${x - W / 2} ${y - H / 2})`} role="button" tabIndex={0}
              className={`shield-node${isSelected ? ' is-selected' : ''}${isParent ? ' is-parent' : ''}${onPath ? ' is-path' : ''}`}
              style={animate ? { animationDelay: `${NODES.indexOf(node) * 170}ms` } : undefined}
              aria-label={`${T.NODE_LABEL[node]}${L('：', ': ')}${T.figureAria(figure)}${marker ? `${L('，', ', ')}${marker}` : ''}${onPath ? L('，點之道經過', ', on the Way of the Points') : ''}`}
              aria-pressed={isSelected}
              onClick={() => onSelect(node)}
              onKeyDown={event => {
                if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(node); }
              }}>
              <rect width={W} height={H} rx="10" />
              {glyphDots(figure, W / 2, 16, 15, 10).map((dot, i) => <circle key={i} cx={dot.x} cy={dot.y} r="4.5" />)}
              <text x={W / 2} y="84" textAnchor="middle" className="shield-id">{node}{isParent ? L('・來源', ' · source') : ''}</text>
              <text x={W / 2} y="99" textAnchor="middle" className="shield-name"
                {...(T.name(info).length > 11 ? { textLength: W - 6, lengthAdjust: 'spacingAndGlyphs' } : {})}>{T.name(info)}</text>
              {marker && <text x={W / 2} y={-5} textAnchor="middle" className="shield-marker">{marker}</text>}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
