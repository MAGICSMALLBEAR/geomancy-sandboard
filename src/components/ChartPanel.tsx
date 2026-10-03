import { useRef, useState } from 'react';
import { HOUSE_NODES, NODES, toDots, type CastSource, type Chart, type NodeId } from '../domain/geomancy.ts';
import { HOUSES } from '../domain/catalog.ts';
import { NODE_LABEL, figureOf, houseOfNode } from '../content/labels.ts';
import { Derivation } from './Derivation.tsx';
import { FigureGlyph } from './FigureGlyph.tsx';
import { ShieldChart } from './ShieldChart.tsx';

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
};

export function ChartPanel({ chart, source, targetHouse, selected, onSelect, animate, onSkipAnimation, path }: Props) {
  const [view, setView] = useState<'shield' | 'houses'>('shield');
  const [showReconciler, setShowReconciler] = useState(false);
  const detailRefs = useRef<Partial<Record<NodeId, HTMLLIElement | null>>>({});
  const nodes = NODES.filter(n => showReconciler || n !== 'R');
  const targetNode = targetHouse ? HOUSE_NODES[targetHouse - 1] : null;
  const markers: Partial<Record<NodeId, string>> = { M1: '第 1 宮', ...(targetNode ? { [targetNode]: targetNode === 'M1' ? '第 1 宮' : '問題宮' } : {}) };

  const selectFromChart = (node: NodeId) => {
    onSelect(node);
    // Move focus to the written explanation so the highlight is never the only feedback.
    requestAnimationFrame(() => detailRefs.current[node]?.querySelector('button')?.focus());
  };

  return (
    <section className="chart-panel" aria-label="盤面">
      <div className="segmented" role="group" aria-label="盤面檢視">
        <button type="button" aria-pressed={view === 'shield'} onClick={() => setView('shield')}>盾盤</button>
        <button type="button" aria-pressed={view === 'houses'} onClick={() => setView('houses')}>十二宮</button>
      </div>

      {view === 'shield' && <>
        <label className="check">
          <input type="checkbox" checked={showReconciler} onChange={event => setShowReconciler(event.target.checked)} />
          顯示調和者（第十六象；部分傳統不使用）
        </label>
        {animate && <button type="button" className="link-button" onClick={onSkipAnimation}>略過成盤動畫</button>}
        <ShieldChart path={path} chart={chart} showReconciler={showReconciler} selected={selected} onSelect={selectFromChart}
          animate={animate} markers={markers} />
        <p className="hint scroll-hint">盤面較寬，可左右捲動；也可以用下面的列表查看每個位置。</p>

        <h3>依位置瀏覽</h3>
        <ol className="node-list">
          {nodes.map(node => {
            const info = figureOf(chart[node]), house = houseOfNode(node), open = selected === node;
            return (
              <li key={node} ref={element => { detailRefs.current[node] = element; }} className={open ? 'is-open' : undefined}>
                <button type="button" className="node-row" aria-expanded={open} onClick={() => onSelect(open ? null : node)}>
                  <FigureGlyph figure={chart[node]} size={26} decorative />
                  <span className="node-row-text">
                    <strong>{NODE_LABEL[node]}</strong>
                    <span>{info.zh}／{info.latin}・圖式 {toDots(chart[node])}</span>
                    {house && <span>第 {house} 宮：{HOUSES[house - 1]}{house === targetHouse ? '（你選的問題宮）' : ''}</span>}
                  </span>
                </button>
                {open && (
                  <div className="node-detail">
                    <p>象徵主題：{info.keywords.join('、')}。</p>
                    <Derivation node={node} chart={chart} source={source} />
                    <a href={`#/learn/${info.id}`}>查看「{info.zh}」的說明</a>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </>}

      {view === 'houses' && (
        <ol className="house-grid">
          {HOUSE_NODES.map((node, i) => {
            const house = i + 1, info = figureOf(chart[node]);
            const tag = house === 1 ? '自己（第 1 宮）' : house === targetHouse ? '你選的問題宮' : null;
            return (
              <li key={node} className={`house-card${tag ? ' is-marked' : ''}`}>
                <FigureGlyph figure={chart[node]} size={30} />
                <div>
                  <strong>第 {house} 宮</strong>
                  <span>{HOUSES[i]}</span>
                  <span>{info.zh}／{info.latin}・{toDots(chart[node])}</span>
                  <span className="muted">來源盤位：{NODE_LABEL[node]}（{node}）</span>
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
