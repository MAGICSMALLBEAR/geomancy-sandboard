import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import type { Draft, ReadingRecord } from '../../domain/contracts.ts';
import { useApp } from '../../app/AppContext.tsx';
import { ERROR_TEXT, toAppError, type AppErrorCode } from '../../infrastructure/errors.ts';
import { METHOD_LABEL, TOPIC_LABEL, figureOf, formatDate } from '../../content/labels.ts';

export function HomePage() {
  const { repo } = useApp();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [recent, setRecent] = useState<ReadingRecord[]>([]);
  const [error, setError] = useState<AppErrorCode | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([repo.getActiveDraft(), repo.listReadings()]).then(([active, readings]) => {
      if (!alive) return;
      setDraft(active);
      setRecent(readings.slice(0, 3));
    }, reason => { if (alive) setError(toAppError(reason).code); });
    return () => { alive = false; };
  }, [repo]);

  return (
    <div className="home">
      <section className="hero">
        <h1>地占沙盤</h1>
        <p>帶著一個問題，在沙面上親手點出四個母象，看整張盤如何一步步推出來，再讀一段附有盤位依據的基礎象徵解讀。</p>
        <Link className="button primary big" to="/new">開始新的占問</Link>
        <p className="muted">測試版・基礎象徵解讀（內容草稿）。記錄只保存在這個瀏覽器。</p>
      </section>

      {error && <p className="notice is-error" role="alert">無法讀取本機記錄。{ERROR_TEXT[error]}</p>}

      {draft && (
        <section className="card" aria-label="未完成的占問">
          <h2>未完成的占問</h2>
          <p className="question-text">{draft.question.text}</p>
          <p className="muted">{METHOD_LABEL[draft.method]}
            {draft.method === 'dots' && `・已確認 ${draft.confirmedCounts.length}／16 列`}</p>
          <Link className="button" to={`/cast/${draft.id}`}>繼續起卦</Link>
        </section>
      )}

      <section aria-label="最近的記錄">
        <h2>最近的記錄</h2>
        {recent.length === 0
          ? <p className="muted">還沒有記錄。完成一次占問後，結果會自動存在這裡。</p>
          : (
            <ul className="record-list">
              {recent.map(record => (
                <li key={record.id} className="card">
                  <Link to={`/result/${record.id}`} className="record-link">{record.question.text}</Link>
                  <p className="muted">{formatDate(record.createdAt)}・{TOPIC_LABEL[record.question.topic]}・裁判：{figureOf(record.chart.J).zh}</p>
                </li>
              ))}
            </ul>
          )}
        <p><Link to="/journal">查看全部日誌</Link>　<Link to="/learn">十六象與教學</Link></p>
      </section>
    </div>
  );
}
