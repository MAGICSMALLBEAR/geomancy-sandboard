import { houseNodes, RULE_VERSION, type Chart, type RuleVersion } from '../domain/geomancy.ts';
import { ASPECT_TONE, advancedLabels, type AspectResult } from '../domain/advanced.ts';
import { useApp } from '../app/AppContext.tsx';
import { figureOf } from '../content/labels.ts';
import { glyphDots } from './FigureGlyph.tsx';

const C = 220, R_OUT = 205, R_IN = 92;
/** Astrological layout: house 1 just below the left horizon, houses running counter-clockwise. */
const angle = (house: number) => ((195 + (house - 1) * 30) * Math.PI) / 180;
const at = (house: number, r: number) => ({ x: C + r * Math.cos(angle(house)), y: C - r * Math.sin(angle(house)) });
const polar = (deg: number, r: number) => ({ x: C + r * Math.cos((deg * Math.PI) / 180), y: C - r * Math.sin((deg * Math.PI) / 180) });

function sector(house: number): string {
  const start = 180 + (house - 1) * 30, end = start + 30;
  const a = polar(start, R_OUT), b = polar(end, R_OUT), c = polar(end, R_IN), d = polar(start, R_IN);
  // Counter-clockwise on screen = sweep-flag 0 for the outer arc, 1 for the inner arc back.
  return `M ${a.x} ${a.y} A ${R_OUT} ${R_OUT} 0 0 0 ${b.x} ${b.y} L ${c.x} ${c.y} A ${R_IN} ${R_IN} 0 0 1 ${d.x} ${d.y} Z`;
}

/** Twelve houses in a wheel, with the aspects between the two significators drawn across the middle. */
export function HouseWheel({ chart, targetHouse, aspects, rule = RULE_VERSION }: { chart: Chart; targetHouse: number | null; aspects: AspectResult; rule?: RuleVersion }) {
  const { L, T, lang } = useApp();
  const ASPECT_LABEL = advancedLabels(lang).aspect;
  const lines = aspects.status === 'checked'
    ? [
        ...(aspects.base ? [{ from: 1, to: aspects.quesited, cls: 'is-base', key: 'base' }] : []),
        ...aspects.hits.map((hit, i) => ({ from: hit.from, to: hit.to, cls: `is-${ASPECT_TONE[hit.kind]}`, key: `hit-${i}` })),
      ]
    : [];
  const label = aspects.status === 'checked'
    ? L(`十二宮圓盤。第 1 宮與第 ${aspects.quesited} 宮${aspects.base ? `為${ASPECT_LABEL[aspects.base]}` : '之間沒有主要相位'}；代表象另形成 ${aspects.hits.length} 個相位。各宮的象見下方列表。`,
      `Wheel of the twelve houses. House 1 and house ${aspects.quesited} ${aspects.base ? `form a ${ASPECT_LABEL[aspects.base].toLowerCase()}` : 'have no major aspect'}; the significators form ${aspects.hits.length} further aspect${aspects.hits.length === 1 ? '' : 's'}. The figure in each house is listed below.`)
    : L('十二宮圓盤。這次沒有選定問題宮，不標示相位。各宮的象見下方列表。', 'Wheel of the twelve houses. No question house was chosen, so no aspects are drawn. The figure in each house is listed below.');

  return (
    <figure className="house-wheel-wrap">
      <svg className="house-wheel" viewBox="0 0 440 440" role="img" aria-label={label}>
        <circle className="hw-ring" cx={C} cy={C} r={R_OUT} />
        {houseNodes(rule).map((node, i) => {
          const house = i + 1, info = figureOf(chart[node]);
          const marked = house === 1 || house === targetHouse;
          const g = at(house, 150), num = at(house, 192), name = at(house, 110);
          return (
            <g key={node} className={`hw-cell${marked ? ' is-marked' : ''}`}>
              <path className="hw-cell-bg" d={sector(house)} />
              <text className="hw-num" x={num.x} y={num.y + 4} textAnchor="middle">{house}</text>
              <g transform={`translate(${g.x - 10} ${g.y - 22})`}>
                {glyphDots(chart[node], 10, 4, 12, 5).map((d, j) => <circle key={j} cx={d.x} cy={d.y} r="2.7" />)}
              </g>
              <text className="hw-name" x={name.x} y={name.y + 4} textAnchor="middle"
                {...(T.name(info).length > 10 ? { textLength: 64, lengthAdjust: 'spacingAndGlyphs' } : {})}>{T.name(info)}</text>
            </g>
          );
        })}
        {Array.from({ length: 12 }, (_, i) => {
          const a = polar(180 + i * 30, R_IN), b = polar(180 + i * 30, R_OUT);
          return <line key={i} className="hw-spoke" x1={a.x} y1={a.y} x2={b.x} y2={b.y} />;
        })}
        <circle className="hw-inner" cx={C} cy={C} r={R_IN} />
        {lines.map(line => {
          const a = at(line.from, R_IN - 6), b = at(line.to, R_IN - 6);
          return <path key={line.key} className={`hw-aspect ${line.cls}`} d={`M ${a.x} ${a.y} L ${b.x} ${b.y}`} />;
        })}
        {lines.length === 0 && <text className="hw-center" x={C} y={C + 4} textAnchor="middle">{aspects.status === 'checked' ? L('沒有相位', 'No aspects') : L('未選問題宮', 'No question house')}</text>}
      </svg>
      {lines.length > 0 && (
        <ul className="hw-legend" aria-hidden="true">
          <li className="is-base"><i />{L('宮位本身的相位', 'Aspect between the houses themselves')}</li>
          <li className="is-easy"><i />{L('助力型（六分、三分）', 'Supportive (sextile, trine)')}</li>
          <li className="is-hard"><i />{L('張力型（四分、對分）', 'Tense (square, opposition)')}</li>
        </ul>
      )}
    </figure>
  );
}
