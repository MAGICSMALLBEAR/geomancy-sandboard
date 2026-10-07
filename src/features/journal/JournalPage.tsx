import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { OUTCOME_STATUSES, type OutcomeStatus, type ReadingRecord } from '../../domain/contracts.ts';
import type { Question } from '../../domain/reading.ts';
import { useApp } from '../../app/AppContext.tsx';
import { toAppError, type AppErrorCode } from '../../infrastructure/errors.ts';
import { buildExportFiles, downloadText } from '../../infrastructure/importExport.ts';
import { figureOf } from '../../content/labels.ts';
import { isReviewDue } from '../../infrastructure/records.ts';
import { Dialog } from '../../components/Dialog.tsx';
import { FigureGlyph } from '../../components/FigureGlyph.tsx';

export function JournalPage() {
  const { repo, L, T } = useApp();
  const [records, setRecords] = useState<ReadingRecord[] | null>(null);
  // One clock reading per load, so the badges and the "due" filter agree.
  const [now, setNow] = useState(() => new Date());
  const [error, setError] = useState<AppErrorCode | null>(null);
  const [topic, setTopic] = useState<Question['topic'] | 'all'>('all');
  const [search, setSearch] = useState('');
  const [params] = useSearchParams();
  const [review, setReview] = useState<OutcomeStatus | 'all' | 'pending' | 'due'>(() => {
    const wanted = params.get('review');
    return wanted === 'pending' || wanted === 'due' ? wanted : 'all';
  });
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [deleting, setDeleting] = useState<ReadingRecord | null>(null);
  const [exporting, setExporting] = useState(false);

  const reload = useCallback(() => {
    repo.listReadings().then(list => { setNow(new Date()); setRecords(list); setError(null); }, reason => setError(toAppError(reason).code));
  }, [repo]);
  useEffect(reload, [reload]);

  // Filtering and search run entirely in this browser.
  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (records ?? []).filter(r =>
      (topic === 'all' || r.question.topic === topic) && (needle === '' || r.question.text.toLowerCase().includes(needle) || (r.question.originalText ?? '').toLowerCase().includes(needle)) &&
      (review === 'all' || (review === 'pending' ? !r.outcome : review === 'due' ? isReviewDue(r, now) : r.outcome?.status === review)));
  }, [records, topic, search, review, now]);
  const stats = useMemo(() => {
    const list = records ?? [];
    return { total: list.length, reviewed: list.filter(r => r.outcome).length, notes: list.filter(r => r.notes).length };
  }, [records]);
  const chosen = visible.filter(r => selected.has(r.id));

  const toggle = (id: string) => setSelected(current => {
    const next = new Set(current);
    if (!next.delete(id)) next.add(id);
    return next;
  });
  const remove = async () => {
    if (!deleting) return;
    try {
      await repo.deleteReading(deleting.id);
      setDeleting(null);
      reload();
    } catch (reason) {
      setDeleting(null);
      setError(toAppError(reason).code);
    }
  };
  const exportChosen = () => {
    for (const file of buildExportFiles(chosen, new Date().toISOString())) downloadText(file.filename, file.text);
    setExporting(false);
  };

  return (
    <div className="journal">
      <h1 className="page-title">{L('日誌', 'Journal')}</h1>
      <p className="page-lede">{L('記錄只保存在這個瀏覽器。清除網站資料會讓它們消失，請定期匯出備份。', 'Records are kept only in this browser. Clearing site data removes them, so export a backup now and then.')}</p>
      {stats.total > 0 && (
        <ul className="journal-stats" aria-label={L('日誌統計', 'Journal statistics')}>
          <li className="card"><strong>{stats.total}</strong><span>{L('筆占問', 'questions')}</span></li>
          <li className="card"><strong>{stats.reviewed}</strong><span>{L('已寫回顧', 'looked back on')}</span></li>
          <li className="card"><strong>{stats.total - stats.reviewed}</strong><span>{L('待回顧', 'to look back on')}</span></li>
          <li className="card"><strong>{stats.notes}</strong><span>{L('有筆記', 'with notes')}</span></li>
        </ul>
      )}
      {error && <p className="notice is-error" role="alert">{T.error(error)}</p>}

      <div className="filters">
        <label>{L('主題', 'Topic')}
          <select value={topic} onChange={event => setTopic(event.target.value as typeof topic)}>
            <option value="all">{L('全部', 'All')}</option>
            {(Object.keys(T.TOPIC_LABEL) as Question['topic'][]).map(t => <option key={t} value={t}>{T.TOPIC_LABEL[t]}</option>)}
          </select>
        </label>
        <label>{L('後來怎樣了', 'What happened afterwards')}
          <select value={review} onChange={event => setReview(event.target.value as typeof review)}>
            <option value="all">{L('全部', 'All')}</option>
            <option value="pending">{L('尚未寫回顧', 'Not looked back on yet')}</option>
            <option value="due">{L('到了回顧的時候', 'Due for a look back')}</option>
            {OUTCOME_STATUSES.map(o => <option key={o} value={o}>{T.OUTCOME_LABEL[o]}</option>)}
          </select>
        </label>
        <label>{L('搜尋問題文字', 'Search question text')}
          <input type="search" value={search} onChange={event => setSearch(event.target.value)} />
        </label>
      </div>

      {records === null && !error && <p role="status">{L('載入中…', 'Loading…')}</p>}
      {records !== null && records.length === 0 && (
        <div className="card"><p>{L('還沒有記錄。', 'No records yet.')}</p><Link className="button primary" to="/new">{L('開始新的占問', 'Start a new question')}</Link></div>
      )}
      {records !== null && records.length > 0 && visible.length === 0 && <p>{L('沒有符合條件的記錄。', 'No records match.')}</p>}

      {visible.length > 0 && <>
        <div className="journal-tools">
          <span role="status">{L(`${visible.length} 筆`, `${visible.length} records`)}{chosen.length > 0 && L(`・已選 ${chosen.length} 筆`, ` · ${chosen.length} selected`)}</span>
          <button type="button" onClick={() => setSelected(new Set(chosen.length === visible.length ? [] : visible.map(r => r.id)))}>
            {chosen.length === visible.length ? L('取消全選', 'Select none') : L('全選', 'Select all')}
          </button>
          <button type="button" disabled={chosen.length === 0} onClick={() => setExporting(true)}>{L('匯出選取記錄', 'Export selected')}</button>
        </div>
        <ul className="record-list">
          {visible.map(record => {
            const judge = figureOf(record.chart.J);
            return (
              <li key={record.id} className="card journal-item">
                <input type="checkbox" checked={selected.has(record.id)} onChange={() => toggle(record.id)}
                  aria-label={L(`選取：${record.question.text.slice(0, 40)}`, `Select: ${record.question.text.slice(0, 40)}`)} />
                <FigureGlyph figure={record.chart.J} size={26} decorative />
                <div className="journal-text">
                  <Link to={`/result/${record.id}`} className="record-link">{record.question.text}</Link>
                  <p className="muted">{L(`${T.formatDate(record.createdAt)}・${T.TOPIC_LABEL[record.question.topic]}・${T.METHOD_LABEL[record.source.kind]}・裁判：${judge.zh}`,
                      `${T.formatDate(record.createdAt)} · ${T.TOPIC_LABEL[record.question.topic]} · ${T.METHOD_LABEL[record.source.kind]} · Judge: ${T.name(judge)}`)}
                    {record.ruleVersion !== 'western-sequential-v1' && L(`・${T.HOUSE_RULE_LABEL[record.ruleVersion]}`, ` · ${T.HOUSE_RULE_LABEL[record.ruleVersion]}`)}{record.notes && L('・有筆記', ' · has notes')}{record.importOrigin && L('・匯入的副本', ' · imported copy')}</p>
                  <p className="outcome-summary">
                    {isReviewDue(record, now)
                      ? <span className="outcome-badge is-due">{L('該回顧了', 'Time to look back')}</span>
                      : <span className={`outcome-badge is-${record.outcome?.status ?? 'none'}`}>{record.outcome ? T.OUTCOME_LABEL[record.outcome.status] : L('尚未寫回顧', 'Not looked back on yet')}</span>}
                    {!record.outcome && record.plan?.reviewOn && <span className="muted">{L(`預計 ${T.formatCalendarDate(record.plan.reviewOn)} 回顧`, `Look back on ${T.formatCalendarDate(record.plan.reviewOn)}`)}</span>}
                  </p>
                  {record.plan?.action && <p className="muted">{L('打算：', 'Plan: ')}{record.plan.action.length > 60 ? `${record.plan.action.slice(0, 60)}…` : record.plan.action}</p>}
                </div>
                <button type="button" className="danger" onClick={() => setDeleting(record)}>{L('刪除', 'Delete')}</button>
              </li>
            );
          })}
        </ul>
      </>}

      <Dialog open={deleting !== null} title={L('刪除這筆記錄？', 'Delete this record?')} onClose={() => setDeleting(null)}>
        <p className="question-text">{deleting?.question.text}</p>
        <p>{L('刪除後無法復原。', 'This cannot be undone.')}</p>
        <div className="dialog-actions">
          <button type="button" className="primary" onClick={() => setDeleting(null)}>{L('保留', 'Keep')}</button>
          <button type="button" className="danger" onClick={() => void remove()}>{L('刪除', 'Delete')}</button>
        </div>
      </Dialog>
      <Dialog open={exporting} title={L(`匯出 ${chosen.length} 筆記錄`, `Export ${chosen.length} records`)} onClose={() => setExporting(false)}>
        <p>{L('匯出的檔案包含你的問題文字、盤面、解讀與筆記，請自行妥善保管。', 'The exported file contains your question text, charts, readings and notes. Keep it somewhere safe.')}</p>
        <div className="dialog-actions">
          <button type="button" className="primary" onClick={exportChosen}>{L('下載 JSON', 'Download JSON')}</button>
          <button type="button" onClick={() => setExporting(false)}>{L('取消', 'Cancel')}</button>
        </div>
      </Dialog>
    </div>
  );
}
