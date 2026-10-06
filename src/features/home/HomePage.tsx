import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import type { Draft, ReadingRecord } from '../../domain/contracts.ts';
import { fromDots } from '../../domain/geomancy.ts';
import { FIGURES } from '../../domain/catalog.ts';
import { useApp } from '../../app/AppContext.tsx';
import { ERROR_TEXT, toAppError, type AppErrorCode } from '../../infrastructure/errors.ts';
import { METHOD_LABEL, OUTCOME_LABEL, TOPIC_LABEL, figureOf, formatDate } from '../../content/labels.ts';
import { FigureGlyph } from '../../components/FigureGlyph.tsx';
import { HeroShield } from '../../components/Decor.tsx';
import { ThemePicker } from '../../components/ThemePicker.tsx';
import { isReviewDue } from '../../infrastructure/records.ts';

const JOURNEY = [
  { title: '寫下問題', text: '聚焦一件事，選擇想看的生活領域。' },
  { title: '點沙成列', text: '在沙面上隨手點出十六列，奇偶化成四個母象。' },
  { title: '盾盤成形', text: '女象、姪象、證人到裁判，一層層推出整張盤。' },
  { title: '解讀與回顧', text: '每段解讀附盤位依據；日後再補寫事情的發展。' },
];

export function HomePage() {
  const { repo } = useApp();
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

  return (
    <div className="home">
      <section className="home-hero">
        <div className="hero-text">
          <p className="hero-kicker">GEOMANCY・西方十六象</p>
          <h1>地占沙盤</h1>
          <p className="hero-lede">帶著一個問題，在沙面上親手點出四個母象，看整張盤如何一步步推出來，再讀一段附有盤位依據的象徵解讀。</p>
          <div className="hero-actions">
            <Link className="button primary big" to="/new">開始新的占問</Link>
            <Link className="button big" to="/learn/try">先到試畫區練習</Link>
          </div>
          <p className="muted">測試版・解讀為內容草稿。記錄只保存在這個瀏覽器。</p>
        </div>
        <div className="hero-art"><HeroShield /></div>
      </section>

      {error && <p className="notice is-error" role="alert">無法讀取本機記錄。{ERROR_TEXT[error]}</p>}

      {draft && (
        <section className="card" aria-label="未完成的占問">
          <h2>未完成的占問</h2>
          <p className="question-text">{draft.question.text}</p>
          <p className="muted">{METHOD_LABEL[draft.method]}
            {draft.method === 'dots' && `・已確認 ${draft.confirmedCounts.length}／16 列`}
            {draft.method === 'press' && `・已完成 ${draft.confirmedPresses?.length ?? 0}／4 次`}</p>
          <Link className="button primary" to={`/cast/${draft.id}`}>繼續起卦</Link>
        </section>
      )}

      <h2 className="section-title">一次占問的四個階段</h2>
      <ol className="journey">
        {JOURNEY.map(step => <li key={step.title} className="card"><strong>{step.title}</strong><span>{step.text}</span></li>)}
      </ol>

      <div className="home-grid">
        <section aria-labelledby="recent-title">
          <h2 id="recent-title" className="section-title">最近的記錄</h2>
          {recent.length === 0
            ? <p className="card muted">還沒有記錄。完成一次占問後，結果會自動存在這裡。</p>
            : (
              <ul className="record-list">
                {recent.map(record => (
                  <li key={record.id} className="card recent-item">
                    <FigureGlyph figure={record.chart.J} size={30} decorative />
                    <div>
                      <Link to={`/result/${record.id}`} className="record-link">{record.question.text}</Link>
                      <p className="muted">{formatDate(record.createdAt)}・{TOPIC_LABEL[record.question.topic]}・裁判：{figureOf(record.chart.J).zh}</p>
                    </div>
                    {record.outcome && <span className={`outcome-badge is-${record.outcome.status}`}>{OUTCOME_LABEL[record.outcome.status]}</span>}
                  </li>
                ))}
              </ul>
            )}
          {toReview > 0 && (
            <p className="notice">有 {toReview} 筆占問到了回顧的時候（已到預定的回顧日，或沒設日期且超過一週），還沒寫「後來怎樣了」。回頭對照，是理解象義最好的練習。
              <br /><Link to="/journal?review=due">去補寫回顧</Link></p>
          )}
          <p><Link to="/journal">查看全部日誌</Link>　<Link to="/learn">十六象與教學</Link></p>
        </section>

        <aside aria-label="練習與學習">
          <h2 className="section-title">還不熟悉？</h2>
          <div className="card cta-card">
            <h3>試畫區</h3>
            <p className="muted">不保存、不起卦，只練習點沙，看一列如何變成一點或兩點。</p>
            <Link className="button" to="/learn/try">去試畫</Link>
          </div>
          <div className="card cta-card">
            <h3>推盤練習</h3>
            <p className="muted">自設四母象，一步步算出女象、姪象、證人與裁判。</p>
            <Link className="button" to="/learn/practice">自己推一次</Link>
          </div>
        </aside>
      </div>

      <h2 className="section-title">選擇你的沙盤風格</h2>
      <p className="muted">三種外觀隨時可換，只改變畫面，不影響盤面與記錄。</p>
      <ThemePicker name="home-theme" />

      <h2 className="section-title">十六象</h2>
      <ul className="figure-ribbon" aria-label="十六象">
        {FIGURES.map(f => (
          <li key={f.id}>
            <Link to={`/learn/${f.id}`}>
              <FigureGlyph figure={fromDots(f.dots)} size={22} decorative />
              <span>{f.zh}</span>
              <span className="latin-small">{f.latin}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
