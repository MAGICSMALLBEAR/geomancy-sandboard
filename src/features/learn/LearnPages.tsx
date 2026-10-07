import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { constructChart, fromDots, mothersFromCounts, toDots, RULE_GOLDEN_DAWN, RULE_VERSION, type CastSource, type Figure } from '../../domain/geomancy.ts';
import { canBeJudge, convert, invert, reverse, totalPoints } from '../../domain/figureRelations.ts';
import { ADVANCED_VERSION } from '../../domain/advanced.ts';
import { figureOf } from '../../content/labels.ts';
import { CONTENT_VERSION, FIGURES } from '../../domain/catalog.ts';
import { CONTENT_EN1 } from '../../domain/readingEn1.ts';
import { buildReading, type Question } from '../../domain/reading.ts';
import teaching from '../../../fixtures/teaching.json';
import { useApp } from '../../app/AppContext.tsx';
import { SOURCES, sourceText } from '../../content/sources.ts';
import { PLANET } from '../../content/learn.ts';
import { FigureCorrespondences } from './CorrespondencesPage.tsx';
import { FigureGlyph } from '../../components/FigureGlyph.tsx';
import { ResultView } from '../../components/ResultView.tsx';

const LEARN_LINKS = [
  { to: '/learn/try', title: ['試畫區', 'Practice tray'], text: ['起卦前先練習點沙：看一列點痕如何兩兩消去，變成一點或兩點。不保存、不起卦。',
    'Practise tapping before you cast: watch a row of marks cancel in pairs and become one dot or two. Nothing is saved or cast.'] },
  { to: '/learn/practice', title: ['推盤練習', 'Derivation practice'], text: ['自己設定四母象，一步一步看女象、姪象、證人與裁判怎麼算出來；也可以先自己算再對答案。',
    'Set four Mothers yourself and see step by step how the Daughters, Nieces, Witnesses and Judge are worked out; or work them out first and check.'] },
  { to: '/learn/houses', title: ['十二宮與盤位', 'Houses and positions'], text: ['十六個位置各從哪裡來、哪些入宮，以及證人、裁判、調和者與進階術語。',
    'Where each of the sixteen positions comes from, which go into houses, and the Witnesses, Judge, Reconciler and advanced terms.'] },
  { to: '/learn/correspondences', title: ['行星、星座與元素對照', 'Planets, signs and elements'], text: ['十六象對應的行星，以及各家說法不同的星座與元素，照原始表格並列比較。',
    'The planet for each figure, and the signs and elements on which traditions differ, side by side as the source tables list them.'] },
  { to: '/learn/customs', title: ['古典禁例與起卦習慣', 'Classical prohibitions and casting customs'], text: ['舊文本說哪些盤不該判斷、什麼狀態不該起卦，以及同一件事要不要重問。',
    'Which charts old texts say not to judge, when not to cast, and whether to ask the same thing again.'] },
  { to: '/learn/example', title: ['固定教學例題', 'Fixed teaching example'], text: ['用一組固定的點數走完整個結果頁，可以播放成盤動畫。',
    'A fixed set of dots taken through the whole result page; you can play the chart animation.'] },
] as const;

