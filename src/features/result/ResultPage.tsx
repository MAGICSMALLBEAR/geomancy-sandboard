import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useBlocker, useLocation, useParams } from 'react-router';
import type { ReadingRecord } from '../../domain/contracts.ts';
import { useApp } from '../../app/AppContext.tsx';
import { setBusy } from '../../app/pwa.ts';
import { toAppError, type AppErrorCode } from '../../infrastructure/errors.ts';
import { buildExportFiles, checkRecord, downloadText } from '../../infrastructure/importExport.ts';
import { IMPROVE_MAX, makeRating } from '../../infrastructure/feedback.ts';
import { NOTES_MAX } from '../../infrastructure/records.ts';
import { Dialog } from '../../components/Dialog.tsx';
import { ResultView } from '../../components/ResultView.tsx';
import { ShareImageDialog } from './ShareImageDialog.tsx';
import { ShareLinkDialog } from './ShareLinkDialog.tsx';
import { OutcomeEditor } from './OutcomeEditor.tsx';
import { PlanEditor } from './PlanEditor.tsx';
import { AiPanel } from './AiPanel.tsx';
import { clearPending, completeCast, getPending, hasPending } from '../casting/pending.ts';

type Load =
  | { status: 'loading' } | { status: 'missing' }
  | { status: 'error'; code: AppErrorCode }
  | { status: 'ok'; record: ReadingRecord; saved: boolean }
  /** Stored data that this build must not interpret: shown as plain text, exportable, never recomputed. */
  | { status: 'restricted'; raw: unknown; code: AppErrorCode; reason: string };

function NotesEditor({ record, onSaved }: { record: ReadingRecord; onSaved: (record: ReadingRecord) => void }) {
  const { repo, logEvent, L, T } = useApp();
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
      <label htmlFor="notes-text">{L('寫下回顧', 'Notes')}</label>
      <p id="notes-help" className="muted">{L('這一盤已經存在日誌裡。筆記只有按下「保存筆記」後才會存入；不會改動問題與盤面。',
        'This chart is already in your journal. Notes are saved only when you press "Save notes"; they never change the question or the chart.')}</p>
      <textarea id="notes-text" rows={6} maxLength={NOTES_MAX} value={text} aria-describedby="notes-help notes-status"
        onChange={event => { setText(event.target.value); if (status.kind !== 'saving') setStatus({ kind: 'idle' }); }} />
      <p className="muted">{L(`還可以寫 ${NOTES_MAX - text.length} 字`, `${NOTES_MAX - text.length} characters left`)}</p>
      <button type="button" className="primary" disabled={!dirty || status.kind === 'saving'} onClick={() => void save(record.revision)}>{L('保存筆記', 'Save notes')}</button>
      <div id="notes-status" role="status">
        {status.kind === 'saved' && !dirty && <p className="notice is-ok">{L('筆記已保存。', 'Notes saved.')}</p>}
        {status.kind === 'saving' && <p>{L('保存中…', 'Saving…')}</p>}
      </div>
      {status.kind === 'error' && (
        <div className="notice is-error" role="alert">
          {status.code === 'REVISION_CONFLICT' ? <>
            <p>{L('另一個分頁已經修改過這筆筆記。你在這裡寫的文字還在上面的輸入框，尚未保存。', 'Another tab has changed these notes. What you wrote here is still in the box above, not saved.')}</p>
            <div className="dialog-actions">
              <button type="button" onClick={() => void overwrite()}>{L('用我這裡的文字保存', 'Save my text from here')}</button>
              <button type="button" onClick={() => void takeLatest()}>{L('改用另一個分頁的版本', "Use the other tab's version")}</button>
            </div>
          </> : <p>{L('筆記尚未保存，文字仍保留在輸入框。', 'Notes not saved; your text is still in the box. ')}{T.error(status.code)}</p>}
        </div>
      )}
      <Dialog open={blocker.state === 'blocked'} title={L('筆記還沒保存', 'Notes not saved')} onClose={() => blocker.reset?.()}>
        <p>{L('離開這一頁會失去尚未保存的筆記文字。', 'Leaving this page loses the notes you have not saved.')}</p>
        <div className="dialog-actions">
          <button type="button" className="primary" onClick={() => blocker.reset?.()}>{L('留在這裡', 'Stay here')}</button>
          <button type="button" onClick={() => blocker.proceed?.()}>{L('不保存並離開', 'Leave without saving')}</button>
        </div>
      </Dialog>
    </div>
  );
}

