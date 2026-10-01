import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { constructChart, fromDots, mothersFromCounts, RULE_VERSION, type CastSource } from '../../domain/geomancy.ts';
import { CONTENT_VERSION, FIGURES } from '../../domain/catalog.ts';
import { buildReading, type Question } from '../../domain/reading.ts';
import teaching from '../../../fixtures/teaching.json';
import { useApp } from '../../app/AppContext.tsx';
import { SOURCES } from '../../content/sources.ts';
import { FigureGlyph } from '../../components/FigureGlyph.tsx';
import { ResultView } from '../../components/ResultView.tsx';

export function LearnPage() {
  return (
    <div className="learn">
      <h1>十六象與教學</h1>

      <section className="card">
        <h2>地占怎麼起卦</h2>
        <ol>
          <li>先寫下一個具體的問題。</li>
          <li>在沙面上不刻意計數地點出十六列點痕。每一列的總數是奇數就記一點，偶數就記兩點。</li>
          <li>每四列組成一個「母象」，依序得到四個母象。每個象由上到下四行，對應火、風、水、土。</li>
          <li>四個「女象」由四母象轉置而來：第一女象依序取四個母象的第一行，依此類推。</li>
          <li>兩兩逐行合成（相同得兩點，不同得一點），得到四個姪象、兩個證人，最後是裁判。</li>
          <li>前十二個位置依序放入十二宮：母象是第 1–4 宮，女象是第 5–8 宮，姪象是第 9–12 宮。</li>
        </ol>
        <p>這裡的地占是西方十六象系統，不需要出生資料、星曆或定位。</p>
        <Link className="button" to="/learn/example">打開固定教學例題</Link>
      </section>

      <section>
        <h2>十六象</h2>
        <p className="muted">中文是本產品的工作譯名。象義為編輯草稿，尚未經地占專家逐條審校。</p>
        <ul className="figure-grid">
          {FIGURES.map(f => (
            <li key={f.id}>
              <Link to={`/learn/${f.id}`} className="card figure-tile">
                <FigureGlyph figure={fromDots(f.dots)} size={30} decorative />
                <span><strong>{f.zh}</strong><br />{f.latin}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="card" id="sources">
        <h2>規則與來源</h2>
        <p>規則版本 {RULE_VERSION}：常見的盾盤構造，前十二個位置依序入宮。其他傳統有不同的入宮方式，本版沒有採用。</p>
        <p>內容版本 {CONTENT_VERSION}：基礎象徵解讀（編輯草稿）。本版沒有成就、相位、點之道等技法。</p>
        <ul className="source-list">
          {SOURCES.map(source => (
            <li key={source.id}>
              <strong>{source.id}</strong>
              {source.url
                ? <a href={source.url} target="_blank" rel="noopener noreferrer">{source.title}（外部網頁，需要網路）</a>
                : source.title}
              <br /><span className="muted">{source.note}</span>
            </li>
          ))}
        </ul>
        <p className="muted">來源連結供查核用，不代表來源作者認可本產品的中文文案。</p>
      </section>
    </div>
  );
}

export function FigurePage() {
  const { figureId } = useParams();
  const info = FIGURES.find(f => f.id === figureId);
  if (!info) {
    return <div className="card"><h1>找不到這個象</h1><Link to="/learn">回十六象目錄</Link></div>;
  }
  return (
    <article className="card figure-page">
      <p><Link to="/learn">← 回十六象目錄</Link></p>
      <h1>{info.zh}<span className="latin">{info.latin}</span></h1>
      <FigureGlyph figure={fromDots(info.dots)} size={72} />
      <p>圖式（由上到下，1 是一點、2 是兩點）：{info.dots}</p>
      <h2>關鍵詞</h2>
      <p>{info.keywords.join('、')}</p>
      <h2>反思提示</h2>
      <p>{info.reflection}</p>
      <p className="muted">中文為工作譯名，內容是本產品的編輯草稿，尚未經地占專家審校。圖式參照見
        <Link to="/learn">規則與來源</Link>的 G03、G05。</p>
    </article>
  );
}

/** Fixed teaching input. Computed by the same domain functions; never stored in the journal. */
export function ExamplePage() {
  const { reducedMotion } = useApp();
  const [animate, setAnimate] = useState(false);
  useEffect(() => {
    if (!animate) return;
    const timer = window.setTimeout(() => setAnimate(false), 3000);
    return () => clearTimeout(timer);
  }, [animate]);
  const source: CastSource = { kind: 'dots', counts: teaching.counts };
  const mothers = mothersFromCounts(teaching.counts);
  const question = teaching.question as Question;
  return (
    <ResultView
      question={question} dateLabel="" source={source}
      chart={constructChart(mothers)} reading={buildReading(mothers, question)}
      animate={animate && !reducedMotion} onSkipAnimation={() => setAnimate(false)}
      banner={
        <div className="notice" role="note">
          <strong>教學例題</strong>：這是固定的示範輸入，不是替你占卜，也不會存進日誌。
          　<button type="button" className="link-button" onClick={() => setAnimate(true)}>播放成盤動畫</button>
          　<Link to="/learn">回教學</Link>
        </div>
      }
    />
  );
}