export function LearnPage() {
  const { L, T } = useApp();
  return (
    <div className="learn">
      <h1 className="page-title">{L('十六象與教學', 'The sixteen figures and learning')}</h1>
      <p className="page-lede">{L('從點沙到解讀，一步步認識西方地占。', 'From tapping the sand to the reading, get to know Western geomancy step by step.')}</p>

      <ul className="learn-links">
        {LEARN_LINKS.map(link => (
          <li key={link.to}>
            <Link to={link.to} className="card learn-link">
              <strong>{L(link.title[0], link.title[1])}</strong>
              <span className="muted">{L(link.text[0], link.text[1])}</span>
            </Link>
          </li>
        ))}
      </ul>

      <section className="card">
        <h2>{L('地占怎麼起卦', 'How a geomancy chart is cast')}</h2>
        <ol>
          <li>{L('先寫下一個具體的問題。', 'First write down one specific question.')}</li>
          <li>{L('在沙面上不刻意計數地點出十六列點痕。每一列的總數是奇數就記一點，偶數就記兩點。', 'Make sixteen rows of marks in the sand without counting. An odd total in a row gives one dot, an even total two dots.')}</li>
          <li>{L('每四列組成一個「母象」，依序得到四個母象。每個象由上到下四行，對應火、風、水、土。', 'Every four rows make a Mother, giving four Mothers in turn. Each figure has four lines from top to bottom: Fire, Air, Water, Earth.')}</li>
          <li>{L('四個「女象」由四母象轉置而來：第一女象依序取四個母象的第一行，依此類推。', 'The four Daughters transpose the Mothers: the First Daughter takes the first line of each Mother in turn, and so on.')}</li>
          <li>{L('兩兩逐行合成（相同得兩點，不同得一點），得到四個姪象、兩個證人，最後是裁判。', 'Pairs are combined line by line (same gives two dots, different gives one), giving four Nieces, two Witnesses and finally the Judge.')}</li>
          <li>{L('前十二個位置依序放入十二宮：母象是第 1–4 宮，女象是第 5–8 宮，姪象是第 9–12 宮。', 'Under the default rule the first twelve positions go into the twelve houses in order: Mothers houses 1–4, Daughters 5–8, Nieces 9–12.')}</li>
        </ol>
        <p>{L('這裡的地占是西方十六象系統，不需要出生資料、星曆或定位。', 'This is the Western sixteen-figure system; no birth data, ephemeris or location is needed.')}</p>
        <Link className="button" to="/learn/practice">{L('自己動手推一次', 'Work one out yourself')}</Link>
      </section>

      <section>
        <h2>{L('十六象', 'The sixteen figures')}</h2>
        <p className="muted">{L('中文是本產品的工作譯名。象義為編輯草稿，尚未經地占專家逐條審校。', 'Meanings are editorial drafts, not yet reviewed line by line by a geomancy expert.')}</p>
        <ul className="figure-grid">
          {FIGURES.map(f => (
            <li key={f.id}>
              <Link to={`/learn/${f.id}`} className="card figure-tile">
                <FigureGlyph figure={fromDots(f.dots)} size={30} decorative />
                {L(<span><strong>{f.zh}</strong><br />{f.latin}</span>, <span><strong>{f.latin}</strong><br />{T.fullName(f).slice(f.latin.length + 1)}</span>)}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="card" id="sources">
        <h2>{L('規則與來源', 'Rules and sources')}</h2>
        <p>{L(`規則版本 ${RULE_VERSION}：常見的盾盤構造，前十二個位置依序入宮（預設）。另有 ${RULE_GOLDEN_DAWN}：盾盤相同，依 Golden Dawn 的方式入宮，可在設定切換；見`,
          `Rule version ${RULE_VERSION}: the common shield construction, with the first twelve positions going into the houses in order (default). There is also ${RULE_GOLDEN_DAWN}: the same shield, placed into houses the Golden Dawn way, switchable in Settings; see `)}<Link to="/learn/houses">{L('十二宮與盤位', 'Houses and positions')}</Link>{L('。', '.')}</p>
        <p>{L(`內容版本 ${CONTENT_VERSION}：基礎象徵解讀（編輯草稿），保存在記錄裡。結果頁另有「進階解讀」（${ADVANCED_VERSION}）：成事關係、相位、象的重現、點之道、證人與裁判、十二宮逐宮，由盤面即時計算、不存入記錄，同樣是未審校的草稿。`,
          `Content versions ${CONTENT_VERSION} (Chinese) and ${CONTENT_EN1} (English): the basic symbolic reading (editorial drafts), saved in the record. The result page also has an advanced reading (${ADVANCED_VERSION}): perfection, aspects, recurring figures, the Way of the Points, Witnesses and Judge, and house by house. It is computed from the chart each time, never saved, and is also an unreviewed draft.`)}</p>
        <ul className="source-list">
          {SOURCES.map(source => {
            const text = sourceText(source, T.lang);
            return (
              <li key={source.id}>
                <strong>{source.id}</strong>
                {source.url
                  ? <a href={source.url} target="_blank" rel="noopener noreferrer">{text.title}{L('（外部網頁，需要網路）', ' (external page, needs internet)')}</a>
                  : text.title}
                <br /><span className="muted">{text.note}</span>
              </li>
            );
          })}
        </ul>
        <p className="muted">{L('來源連結供查核用，不代表來源作者認可本產品的中文文案。', "Source links are for checking; they do not mean the authors endorse this App's wording.")}</p>
      </section>
    </div>
  );
}

function RelatedFigure({ label, note, figure, self }: { label: string; note: string; figure: Figure; self: boolean }) {
  const { L, T } = useApp();
  const info = figureOf(figure);
  return (
    <li>
      <FigureGlyph figure={figure} size={24} decorative />
      <span>
        <strong>{label}</strong>{L(`（${note}）：`, ` (${note}): `)}
        {self ? L(`還是「${info.zh}」本身`, `${info.latin} itself again`) : <Link to={`/learn/${info.id}`}>{T.fullName(info)}</Link>}
      </span>
    </li>
  );
}

export function FigurePage() {
  const { figureId } = useParams();
  const { L, T } = useApp();
  const index = FIGURES.findIndex(f => f.id === figureId);
  if (index === -1) {
    return <div className="card"><h1>{L('找不到這個象', 'Figure not found')}</h1><Link to="/learn">{L('回十六象目錄', 'Back to the sixteen figures')}</Link></div>;
  }
  const info = FIGURES[index], figure = fromDots(info.dots);
  const previous = FIGURES[(index + FIGURES.length - 1) % FIGURES.length], next = FIGURES[(index + 1) % FIGURES.length];
  const points = totalPoints(figure);
  const related = [
    { label: L('反轉', 'Inverse'), note: L('每行一點、兩點互換', 'one and two dots swapped in every line'), figure: invert(figure) },
    { label: L('倒轉', 'Reverse'), note: L('上下顛倒', 'turned upside down'), figure: reverse(figure) },
    { label: L('對轉', 'Converse'), note: L('反轉再倒轉', 'inverted, then reversed'), figure: convert(figure) },
  ];
  return (
    <article className="card figure-page">
      <p><Link to="/learn">{L('← 回十六象目錄', '← Back to the sixteen figures')}</Link></p>
      <h1>{L(info.zh, info.latin)}<span className="latin">{L(info.latin, T.fullName(info).slice(info.latin.length + 1))}</span></h1>
      <FigureGlyph figure={figure} size={72} />
      <p>{L('圖式（由上到下，1 是一點、2 是兩點）：', 'Pattern (top to bottom, 1 is one dot, 2 is two dots): ')}{info.dots}</p>
      <h2>{L('關鍵詞', 'Keywords')}</h2>
      <p>{T.list(T.keywords(info))}</p>
      <h2>{L('反思提示', 'Reflection prompt')}</h2>
      <p>{T.reflection(info)}</p>
      <h2>{L('行星對應', 'Planet')}</h2>
      <p>{T.lang === 'en' ? PLANET[info.id].latin : <>{PLANET[info.id].zh}<span className="latin">{PLANET[info.id].latin}</span></>}</p>
      <p className="muted">{L('西方地占把十六象兩兩配給七個行星，龍首、龍尾配給月亮的南北交點。來源：G09。',
        "Western geomancy gives the sixteen figures to the seven planets in pairs, with Caput and Cauda Draconis given to the Moon's north and south nodes. Source: G09.")}</p>
      <FigureCorrespondences figureId={info.id} />

      <h2>{L('圖式結構', 'Structure')}</h2>
      <ol className="element-rows" aria-label={L('四行，由上到下', 'Four lines, top to bottom')}>
        {figure.map((bit, row) => (
          <li key={row}><span className="element-name">{L(`${T.ROW_ELEMENT[row]}行`, `${T.ROW_ELEMENT[row]} line`)}</span>{T.dotWord(bit)}<span aria-hidden="true">{bit === 1 ? ' •' : ' ••'}</span></li>
        ))}
      </ol>
      <p>{L(`共 ${points} 點，是${T.parity(points)}。`, `${points} dots in all: ${T.parity(points)}. `)}
        {canBeJudge(figure)
          ? L('裁判一定是偶數點，所以這個象可能出現在裁判的位置。', 'The Judge always has an even number of dots, so this figure can appear as the Judge.')
          : L('裁判一定是偶數點，所以這個象不會出現在裁判的位置，但可以出現在其他十四個位置。', 'The Judge always has an even number of dots, so this figure never appears as the Judge, though it can appear in the other fourteen positions.')}</p>

      <h3>{L('相關的象', 'Related figures')}</h3>
      <ul className="related-figures">
        {related.map(r => <RelatedFigure key={r.label} {...r} self={toDots(r.figure) === info.dots} />)}
      </ul>
      <p className="muted">{L('反轉、倒轉、對轉只是圖式上的對應，用來幫助記憶；不代表兩個象的意思一定相反。', 'Inverse, reverse and converse are pattern relations to help memory; they do not mean the two figures have opposite meanings.')}</p>

      <p className="muted">{L('中文為工作譯名，內容是本產品的編輯草稿，尚未經地占專家審校。圖式參照見', "The content is this App's editorial draft, not yet expert-reviewed. For the patterns see G03 and G05 under ")}
        <Link to="/learn">{L('規則與來源', 'Rules and sources')}</Link>{L('的 G03、G05。', '.')}</p>
      <nav className="figure-nav" aria-label={L('切換象', 'Other figures')}>
        <Link to={`/learn/${previous.id}`}>← {T.name(previous)}</Link>
        <Link to={`/learn/${next.id}`}>{T.name(next)} →</Link>
      </nav>
    </article>
  );
}

/** Fixed teaching input. Computed by the same domain functions; never stored in the journal. */
export function ExamplePage() {
  const { reducedMotion, lang, L } = useApp();
  const [animate, setAnimate] = useState(false);
  useEffect(() => {
    if (!animate) return;
    const timer = window.setTimeout(() => setAnimate(false), 3000);
    return () => clearTimeout(timer);
  }, [animate]);
  const source: CastSource = { kind: 'dots', counts: teaching.counts };
  const mothers = mothersFromCounts(teaching.counts);
  const question = lang === 'en'
    ? { ...teaching.question, text: 'Over the next three months, what conditions are worth noticing as I apply for this position?', timeframe: 'The next three months' } as Question
    : teaching.question as Question;
  return (
    <ResultView
      question={question} dateLabel="" source={source}
      chart={constructChart(mothers)} reading={buildReading(mothers, question, lang === 'en' ? CONTENT_EN1 : CONTENT_VERSION)}
      animate={animate && !reducedMotion} onSkipAnimation={() => setAnimate(false)}
      banner={
        <div className="notice" role="note">
          <strong>{L('教學例題', 'Teaching example')}</strong>{L('：這是固定的示範輸入，不是替你占卜，也不會存進日誌。', ': a fixed demonstration input. It is not a reading for you and is not saved to the journal.')}
          　<button type="button" className="link-button" onClick={() => setAnimate(true)}>{L('播放成盤動畫', 'Play the chart animation')}</button>
          　<Link to="/learn">{L('回教學', 'Back to learning')}</Link>
        </div>
      }
    />
  );
}
