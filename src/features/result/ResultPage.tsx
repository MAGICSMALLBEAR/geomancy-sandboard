import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useBlocker, useLocation, useParams } from 'react-router';
import type { ReadingRecord } from '../../domain/contracts.ts';
import { useApp } from '../../app/AppContext.tsx';
import { setBusy } from '../../app/pwa.ts';
import { ERROR_TEXT, toAppError, type AppErrorCode } from '../../infrastructure/errors.ts';
import { buildExportFiles, checkRecord, downloadText } from '../../infrastructure/importExport.ts';
import { IMPROVE_MAX, makeRating } from '../../infrastructure/feedback.ts';
import { NOTES_MAX } from '../../infrastructure/records.ts';
import { formatDate } from '../../content/labels.ts';
import { Dialog } from '../../components/Dialog.tsx';
import { ResultView } from '../../components/ResultView.tsx';
import { METHOD_LABEL } from '../../content/labels.ts';
import { ShareImageDialog } from './ShareImageDialog.tsx';
import { OutcomeEditor } from './OutcomeEditor.tsx';
import { clearPending, completeCast, getPending, hasPending } from '../casting/pending.ts';

type Load =
  | { status: 'loading' } | { status: 'missing' }
  | { status: 'error'; code: AppErrorCode }
  | { status: 'ok'; record: ReadingRecord; saved: boolean }
  /** Stored data that this build must not interpret: shown as plain text, exportable, never recomputed. */
  | { status: 'restricted'; raw: unknown; code: AppErrorCode; reason: string };

function NotesEditor({ record, onSaved }: { record: ReadingRecord; onSaved: (record: ReadingRecord) => void }) {
  const { repo, logEvent } = useApp();
  const [text, setText] = useState(record.notes);
  const [status, setStatus] = useState<{ kind: 'idle' | 'saving' | 'saved' } | { kind: 'error'; code: AppErrorCode }>({ kind: 'idle' });
  const dirty = text !== record.notes;
  const blocker = useBlocker(dirty);

  useEffect(() => {
    setBusy('notes', dirty);
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => { window.removeEventListener('beforeunload', warn); setBusy('notes', false); };
  }, [dirty]);

  const save = async (revision: number) => {
    setStatus({ kind: 'saving' });
    try {
      const next = await repo.saveNotes(record.id, revision, text);
      onSaved(next);
      setStatus({ kind: 'saved' });
      logEvent('note_saved');
    } catch (error) {
      // The typed text stays in the box whatever happened.
      const code = toAppError(error).code;
      setStatus({ kind: 'error', code });
      logEvent('error_shown', { errorCode: code });
    }
  };
  /** Conflict: the user explicitly chooses to keep this tab's text over the other tab's. */
  const overwrite = async () => {
    try {
      const latest = await repo.getReading(record.id);
      if (!latest) { setStatus({ kind: 'error', code: 'NOT_FOUND' }); return; }
      await save(latest.revision);
    } catch (error) {
      setStatus({ kind: 'error', code: toAppError(error).code });
    }
  };
  const takeLatest = async () => {
    try {
      const latest = await repo.getReading(record.id);
      if (!latest) { setStatus({ kind: 'error', code: 'NOT_FOUND' }); return; }
      onSaved(latest);
      setText(latest.notes);
      setStatus({ kind: 'idle' });
    } catch (error) {
      setStatus({ kind: 'error', code: toAppError(error).code });
    }
  };

  return (
    <div className="card notes">
      <label htmlFor="notes-text">寫下回顧</label>
      <p id="notes-help" className="muted">這一盤已經存在日誌裡。筆記只有按下「保存筆記」後才會存入；不會改動問題與盤面。</p>
      <textarea id="notes-text" rows={6} maxLength={NOTES_MAX} value={text} aria-describedby="notes-help notes-status"
        onChange={event => { setText(event.target.value); if (status.kind !== 'saving') setStatus({ kind: 'idle' }); }} />
      <p className="muted">還可以寫 {NOTES_MAX - text.length} 字</p>
      <button type="button" className="primary" disabled={!dirty || status.kind === 'saving'} onClick={() => void save(record.revision)}>保存筆記</button>
      <div id="notes-status" role="status">
        {status.kind === 'saved' && !dirty && <p className="notice is-ok">筆記已保存。</p>}
        {status.kind === 'saving' && <p>保存中…</p>}
      </div>
      {status.kind === 'error' && (
        <div className="notice is-error" role="alert">
          {status.code === 'REVISION_CONFLICT' ? <>
            <p>另一個分頁已經修改過這筆筆記。你在這裡寫的文字還在上面的輸入框，尚未保存。</p>
            <div className="dialog-actions">
              <button type="button" onClick={() => void overwrite()}>用我這裡的文字保存</button>
              <button type="button" onClick={() => void takeLatest()}>改用另一個分頁的版本</button>
            </div>
          </> : <p>筆記尚未保存，文字仍保留在輸入框。{ERROR_TEXT[status.code]}</p>}
        </div>
      )}
      <Dialog open={blocker.state === 'blocked'} title="筆記還沒保存" onClose={() => blocker.reset?.()}>
        <p>離開這一頁會失去尚未保存的筆記文字。</p>
        <div className="dialog-actions">
          <button type="button" className="primary" onClick={() => blocker.reset?.()}>留在這裡</button>
          <button type="button" onClick={() => blocker.proceed?.()}>不保存並離開</button>
        </div>
      </Dialog>
    </div>
  );
}

