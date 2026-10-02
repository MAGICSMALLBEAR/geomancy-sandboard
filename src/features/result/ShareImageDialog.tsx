import { useEffect, useRef, useState } from 'react';
import type { Chart } from '../../domain/geomancy.ts';
import type { Question } from '../../domain/reading.ts';
import { Dialog } from '../../components/Dialog.tsx';
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
};

/** Drawn and downloaded on this device only (DECISIONS D25). */
export function ShareImageDialog({ open, onClose, chart, question, dateLabel, methodLabel, createdAt }: Props) {
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
        drawShareImage(canvas.current, buildShareContent({ chart, question, dateLabel, methodLabel }, includeQuestion));
        const blob = await canvasToPng(canvas.current);
        url = URL.createObjectURL(blob);
        if (alive) { setImage({ url, blob }); setFailed(false); } else URL.revokeObjectURL(url);
      } catch {
        if (alive) setFailed(true);
      }
    })();
    return () => { alive = false; if (url) URL.revokeObjectURL(url); };
  }, [open, includeQuestion, chart, question, dateLabel, methodLabel]);

  const download = () => {
    if (!image) return;
    const link = document.createElement('a');
    link.href = image.url;
    link.download = `geomancy-${createdAt.slice(0, 10)}.png`;
    document.body.append(link);
    link.click();
    link.remove();
  };

  return (
    <Dialog open={open} title="存成圖片" onClose={onClose}>
      <p>圖片在這台裝置上產生，不會上傳。內容包含盾盤、裁判與成事關係的結論。</p>
      <label className="check">
        <input type="checkbox" checked={includeQuestion} onChange={event => setIncludeQuestion(event.target.checked)} />
        在圖片中顯示問題文字（圖片容易被轉傳，預設不顯示）
      </label>
      {failed && <p className="notice is-error" role="alert">這個瀏覽器無法產生圖片。可以改用截圖，或匯出 JSON。</p>}
      {image && <img className="share-preview" src={image.url} width={SHARE_WIDTH} height={SHARE_HEIGHT}
        alt={`圖片預覽：盾盤、裁判與成事關係${includeQuestion ? '，含問題文字' : ''}`} />}
      <div className="dialog-actions">
        <button type="button" className="primary" disabled={!image} onClick={download}>下載 PNG</button>
        <button type="button" onClick={onClose}>取消</button>
      </div>
    </Dialog>
  );
}
