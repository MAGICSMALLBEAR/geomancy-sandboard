/** Share a chart as a link (DECISIONS D40). The question goes into the link only when ticked. */
import { useRef, useState } from 'react';
import type { Mothers, RuleVersion } from '../../domain/geomancy.ts';
import type { Question } from '../../domain/reading.ts';
import { buildShareUrl } from '../../infrastructure/shareLink.ts';
import { Dialog } from '../../components/Dialog.tsx';
import { useApp } from '../../app/AppContext.tsx';

type Props = { open: boolean; onClose: () => void; mothers: Mothers; question: Question; rule: RuleVersion };

export function ShareLinkDialog({ open, onClose, mothers, question, rule }: Props) {
  const { L } = useApp();
  const [includeQuestion, setIncludeQuestion] = useState(false);
  const [copied, setCopied] = useState<'idle' | 'copied' | 'failed'>('idle');
  const field = useRef<HTMLInputElement>(null);
  const url = buildShareUrl(window.location, mothers, question, includeQuestion, rule);
  const canShare = typeof navigator.share === 'function';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied('copied');
    } catch {
      // Clipboard refused: select the text so the user can copy it by hand.
      field.current?.select();
      setCopied('failed');
    }
  };
  const share = async () => {
    try {
      await navigator.share({ url });
    } catch {
      // Closing the share sheet is not an error; the link is still on screen.
    }
  };

  return (
    <Dialog open={open} title={L('分享連結', 'Share link')} onClose={onClose}>
      <p>{L('拿到連結的人會看到同一張盤面與解讀。連結裡只有四個母象、問題範圍與宮位配置，不含筆記、回顧與日期，也不會存進對方的日誌。',
        'Anyone with the link sees the same chart and reading. The link holds only the four Mothers, the question scope and the house rule: no notes, follow-ups or dates, and it is not saved to their journal.')}</p>
      <label className="check">
        <input type="checkbox" checked={includeQuestion} onChange={event => { setIncludeQuestion(event.target.checked); setCopied('idle'); }} />
        {L('在連結中加入問題文字', 'Include the question text in the link')}
      </label>
      {includeQuestion && <p className="notice">{L('問題文字會直接寫在網址裡：任何拿到連結的人都看得到，也可能留在瀏覽紀錄、聊天記錄或連結預覽中。', 'The question text goes straight into the address: anyone with the link can see it, and it may stay in browser history, chat logs or link previews.')}</p>}
      <label htmlFor="share-link-url">{L('連結', 'Link')}</label>
      <input id="share-link-url" ref={field} type="text" readOnly value={url} onFocus={event => event.target.select()} />
      <div className="dialog-actions">
        <button type="button" className="primary" onClick={() => void copy()}>{L('複製連結', 'Copy link')}</button>
        {canShare && <button type="button" onClick={() => void share()}>{L('分享…', 'Share…')}</button>}
        <button type="button" onClick={onClose}>{L('關閉', 'Close')}</button>
      </div>
      <div role="status">
        {copied === 'copied' && <p className="notice is-ok">{L('已複製。', 'Copied.')}</p>}
        {copied === 'failed' && <p className="notice">{L('無法自動複製，連結已選取，請手動複製。', 'Could not copy automatically. The link is selected; copy it by hand.')}</p>}
      </div>
    </Dialog>
  );
}
