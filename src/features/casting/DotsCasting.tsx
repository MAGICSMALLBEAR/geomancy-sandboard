import { useEffect, useReducer, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useBlocker } from 'react-router';
import type { Bit, Figure } from '../../domain/geomancy.ts';
import type { Draft } from '../../domain/contracts.ts';
import { useApp } from '../../app/AppContext.tsx';
import { playTap } from '../../app/sound.ts';
import { buzzConfirm, buzzTap } from '../../app/haptics.ts';
import { toAppError } from '../../infrastructure/errors.ts';
import { ROW_MAX_DOTS } from '../../infrastructure/records.ts';
import { figureOf } from '../../content/labels.ts';
import { Dialog } from '../../components/Dialog.tsx';
import { FigureGlyph } from '../../components/FigureGlyph.tsx';
import { beginTap, judgeRelease, trackTap, type TapCandidate } from './gesture.ts';
import { canConfirm, dotsReducer, initDots } from './dotsReducer.ts';
import { REDUCE_MS, SandCanvas, type SandCanvasHandle } from './SandCanvas.tsx';

type Props = {
  draft: Draft;
  /** Row 16 is stored: hand the ready draft to the page, which finalises it. */
  onReady: (draft: Draft) => void;
  /** The draft no longer exists here (finished or discarded in another tab). */
  onGone: () => void;
};

const motherFigure = (counts: number[], index: number): Figure =>
  counts.slice(index * 4, index * 4 + 4).map(n => (n % 2) as Bit) as unknown as Figure;

