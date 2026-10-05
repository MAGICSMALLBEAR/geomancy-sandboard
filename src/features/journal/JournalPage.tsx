import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { OUTCOME_STATUSES, type OutcomeStatus, type ReadingRecord } from '../../domain/contracts.ts';
import type { Question } from '../../domain/reading.ts';
import { useApp } from '../../app/AppContext.tsx';
import { ERROR_TEXT, toAppError, type AppErrorCode } from '../../infrastructure/errors.ts';
import { buildExportFiles, downloadText } from '../../infrastructure/importExport.ts';
import { METHOD_LABEL, OUTCOME_LABEL, TOPIC_LABEL, figureOf, formatDate } from '../../content/labels.ts';
import { Dialog } from '../../components/Dialog.tsx';
import { FigureGlyph } from '../../components/FigureGlyph.tsx';

export function JournalPage() {
  const { repo } = useApp();
  const [records, setRecords] = useState<ReadingRecord[] | null>(null);
  const [error, setError] = useState<AppErrorCode | null>(null);
  const [topic, setTopic] = useState<Question['topic'] | 'all'>('all');
  const [search, setSearch] = useState('');
  const [params] = useSearchParams();
  const [review, setReview] = useState<OutcomeStatus | 'all' | 'pending'>(() => params.get('review') === 'pending' ? 'pending' : 'all');
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [deleting, setDeleting] = useState<ReadingRecord | null>(null);
  const [exporting, setExporting] = useState(false);

  const reload = useCallback(() => {
    repo.listReadings().then(list => { setRecords(list); setError(null); }, reason => setError(toAppError(reason).code));
  }, [repo]);
  useEffect(reload, [reload]);

  // Filtering and search run entirely in this browser.
  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (records ?? []).filter(r =>
      (topic === 'all' || r.question.topic === topic) && (needle === '' || r.question.text.toLowerCase().includes(needle)) &&
      (review === 'all' || (review === 'pending' ? !r.outcome : r.outcome?.status === review)));
  }, [records, topic, search, review]);
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
      <h1 className="page-title">日誌</h1>
      <p className="page-lede">記錄只保存在這個瀏覽器。清除網站資料會讓它們消失，請定期匯出備份。</p>
      {stats.total > 0 && (
        <ul className="journal-stats" aria-label="日誌統計">
          <li className="card"><strong>{stats.total}</strong><span>筆占問</span></li>
          <li className="card"><strong>{stats.reviewed}</strong><span>已寫回顧</span></li>
          <li className="card"><strong>{stats.total - stats.reviewed}</strong><span>待回顧</span></li>
          <li className="card"><strong>{stats.notes}</strong><span>有筆記</span></li>
        </ul>
      )}
      {error && <p className="notice is-error" role="alert">{ERROR_TEXT[error]}</p>}

      <div className="filters">
        <label>主題
          <select value={topic} onChange={event => setTopic(event.target.value as typeof topic)}>
            <option value="all">全部</option>
            {(Object.keys(TOPIC_LABEL) as Question['topic'][]).map(t => <option key={t} value={t}>{TOPIC_LABEL[t]}</option>)}
          </select>
        </label>
        <label>後來怎樣了
          <select value={review} onChange={event => setReview(event.target.value as typeof review)}>
            <option value="all">全部</option>
            <option value="pending">尚未寫回顧</option>
            {OUTCOME_STATUSES.map(o => <option key={o} value={o}>{OUTCOME_LABEL[o]}</option>)}
          </select>
        </label>
        <label>搜尋問題文字
          <input type="search" value={search} onChange={event => setSearch(event.target.value)} />
        </label>
      </div>

      {records === null && !error && <p role="status">載入中…</p>}
      {records !== null && records.length === 0 && (
        <div className="card"><p>還沒有記錄。</p><Link className="button primary" to="/new">開始新的占問</Link></div>
      )}
      {records !== null && records.length > 0 && visible.length === 0 && <p>沒有符合條件的記錄。</p>}

      {visible.length > 0 && <>
        <div className="journal-tools">
          <span role="status">{visible.length} 筆{chosen.length > 0 && `・已選 ${chosen.length} 筆`}</span>
          <button type="button" onClick={() => setSelected(new Set(chosen.length === visible.length ? [] : visible.map(r => r.id)))}>
            {chosen.length === visible.length ? '取消全選' : '全選'}
          </button>
          <button type="button" disabled={chosen.length === 0} onClick={() => setExporting(true)}>匯出選取記錄</button>
        </div>
        <ul className="record-list">
          {visible.map(record => {
            const judge = figureOf(record.chart.J);
            return (
              <li key={record.id} className="card journal-item">
                <input type="checkbox" checked={selected.has(record.id)} onChange={() => toggle(record.id)}
                  aria-label={`選取：${record.question.text.slice(0, 40)}`} />
                <FigureGlyph figure={record.chart.J} size={26} decorative />
                <div className="journal-text">
                  <Link to={`/result/${record.id}`} className="record-link">{record.question.text}</Link>
                  <p className="muted">{formatDate(record.createdAt)}・{TOPIC_LABEL[record.question.topic]}・{METHOD_LABEL[record.source.kind]}・裁判：{judge.zh}
                    {record.notes && '・有筆記'}{record.importOrigin && '・匯入的副本'}</p>
                  <p><span className={`outcome-badge is-${record.outcome?.status ?? 'none'}`}>{record.outcome ? OUTCOME_LABEL[record.outcome.status] : '尚未寫回顧'}</span></p>
                </div>
                <button type="button" className="danger" onClick={() => setDeleting(record)}>刪除</button>
              </li>
            );
          })}
        </ul>
      </>}

      <Dialog open={deleting !== null} title="刪除這筆記錄？" onClose={() => setDeleting(null)}>
        <p className="question-text">{deleting?.question.text}</p>
        <p>刪除後無法復原。</p>
        <div className="dialog-actions">
          <button type="button" className="primary" onClick={() => setDeleting(null)}>保留</button>
          <button type="button" className="danger" onClick={() => void remove()}>刪除</button>
        </div>
      </Dialog>
      <Dialog open={exporting} title={`匯出 ${chosen.length} 筆記錄`} onClose={() => setExporting(false)}>
        <p>匯出的檔案包含你的問題文字、盤面、解讀與筆記，請自行妥善保管。</p>
        <div className="dialog-actions">
          <button type="button" className="primary" onClick={exportChosen}>下載 JSON</button>
          <button type="button" onClick={() => setExporting(false)}>取消</button>
        </div>
      </Dialog>
    </div>
  );
}