function FeedbackForm() {
  const { repo } = useApp();
  const [ease, setEase] = useState(0);
  const [clarity, setClarity] = useState(0);
  const [improve, setImprove] = useState('');
  const [state, setState] = useState<'idle' | 'sent' | 'failed'>('idle');
  if (state === 'sent') return <p className="notice is-ok" role="status">謝謝。回饋只存在這個瀏覽器，可在「設定」匯出或清除。</p>;
  const scale = (label: string, value: number, set: (n: number) => void) => (
    <fieldset className="scale">
      <legend>{label}</legend>
      {[1, 2, 3, 4, 5].map(n => (
        <label key={n}><input type="radio" name={label} checked={value === n} onChange={() => set(n)} />{n}</label>
      ))}
      <span className="muted">1 很不同意・5 很同意</span>
    </fieldset>
  );
  return (
    <details className="card feedback">
      <summary>這次體驗如何？（選填）</summary>
      <p className="muted">這是對 App 操作的意見，不是占卜準確率。回饋只存在本機，不會自動送出；請不要填私密內容。</p>
      {scale('操作順手', ease, setEase)}
      {scale('解讀容易理解', clarity, setClarity)}
      <label htmlFor="improve">最想改善的一件事（選填）</label>
      <textarea id="improve" rows={3} maxLength={IMPROVE_MAX} value={improve} onChange={event => setImprove(event.target.value)} />
      <button type="button" disabled={ease === 0 || clarity === 0}
        onClick={() => { repo.addFeedback(makeRating(ease, clarity, improve)).then(() => setState('sent'), () => setState('failed')); }}>
        存下回饋
      </button>
      {state === 'failed' && <p className="notice is-error" role="alert">回饋尚未保存，請再試一次。</p>}
    </details>
  );
}

function Restricted({ raw, code, reason }: { raw: unknown; code: AppErrorCode; reason: string }) {
  const record = (raw ?? {}) as { question?: { text?: unknown }; createdAt?: unknown; reading?: { claims?: unknown } };
  const claims = Array.isArray(record.reading?.claims) ? record.reading.claims as { title?: unknown; text?: unknown }[] : [];
  return (
    <div className="card">
      <h1>這筆記錄只能以純文字檢視</h1>
      <p className="notice is-error" role="alert">{ERROR_TEXT[code]}{reason && `（${reason}）`}這裡不會用目前的規則重新排盤或解讀。</p>
      <p>問題：{typeof record.question?.text === 'string' ? record.question.text : '（無法讀取）'}</p>
      <p>建立時間：{typeof record.createdAt === 'string' ? formatDate(record.createdAt) || record.createdAt : '（無法讀取）'}</p>
      {claims.map((claim, i) => (
        <p key={i}><strong>{typeof claim.title === 'string' ? claim.title : ''}</strong><br />{typeof claim.text === 'string' ? claim.text : ''}</p>
      ))}
      <button type="button" onClick={() => downloadText('geomancy-raw-record.json', JSON.stringify(raw, null, 2))}>匯出原始資料</button>
      <p><Link to="/journal">回日誌</Link></p>
    </div>
  );
}

