import { useEffect, useMemo, useRef, useState } from 'react';
import type { Chart, RuleVersion } from '../../domain/geomancy.ts';
import type { Question } from '../../domain/reading.ts';
import { Dialog } from '../../components/Dialog.tsx';
import { useApp } from '../../app/AppContext.tsx';
import { buildShareContent, canvasToPng, drawShareImage, SHARE_HEIGHT, SHARE_WIDTH } from './shareImage.ts';

type Props = {
  open: boolean;
  onClose: () => void;
  chart: Chart;
  question: Question;
  dateLabel: string;
  methodLabel: string;
  /** For the file name only. */
  createdAt: string;
  rule?: RuleVersion;
};

/** Drawn and downloaded on this device only (DECISIONS D25). */
export function ShareImageDialog({ open, onClose, chart, question, dateLabel, methodLabel, createdAt, rule }: Props) {
  const { lang, L } = useApp();
  const [includeQuestion, setIncludeQuestion] = useState(false);
  const [image, setImage] = useState<{ url: string; blob: Blob } | null>(null);
  const [failed, setFailed] = useState(false);
  const canvas = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!open) return;
    let alive = true, url = '';
    (async () => {
      try {
        canvas.current ??= document.createElement('canvas');
        drawShareImage(canvas.current, buildShareContent({ chart, question, dateLabel, methodLabel, rule, lang }, includeQuestion));
        const blob = await canvasToPng(canvas.current);
        url = URL.createObjectURL(blob);
        if (alive) { setImage({ url, blob }); setFailed(false); } else URL.revokeObjectURL(url);
      } catch {
        if (alive) setFailed(true);
      }
    })();
    return () => { alive = false; if (url) URL.revokeObjectURL(url); };
  }, [open, includeQuestion, chart, question, dateLabel, methodLabel, rule, lang]);

  const [shareFailed, setShareFailed] = useState(false);
  const fileName = `geomancy-${createdAt.slice(0, 10)}.png`;
  const file = useMemo(() => image ? new File([image.blob], fileName, { type: 'image/png' }) : null, [image, fileName]);
  // Only browsers that can share files (mostly phones) get the button; desktop keeps the download.
  const canShare = file !== null && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] });
  const share = async () => {
    if (!file) return;
    setShareFailed(false);
    try {
      await navigator.share({ files: [file] });
    } catch (error) {
      // Closing the share sheet is a choice, not a failure.
      if (!(error instanceof DOMException && error.name === 'AbortError')) setShareFailed(true);
    }
  };

  const download = () => {
    if (!image) return;
    const link = document.createElement('a');
    link.href = image.url;
    link.download = fileName;
    document.body.append(link);
    link.click();
    link.remove();
  };

  return (
    <Dialog open={open} title={L('存成圖片', 'Save as image')} onClose={onClose}>
      <p>{L('圖片在這台裝置上產生，不會上傳。內容包含盾盤、裁判與成事關係的結論。', 'The image is made on this device and never uploaded. It shows the shield, the Judge and the perfection result. ')}{canShare && L('按「分享」會打開裝置的分享選單，由你選擇要傳給誰。', 'Share opens your device\'s share menu, where you choose who gets it.')}</p>
      <label className="check">
        <input type="checkbox" checked={includeQuestion} onChange={event => setIncludeQuestion(event.target.checked)} />
        {L('在圖片中顯示問題文字（圖片容易被轉傳，預設不顯示）', 'Show the question text on the image (images get passed around easily, so it is off by default)')}
      </label>
      {failed && <p className="notice is-error" role="alert">{L('這個瀏覽器無法產生圖片。可以改用截圖，或匯出 JSON。', 'This browser cannot make the image. Take a screenshot or export JSON instead.')}</p>}
      {shareFailed && <p className="notice is-error" role="alert">{L('無法開啟分享選單。可以改按「下載 PNG」。', 'Could not open the share menu. Use "Download PNG" instead.')}</p>}
      {image && <img className="share-preview" src={image.url} width={SHARE_WIDTH} height={SHARE_HEIGHT}
        alt={L(`圖片預覽：盾盤、裁判與成事關係${includeQuestion ? '，含問題文字' : ''}`, `Image preview: shield, Judge and perfection${includeQuestion ? ', with the question text' : ''}`)} />}
      <div className="dialog-actions">
        {canShare && <button type="button" className="primary" onClick={() => void share()}>{L('分享…', 'Share…')}</button>}
        <button type="button" className={canShare ? undefined : 'primary'} disabled={!image} onClick={download}>{L('下載 PNG', 'Download PNG')}</button>
        <button type="button" onClick={onClose}>{L('取消', 'Cancel')}</button>
      </div>
    </Dialog>
  );
}
