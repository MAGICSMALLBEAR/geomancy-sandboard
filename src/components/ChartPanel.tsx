import { useRef, useState } from 'react';
import { houseNodes, NODES, RULE_VERSION, toDots, type CastSource, type Chart, type NodeId, type RuleVersion } from '../domain/geomancy.ts';
import { figureOf, houseOfNode } from '../content/labels.ts';
import { useApp } from '../app/AppContext.tsx';
import { Derivation } from './Derivation.tsx';
import { FigureGlyph } from './FigureGlyph.tsx';
import { ShieldChart } from './ShieldChart.tsx';
import { HouseWheel } from './HouseWheel.tsx';
import type { AspectResult } from '../domain/advanced.ts';

type Props = {
  chart: Chart;
  source: CastSource;
  targetHouse: number | null;
  selected: NodeId | null;
  onSelect: (node: NodeId | null) => void;
  animate: boolean;
  onSkipAnimation: () => void;
  /** Way of the Points to highlight on the shield, if the reader asked for it. */
  path?: readonly NodeId[];
  /** Drawn on the house wheel; omitted where no advanced reading exists. */
  aspects?: AspectResult;
  /** Replaces "you entered this" for manual mothers, e.g. on a shared chart. */
  manualNote?: string;
  /** House rule of this chart; the shield itself is the same under every rule. */
  rule?: RuleVersion;
};

export function ChartPanel({ chart, source, targetHouse, selected, onSelect, animate, onSkipAnimation, path, aspects, manualNote, rule = RULE_VERSION }: Props) {
  const { L, T } = useApp();
  const [view, setView] = useState<'shield' | 'houses'>('shield');
  const [showReconciler, setShowReconciler] = useState(false);
  const detailRefs = useRef<Partial<Record<NodeId, HTMLLIElement | null>>>({});
  const nodes = NODES.filter(n => showReconciler || n !== 'R');
  const houseList = houseNodes(rule);
  const targetNode = targetHouse ? houseList[targetHouse - 1] : null;
  const house1 = houseList[0], house1Label = L('第 1 宮', 'House 1');
  const markers: Partial<Record<NodeId, string>> = {
    [house1]: house1Label, ...(targetNode ? { [targetNode]: targetNode === house1 ? house1Label : L('問題宮', 'Question') } : {}),
  };

  const selectFromChart = (node: NodeId) => {
    onSelect(node);
    // Move focus to the written explanation so the highlight is never the only feedback.
    requestAnimationFrame(() => detailRefs.current[node]?.querySelector('button')?.focus());
  };

  return (
    <section className="chart-panel" aria-label={L('盤面', 'Chart')}>
      <div className="segmented" role="group" aria-label={L('盤面檢視', 'Chart view')}>
        <button type="button" aria-pressed={view === 'shield'} onClick={() => setView('shield')}>{L('盾盤', 'Shield')}</button>
        <button type="button" aria-pressed={view === 'houses'} onClick={() => setView('houses')}>{L('十二宮', 'Houses')}</button>
      </div>

      {view === 'shield' && <>
        <label className="check">
          <input type="checkbox" checked={showReconciler} onChange={event => setShowReconciler(event.target.checked)} />
          {L('顯示調和者（第十六象；部分傳統不使用）', 'Show the Reconciler (the sixteenth figure; some traditions do not use it)')}
        </label>
        {animate && <button type="button" className="link-button" onClick={onSkipAnimation}>{L('略過成盤動畫', 'Skip the chart animation')}</button>}
        <ShieldChart path={path} chart={chart} showReconciler={showReconciler} selected={selected} onSelect={selectFromChart}
          animate={animate} markers={markers} />
        <p className="hint scroll-hint">{L('盤面較寬，可左右捲動；也可以用下面的列表查看每個位置。', 'The chart is wide; scroll sideways, or use the list below to see each position.')}</p>

        <h3>{L('依位置瀏覽', 'By position')}</h3>
        <ol className="node-list">
          {nodes.map(node => {
            const info = figureOf(chart[node]), house = houseOfNode(node, rule), open = selected === node;
            return (
              <li key={node} ref={element => { detailRefs.current[node] = element; }} className={open ? 'is-open' : undefined}>
                <button type="button" className="node-row" aria-expanded={open} onClick={() => onSelect(open ? null : node)}>
                  <FigureGlyph figure={chart[node]} size={26} decorative />
                  <span className="node-row-text">
                    <strong>{T.NODE_LABEL[node]}</strong>
                    <span>{T.fullName(info)}{L('・圖式 ', ' · pattern ')}{toDots(chart[node])}</span>
                    {house && <span>{L(`第 ${house} 宮：`, `House ${house}: `)}{T.HOUSES[house - 1]}{house === targetHouse ? L('（你選的問題宮）', ' (your question house)') : ''}</span>}
                  </span>
                </button>
                {open && (
                  <div className="node-detail">
                    <p>{L('象徵主題：', 'Themes: ')}{T.list(T.keywords(info))}{L('。', '.')}</p>
                    <Derivation node={node} chart={chart} source={source} manualNote={manualNote} />
                    <a href={`#/learn/${info.id}`}>{L(`查看「${info.zh}」的說明`, `About ${info.latin}`)}</a>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </>}

      {view === 'houses' && aspects && <HouseWheel chart={chart} targetHouse={targetHouse} aspects={aspects} rule={rule} />}
      {view === 'houses' && (
        <ol className="house-grid">
          {houseList.map((node, i) => {
            const house = i + 1, info = figureOf(chart[node]);
            const tag = house === 1 ? L('自己（第 1 宮）', 'You (house 1)') : house === targetHouse ? L('你選的問題宮', 'Your question house') : null;
            return (
              <li key={node} className={`house-card${tag ? ' is-marked' : ''}`}>
                <FigureGlyph figure={chart[node]} size={30} />
                <div>
                  <strong>{L(`第 ${house} 宮`, `House ${house}`)}</strong>
                  <span>{T.HOUSES[i]}</span>
                  <span>{T.fullName(info)}・{toDots(chart[node])}</span>
                  <span className="muted">{L('來源盤位：', 'From: ')}{T.NODE_LABEL[node]}{L(`（${node}）`, ` (${node})`)}</span>
                  {tag && <span className="tag">{tag}</span>}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