export function ResultPage() {
  const { id = '' } = useParams();
  const { repo, reducedMotion, logEvent } = useApp();
  const location = useLocation();
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [animate, setAnimate] = useState(() => Boolean((location.state as { animate?: boolean } | null)?.animate));
  const [retry, setRetry] = useState<{ kind: 'idle' | 'working' } | { kind: 'failed'; code: AppErrorCode }>({ kind: 'idle' });
  const [exportOpen, setExportOpen] = useState(false);
  const [imageOpen, setImageOpen] = useState(false);
  const retrying = useRef(false);

  const read = useCallback(async () => {
    try {
      const record = await repo.getReading(id);
      if (record) {
        const check = checkRecord(record);
        if (check.ok) setLoad({ status: 'ok', record, saved: true });
        else setLoad({ status: 'restricted', raw: record, code: check.code, reason: check.reason });
        return;
      }
      const pending = getPending(id);
      setLoad(pending ? { status: 'ok', record: pending.record, saved: false } : { status: 'missing' });
    } catch (error) {
      const pending = getPending(id);
      setLoad(pending ? { status: 'ok', record: pending.record, saved: false } : { status: 'error', code: toAppError(error).code });
    }
  }, [id, repo]);

  useEffect(() => { void read(); }, [read]);

  // The build-up is decoration over an already stored chart; it ends on its own or when skipped.
  useEffect(() => {
    if (!animate) return;
    const timer = window.setTimeout(() => setAnimate(false), 3000);
    return () => clearTimeout(timer);
  }, [animate]);

  const unsaved = load.status === 'ok' && !load.saved;
  useEffect(() => {
    if (!unsaved) return;
    const warn = (event: BeforeUnloadEvent) => { if (hasPending()) event.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [unsaved]);

  if (load.status === 'loading') return <p role="status">載入中…</p>;
  if (load.status === 'missing') {
    return (
      <div className="card">
        <h1>這個瀏覽器找不到這筆記錄</h1>
        <p>記錄只保存在起卦時使用的瀏覽器裡。它可能已被刪除，或是在另一台裝置上。</p>
        <p><Link to="/journal">查看日誌</Link></p>
      </div>
    );
  }
  if (load.status === 'error') {
    return <div className="notice is-error" role="alert"><p>無法讀取記錄。{ERROR_TEXT[load.code]}</p><Link to="/journal">回日誌</Link></div>;
  }
  if (load.status === 'restricted') return <Restricted raw={load.raw} code={load.code} reason={load.reason} />;

  const { record, saved } = load;
  const retrySave = async () => {
    const pending = getPending(id);
    if (!pending || retrying.current) return;
    retrying.current = true;
    setRetry({ kind: 'working' });
    try {
      await completeCast(repo, pending.draft, pending.unsavedSource);
      clearPending(id);
      setRetry({ kind: 'idle' });
      await read();
    } catch (error) {
      setRetry({ kind: 'failed', code: toAppError(error).code });
    } finally {
      retrying.current = false;
    }
  };
  const exportThis = () => {
    for (const file of buildExportFiles([record], new Date().toISOString())) downloadText(file.filename, file.text);
    setExportOpen(false);
  };

  const banner = saved ? null : (
    <div className="notice is-error" role="alert">
      <h2>暫存結果：尚未存入日誌</h2>
      <p>這一盤只存在這個分頁的記憶體裡，關閉或重新整理就會消失。重試會保存同一盤，不會重新取數。</p>
      <div className="dialog-actions">
        <button type="button" className="primary" disabled={retry.kind === 'working'} onClick={() => void retrySave()}>重試保存</button>
        <button type="button" onClick={() => setExportOpen(true)}>匯出這一盤</button>
      </div>
      {retry.kind === 'failed' && <p>仍然無法保存。{ERROR_TEXT[retry.code]}</p>}
    </div>
  );

  return (
    <>
      <ResultView
        question={record.question} dateLabel={formatDate(record.createdAt)} source={record.source}
        chart={record.chart} reading={record.reading}
        animate={animate && !reducedMotion} onSkipAnimation={() => setAnimate(false)}
        onEvidenceOpened={() => logEvent('evidence_opened')}
        banner={banner}
        notes={saved
          ? <>
              <NotesEditor key={record.id} record={record} onSaved={next => setLoad({ status: 'ok', record: next, saved: true })} />
              <OutcomeEditor key={`outcome-${record.id}`} record={record} onSaved={next => setLoad({ status: 'ok', record: next, saved: true })} />
              <FeedbackForm />
            </>
          : <p className="card">保存成功後才能寫筆記。</p>}
      />
      <nav className="result-actions" aria-label="這筆記錄的操作">
        <Link className="button primary" to="/new">新占問</Link>
        <Link className="button" to="/journal">回日誌</Link>
        <button type="button" onClick={() => setImageOpen(true)}>存成圖片</button>
        <button type="button" onClick={() => setExportOpen(true)}>匯出此筆</button>
      </nav>
      <ShareImageDialog open={imageOpen} onClose={() => setImageOpen(false)} chart={record.chart} question={record.question}
        dateLabel={formatDate(record.createdAt)} methodLabel={METHOD_LABEL[record.source.kind]} createdAt={record.createdAt} />
      <Dialog open={exportOpen} title="匯出這筆記錄" onClose={() => setExportOpen(false)}>
        <p>匯出的檔案包含你的問題文字、盤面、解讀與筆記，請自行妥善保管。</p>
        <div className="dialog-actions">
          <button type="button" className="primary" onClick={exportThis}>下載 JSON</button>
          <button type="button" onClick={() => setExportOpen(false)}>取消</button>
        </div>
      </Dialog>
    </>
  );
}
