import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import type { Draft, ReadingRecord } from '../../domain/contracts.ts';
import { fromDots } from '../../domain/geomancy.ts';
import { FIGURES, FIGURES_EN } from '../../domain/catalog.ts';
import { useApp } from '../../app/AppContext.tsx';
import { toAppError, type AppErrorCode } from '../../infrastructure/errors.ts';
import { figureOf } from '../../content/labels.ts';
import { FigureGlyph } from '../../components/FigureGlyph.tsx';
import { HeroShield } from '../../components/Decor.tsx';
import { ThemePicker } from '../../components/ThemePicker.tsx';
import { isReviewDue } from '../../infrastructure/records.ts';

export function HomePage() {
  const { repo, L, T, lang } = useApp();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [recent, setRecent] = useState<ReadingRecord[]>([]);
  const [toReview, setToReview] = useState(0);
  const [error, setError] = useState<AppErrorCode | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([repo.getActiveDraft(), repo.listReadings()]).then(([active, readings]) => {
      if (!alive) return;
      setDraft(active);
      setRecent(readings.slice(0, 3));
      const now = new Date();
      setToReview(readings.filter(r => isReviewDue(r, now)).length);
    }, reason => { if (alive) setError(toAppError(reason).code); });
    return () => { alive = false; };
  }, [repo]);

  const journey = [
    { title: L('寫下問題', 'Write the question'), text: L('聚焦一件事，選擇想看的生活領域。', 'Focus on one matter and choose the area of life to look at.') },
    { title: L('點沙成列', 'Dot the rows'), text: L('在沙面上隨手點出十六列，奇偶化成四個母象。', 'Tap sixteen rows of dots in the sand; odd and even become the four Mothers.') },
    { title: L('盾盤成形', 'Build the shield'), text: L('女象、姪象、證人到裁判，一層層推出整張盤。', 'Daughters, Nieces, Witnesses and the Judge follow layer by layer.') },
    { title: L('解讀與回顧', 'Read and look back'), text: L('每段解讀附盤位依據；日後再補寫事情的發展。', 'Each reading points to its positions; later, note what actually happened.') },
  ];

  return (
    <div className="home">
      <section className="home-hero">
        <div className="hero-text">
          <p className="hero-kicker">{L('GEOMANCY・西方十六象', 'GEOMANCY · THE SIXTEEN FIGURES')}</p>
          <h1>{L('地占沙盤', 'Geomancy Sand Tray')}</h1>
          <p className="hero-lede">{L('帶著一個問題，在沙面上親手點出四個母象，看整張盤如何一步步推出來，再讀一段附有盤位依據的象徵解讀。',
            'Bring a question, tap out the four Mothers in the sand with your own hand, watch the whole chart unfold step by step, then read a symbolic reading that shows where each point comes from.')}</p>
          <div className="hero-actions">
            <Link className="button primary big" to="/new">{L('開始新的占問', 'Ask a new question')}</Link>
            <Link className="button big" to="/learn/try">{L('先到試畫區練習', 'Practise in the trial tray')}</Link>
          </div>
          <p className="muted">{L('測試版・解讀為內容草稿。記錄只保存在這個瀏覽器。', 'Beta · readings are draft content. Records are kept only in this browser.')}</p>
        </div>
        <div className="hero-art"><HeroShield /></div>
      </section>

      {error && <p className="notice is-error" role="alert">{L('無法讀取本機記錄。', 'Cannot read local records.')}{T.error(error)}</p>}

      {draft && (
        <section className="card" aria-label={L('未完成的占問', 'Unfinished question')}>
          <h2>{L('未完成的占問', 'Unfinished question')}</h2>
          <p className="question-text">{draft.question.text}</p>
          <p className="muted">{T.METHOD_LABEL[draft.method]}
            {draft.method === 'dots' && L(`・已確認 ${draft.confirmedCounts.length}／16 列`, ` · ${draft.confirmedCounts.length}/16 rows confirmed`)}
            {draft.method === 'press' && L(`・已完成 ${draft.confirmedPresses?.length ?? 0}／4 次`, ` · ${draft.confirmedPresses?.length ?? 0}/4 presses done`)}</p>
          <Link className="button primary" to={`/cast/${draft.id}`}>{L('繼續起卦', 'Continue casting')}</Link>
        </section>
      )}

      <h2 className="section-title">{L('一次占問的四個階段', 'Four stages of a question')}</h2>
      <ol className="journey">
        {journey.map(step => <li key={step.title} className="card"><strong>{step.title}</strong><span>{step.text}</span></li>)}
      </ol>

      <div className="home-grid">
        <section aria-labelledby="recent-title">
          <h2 id="recent-title" className="section-title">{L('最近的記錄', 'Recent records')}</h2>
          {recent.length === 0
            ? <p className="card muted">{L('還沒有記錄。完成一次占問後，結果會自動存在這裡。', 'No records yet. Finish a question and the result is saved here automatically.')}</p>
            : (
              <ul className="record-list">
                {recent.map(record => (
                  <li key={record.id} className="card recent-item">
                    <FigureGlyph figure={record.chart.J} size={30} decorative />
                    <div>
                      <Link to={`/result/${record.id}`} className="record-link">{record.question.text}</Link>
                      <p className="muted">{T.formatDate(record.createdAt)}・{T.TOPIC_LABEL[record.question.topic]}・{L('裁判：', 'Judge: ')}{T.name(figureOf(record.chart.J))}</p>
                    </div>
                    {record.outcome && <span className={`outcome-badge is-${record.outcome.status}`}>{T.OUTCOME_LABEL[record.outcome.status]}</span>}
                  </li>
                ))}
              </ul>
            )}
          {toReview > 0 && (
            <p className="notice">{L(`有 ${toReview} 筆占問到了回顧的時候（已到預定的回顧日，或沒設日期且超過一週），還沒寫「後來怎樣了」。回頭對照，是理解象義最好的練習。`,
              `${toReview} question${toReview > 1 ? 's are' : ' is'} due for a look back (the review date has come, or there is no date and a week has passed) with no follow-up yet. Comparing afterwards is the best way to learn the figures.`)}
              <br /><Link to="/journal?review=due">{L('去補寫回顧', 'Write the follow-up')}</Link></p>
          )}
          <p><Link to="/journal">{L('查看全部日誌', 'Open the journal')}</Link>　<Link to="/learn">{L('十六象與教學', 'The figures and lessons')}</Link></p>
        </section>

        <aside aria-label={L('練習與學習', 'Practice and learning')}>
          <h2 className="section-title">{L('還不熟悉？', 'New to this?')}</h2>
          <div className="card cta-card">
            <h3>{L('試畫區', 'Trial tray')}</h3>
            <p className="muted">{L('不保存、不起卦，只練習點沙，看一列如何變成一點或兩點。', 'Nothing saved, no casting: just practise dotting and see how a row becomes one dot or two.')}</p>
            <Link className="button" to="/learn/try">{L('去試畫', 'Try it')}</Link>
          </div>
          <div className="card cta-card">
            <h3>{L('推盤練習', 'Build-a-chart practice')}</h3>
            <p className="muted">{L('自設四母象，一步步算出女象、姪象、證人與裁判。', 'Set four Mothers yourself and work out the Daughters, Nieces, Witnesses and Judge step by step.')}</p>
            <Link className="button" to="/learn/practice">{L('自己推一次', 'Work one out')}</Link>
          </div>
        </aside>
      </div>

      <h2 className="section-title">{L('選擇你的沙盤風格', 'Choose your tray style')}</h2>
      <p className="muted">{L('三種外觀隨時可換，只改變畫面，不影響盤面與記錄。', 'Switch between three looks at any time; only the appearance changes, never the chart or records.')}</p>
      <ThemePicker name="home-theme" />

      <h2 className="section-title">{L('十六象', 'The sixteen figures')}</h2>
      <ul className="figure-ribbon" aria-label={L('十六象', 'The sixteen figures')}>
        {FIGURES.map(f => (
          <li key={f.id}>
            <Link to={`/learn/${f.id}`}>
              <FigureGlyph figure={fromDots(f.dots)} size={22} decorative />
              <span>{lang === 'en' ? f.latin : f.zh}</span>
              <span className="latin-small">{lang === 'en' ? FIGURES_EN[f.id].gloss : f.latin}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
