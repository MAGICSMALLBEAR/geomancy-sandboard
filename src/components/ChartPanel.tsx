import { useRef, useState } from 'react';
import { HOUSE_NODES, NODES, PARENTS, toDots, type CastSource, type Chart, type NodeId } from '../domain/geomancy.ts';
import { HOUSES } from '../domain/catalog.ts';
import { NODE_LABEL, ORDINAL, ROW_ELEMENT, dotWord, figureOf, houseOfNode } from '../content/labels.ts';
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

/** How one position was produced, in words. Mothers show their real origin, never invented dot counts. */
function Derivation({ node, chart, source }: { node: NodeId; chart: Chart; source: CastSource }) {
  const parents = PARENTS[node];
  if (node.startsWith('M')) {
    const index = Number(node[1]) - 1;
    if (source.kind === 'quick') return <p>數位亂數來源：由裝置亂數一次產生的十六個位元，每四個位元組成一個母象。</p>;
    if (source.kind === 'manual') return <p>手動設定：這個母象由你直接輸入。</p>;
    const verb = source.kind === 'auto' ? '裝置亂數落下' : '點了';
    return (
      <>
      {source.kind === 'auto' && <p>自動點沙：每列落下幾粒沙由裝置亂數一次決定（5–20 粒），奇偶規則與手動點沙相同。</p>}
      <ol className="derive-rows">
        {source.counts.slice(index * 4, index * 4 + 4).map((count, row) => (
          <li key={row}>{ROW_ELEMENT[row]}行：{verb} {count} {source.kind === 'auto' ? '粒' : '下'}，{count % 2 === 1 ? '奇數' : '偶數'} → {dotWord(count % 2)}</li>
        ))}
      </ol>
      </>
    );
  }
  if (node.startsWith('D') && parents) {
    const row = Number(node[1]) - 1;
    return (
      <>
        <p>轉置：依序取四個母象的第{ORDINAL[row]}行（{ROW_ELEMENT[row]}行），不是相加。</p>
        <ol className="derive-rows">
          {parents.map((mother, i) => (
            <li key={mother}>{NODE_LABEL[mother]}的第{ORDINAL[row]}行是{dotWord(chart[mother][row])} → 這裡的第{ORDINAL[i]}行</li>
          ))}
        </ol>
      </>
    );
  }
  if (!parents) return null;
  const [a, b] = parents;
  return (
    <>
      <p>{NODE_LABEL[a]}（{a}）＋{NODE_LABEL[b]}（{b}）逐行合成：相同得兩點，不同得一點。</p>
      <ol className="derive-rows">
        {chart[node].map((bit, row) => (
          <li key={row}>{ROW_ELEMENT[row]}行：{dotWord(chart[a][row])}＋{dotWord(chart[b][row])} → {dotWord(bit)}</li>
        ))}
      </ol>
    </>
  );
}

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
