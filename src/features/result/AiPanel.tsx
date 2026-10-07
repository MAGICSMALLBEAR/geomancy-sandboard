/** AI retelling with the user's own key (DECISIONS D42). Sends only after a preview and an explicit click. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import type { ReadingRecord } from '../../domain/contracts.ts';
import type { NodeId } from '../../domain/geomancy.ts';
import { useApp } from '../../app/AppContext.tsx';
import { setBusy } from '../../app/pwa.ts';
import { requestAiReading, type AiFailure } from '../../app/aiClient.ts';
import { AI_PROMPT_VERSION_EN, buildAiPayload, checkParagraph, estimateCostUsd } from '../../infrastructure/ai.ts';
import { toAppError, type AppErrorCode } from '../../infrastructure/errors.ts';
import { figureOf } from '../../content/labels.ts';
import { Dialog } from '../../components/Dialog.tsx';

const FAILURE_TEXT: Record<AiFailure, readonly [string, string]> = {
  offline: ['目前沒有網路。AI 解讀需要連線，其他功能照常可用。', 'You are offline. AI retelling needs a connection; everything else still works.'],
  auth: ['API 金鑰無效或已撤銷。請到設定重新輸入。', 'The API key is invalid or revoked. Enter it again in Settings.'],
  permission: ['這把金鑰沒有使用這個模型的權限。', 'This key is not allowed to use this model.'],
  'rate-limit': ['請求太頻繁或已達用量上限，請稍後再試，或到 Anthropic Console 檢查額度。', 'Too many requests, or a usage limit was reached. Try again later, or check your limits in the Anthropic Console.'],
  overloaded: ['AI 服務暫時忙碌，請稍後再試。', 'The AI service is busy. Try again later.'],
  'bad-request': ['AI 服務拒絕了這個請求。', 'The AI service rejected this request.'],
  refusal: ['AI 這次婉拒回答。可以改寫問題，或不附上問題文字再試一次。', 'The AI declined this time. Rephrase the question, or try again without the question text.'],
  truncated: ['AI 的回覆太長被截斷，沒有保存。請再試一次。', 'The reply was too long and got cut off; nothing was saved. Please try again.'],
  'invalid-output': ['AI 的回覆格式不正確，沒有保存。請再試一次。', 'The reply was not in the expected format; nothing was saved. Please try again.'],
  cancelled: ['已取消，沒有保存。', 'Cancelled; nothing was saved.'],
  network: ['連不上 AI 服務，請檢查網路後再試。', 'Could not reach the AI service. Check your connection and try again.'],
  unknown: ['AI 解讀失敗，沒有保存。', 'The AI retelling failed; nothing was saved.'],
};

type State =
  | { kind: 'idle' } | { kind: 'working' }
  | { kind: 'failed'; failure: AiFailure; detail?: string }
  | { kind: 'save-error'; code: AppErrorCode };

export function AiPanel({ record, onSaved, onShowNode }: { record: ReadingRecord; onSaved: (record: ReadingRecord) => void; onShowNode?: (node: NodeId) => void }) {
  const { repo, settings, lang, L, T } = useApp();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [sendQuestion, setSendQuestion] = useState(false);
  const [state, setState] = useState<State>({ kind: 'idle' });
  const abort = useRef<AbortController | null>(null);
  const input = useMemo(() => ({ chart: record.chart, question: record.question, reading: record.reading, rule: record.ruleVersion }), [record]);
  // A new retelling is written in the current interface language.
  const payload = useMemo(() => buildAiPayload(input, sendQuestion, lang), [input, sendQuestion, lang]);

  useEffect(() => {
    setBusy('ai', state.kind === 'working');
    return () => setBusy('ai', false);
  }, [state.kind]);
  useEffect(() => () => abort.current?.abort(), []);

  const run = async () => {
    setPreviewOpen(false);
    setState({ kind: 'working' });
    const controller = new AbortController();
    abort.current = controller;
    const result = await requestAiReading({ apiKey: settings.aiKey, model: settings.aiModel, payload, signal: controller.signal, lang });
    abort.current = null;
    if (!result.ok) { setState({ kind: 'failed', failure: result.failure, detail: result.detail }); return; }
    try {
      const latest = await repo.getReading(record.id);
      if (!latest) { setState({ kind: 'save-error', code: 'NOT_FOUND' }); return; }
      const next = await repo.saveAi(record.id, latest.revision,
        { ...result.reading, sentQuestion: sendQuestion, recordedAt: new Date().toISOString() });
      onSaved(next);
      setState({ kind: 'idle' });
    } catch (error) {
      setState({ kind: 'save-error', code: toAppError(error).code });
    }
  };
  const remove = async () => {
    try {
      const latest = await repo.getReading(record.id);
      if (!latest) return;
      onSaved(await repo.saveAi(record.id, latest.revision, null));
    } catch (error) {
      setState({ kind: 'save-error', code: toAppError(error).code });
    }
  };

  const ai = record.ai;
  const cost = ai ? estimateCostUsd(ai.model, ai.usage) : null;
  // A saved retelling is checked in the language it was written in, whatever the interface shows now.
  const aiLang = ai?.promptVersion === AI_PROMPT_VERSION_EN ? 'en' : 'zh-TW';
  return (
    <section className="card ai-panel" aria-labelledby="ai-title">
      <h3 id="ai-title">{L('AI 轉述', 'AI retelling')}<span className="tag">{L('選用', 'optional')}</span></h3>
      {!settings.aiKey && !ai && (
        <p className="muted">{L('可以請 AI 把這張盤的計算結果串成一段說明。需要你自己的 Anthropic API 金鑰，費用由你的帳戶支付。', "AI can weave this chart's computed results into one explanation. It needs your own Anthropic API key, and your account pays. ")}
          <Link to="/settings">{L('到設定開啟', 'Turn it on in Settings')}</Link></p>
      )}

      {ai && (
        <div className="ai-result">
          <p className="notice">{L(`以下由 AI（${ai.model}）依這張盤的計算結果改寫，可能出錯，也不是預測。每段後面列出它引用的盤位，與盤面不符的地方會標出來。`,
            `Rewritten by AI (${ai.model}) from this chart's computed results. It can be wrong, and it is not a prediction. Each paragraph lists the positions it relies on; anything that does not match the chart is marked.`)}</p>
          {ai.paragraphs.map((p, i) => {
            const problems = checkParagraph(p, record.chart, record.ruleVersion, aiLang);
            return (
              <article key={i} className={`ai-paragraph${problems.length ? ' has-problem' : ''}`}>
                {p.heading && <h4>{p.heading}</h4>}
                <p>{p.text}</p>
                <p className="muted ai-cites">{L('引用：', 'Cites: ')}{p.cites.length === 0 ? L('（沒有標出）', '(none given)') : p.cites.map((node, j) => {
                  const cite = L(`${T.NODE_LABEL[node]}「${figureOf(record.chart[node]).zh}」`, `${T.NODE_LABEL[node]} (${T.name(figureOf(record.chart[node]))})`);
                  return <span key={node}>{j > 0 && L('、', ', ')}
                    {onShowNode
                      ? <button type="button" className="link-button" onClick={() => onShowNode(node)}>{cite}</button>
                      : cite}
                  </span>;
                })}</p>
                {problems.length > 0 && <p className="notice is-error">{L('查核未通過：', 'Check failed: ')}{problems.join(' ')}</p>}
              </article>
            );
          })}
          <p className="muted">{L(`產生於 ${T.formatDate(ai.recordedAt)}・${ai.sentQuestion ? '有附上問題文字' : '沒有附上問題文字'}・輸入 ${ai.usage.inputTokens.toLocaleString()}、輸出 ${ai.usage.outputTokens.toLocaleString()} tokens`,
            `Made ${T.formatDate(ai.recordedAt)} · ${ai.sentQuestion ? 'question text included' : 'question text not included'} · ${ai.usage.inputTokens.toLocaleString()} input, ${ai.usage.outputTokens.toLocaleString()} output tokens`)}
            {cost !== null && L(`（約 US$${cost.toFixed(3)}）`, ` (about US$${cost.toFixed(3)})`)}</p>
        </div>
      )}

      {settings.aiKey && (
        <div className="dialog-actions">
          <button type="button" className={ai ? undefined : 'primary'} disabled={state.kind === 'working'} onClick={() => setPreviewOpen(true)}>
            {ai ? L('重新產生…', 'Make a new one…') : L('請 AI 轉述這張盤…', 'Ask AI to retell this chart…')}</button>
          {ai && <button type="button" className="danger" disabled={state.kind === 'working'} onClick={() => void remove()}>{L('刪除 AI 轉述', 'Delete AI retelling')}</button>}
        </div>
      )}
      {!settings.aiKey && ai && <p className="muted">{L('要重新產生，請先到', 'To make a new one, first enter an API key in ')}<Link to="/settings">{L('設定', 'Settings')}</Link>{L('輸入 API 金鑰。', '.')}</p>}

      <div role="status">
        {state.kind === 'working' && (
          <p className="notice">{L('AI 正在閱讀這張盤，通常需要半分鐘到一分鐘…', 'AI is reading this chart; this usually takes half a minute to a minute… ')}
            <button type="button" onClick={() => abort.current?.abort()}>{L('取消', 'Cancel')}</button></p>
        )}
      </div>
      {state.kind === 'failed' && <p className="notice is-error" role="alert">{L(...FAILURE_TEXT[state.failure])}{state.detail ? L(`（${state.detail}）`, ` (${state.detail})`) : ''}</p>}
      {state.kind === 'save-error' && <p className="notice is-error" role="alert">{L('AI 已回覆，但沒有存進記錄。', 'The AI replied, but it was not saved to the record. ')}{T.error(state.code)}</p>}

      <Dialog open={previewOpen} title={L('送出前確認', 'Confirm before sending')} onClose={() => setPreviewOpen(false)}>
        <p>{L(`會用你的 API 金鑰，把下面的資料直接送到 Anthropic 的 Claude API（模型：${settings.aiModel}）。不會送出筆記、回顧、預計行動或記錄 ID。`,
          `Your API key will be used to send the data below straight to Anthropic's Claude API (model: ${settings.aiModel}). Notes, follow-ups, plans and record IDs are never sent.`)}
          {ai && L(' 新的回覆會取代目前這一份。', ' The new reply will replace the current one.')}</p>
        <label className="check">
          <input type="checkbox" checked={sendQuestion} onChange={event => setSendQuestion(event.target.checked)} />
          {L('一併送出問題文字（預設不送；送出後 AI 能貼近你的問題來寫）', 'Also send the question text (off by default; with it, the AI can write closer to your question)')}
        </label>
        <details>
          <summary>{L('查看要送出的完整資料', 'See the full data to be sent')}</summary>
          <pre className="raw ai-preview">{JSON.stringify(payload, null, 2)}</pre>
        </details>
        <div className="dialog-actions">
          <button type="button" className="primary" onClick={() => void run()}>{L('送出', 'Send')}</button>
          <button type="button" onClick={() => setPreviewOpen(false)}>{L('取消', 'Cancel')}</button>
        </div>
      </Dialog>
    </section>
  );
}