function FeedbackForm() {
  const { repo, L } = useApp();
  const [ease, setEase] = useState(0);
  const [clarity, setClarity] = useState(0);
  const [improve, setImprove] = useState('');
  const [state, setState] = useState<'idle' | 'sent' | 'failed'>('idle');
  if (state === 'sent') return <p className="notice is-ok" role="status">{L('謝謝。回饋只存在這個瀏覽器，可在「設定」匯出或清除。', 'Thank you. Feedback stays in this browser; export or clear it in Settings.')}</p>;
  const scale = (label: string, value: number, set: (n: number) => void) => (
    <fieldset className="scale">
      <legend>{label}</legend>
      {[1, 2, 3, 4, 5].map(n => (
        <label key={n}><input type="radio" name={label} checked={value === n} onChange={() => set(n)} />{n}</label>
      ))}
      <span className="muted">{L('1 很不同意・5 很同意', '1 strongly disagree · 5 strongly agree')}</span>
    </fieldset>
  );
  return (
    <details className="card feedback">
      <summary>{L('這次體驗如何？（選填）', 'How was this? (optional)')}</summary>
      <p className="muted">{L('這是對 App 操作的意見，不是占卜準確率。回饋只存在本機，不會自動送出；請不要填私密內容。',
        'This is about using the App, not about how accurate the divination was. Feedback stays on this device and is never sent automatically; please leave out anything private.')}</p>
      {scale(L('操作順手', 'Easy to use'), ease, setEase)}
      {scale(L('解讀容易理解', 'Reading easy to understand'), clarity, setClarity)}
      <label htmlFor="improve">{L('最想改善的一件事（選填）', 'One thing you would most like improved (optional)')}</label>
      <textarea id="improve" rows={3} maxLength={IMPROVE_MAX} value={improve} onChange={event => setImprove(event.target.value)} />
      <button type="button" disabled={ease === 0 || clarity === 0}
        onClick={() => { repo.addFeedback(makeRating(ease, clarity, improve)).then(() => setState('sent'), () => setState('failed')); }}>
        {L('存下回饋', 'Save feedback')}
      </button>
      {state === 'failed' && <p className="notice is-error" role="alert">{L('回饋尚未保存，請再試一次。', 'Feedback not saved; try again.')}</p>}
    </details>
  );
}

function Restricted({ raw, code, reason }: { raw: unknown; code: AppErrorCode; reason: string }) {
  const record = (raw ?? {}) as { question?: { text?: unknown }; createdAt?: unknown; reading?: { claims?: unknown } };
  const claims = Array.isArray(record.reading?.claims) ? record.reading.claims as { title?: unknown; text?: unknown }[] : [];
  const { L, T } = useApp();
  const unreadable = L('（無法讀取）', '(unreadable)');
  return (
    <div className="card">
      <h1>{L('這筆記錄只能以純文字檢視', 'This record can only be viewed as plain text')}</h1>
      <p className="notice is-error" role="alert">{T.error(code)}{reason && L(`（${reason}）`, ` (${reason}) `)}{L('這裡不會用目前的規則重新排盤或解讀。', 'It is not recomputed or re-read with the current rules.')}</p>
      <p>{L('問題：', 'Question: ')}{typeof record.question?.text === 'string' ? record.question.text : unreadable}</p>
      <p>{L('建立時間：', 'Created: ')}{typeof record.createdAt === 'string' ? T.formatDate(record.createdAt) || record.createdAt : unreadable}</p>
      {claims.map((claim, i) => (
        <p key={i}><strong>{typeof claim.title === 'string' ? claim.title : ''}</strong><br />{typeof claim.text === 'string' ? claim.text : ''}</p>
      ))}
      <button type="button" onClick={() => downloadText('geomancy-raw-record.json', JSON.stringify(raw, null, 2))}>{L('匯出原始資料', 'Export the raw data')}</button>
      <p><Link to="/journal">{L('回日誌', 'Back to journal')}</Link></p>
    </div>
  );
}

