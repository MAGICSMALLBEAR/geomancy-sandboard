import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router';
import type { CastSource } from '../../domain/geomancy.ts';
import type { Draft } from '../../domain/contracts.ts';
import { useApp } from '../../app/AppContext.tsx';
import { setBusy } from '../../app/pwa.ts';
import { toAppError, type AppErrorCode } from '../../infrastructure/errors.ts';
import { Dialog } from '../../components/Dialog.tsx';
import { DotsCasting } from './DotsCasting.tsx';
import { QuickCasting } from './QuickCasting.tsx';
import { AutoCasting, AutoSandShow } from './AutoCasting.tsx';
import { ManualCasting } from './ManualCasting.tsx';
import { PressCasting } from './PressCasting.tsx';
import { clearPending, completeCast, keepAsPending } from './pending.ts';

type Load =
  | { status: 'loading' } | { status: 'missing' } | { status: 'discarded' }
  | { status: 'error'; code: AppErrorCode }
  | { status: 'ready'; draft: Draft };
type Final =
  | { status: 'idle' } | { status: 'working' }
  | { status: 'failed'; code: AppErrorCode; draft: Draft; source: CastSource | null };

export function CastPage() {
  const { id = '' } = useParams();
  const { repo, logEvent, L, T } = useApp();
  const navigate = useNavigate();
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [final, setFinal] = useState<Final>({ status: 'idle' });
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  /** Automatic sand, already saved: its playback runs before the result opens. */
  const [playback, setPlayback] = useState<readonly number[] | null>(null);
  const finalizing = useRef(false);

  useEffect(() => {
    setBusy('cast', true);
    return () => setBusy('cast', false);
  }, []);

  /** Saves the locked source and creates the record under the draft's ID. A retry reuses the same input. */
  const finalize = useCallback(async (draft: Draft, source: CastSource | null, playBack = false) => {
    if (finalizing.current) return;
    finalizing.current = true;
    setFinal({ status: 'working' });
    try {
      const record = await completeCast(repo, draft, source);
      clearPending(draft.id);
      logEvent('chart_completed', { method: draft.method });
      // Best effort only; the result is never treated as a guarantee.
      void navigator.storage?.persist?.().catch(() => undefined);
      if (playBack && record.source.kind === 'auto') { setFinal({ status: 'idle' }); setPlayback(record.source.counts); }
      else navigate(`/result/${draft.id}`, { replace: true, state: { animate: true } });
    } catch (error) {
      const code = toAppError(error).code;
      setFinal({ status: 'failed', code, draft, source });
      logEvent('error_shown', { errorCode: code });
    } finally {
      finalizing.current = false;
    }
  }, [repo, logEvent, navigate]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (await repo.getReading(id)) { if (alive) navigate(`/result/${id}`, { replace: true }); return; }
        const draft = await repo.loadDraft(id);
        if (!alive) return;
        if (!draft) { setLoad({ status: 'missing' }); return; }
        setLoad({ status: 'ready', draft });
        // Row 16 (or the quick/manual source) was already stored: finish with that exact input.
        if (draft.state === 'ready-to-finalize') void finalize(draft, null);
      } catch (error) {
        if (alive) setLoad({ status: 'error', code: toAppError(error).code });
      }
    })();
    return () => { alive = false; };
  }, [id, repo, navigate, finalize]);

  if (load.status === 'loading') return <p role="status">{L('載入中…', 'Loading…')}</p>;
  if (load.status === 'discarded') return <Navigate to="/new" replace />;
  if (load.status === 'error') {
    return <div className="notice is-error" role="alert"><p>{L('無法讀取草稿。', 'Could not read the draft. ')}{T.error(load.code)}</p><Link to="/">{L('回首頁', 'Back to home')}</Link></div>;
  }
  if (load.status === 'missing') {
    return (
      <div className="card">
        <h1>{L('找不到這筆進行中的占問', 'This question in progress was not found')}</h1>
        <p>{L('它可能已經完成、被放棄，或不在這個瀏覽器裡。', 'It may have been finished or discarded, or it is not in this browser.')}</p>
        <p><Link to="/journal">{L('查看日誌', 'Open the journal')}</Link>　<Link to="/new">{L('新增占問', 'New question')}</Link></p>
      </div>
    );
  }

  const { draft } = load;
  const discard = async () => {
    try {
      await repo.discardDraft(draft.id);
      setConfirmDiscard(false);
      setLoad({ status: 'discarded' });
    } catch (error) {
      setConfirmDiscard(false);
      setLoad({ status: 'error', code: toAppError(error).code });
    }
  };

  let body;
  if (playback) {
    body = <AutoSandShow counts={playback} onDone={() => navigate(`/result/${draft.id}`, { replace: true, state: { animate: true } })} />;
  } else if (final.status === 'working') {
    body = <p role="status" className="card">{L('正在保存並排盤…', 'Saving and building the chart…')}</p>;
  } else if (final.status === 'failed') {
    const { code, source } = final;
    body = (
      <div className="notice is-error" role="alert">
        <h2>{L('尚未保存', 'Not saved yet')}</h2>
        <p>{T.error(code)}{L('這一盤的輸入已固定，重試會使用同一份輸入，不會重新取數。', ' The input for this chart is fixed: retrying uses the same input and draws nothing new.')}</p>
        <div className="dialog-actions">
          <button type="button" className="primary" onClick={() => void finalize(final.draft, source, final.draft.method === 'auto')}>{L('重試保存', 'Retry saving')}</button>
          <button type="button" onClick={() => {
            try {
              keepAsPending(final.draft, source);
              navigate(`/result/${draft.id}`, { replace: true });
            } catch (error) {
              setFinal({ ...final, code: toAppError(error).code });
            }
          }}>{L('先看暫存結果（未保存）', 'See the unsaved result for now')}</button>
        </div>
      </div>
    );
  } else if (draft.method === 'dots') {
    body = <DotsCasting draft={draft} onReady={ready => void finalize(ready, null)} onGone={() => setLoad({ status: 'missing' })} />;
  } else if (draft.method === 'press') {
    body = <PressCasting draft={draft} onReady={ready => void finalize(ready, null)} onGone={() => setLoad({ status: 'missing' })} />;
  } else if (draft.method === 'auto') {
    body = <AutoCasting onSource={source => void finalize(draft, source, true)} />;
  } else if (draft.method === 'quick') {
    body = <QuickCasting onSource={source => void finalize(draft, source)} />;
  } else {
    body = <ManualCasting onSource={source => void finalize(draft, source)} />;
  }

  return (
    <div className="cast">
      <header className="cast-head">
        <p className="eyebrow">{T.METHOD_LABEL[draft.method]}</p>
        <h1 className="question-text">{draft.question.text}</h1>
        {!playback && (
          <p className="cast-links">
            <Link to="/">{L('暫停，回首頁', 'Pause and go home')}</Link>
            <button type="button" className="link-button" onClick={() => setConfirmDiscard(true)}>{L('放棄這筆草稿', 'Discard this draft')}</button>
          </p>
        )}
      </header>
      {body}
      <Dialog open={confirmDiscard} title={L('放棄這筆草稿？', 'Discard this draft?')} onClose={() => setConfirmDiscard(false)}>
        <p>{L('已確認的列與這個問題都會刪除，無法復原。', 'The confirmed rows and this question will be deleted. This cannot be undone.')}</p>
        <div className="dialog-actions">
          <button type="button" className="primary" onClick={() => setConfirmDiscard(false)}>{L('保留草稿', 'Keep the draft')}</button>
          <button type="button" className="danger" onClick={() => void discard()}>{L('放棄草稿', 'Discard the draft')}</button>
        </div>
      </Dialog>
    </div>
  );
}
