import { fromDots, houseNodes, type NodeId } from '../domain/geomancy.ts';
import { ASPECT_TONE, advancedLabels, type AdvancedReading as Advanced } from '../domain/advanced.ts';
import { sourceById, sourceText } from '../content/sources.ts';
import { useApp } from '../app/AppContext.tsx';
import { FigureGlyph } from './FigureGlyph.tsx';

type Props = {
  advanced: Advanced;
  onShowNode: (node: NodeId) => void;
  pathShown: boolean;
  onTogglePath: () => void;
};

function Sources({ ids }: { ids: string[] }) {
  const { L, lang } = useApp();
  return (
    <p className="muted">{L('來源：', 'Sources: ')}{ids.map((id, i) => {
      const entry = sourceById(id), title = entry ? sourceText(entry, lang).title : id;
      return (
        <span key={id}>{i > 0 && L('、', '; ')}
          {entry?.url ? <a href={entry.url} target="_blank" rel="noopener noreferrer">{title}</a> : title}
        </span>
      );
    })}</p>
  );
}

/** Advanced layer: recomputed from the chart on display, never stored (DECISIONS D24). */
export function AdvancedReading({ advanced, onShowNode, pathShown, onTogglePath }: Props) {
  const { L, T, lang } = useApp();
  const { perfection: PERFECTION_LABEL, aspect: ASPECT_LABEL } = advancedLabels(lang);
  const { perfection, aspects, recurrences, way, court, houses, halted } = advanced;
  const nodes = houseNodes(advanced.rule);
  const showHouse = (h: number) => onShowNode(nodes[h - 1]);
  const seeHouse = (h: number) => L(`看第 ${h} 宮`, `Show house ${h}`);
  return (
    <section className="advanced-reading" aria-labelledby="advanced-title">
      <h2 id="advanced-title">{L('進階解讀', 'Advanced reading')}<span className="tag">{L('草稿', 'draft')}</span></h2>
      <p className="muted">{L(`以下依傳統西方地占技法由盤面即時計算，文字是本產品的編輯草稿，尚未經地占專家審校；它不存進記錄，規則或文字更新後重開會看到新版本（${advanced.version}）。`,
        `Computed from the chart with traditional Western geomancy techniques each time you open it. The wording is this App's editorial draft, not reviewed by a geomancy expert; it is not saved with the record, so after an update you will see the new version (${advanced.version}).`)}</p>

      {halted && (
        <article className="card halted-note">
          <h3>{L('傳統禁例：停止盤', 'A traditional rule: the halted chart')}</h3>
          <p>{halted.text}</p>
          <p><a href="#/learn/customs">{L('了解古典禁例與起卦習慣', 'About the classical rules and casting customs')}</a></p>
          <Sources ids={['G10', 'E01']} />
        </article>
      )}

      <article className="card">
        <h3>{L('成事關係', 'Perfection')}</h3>
        {perfection.status === 'no-quesited' ? (
          <p>{L('成事關係比較第 1 宮（你自己）與所問之事的宮位。這次是一般反思，沒有選定問題宮，所以不判斷。想看成事關係，新增占問時選擇「工作」或「關係」並指定宮位。',
            'Perfection compares house 1 (you) with the house of the matter. This is a general reflection with no question house, so it is not judged. To see perfection, choose Work or Relationships and a house when asking.')}</p>
        ) : (
          <>
            <p>{L(`第 1 宮（你自己）是「${perfection.querentFigure.zh}」，第 ${perfection.quesited} 宮（${T.HOUSES[perfection.quesited - 1]}）是「${perfection.quesitedFigure.zh}」。`,
              `House 1 (you) holds ${perfection.querentFigure.latin}; house ${perfection.quesited} (${T.HOUSES[perfection.quesited - 1]}) holds ${perfection.quesitedFigure.latin}.`)}</p>
            <p>{perfection.summary}</p>
            {perfection.hits.length > 0 && (
              <ol className="perfection-hits">
                {perfection.hits.map((hit, i) => (
                  <li key={i}>
                    <strong>{PERFECTION_LABEL[hit.mode]}</strong>{L('：', ': ')}{hit.text}
                    <br />
                    {hit.houses.map(h => (
                      <button key={h} type="button" className="link-button" onClick={() => onShowNode(nodes[h - 1])}>{seeHouse(h)}</button>
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
        <h3>{L('相位', 'Aspects')}</h3>
        {aspects.status === 'no-quesited' ? (
          <p>{L('相位看的是第 1 宮與問題宮之間的距離，以及兩個代表象移到哪裡。這次是一般反思，沒有選定問題宮，所以不判斷。',
            'Aspects look at the distance between house 1 and the question house, and where the two significators move. This is a general reflection with no question house, so they are not judged.')}</p>
        ) : (
          <>
            <p className="muted">{L('像占星一樣把十二宮排成一圈：相隔兩宮為六分相、三宮為四分相、四宮為三分相、六宮為對分相；相鄰或相隔五宮沒有主要相位。相位不算成事，只說明雙方之間的氣氛。在「盤面 → 十二宮」可以看到連線。',
              'As in astrology, the twelve houses form a circle: two houses apart is a sextile, three a square, four a trine, six an opposition; adjacent or five apart has no major aspect. Aspects are not perfection; they describe the mood between the two sides. Chart → Houses shows the lines.')}</p>
            <p>{aspects.baseText}</p>
            {aspects.hits.length > 0 && (
              <ul className="aspect-list">
                {aspects.hits.map((hit, i) => (
                  <li key={i} className={`is-${ASPECT_TONE[hit.kind]}`}>
                    <span className={`tone is-${ASPECT_TONE[hit.kind]}`}>{ASPECT_TONE[hit.kind] === 'easy' ? L('助力', 'Supportive') : L('張力', 'Tense')}・{ASPECT_LABEL[hit.kind]}</span>
                    <br />{hit.text}
                    <br />
                    <button type="button" className="link-button" onClick={() => showHouse(hit.from)}>{seeHouse(hit.from)}</button>
                  </li>
                ))}
              </ul>
            )}
            <p>{aspects.summary}</p>
          </>
        )}
        <Sources ids={['G08', 'E01']} />
      </article>

      <article className="card">
        <h3>{L('象的重現', 'Recurring figures')}</h3>
        <p className="muted">{L('同一個象出現在好幾個宮位時，傳統上把它看成一條線，把那些生活領域串在一起；裁判的象若也出現在宮位中，說明結論會在哪裡顯現。',
          "When one figure appears in several houses, tradition sees it as a thread tying those areas of life together; if the Judge's figure also appears in a house, it shows where the verdict will show itself.")}</p>
        {recurrences.length === 0
          ? <p>{L('十二宮裡沒有重複出現的象，裁判的象也沒有出現在任何宮位：各個領域各自獨立，沒有特別被串起來的主題。',
            "No figure repeats in the twelve houses and the Judge's figure is in none of them: each area stands on its own, with no theme tying them together.")}</p>
          : (
            <ul className="recur-list">
              {recurrences.map(r => (
                <li key={r.figure.id}>
                  <FigureGlyph figure={fromDots(r.figure.dots)} size={26} decorative />
                  <div>
                    <p>
                      {r.roles.includes('querent') && <span className="tag">{L('你自己的象', 'Your figure')}</span>}
                      {r.roles.includes('quesited') && <span className="tag">{L('問題宮的象', 'Figure of the question')}</span>}
                      {r.roles.includes('judge') && <span className="tag">{L('裁判的象', "Judge's figure")}</span>}
                    </p>
                    <p>{r.text}</p>
                    <p>{r.houses.map(h => (
                      <button key={h} type="button" className="link-button" onClick={() => showHouse(h)}>{seeHouse(h)}</button>
                    ))}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        <Sources ids={['G08', 'E01']} />
      </article>

      <article className="card">
        <h3>{L('證人與裁判', 'Witnesses and Judge')}</h3>
        <p>{court}</p>
        <p>
          {(['RW', 'LW', 'J'] as NodeId[]).map(node => (
            <button key={node} type="button" className="link-button" onClick={() => onShowNode(node)}>{L(`看${T.NODE_LABEL[node]}`, `Show the ${T.NODE_LABEL[node]}`)}</button>
          ))}
        </p>
        <Sources ids={['G01', 'E01']} />
      </article>

      <article className="card">
        <h3>{L('點之道', 'The Way of the Points')}</h3>
        <p>{way.text}</p>
        <button type="button" aria-pressed={pathShown} onClick={onTogglePath}>
          {pathShown ? L('取消盾盤上的路徑', 'Hide the path on the shield') : L('在盾盤上標出路徑', 'Mark the path on the shield')}
        </button>
        <p className="muted">{L('經過：', 'Passes through: ')}{way.nodes.map(n => T.NODE_LABEL[n]).join(' → ')}</p>
        <Sources ids={['G07', 'E01']} />
      </article>

      <details className="card">
        <summary>{L('十二宮逐宮解讀', 'House by house')}</summary>
        <p className="muted">{L('每一宮代表一個生活領域；落在其中的象說明那個領域的狀態。這是組合式的草稿文字：由「象在宮中的傾向」與「宮位的問題」組成。',
          'Each house is an area of life; the figure in it describes that area. This draft text is composed from two parts: how the figure tends to act in a house, and a question for that house.')}</p>
        <ol className="house-readings">
          {houses.map(h => (
            <li key={h.house} className={h.isQuerent || h.isQuesited ? 'is-marked' : ''}>
              <FigureGlyph figure={fromDots(h.figure.dots)} size={28} decorative />
              <div>
                <p><strong>{L(`第 ${h.house} 宮`, `House ${h.house}`)}</strong>
                  {h.isQuerent && <span className="tag">{L('你自己', 'You')}</span>}
                  {h.isQuesited && <span className="tag">{L('問題宮', 'Question house')}</span>}
                </p>
                <p>{h.text}</p>
                <p className="muted">{L('可以想想：', 'To think about: ')}{h.prompt}</p>
              </div>
            </li>
          ))}
        </ol>
        <Sources ids={['G02', 'E01']} />
      </details>
    </section>
  );
}
