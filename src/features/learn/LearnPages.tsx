import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { constructChart, fromDots, mothersFromCounts, toDots, RULE_VERSION, type CastSource, type Figure } from '../../domain/geomancy.ts';
import { canBeJudge, convert, invert, reverse, totalPoints } from '../../domain/figureRelations.ts';
import { ADVANCED_VERSION } from '../../domain/advanced.ts';
import { ROW_ELEMENT, dotWord, figureOf } from '../../content/labels.ts';
import { CONTENT_VERSION, FIGURES } from '../../domain/catalog.ts';
import { buildReading, type Question } from '../../domain/reading.ts';
import teaching from '../../../fixtures/teaching.json';
import { useApp } from '../../app/AppContext.tsx';
import { SOURCES } from '../../content/sources.ts';
import { PLANET } from '../../content/learn.ts';
import { FigureGlyph } from '../../components/FigureGlyph.tsx';
import { ResultView } from '../../components/ResultView.tsx';

const LEARN_LINKS = [
  { to: '/learn/try', title: '試畫區', text: '起卦前先練習點沙：看一列點痕如何兩兩消去，變成一點或兩點。不保存、不起卦。' },
  { to: '/learn/practice', title: '推盤練習', text: '自己設定四母象，一步一步看女象、姪象、證人與裁判怎麼算出來；也可以先自己算再對答案。' },
  { to: '/learn/houses', title: '十二宮與盤位', text: '十六個位置各從哪裡來、哪些入宮，以及證人、裁判、調和者與進階術語。' },
  { to: '/learn/customs', title: '古典禁例與起卦習慣', text: '舊文本說哪些盤不該判斷、什麼狀態不該起卦，以及同一件事要不要重問。' },
  { to: '/learn/example', title: '固定教學例題', text: '用一組固定的點數走完整個結果頁，可以播放成盤動畫。' },
] as const;

export function LearnPage() {
  return (
    <div className="learn">
      <h1 className="page-title">十六象與教學</h1>
      <p className="page-lede">從點沙到解讀，一步步認識西方地占。</p>

      <ul className="learn-links">
        {LEARN_LINKS.map(link => (
          <li key={link.to}>
            <Link to={link.to} className="card learn-link">
              <strong>{link.title}</strong>
              <span className="muted">{link.text}</span>
            </Link>
          </li>
        ))}
      </ul>

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
        <Link className="button" to="/learn/practice">自己動手推一次</Link>
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
        <p>內容版本 {CONTENT_VERSION}：基礎象徵解讀（編輯草稿），保存在記錄裡。
          結果頁另有「進階解讀」（{ADVANCED_VERSION}）：成事關係、相位、象的重現、點之道、證人與裁判、十二宮逐宮，由盤面即時計算、不存入記錄，同樣是未審校的草稿。</p>
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

function RelatedFigure({ label, note, figure, self }: { label: string; note: string; figure: Figure; self: boolean }) {
  const info = figureOf(figure);
  return (
    <li>
      <FigureGlyph figure={figure} size={24} decorative />
      <span>
        <strong>{label}</strong>（{note}）：
        {self ? <>還是「{info.zh}」本身</> : <Link to={`/learn/${info.id}`}>{info.zh}／{info.latin}</Link>}
      </span>
    </li>
  );
}

export function FigurePage() {
  const { figureId } = useParams();
  const index = FIGURES.findIndex(f => f.id === figureId);
  if (index === -1) {
    return <div className="card"><h1>找不到這個象</h1><Link to="/learn">回十六象目錄</Link></div>;
  }
  const info = FIGURES[index], figure = fromDots(info.dots);
  const previous = FIGURES[(index + FIGURES.length - 1) % FIGURES.length], next = FIGURES[(index + 1) % FIGURES.length];
  const points = totalPoints(figure);
  const related = [
    { label: '反轉', note: '每行一點、兩點互換', figure: invert(figure) },
    { label: '倒轉', note: '上下顛倒', figure: reverse(figure) },
    { label: '對轉', note: '反轉再倒轉', figure: convert(figure) },
  ];
  return (
    <article className="card figure-page">
      <p><Link to="/learn">← 回十六象目錄</Link></p>
      <h1>{info.zh}<span className="latin">{info.latin}</span></h1>
      <FigureGlyph figure={figure} size={72} />
      <p>圖式（由上到下，1 是一點、2 是兩點）：{info.dots}</p>
      <h2>關鍵詞</h2>
      <p>{info.keywords.join('、')}</p>
      <h2>反思提示</h2>
      <p>{info.reflection}</p>
      <h2>行星對應</h2>
      <p>{PLANET[info.id].zh}<span className="latin">{PLANET[info.id].latin}</span></p>
      <p className="muted">西方地占把十六象兩兩配給七個行星，龍首、龍尾配給月亮的南北交點。
        星座與元素在各傳統之間差異很大，這裡不列。來源：G09。</p>

      <h2>圖式結構</h2>
      <ol className="element-rows" aria-label="四行，由上到下">
        {figure.map((bit, row) => (
          <li key={row}><span className="element-name">{ROW_ELEMENT[row]}行</span>{dotWord(bit)}<span aria-hidden="true">{bit === 1 ? ' •' : ' ••'}</span></li>
        ))}
      </ol>
      <p>共 {points} 點，是{points % 2 === 0 ? '偶數' : '奇數'}。
        {canBeJudge(figure)
          ? '裁判一定是偶數點，所以這個象可能出現在裁判的位置。'
          : '裁判一定是偶數點，所以這個象不會出現在裁判的位置，但可以出現在其他十四個位置。'}</p>

      <h3>相關的象</h3>
      <ul className="related-figures">
        {related.map(r => <RelatedFigure key={r.label} {...r} self={toDots(r.figure) === info.dots} />)}
      </ul>
      <p className="muted">反轉、倒轉、對轉只是圖式上的對應，用來幫助記憶；不代表兩個象的意思一定相反。</p>

      <p className="muted">中文為工作譯名，內容是本產品的編輯草稿，尚未經地占專家審校。圖式參照見
        <Link to="/learn">規則與來源</Link>的 G03、G05。</p>
      <nav className="figure-nav" aria-label="切換象">
        <Link to={`/learn/${previous.id}`}>← {previous.zh}</Link>
        <Link to={`/learn/${next.id}`}>{next.zh} →</Link>
      </nav>
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