export function DotsCasting({ draft, onReady, onGone }: Props) {
  const { repo, settings, reducedMotion, logEvent, L, T } = useApp();
  const [state, dispatch] = useReducer(dotsReducer, draft, initDots);
  const [resumeNotice, setResumeNotice] = useState(draft.confirmedCounts.length > 0);
  const [lastRow, setLastRow] = useState<{ row: number; count: number } | null>(null);
  const [hint, setHint] = useState('');
  const [announce, setAnnounce] = useState('');

  const canvas = useRef<SandCanvasHandle>(null);
  const tray = useRef<HTMLDivElement>(null);
  const candidate = useRef<TapCandidate | null>(null);
  // Synchronous guards: set before any await so a double tap/click cannot slip through a re-render.
  const locked = useRef(state.phase !== 'collecting');
  const count = useRef(0);
  const rows = useRef(draft.confirmedCounts.length);
  const revision = useRef(draft.revision);
  const revealTimer = useRef(0);

  const rowNumber = state.confirmed.length + 1;
  const motherIndex = Math.min(3, Math.floor(state.confirmed.length / 4));
  const rowInMother = state.confirmed.length % 4;

  useEffect(() => () => clearTimeout(revealTimer.current), []);

  const cancelCandidate = () => {
    if (!candidate.current) return;
    candidate.current = null;
    canvas.current?.setPending(null);
  };
  useEffect(() => {
    // A gesture interrupted by backgrounding is never a valid release.
    const onHidden = () => { if (document.hidden) { candidate.current = null; canvas.current?.setPending(null); } };
    document.addEventListener('visibilitychange', onHidden);
    return () => document.removeEventListener('visibilitychange', onHidden);
  }, []);

  const hasUnconfirmed = state.phase === 'collecting' && state.count > 0;
  const blocker = useBlocker(hasUnconfirmed);
  useEffect(() => {
    if (!hasUnconfirmed) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [hasUnconfirmed]);

  const addDot = (place: () => void) => {
    if (locked.current) return;
    if (count.current >= ROW_MAX_DOTS) { dispatch({ type: 'tap' }); return; }
    count.current += 1;
    place();
    dispatch({ type: 'tap' });
    setHint('');
    if (settings.sound) playTap();
    if (settings.haptics) buzzTap();
  };

  const relative = (event: ReactPointerEvent) => {
    const rect = tray.current!.getBoundingClientRect();
    const inside = event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
    return { x: (event.clientX - rect.left) / rect.width, y: (event.clientY - rect.top) / rect.height, inside };
  };
  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (locked.current) return;
    const next = beginTap(candidate.current, { pointerId: event.pointerId, isPrimary: event.isPrimary, button: event.button,
      x: event.clientX, y: event.clientY, time: event.timeStamp });
    if (next === candidate.current) return;
    candidate.current = next;
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* capture is best effort */ }
    const point = relative(event);
    canvas.current?.setPending({ x: point.x, y: point.y });
  };
  const onPointerMove = (event: ReactPointerEvent) => {
    candidate.current = trackTap(candidate.current, event.pointerId, event.clientX, event.clientY);
  };
  const onPointerUp = (event: ReactPointerEvent) => {
    const point = relative(event);
    const verdict = judgeRelease(candidate.current, { pointerId: event.pointerId, x: event.clientX, y: event.clientY,
      time: event.timeStamp, inside: point.inside });
    if (verdict === 'ignored') return;
    cancelCandidate();
    if (verdict === 'tap') addDot(() => canvas.current?.addMark(point.x, point.y));
    else setHint(L('輕點即可：這次沒有算進去。', 'Just tap: that one did not count.'));
  };
  const onPointerAbort = (event: ReactPointerEvent) => {
    if (candidate.current?.pointerId === event.pointerId) cancelCandidate();
  };

  const finishReveal = () => {
    clearTimeout(revealTimer.current);
    canvas.current?.clear();
    count.current = 0;
    dispatch({ type: 'reveal-done' });
    if (rows.current % 4 !== 0) locked.current = false;
  };

  const confirmRow = async () => {
    if (locked.current || count.current < 1) return;
    locked.current = true;
    cancelCandidate();
    const fixed = count.current;
    dispatch({ type: 'confirm-start' });
    try {
      const next = await repo.confirmRow(draft.id, revision.current, fixed);
      revision.current = next.revision;
      rows.current = next.confirmedCounts.length;
      setResumeNotice(false);
      setLastRow({ row: rows.current, count: fixed });
      setAnnounce(L(`第 ${rows.current} 列完成：${T.parity(fixed)}，記為${T.dotWord(fixed % 2)}。進度 ${rows.current}／16。`,
        `Row ${rows.current} done: ${T.parity(fixed)}, recorded as ${T.dotWord(fixed % 2)}. ${rows.current} of 16.`));
      logEvent('row_confirmed', { method: 'dots', rowIndex: rows.current });
      if (settings.haptics) buzzConfirm();
      dispatch({ type: 'confirm-ok', draft: next });
      if (next.state === 'ready-to-finalize') { onReady(next); return; }
      canvas.current?.reduce(fixed % 2 === 1 ? 1 : 2);
      revealTimer.current = window.setTimeout(finishReveal, reducedMotion ? 0 : REDUCE_MS + 300);
    } catch (error) {
      const code = toAppError(error).code;
      // Stay on this row with the same dots; never claim success and never substitute a number.
      locked.current = false;
      dispatch({ type: 'confirm-fail', code });
      logEvent('error_shown', { errorCode: code });
    }
  };

  const clearRow = () => {
    if (locked.current) return;
    count.current = 0;
    cancelCandidate();
    canvas.current?.clear();
    dispatch({ type: 'clear' });
  };
  const continueAfterMother = () => {
    locked.current = false;
    dispatch({ type: 'continue' });
  };
  const reloadLatest = async () => {
    try {
      const latest = await repo.loadDraft(draft.id);
      if (!latest) { onGone(); return; }
      if (latest.state === 'ready-to-finalize') { onReady(latest); return; }
      revision.current = latest.revision;
      rows.current = latest.confirmedCounts.length;
      count.current = 0;
      canvas.current?.clear();
      dispatch({ type: 'reload', draft: latest });
      locked.current = latest.confirmedCounts.length % 4 === 0 && latest.confirmedCounts.length > 0;
      setResumeNotice(latest.confirmedCounts.length > 0);
    } catch (error) {
      dispatch({ type: 'confirm-fail', code: toAppError(error).code });
    }
  };

  const mothersDone = Math.floor(state.confirmed.length / 4);
  const collecting = state.phase === 'collecting';

  return (
    <div className="dots">
      <p className="cast-progress" aria-live="off">
        <strong>{L(`${T.mother(motherIndex)}／第${T.ORDINAL[rowInMother]}列`, `${T.mother(motherIndex)}, row ${rowInMother + 1}`)}</strong>
        <span className="muted">{L(`（${T.ROW_ELEMENT[rowInMother]}行・全部第 ${Math.min(16, rowNumber)}／16 列）`, ` (${T.ROW_ELEMENT[rowInMother]} line · row ${Math.min(16, rowNumber)} of 16)`)}</span>
      </p>
      <ol className="row-progress" aria-label={L(`已完成 ${state.confirmed.length} 列，共 16 列`, `${state.confirmed.length} of 16 rows done`)}>
        {Array.from({ length: 16 }, (_, i) => {
          const done = state.confirmed[i];
          return (
            <li key={i} className={`${done !== undefined ? 'is-done' : ''}${i === state.confirmed.length ? ' is-current' : ''}${i % 4 === 3 ? ' ends-mother' : ''}`}>
              <span aria-hidden="true">{done === undefined ? '' : done % 2 === 1 ? '•' : '••'}</span>
              <span className="sr-only">{L(`第 ${i + 1} 列：`, `Row ${i + 1}: `)}{done === undefined ? (i === state.confirmed.length ? L('進行中', 'in progress') : L('未開始', 'not started')) : T.dotWord(done % 2)}</span>
            </li>
          );
        })}
      </ol>

      {resumeNotice && <p className="notice" role="status">{L(`已保留前 ${state.confirmed.length} 列；未確認的一列請重新點沙。`, `The first ${state.confirmed.length} rows were kept. Tap the unconfirmed row again.`)}</p>}

      {state.phase === 'mother-review' ? (
        <section className="card mother-review" aria-label={L('母象回顧', 'Mother review')}>
          <h2>{L(`${T.mother(mothersDone - 1)}完成`, `${T.mother(mothersDone - 1)} complete`)}</h2>
          <FigureGlyph figure={motherFigure(state.confirmed, mothersDone - 1)} size={64} />
          <p><strong>{T.fullName(figureOf(motherFigure(state.confirmed, mothersDone - 1)))}</strong></p>
          <p className="muted">{L('這四列的奇偶組成一個母象。已確認的列不能修改。', 'The odd or even of these four rows makes one Mother. Confirmed rows cannot be changed.')}</p>
          <button type="button" className="primary" onClick={continueAfterMother}>{L(`繼續${T.mother(mothersDone)}`, `Continue to the ${T.mother(mothersDone)}`)}</button>
        </section>
      ) : (
        <>
          <p id="tray-help" className="hint">{L('在沙面上隨意點幾下，不用刻意計數；準備好後按「完成這列」。', 'Tap the sand a few times at random; no need to count. When ready, press "Finish this row".')}</p>
          <div ref={tray} className={`sand-tray${collecting ? '' : ' is-locked'}`} aria-describedby="tray-help"
            onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
            onPointerCancel={onPointerAbort} onLostPointerCapture={onPointerAbort}
            onContextMenu={event => event.preventDefault()}>
            <SandCanvas ref={canvas} reducedMotion={reducedMotion} />
            {state.phase === 'reveal' && lastRow && (
              <div className="tray-overlay">
                <p>{L(`第 ${lastRow.row} 列：${lastRow.count} 點，${T.parity(lastRow.count)} → ${T.dotWord(lastRow.count % 2)}`, `Row ${lastRow.row}: ${lastRow.count} dots, ${T.parity(lastRow.count)} → ${T.dotWord(lastRow.count % 2)}`)}</p>
                <button type="button" className="link-button" onClick={finishReveal}>{L('略過', 'Skip')}</button>
              </div>
            )}
            {state.phase === 'saving' && <div className="tray-overlay"><p>{L('正在保存這一列…', 'Saving this row…')}</p></div>}
          </div>
          <p className="hint" role="status">{hint}</p>
          {state.capped && <p className="notice" role="alert">{L(`本列已達 ${ROW_MAX_DOTS} 點的操作上限。請完成這列，或清空後重新點。`, `This row has reached the limit of ${ROW_MAX_DOTS} dots. Finish the row, or clear it and tap again.`)}</p>}
          {state.error && (
            <div className="notice is-error" role="alert">
              <p>{state.error === 'REVISION_CONFLICT'
                ? L('另一個分頁已更新這筆草稿。這一列尚未保存。', 'Another tab has updated this draft. This row is not saved.')
                : L(`這一列尚未保存，點數仍保留。${T.error(state.error)}`, `This row is not saved; its dots are kept. ${T.error(state.error)}`)}</p>
              {state.error === 'REVISION_CONFLICT'
                ? <button type="button" onClick={reloadLatest}>{L('重新載入最新草稿', 'Load the latest draft')}</button>
                : <button type="button" onClick={confirmRow}>{L('用同樣的點數重試', 'Retry with the same dots')}</button>}
            </div>
          )}
          {lastRow && collecting && (
            <p className="muted">{L(`上一列（第 ${lastRow.row} 列）：${lastRow.count} 點 → ${T.dotWord(lastRow.count % 2)}`, `Previous row (row ${lastRow.row}): ${lastRow.count} dots → ${T.dotWord(lastRow.count % 2)}`)}</p>
          )}
          <div className="action-bar">
            <button type="button" disabled={!collecting}
              onKeyDown={event => { if (event.repeat) event.preventDefault(); }}
              onClick={() => addDot(() => canvas.current?.addMarkAuto())}>{L('加入一點', 'Add a dot')}</button>
            <button type="button" disabled={!collecting || state.count === 0} onClick={clearRow}>{L('清空本列', 'Clear this row')}</button>
            <button type="button" className="primary" disabled={!canConfirm(state)} onClick={confirmRow}>{L('完成這列', 'Finish this row')}</button>
          </div>
          {collecting && state.count === 0 && <p className="hint">{L('先在沙面上點至少一下，才能完成這列。', 'Tap the sand at least once before finishing the row.')}</p>}
        </>
      )}

      {mothersDone > 0 && (
        <section aria-label={L('已完成的母象', 'Completed Mothers')} className="mothers-strip">
          {Array.from({ length: mothersDone }, (_, i) => (
            <figure key={i}>
              <FigureGlyph figure={motherFigure(state.confirmed, i)} size={28} />
              <figcaption>{T.mother(i)}</figcaption>
            </figure>
          ))}
        </section>
      )}

      <p className="sr-only" role="status" aria-live="polite">{announce}</p>

      <Dialog open={blocker.state === 'blocked'} title={L('這一列還沒確認', 'This row is not confirmed')} onClose={() => blocker.reset?.()}>
        <p>{L('離開後，已確認的列會保留，但這一列需要重新點沙。', 'If you leave, confirmed rows are kept but this row will need to be tapped again.')}</p>
        <div className="dialog-actions">
          <button type="button" className="primary" onClick={() => blocker.reset?.()}>{L('繼續點沙', 'Keep tapping')}</button>
          <button type="button" onClick={() => blocker.proceed?.()}>{L('放棄本列並離開', 'Drop this row and leave')}</button>
        </div>
      </Dialog>
    </div>
  );
}
