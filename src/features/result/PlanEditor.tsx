/** "What I'll do next" and a review date (DECISIONS D37): optional, stored on the record next to the follow-up. */
import { useEffect, useState } from 'react';
import type { ReadingRecord } from '../../domain/contracts.ts';
import { useApp } from '../../app/AppContext.tsx';
import { setBusy } from '../../app/pwa.ts';
import { toAppError, type AppErrorCode } from '../../infrastructure/errors.ts';
import { PLAN_ACTION_MAX, isCalendarDate, isReviewDue, localDate } from '../../infrastructure/records.ts';

const QUICK_DAYS = [[['一週後', 'In a week'], 7], [['兩週後', 'In two weeks'], 14], [['一個月後', 'In a month'], 30], [['三個月後', 'In three months'], 90]] as const;

export function PlanEditor({ record, onSaved }: { record: ReadingRecord; onSaved: (record: ReadingRecord) => void }) {
  const { repo, L, T } = useApp();
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
        <h3 id="plan-title">{L('接下來打算怎麼做', 'What I plan to do next')}</h3>
        {record.plan.action && <p className="question-text">{record.plan.action}</p>}
        <p className="muted">
          {record.plan.reviewOn ? L(`預計 ${T.formatCalendarDate(record.plan.reviewOn)} 回顧`, `Look back on ${T.formatCalendarDate(record.plan.reviewOn)}`) : L('沒有設定回顧日期', 'No review date')}
          {L('・寫於 ', ' · written ')}{T.formatDate(record.plan.recordedAt)}
        </p>
        {due && record.plan.reviewOn && <p className="notice">{L('已經到了預定的回顧日。可以在下方寫「後來怎樣了」。', 'The review date has come. You can write "What happened afterwards" below.')}</p>}
        <div className="dialog-actions">
          <button type="button" onClick={() => { setEditing(true); setState({ kind: 'idle' }); }}>{L('修改', 'Edit')}</button>
          <button type="button" className="danger" onClick={() => void save(null)}>{L('刪除', 'Delete')}</button>
        </div>
        <div role="status">{state.kind === 'saved' && <p className="notice is-ok">{L('已保存。', 'Saved.')}</p>}</div>
        {state.kind === 'error' && <p className="notice is-error" role="alert">{T.error(state.code)}</p>}
      </section>
    );
  }

  const today = new Date();
  return (
    <section className="card plan" aria-labelledby="plan-title">
      <h3 id="plan-title">{L('接下來打算怎麼做', 'What I plan to do next')}</h3>
      <p className="muted">{L('寫下一個你能主動做的小步驟，再選一天回來寫「後來怎樣了」。兩項都是選填，可以只填一項。',
        'Write one small step you can take yourself, and pick a day to come back and write what happened. Both are optional; one is enough.')}</p>
      <label htmlFor={`plan-action-${record.id}`}>{L('打算做什麼？', 'What will you do?')}</label>
      <textarea id={`plan-action-${record.id}`} rows={3} maxLength={PLAN_ACTION_MAX} value={action}
        onChange={event => { setAction(event.target.value); if (state.kind !== 'saving') setState({ kind: 'idle' }); }} />
      <p className="muted">{L(`還可以寫 ${PLAN_ACTION_MAX - action.length} 字`, `${PLAN_ACTION_MAX - action.length} characters left`)}</p>
      <label htmlFor={`plan-date-${record.id}`}>{L('預計哪天回顧？', 'When will you look back?')}</label>
      <input id={`plan-date-${record.id}`} type="date" value={reviewOn}
        onChange={event => { setReviewOn(event.target.value); if (state.kind !== 'saving') setState({ kind: 'idle' }); }} />
      <div className="chips quick-dates" role="group" aria-label={L('快速選擇回顧日期', 'Quick review dates')}>
        {QUICK_DAYS.map(([label, days]) => (
          <button type="button" key={days} aria-pressed={reviewOn === localDate(today, days)}
            onClick={() => setReviewOn(localDate(today, days))}>{L(label[0], label[1])}</button>
        ))}
        {reviewOn && <button type="button" onClick={() => setReviewOn('')}>{L('不設日期', 'No date')}</button>}
      </div>
      {reviewOn && dateOk && <p className="muted">{L(`預計 ${T.formatCalendarDate(reviewOn)} 回顧。到了那天，首頁會提醒你。`, `Look back on ${T.formatCalendarDate(reviewOn)}. The home page will remind you that day.`)}</p>}
      {!dateOk && <p className="notice is-error">{L('日期格式不正確，請重新選擇。', 'That date is not valid; choose again.')}</p>}
      <div className="dialog-actions">
        <button type="button" className="primary" disabled={empty || !dateOk || !dirty || state.kind === 'saving'}
          onClick={() => void save({ action, ...(reviewOn ? { reviewOn } : {}) })}>{L('保存', 'Save')}</button>
        {record.plan && <button type="button" onClick={() => { setEditing(false); reset(record); setState({ kind: 'idle' }); }}>{L('取消修改', 'Cancel editing')}</button>}
      </div>
      <div role="status">{state.kind === 'saving' && <p>{L('保存中…', 'Saving…')}</p>}</div>
      {state.kind === 'error' && (
        <div className="notice is-error" role="alert">
          {state.code === 'REVISION_CONFLICT' ? <>
            <p>{L('另一個分頁已經修改過這一段。你在這裡寫的內容還在，尚未保存。', 'Another tab has changed this. What you wrote here is still on screen, not saved.')}</p>
            <button type="button" onClick={() => void takeLatest()}>{L('改看另一個分頁的版本', "Show the other tab's version")}</button>
          </> : <p>{L('尚未保存，內容仍保留。', 'Not saved; your input is kept. ')}{T.error(state.code)}</p>}
        </div>
      )}
    </section>
  );
}
