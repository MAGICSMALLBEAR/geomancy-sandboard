/** "What I'll do next" and a review date (DECISIONS D37): optional, stored on the record next to the follow-up. */
import { useEffect, useState } from 'react';
import type { ReadingRecord } from '../../domain/contracts.ts';
import { useApp } from '../../app/AppContext.tsx';
import { setBusy } from '../../app/pwa.ts';
import { ERROR_TEXT, toAppError, type AppErrorCode } from '../../infrastructure/errors.ts';
import { PLAN_ACTION_MAX, isCalendarDate, isReviewDue, localDate } from '../../infrastructure/records.ts';
import { formatCalendarDate, formatDate } from '../../content/labels.ts';

const QUICK_DAYS = [['一週後', 7], ['兩週後', 14], ['一個月後', 30], ['三個月後', 90]] as const;

export function PlanEditor({ record, onSaved }: { record: ReadingRecord; onSaved: (record: ReadingRecord) => void }) {
  const { repo } = useApp();
  const [editing, setEditing] = useState(!record.plan);
  const [action, setAction] = useState(record.plan?.action ?? '');
  const [reviewOn, setReviewOn] = useState(record.plan?.reviewOn ?? '');
  const [state, setState] = useState<{ kind: 'idle' | 'saving' | 'saved' } | { kind: 'error'; code: AppErrorCode }>({ kind: 'idle' });
  const dirty = editing && (action !== (record.plan?.action ?? '') || reviewOn !== (record.plan?.reviewOn ?? ''));
  const empty = action.trim() === '' && reviewOn === '';
  const dateOk = reviewOn === '' || isCalendarDate(reviewOn);

  useEffect(() => {
    setBusy('plan', dirty);
    return () => setBusy('plan', false);
  }, [dirty]);

  const reset = (from: ReadingRecord) => { setAction(from.plan?.action ?? ''); setReviewOn(from.plan?.reviewOn ?? ''); };
  const save = async (value: { action: string; reviewOn?: string } | null) => {
    setState({ kind: 'saving' });
    try {
      const latest = await repo.getReading(record.id);
      if (!latest) { setState({ kind: 'error', code: 'NOT_FOUND' }); return; }
      // Same rule as the follow-up: a plan changed in another tab must not be overwritten silently.
      if (JSON.stringify(latest.plan ?? null) !== JSON.stringify(record.plan ?? null)) {
        setState({ kind: 'error', code: 'REVISION_CONFLICT' });
        return;
      }
      const next = await repo.savePlan(record.id, latest.revision, value);
      onSaved(next);
      setEditing(value === null);
      if (value === null) { setAction(''); setReviewOn(''); }
      setState({ kind: 'saved' });
    } catch (error) {
      setState({ kind: 'error', code: toAppError(error).code });
    }
  };
  const takeLatest = async () => {
    const latest = await repo.getReading(record.id).catch(() => null);
    if (!latest) { setState({ kind: 'error', code: 'NOT_FOUND' }); return; }
    onSaved(latest);
    reset(latest);
    setEditing(!latest.plan);
    setState({ kind: 'idle' });
  };

  if (!editing && record.plan) {
    const due = isReviewDue(record, new Date());
    return (
      <section className="card plan" aria-labelledby="plan-title">
        <h3 id="plan-title">接下來打算怎麼做</h3>
        {record.plan.action && <p className="question-text">{record.plan.action}</p>}
        <p className="muted">
          {record.plan.reviewOn ? `預計 ${formatCalendarDate(record.plan.reviewOn)} 回顧` : '沒有設定回顧日期'}・寫於 {formatDate(record.plan.recordedAt)}
        </p>
        {due && record.plan.reviewOn && <p className="notice">已經到了預定的回顧日。可以在下方寫「後來怎樣了」。</p>}
        <div className="dialog-actions">
          <button type="button" onClick={() => { setEditing(true); setState({ kind: 'idle' }); }}>修改</button>
          <button type="button" className="danger" onClick={() => void save(null)}>刪除</button>
        </div>
        <div role="status">{state.kind === 'saved' && <p className="notice is-ok">已保存。</p>}</div>
        {state.kind === 'error' && <p className="notice is-error" role="alert">{ERROR_TEXT[state.code]}</p>}
      </section>
    );
  }

  const today = new Date();
  return (
    <section className="card plan" aria-labelledby="plan-title">
      <h3 id="plan-title">接下來打算怎麼做</h3>
      <p className="muted">寫下一個你能主動做的小步驟，再選一天回來寫「後來怎樣了」。兩項都是選填，可以只填一項。</p>
      <label htmlFor={`plan-action-${record.id}`}>打算做什麼？</label>
      <textarea id={`plan-action-${record.id}`} rows={3} maxLength={PLAN_ACTION_MAX} value={action}
        onChange={event => { setAction(event.target.value); if (state.kind !== 'saving') setState({ kind: 'idle' }); }} />
      <p className="muted">還可以寫 {PLAN_ACTION_MAX - action.length} 字</p>
      <label htmlFor={`plan-date-${record.id}`}>預計哪天回顧？</label>
      <input id={`plan-date-${record.id}`} type="date" value={reviewOn}
        onChange={event => { setReviewOn(event.target.value); if (state.kind !== 'saving') setState({ kind: 'idle' }); }} />
      <div className="chips quick-dates" role="group" aria-label="快速選擇回顧日期">
        {QUICK_DAYS.map(([label, days]) => (
          <button type="button" key={days} aria-pressed={reviewOn === localDate(today, days)}
            onClick={() => setReviewOn(localDate(today, days))}>{label}</button>
        ))}
        {reviewOn && <button type="button" onClick={() => setReviewOn('')}>不設日期</button>}
      </div>
      {reviewOn && dateOk && <p className="muted">預計 {formatCalendarDate(reviewOn)} 回顧。到了那天，首頁會提醒你。</p>}
      {!dateOk && <p className="notice is-error">日期格式不正確，請重新選擇。</p>}
      <div className="dialog-actions">
        <button type="button" className="primary" disabled={empty || !dateOk || !dirty || state.kind === 'saving'}
          onClick={() => void save({ action, ...(reviewOn ? { reviewOn } : {}) })}>保存</button>
        {record.plan && <button type="button" onClick={() => { setEditing(false); reset(record); setState({ kind: 'idle' }); }}>取消修改</button>}
      </div>
      <div role="status">{state.kind === 'saving' && <p>保存中…</p>}</div>
      {state.kind === 'error' && (
        <div className="notice is-error" role="alert">
          {state.code === 'REVISION_CONFLICT' ? <>
            <p>另一個分頁已經修改過這一段。你在這裡寫的內容還在，尚未保存。</p>
            <button type="button" onClick={() => void takeLatest()}>改看另一個分頁的版本</button>
          </> : <p>尚未保存，內容仍保留。{ERROR_TEXT[state.code]}</p>}
        </div>
      )}
    </section>
  );
}
