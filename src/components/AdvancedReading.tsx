import { fromDots, HOUSE_NODES, type NodeId } from '../domain/geomancy.ts';
import { HOUSES } from '../domain/catalog.ts';
import { PERFECTION_LABEL, type AdvancedReading as Advanced } from '../domain/advanced.ts';
import { NODE_LABEL } from '../content/labels.ts';
import { sourceById } from '../content/sources.ts';
import { FigureGlyph } from './FigureGlyph.tsx';

type Props = {
  advanced: Advanced;
  onShowNode: (node: NodeId) => void;
  pathShown: boolean;
  onTogglePath: () => void;
};

function Sources({ ids }: { ids: string[] }) {
  return (
    <p className="muted">來源：{ids.map((id, i) => {
      const entry = sourceById(id);
      return (
        <span key={id}>{i > 0 && '、'}
          {entry?.url ? <a href={entry.url} target="_blank" rel="noopener noreferrer">{entry.title}</a> : (entry?.title ?? id)}
        </span>
      );
    })}</p>
  );
}

/** Advanced layer: recomputed from the chart on display, never stored (DECISIONS D24). */
export function AdvancedReading({ advanced, onShowNode, pathShown, onTogglePath }: Props) {
  const { perfection, way, court, houses } = advanced;
  return (
    <section className="advanced-reading" aria-labelledby="advanced-title">
      <h2 id="advanced-title">進階解讀<span className="tag">草稿</span></h2>
      <p className="muted">以下依傳統西方地占技法由盤面即時計算，文字是本產品的編輯草稿，尚未經地占專家審校；
        它不存進記錄，規則或文字更新後重開會看到新版本（{advanced.version}）。</p>

      <article className="card">
        <h3>成事關係</h3>
        {perfection.status === 'no-quesited' ? (
          <p>成事關係比較第 1 宮（你自己）與所問之事的宮位。這次是一般反思，沒有選定問題宮，所以不判斷。
            想看成事關係，新增占問時選擇「工作」或「關係」並指定宮位。</p>
        ) : (
          <>
            <p>第 1 宮（你自己）是「{perfection.querentFigure.zh}」，第 {perfection.quesited} 宮（{HOUSES[perfection.quesited - 1]}）是「{perfection.quesitedFigure.zh}」。</p>
            <p>{perfection.summary}</p>
            {perfection.hits.length > 0 && (
              <ol className="perfection-hits">
                {perfection.hits.map((hit, i) => (
                  <li key={i}>
                    <strong>{PERFECTION_LABEL[hit.mode]}</strong>：{hit.text}
                    <br />
                    {hit.houses.map(h => (
                      <button key={h} type="button" className="link-button" onClick={() => onShowNode(HOUSE_NODES[h - 1])}>看第 {h} 宮</button>
                    ))}
                  </li>
                ))}
              </ol>
            )}
          </>
        )}
        <Sources ids={['G06', 'E01']} />
      </article>

      <article className="card">
        <h3>證人與裁判</h3>
        <p>{court}</p>
        <p>
          {(['RW', 'LW', 'J'] as NodeId[]).map(node => (
            <button key={node} type="button" className="link-button" onClick={() => onShowNode(node)}>看{NODE_LABEL[node]}</button>
          ))}
        </p>
        <Sources ids={['G01', 'E01']} />
      </article>

      <article className="card">
        <h3>點之道</h3>
        <p>{way.text}</p>
        <button type="button" aria-pressed={pathShown} onClick={onTogglePath}>
          {pathShown ? '取消盾盤上的路徑' : '在盾盤上標出路徑'}
        </button>
        <p className="muted">經過：{way.nodes.map(n => NODE_LABEL[n]).join(' → ')}</p>
        <Sources ids={['G07', 'E01']} />
      </article>

      <details className="card">
        <summary>十二宮逐宮解讀</summary>
        <p className="muted">每一宮代表一個生活領域；落在其中的象說明那個領域的狀態。這是組合式的草稿文字：由「象在宮中的傾向」與「宮位的問題」組成。</p>
        <ol className="house-readings">
          {houses.map(h => (
            <li key={h.house} className={h.isQuerent || h.isQuesited ? 'is-marked' : ''}>
              <FigureGlyph figure={fromDots(h.figure.dots)} size={28} decorative />
              <div>
                <p><strong>第 {h.house} 宮</strong>
                  {h.isQuerent && <span className="tag">你自己</span>}
                  {h.isQuesited && <span className="tag">問題宮</span>}
                </p>
                <p>{h.text}</p>
                <p className="muted">可以想想：{h.prompt}</p>
              </div>
            </li>
          ))}
        </ol>
        <Sources ids={['G02', 'E01']} />
      </details>
    </section>
  );
}
