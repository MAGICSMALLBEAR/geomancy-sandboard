import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { Link, useBlocker } from 'react-router';
import { pressFigure } from '../../domain/geomancy.ts';
import { drawPressByte } from '../../domain/random.ts';
import type { Draft } from '../../domain/contracts.ts';
import { useApp } from '../../app/AppContext.tsx';
import { playTap } from '../../app/sound.ts';
import { buzzConfirm } from '../../app/haptics.ts';
import { toAppError, type AppErrorCode } from '../../infrastructure/errors.ts';
import { figureOf } from '../../content/labels.ts';
import { Dialog } from '../../components/Dialog.tsx';
import { FigureGlyph } from '../../components/FigureGlyph.tsx';

type Props = {
  draft: Draft;
  /** The fourth press is stored: hand the ready draft to the page, which finalises it. */
  onReady: (draft: Draft) => void;
  /** The draft no longer exists here (finished or discarded in another tab). */
  onGone: () => void;
};

/** How long a press must last before releasing it counts. It only gates the gesture; it never enters the draw. */
export const HOLD_MS = 1000;
const RING = 2 * Math.PI * 54;

type Phase = 'ready' | 'holding' | 'saving' | 'review';

/**
 * Four long presses (DECISIONS D28). Each completed press draws one device byte in the release handler,
 * keeps it until it is saved, and retries with the same byte: a failed save never draws again.
 */
