/** "What happened afterwards" (DECISIONS D30): a later, optional follow-up stored on the record. */
import { useEffect, useState } from 'react';
import { OUTCOME_STATUSES, type OutcomeStatus, type ReadingRecord } from '../../domain/contracts.ts';
import { useApp } from '../../app/AppContext.tsx';
import { setBusy } from '../../app/pwa.ts';
import { toAppError, type AppErrorCode } from '../../infrastructure/errors.ts';
import { OUTCOME_TEXT_MAX } from '../../infrastructure/records.ts';

const OUTCOME_HELP: Record<OutcomeStatus, [string, string]> = {
  matched: ['事情的發展和當時讀到的主題大致一致。', 'Things went broadly the way the themes you read suggested.'],
  partly: ['有些部分一致，有些不同。', 'Some parts matched, some did not.'],
  'not-matched': ['事情往不同的方向發展。', 'Things went a different way.'],
  unclear: ['時間還不夠，或結果還不明朗。', 'Not enough time has passed, or the outcome is still unclear.'],
};

export function OutcomeEditor({ record, onSaved }: { record: ReadingRecord; onSaved: (record: ReadingRecord) => void }) {
  const { repo, L, T } = useApp();
  const [editing, setEditing] = useState(!record.outcome);
  const [status, setStatus] = useState<OutcomeStatus | null>(record.outcome?.status ?? null);
  const [text, setText] = useState(record.outcome?.text ?? '');
  const [state, setState] = useState<{ kind: 'idle' | 'saving' | 'saved' } | { kind: 'error'; code: AppErrorCode }>({ kind: 'idle' });
  const dirty = editing && (status !== (record.outcome?.status ?? null) || text !== (record.outcome?.text ?? ''));

  useEffect(() => {
    setBusy('outcome', dirty);
    return () => setBusy('outcome', false);
  }, [dirty]);

  const save = async (value: { status: OutcomeStatus; text: string } | null) => {
    setState({ kind: 'saving' });
    try {
      const latest = await repo.getReading(record.id);
      if (!latest) { setState({ kind: 'error', code: 'NOT_FOUND' }); return; }
      // Notes and follow-up share the revision; a newer revision from this record's own notes is fine,
      // but a different follow-up written in another tab must not be overwritten silently.
      if (JSON.stringify(latest.outcome ?? null) !== JSON.stringify(record.outcome ?? null)) {
        setState({ kind: 'error', code: 'REVISION_CONFLICT' });
        return;
      }
      const next = await repo.saveOutcome(record.id, latest.revision, value);
      onSaved(next);
      setEditing(value === null);
      if (value === null) { setStatus(null); setText(''); }
      setState({ kind: 'saved' });
    } catch (error) {
      setState({ kind: 'error', code: toAppError(error).code });
    }
  };
  const takeLatest = async () => {
    const latest = await repo.getReading(record.id).catch(() => null);
    if (!latest) { setState({ kind: 'error', code: 'NOT_FOUND' }); return; }
    onSaved(latest);
    setStatus(latest.outcome?.status ?? null);
    setText(latest.outcome?.text ?? '');
    setEditing(!latest.outcome);
    setState({ kind: 'idle' });
  };

  if (!editing && record.outcome) {
    return (
      <section className="card outcome" aria-labelledby="outcome-title">
        <h3 id="outcome-title">{L('後來怎樣了', 'What happened afterwards')}</h3>
        <p className="outcome-summary">
          <span className={`outcome-badge is-${record.outcome.status}`}>{T.OUTCOME_LABEL[record.outcome.status]}</span>
          <span className="muted">{L('寫於 ', 'Written ')}{T.formatDate(record.outcome.recordedAt)}</span>
        </p>
        {record.outcome.text && <p className="question-text">{record.outcome.text}</p>}
        <div className="dialog-actions">
          <button type="button" onClick={() => { setEditing(true); setState({ kind: 'idle' }); }}>{L('修改回顧', 'Edit follow-up')}</button>
          <button type="button" className="danger" onClick={() => void save(null)}>{L('刪除回顧', 'Delete follow-up')}</button>
        </div>
        <div role="status">{state.kind === 'saved' && <p className="notice is-ok">{L('回顧已保存。', 'Follow-up saved.')}</p>}</div>
        {state.kind === 'error' && <p className="notice is-error" role="alert">{T.error(state.code)}</p>}
      </section>
    );
  }

  return (
    <section className="card outcome" aria-labelledby="outcome-title">
      <h3 id="outcome-title">{L('後來怎樣了', 'What happened afterwards')}</h3>
      <p className="muted">{L('過一段時間再回來，記下事情實際的發展，並和當時的解讀對照。這能幫你熟悉象義；它不是在評分占卜準不準。',
        'Come back after a while, note what actually happened, and compare it with the reading. This helps you learn the figures; it is not a score of whether the divination was right.')}</p>
      <fieldset>
        <legend>{L('和當時的解讀相比', 'Compared with the reading')}</legend>
        <div className="choice-row">
          {OUTCOME_STATUSES.map(option => (
            <label key={option} className="choice">
              <input type="radio" name={`outcome-${record.id}`} checked={status === option} onChange={() => setStatus(option)} />
              <span><strong>{T.OUTCOME_LABEL[option]}</strong><br /><span className="muted">{L(...OUTCOME_HELP[option])}</span></span>
            </label>
          ))}
        </div>
      </fieldset>
      <label htmlFor={`outcome-text-${record.id}`}>{L('實際發生了什麼？（選填）', 'What actually happened? (optional)')}</label>
      <textarea id={`outcome-text-${record.id}`} rows={4} maxLength={OUTCOME_TEXT_MAX} value={text}
        onChange={event => { setText(event.target.value); if (state.kind !== 'saving') setState({ kind: 'idle' }); }} />
      <p className="muted">{L(`還可以寫 ${OUTCOME_TEXT_MAX - text.length} 字`, `${OUTCOME_TEXT_MAX - text.length} characters left`)}</p>
      <div className="dialog-actions">
        <button type="button" className="primary" disabled={status === null || !dirty || state.kind === 'saving'}
          onClick={() => status && void save({ status, text })}>{L('保存回顧', 'Save follow-up')}</button>
        {record.outcome && <button type="button" onClick={() => {
          setEditing(false); setStatus(record.outcome!.status); setText(record.outcome!.text); setState({ kind: 'idle' });
        }}>{L('取消修改', 'Cancel editing')}</button>}
      </div>
      <div role="status">{state.kind === 'saving' && <p>{L('保存中…', 'Saving…')}</p>}</div>
      {state.kind === 'error' && (
        <div className="notice is-error" role="alert">
          {state.code === 'REVISION_CONFLICT' ? <>
            <p>{L('另一個分頁已經修改過這筆回顧。你在這裡選的內容還在，尚未保存。', 'Another tab has changed this follow-up. What you chose here is still on screen, not saved.')}</p>
            <button type="button" onClick={() => void takeLatest()}>{L('改看另一個分頁的版本', "Show the other tab's version")}</button>
          </> : <p>{L('回顧尚未保存，內容仍保留。', 'Follow-up not saved; your input is kept. ')}{T.error(state.code)}</p>}
        </div>
      )}
    </section>
  );
}