export function ResultPage() {
  const { id = '' } = useParams();
  const { repo, reducedMotion, logEvent, L, T } = useApp();
  const location = useLocation();
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [animate, setAnimate] = useState(() => Boolean((location.state as { animate?: boolean } | null)?.animate));
  const [retry, setRetry] = useState<{ kind: 'idle' | 'working' } | { kind: 'failed'; code: AppErrorCode }>({ kind: 'idle' });
  const [exportOpen, setExportOpen] = useState(false);
  const [imageOpen, setImageOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
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

  if (load.status === 'loading') return <p role="status">{L('載入中…', 'Loading…')}</p>;
  if (load.status === 'missing') {
    return (
      <div className="card">
        <h1>{L('這個瀏覽器找不到這筆記錄', 'This browser cannot find this record')}</h1>
        <p>{L('記錄只保存在起卦時使用的瀏覽器裡。它可能已被刪除，或是在另一台裝置上。', 'Records are kept only in the browser used for casting. It may have been deleted, or it is on another device.')}</p>
        <p><Link to="/journal">{L('查看日誌', 'Open the journal')}</Link></p>
      </div>
    );
  }
  if (load.status === 'error') {
    return <div className="notice is-error" role="alert"><p>{L('無法讀取記錄。', 'Cannot read the record. ')}{T.error(load.code)}</p><Link to="/journal">{L('回日誌', 'Back to journal')}</Link></div>;
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
      <h2>{L('暫存結果：尚未存入日誌', 'Temporary result: not in your journal yet')}</h2>
      <p>{L('這一盤只存在這個分頁的記憶體裡，關閉或重新整理就會消失。重試會保存同一盤，不會重新取數。',
        'This chart exists only in this tab’s memory and disappears if you close or reload. Retrying saves the same chart without drawing again.')}</p>
      <div className="dialog-actions">
        <button type="button" className="primary" disabled={retry.kind === 'working'} onClick={() => void retrySave()}>{L('重試保存', 'Try saving again')}</button>
        <button type="button" onClick={() => setExportOpen(true)}>{L('匯出這一盤', 'Export this chart')}</button>
      </div>
      {retry.kind === 'failed' && <p>{L('仍然無法保存。', 'Still cannot save. ')}{T.error(retry.code)}</p>}
    </div>
  );

  return (
    <>
      <ResultView
        question={record.question} dateLabel={T.formatDate(record.createdAt)} source={record.source}
        chart={record.chart} reading={record.reading}
        animate={animate && !reducedMotion} onSkipAnimation={() => setAnimate(false)}
        onEvidenceOpened={() => logEvent('evidence_opened')}
        banner={banner}
        readingExtra={saved ? showNode => (
          <AiPanel key={`ai-${record.id}`} record={record} onShowNode={showNode} onSaved={next => setLoad({ status: 'ok', record: next, saved: true })} />
        ) : undefined}
        notes={saved
          ? <>
              <NotesEditor key={record.id} record={record} onSaved={next => setLoad({ status: 'ok', record: next, saved: true })} />
              <PlanEditor key={`plan-${record.id}`} record={record} onSaved={next => setLoad({ status: 'ok', record: next, saved: true })} />
              <OutcomeEditor key={`outcome-${record.id}`} record={record} onSaved={next => setLoad({ status: 'ok', record: next, saved: true })} />
              <FeedbackForm />
            </>
          : <p className="card">{L('保存成功後才能寫筆記。', 'You can write notes once the chart is saved.')}</p>}
      />
      <nav className="result-actions" aria-label={L('這筆記錄的操作', 'Actions for this record')}>
        <Link className="button primary" to="/new">{L('新占問', 'New question')}</Link>
        <Link className="button" to="/journal">{L('回日誌', 'Back to journal')}</Link>
        <button type="button" onClick={() => setImageOpen(true)}>{L('存成圖片', 'Save as image')}</button>
        <button type="button" onClick={() => setLinkOpen(true)}>{L('分享連結', 'Share link')}</button>
        <button type="button" onClick={() => setExportOpen(true)}>{L('匯出此筆', 'Export this record')}</button>
      </nav>
      <ShareLinkDialog open={linkOpen} onClose={() => setLinkOpen(false)} mothers={record.mothers} question={record.question} rule={record.ruleVersion} />
      <ShareImageDialog open={imageOpen} onClose={() => setImageOpen(false)} chart={record.chart} question={record.question}
        dateLabel={T.formatDate(record.createdAt)} methodLabel={T.METHOD_LABEL[record.source.kind]} createdAt={record.createdAt} rule={record.ruleVersion} />
      <Dialog open={exportOpen} title={L('匯出這筆記錄', 'Export this record')} onClose={() => setExportOpen(false)}>
        <p>{L('匯出的檔案包含你的問題文字、盤面、解讀與筆記，請自行妥善保管。', 'The exported file contains your question, chart, reading and notes; keep it somewhere safe.')}</p>
        <div className="dialog-actions">
          <button type="button" className="primary" onClick={exportThis}>{L('下載 JSON', 'Download JSON')}</button>
          <button type="button" onClick={() => setExportOpen(false)}>{L('取消', 'Cancel')}</button>
        </div>
      </Dialog>
    </>
  );
}