export function PressCasting({ draft, onReady, onGone }: Props) {
  const { repo, settings, logEvent, L, T } = useApp();
  const [presses, setPresses] = useState<number[]>(draft.confirmedPresses ?? []);
  const [phase, setPhase] = useState<Phase>('ready');
  const [progress, setProgress] = useState(0);
  const [hint, setHint] = useState('');
  const [error, setError] = useState<AppErrorCode | null>(null);
  const [unsaved, setUnsaved] = useState(false);
  const [resumeNotice, setResumeNotice] = useState((draft.confirmedPresses ?? []).length > 0);
  const [announce, setAnnounce] = useState('');

  // Synchronous guards, set before any await.
  const hold = useRef<{ pointerId: number | 'key'; start: number } | null>(null);
  const busy = useRef(false);
  const pending = useRef<number | null>(null);
  const revision = useRef(draft.revision);
  const frame = useRef(0);

  const count = presses.length;

  const stopHold = () => {
    hold.current = null;
    cancelAnimationFrame(frame.current);
    setProgress(0);
    setPhase(p => (p === 'holding' ? 'ready' : p));
  };
  useEffect(() => {
    const onHidden = () => { if (document.hidden && hold.current) stopHold(); };
    document.addEventListener('visibilitychange', onHidden);
    return () => { document.removeEventListener('visibilitychange', onHidden); cancelAnimationFrame(frame.current); };
  }, []);

  const blocker = useBlocker(unsaved);
  useEffect(() => {
    if (!unsaved) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [unsaved]);

  const begin = (pointerId: number | 'key', time: number) => {
    if (busy.current || phase !== 'ready' || hold.current) return false;
    hold.current = { pointerId, start: time };
    setHint('');
    setPhase('holding');
    const tick = () => {
      if (!hold.current) return;
      const p = Math.min(1, (performance.now() - hold.current.start) / HOLD_MS);
      setProgress(p);
      if (p < 1) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return true;
  };

  const save = async () => {
    const byte = pending.current;
    if (byte === null) return;
    busy.current = true;
    setPhase('saving');
    setError(null);
    try {
      const next = await repo.confirmPress(draft.id, revision.current, byte);
      pending.current = null;
      setUnsaved(false);
      revision.current = next.revision;
      const saved = next.confirmedPresses ?? [];
      setPresses(saved);
      setResumeNotice(false);
      const f = figureOf(pressFigure(byte));
      setAnnounce(L(`第${T.ORDINAL[saved.length - 1]}次長按完成：${f.zh}。進度 ${saved.length}／4。`, `Press ${saved.length} done: ${T.name(f)}. ${saved.length} of 4.`));
      logEvent('row_confirmed', { method: 'press', rowIndex: saved.length });
      if (next.state === 'ready-to-finalize') { onReady(next); return; }
      setPhase('review');
    } catch (e) {
      const code = toAppError(e).code;
      setError(code);
      setPhase('ready');
      logEvent('error_shown', { errorCode: code });
    } finally {
      busy.current = false;
    }
  };

  const release = (pointerId: number | 'key', time: number, inside: boolean) => {
    const current = hold.current;
    if (!current || current.pointerId !== pointerId) return;
    const held = time - current.start;
    stopHold();
    if (!inside) { setHint(L('在圓圈裡放開才算：這次沒有算進去。', 'Release inside the circle: that one did not count.')); return; }
    if (held < HOLD_MS) { setHint(L('再按久一點：圓圈填滿後再放開。這次沒有算進去。', 'Hold a little longer and release once the circle is full. That one did not count.')); return; }
    if (pending.current === null) {
      try {
        pending.current = drawPressByte();
      } catch {
        setError('RNG_UNAVAILABLE');
        return;
      }
    }
    setUnsaved(true);
    if (settings.sound) playTap();
    if (settings.haptics) buzzConfirm();
    void save();
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!event.isPrimary || event.button !== 0) {
      // A second finger while holding cancels the press.
      if (hold.current) { stopHold(); setHint(L('一次用一指按住：這次沒有算進去。', 'Hold with one finger at a time: that one did not count.')); }
      return;
    }
    if (pending.current !== null || error === 'RNG_UNAVAILABLE') return;
    if (!begin(event.pointerId, performance.now())) return;
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* capture is best effort */ }
  };
  const onPointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const inside = event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
    release(event.pointerId, performance.now(), inside);
  };
  const onPointerAbort = (event: ReactPointerEvent) => {
    if (hold.current?.pointerId === event.pointerId) stopHold();
  };
  const onKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== ' ' && event.key !== 'Enter') return;
    event.preventDefault();
    if (event.repeat || pending.current !== null) return;
    begin('key', performance.now());
  };
  const onKeyUp = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== ' ' && event.key !== 'Enter') return;
    event.preventDefault();
    release('key', performance.now(), true);
  };

  const reloadLatest = async () => {
    try {
      const latest = await repo.loadDraft(draft.id);
      if (!latest) { onGone(); return; }
      pending.current = null;
      setUnsaved(false);
      if (latest.state === 'ready-to-finalize') { onReady(latest); return; }
      revision.current = latest.revision;
      setPresses(latest.confirmedPresses ?? []);
      setError(null);
      setPhase('ready');
    } catch (e) {
      setError(toAppError(e).code);
    }
  };

  if (error === 'RNG_UNAVAILABLE') {
    return (
      <div className="notice is-error" role="alert">
        <p>{T.error('RNG_UNAVAILABLE')}</p>
        <p>{L('請放棄這筆草稿，回到新增占問改選其他起卦方式。', 'Please discard this draft and choose another casting method on the new-question page.')}</p>
        <Link to="/new">{L('回到新增占問', 'Back to new question')}</Link>
      </div>
    );
  }

  const last = count > 0 ? pressFigure(presses[count - 1]) : null;
  const label = phase === 'saving' ? L('保存中…', 'Saving…')
    : phase === 'holding' ? (progress >= 1 ? L('放開', 'Release') : L('按住…', 'Hold…'))
    : L(`第${T.ORDINAL[Math.min(3, count)]}次`, `Press ${Math.min(3, count) + 1}`);

  return (
    <div className="press">
      <p className="cast-progress">
        <strong>{T.mother(Math.min(3, count))}</strong>
        <span className="muted">{L(`（已完成 ${count}／4 次長按）`, ` (${count} of 4 presses done)`)}</span>
      </p>
      {resumeNotice && <p className="notice" role="status">{L(`已保留前 ${count} 次長按，從第 ${count + 1} 次繼續。`, `The first ${count} presses were kept. Continue with press ${count + 1}.`)}</p>}

      {phase === 'review' && last ? (
        <section className="card mother-review" aria-label={L('母象回顧', 'Mother review')}>
          <h2>{L(`${T.mother(count - 1)}完成`, `${T.mother(count - 1)} complete`)}</h2>
          <FigureGlyph figure={last} size={64} />
          <p><strong>{T.fullName(figureOf(last))}</strong></p>
          <p className="muted">{L('已經保存，不能修改。', 'Saved; it cannot be changed.')}</p>
          <button type="button" className="primary" onClick={() => setPhase('ready')}>{L(`繼續第${T.ORDINAL[count]}次長按`, `Continue to press ${count + 1}`)}</button>
        </section>
      ) : (
        <>
          <p id="press-help" className="hint">{L('按住圓圈，等圓圈填滿後放開。放開的那一刻，裝置亂數決定這個母象；按多久不影響結果。鍵盤可按住空白鍵。', 'Press and hold the circle, and release once it is full. At the moment you release, device random decides this Mother; how long you hold does not affect it. On a keyboard, hold the space bar.')}</p>
          <div className="press-stage">
            <button type="button" className={`press-pad${phase === 'holding' ? ' is-holding' : ''}${progress >= 1 ? ' is-full' : ''}`}
              aria-describedby="press-help" disabled={phase === 'saving' || error !== null}
              onPointerDown={onPointerDown} onPointerUp={onPointerUp}
              onPointerCancel={onPointerAbort} onLostPointerCapture={onPointerAbort}
              onKeyDown={onKeyDown} onKeyUp={onKeyUp} onBlur={() => { if (hold.current?.pointerId === 'key') stopHold(); }}
              onContextMenu={event => event.preventDefault()}>
              <svg viewBox="0 0 120 120" aria-hidden="true">
                <circle className="press-track" cx="60" cy="60" r="54" />
                <circle className="press-ring" cx="60" cy="60" r="54"
                  style={{ strokeDasharray: RING, strokeDashoffset: RING * (1 - progress) }} />
              </svg>
              <span className="press-label">{label}</span>
              <span className="sr-only">{L(`長按起卦，第 ${count + 1} 次，共 4 次`, `Long-press cast, press ${count + 1} of 4`)}</span>
            </button>
          </div>
          <p className="hint" role="status">{hint}</p>
          {error && (
            <div className="notice is-error" role="alert">
              <p>{error === 'REVISION_CONFLICT'
                ? L('另一個分頁已更新這筆草稿。這一次長按尚未保存。', 'Another tab has updated this draft. This press is not saved.')
                : L(`這一次長按的結果已固定但尚未保存。${T.error(error)}`, `The result of this press is fixed but not saved. ${T.error(error)}`)}</p>
              {error === 'REVISION_CONFLICT'
                ? <button type="button" onClick={() => void reloadLatest()}>{L('重新載入最新草稿', 'Load the latest draft')}</button>
                : <button type="button" onClick={() => void save()}>{L('用同一個結果重試保存', 'Retry saving the same result')}</button>}
            </div>
          )}
        </>
      )}

      {count > 0 && (
        <section aria-label={L('已完成的母象', 'Completed Mothers')} className="mothers-strip">
          {presses.map((byte, i) => (
            <figure key={i}>
              <FigureGlyph figure={pressFigure(byte)} size={28} />
              <figcaption>{T.mother(i)}</figcaption>
            </figure>
          ))}
        </section>
      )}

      <p className="sr-only" role="status" aria-live="polite">{announce}</p>

      <Dialog open={blocker.state === 'blocked'} title={L('這一次長按還沒保存', 'This press is not saved')} onClose={() => blocker.reset?.()}>
        <p>{L('離開後，已保存的長按會保留，但這一次的結果會放棄，回來時要重新長按。', 'If you leave, saved presses are kept but this result is dropped; you will press again when you come back.')}</p>
        <div className="dialog-actions">
          <button type="button" className="primary" onClick={() => blocker.reset?.()}>{L('留下來重試保存', 'Stay and retry saving')}</button>
          <button type="button" onClick={() => blocker.proceed?.()}>{L('放棄這一次並離開', 'Drop this press and leave')}</button>
        </div>
      </Dialog>
    </div>
  );
}
