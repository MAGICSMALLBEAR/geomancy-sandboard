import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import type { Bit, CastSource, Figure } from '../../domain/geomancy.ts';
import { drawAutoSource } from '../../domain/random.ts';
import { useApp } from '../../app/AppContext.tsx';
import { ERROR_TEXT } from '../../infrastructure/errors.ts';
import { ORDINAL, ROW_ELEMENT, dotWord, figureOf } from '../../content/labels.ts';
import { FigureGlyph } from '../../components/FigureGlyph.tsx';
import { REDUCE_MS, SandCanvas, type SandCanvasHandle } from './SandCanvas.tsx';

/**
 * The automatic method reaches the device RNG here, once, from the button's click handler.
 * The page saves the source before AutoSandShow plays it back.
 */
export function AutoCasting({ onSource }: { onSource: (source: CastSource) => void }) {
  const locked = useRef(false);
  const [started, setStarted] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  const cast = () => {
    if (locked.current) return;
    locked.current = true;
    let source: CastSource;
    try {
      source = drawAutoSource();
    } catch {
      setUnavailable(true);
      return;
    }
    setStarted(true);
    onSource(source);
  };

  if (unavailable) {
    return (
      <div className="notice is-error" role="alert">
        <p>{ERROR_TEXT.RNG_UNAVAILABLE}</p>
        <p>請放棄這筆草稿，回到新增占問改選其他起卦方式。</p>
        <Link to="/new">回到新增占問</Link>
      </div>
    );
  }
  return (
    <section className="card quick">
      <h2>自動點沙</h2>
      <p>不用自己點：按一次按鈕，裝置亂數會決定十六列各落下幾粒沙（每列 5–20 粒），
        接著你會看到沙子自動落下，每列依奇偶化約成一點或兩點，每四列組成一個母象。</p>
      <p className="muted">每列的粒數在按下的瞬間就固定並保存；動畫只是把它播出來，可以略過，重新整理也不會換一盤。</p>
      <button type="button" className="primary big" disabled={started} onClick={cast}>
        {started ? '正在保存…' : '開始自動點沙'}
      </button>
    </section>
  );
}

const DROP_MS = 45;
const ROW_PAUSE_MS = 250;
const MOTHER_PAUSE_MS = 700;

const motherFigure = (counts: readonly number[], index: number): Figure =>
  counts.slice(index * 4, index * 4 + 4).map(n => (n % 2) as Bit) as unknown as Figure;

/** Plays back an already saved automatic source. Purely visual: it never changes or re-reads data. */
export function AutoSandShow({ counts, onDone }: { counts: readonly number[]; onDone: () => void }) {
  const { reducedMotion } = useApp();
  const canvas = useRef<SandCanvasHandle>(null);
  // With reduced motion there is nothing to watch: every row is shown at once.
  const [done, setDone] = useState(reducedMotion ? 16 : 0);
  const [current, setCurrent] = useState<{ row: number; reducing: boolean } | null>(null);
  const [announce, setAnnounce] = useState('');

  useEffect(() => {
    if (reducedMotion) return;
    const timers: number[] = [];
    let at = 300;
    const later = (ms: number, fn: () => void) => { timers.push(window.setTimeout(fn, ms)); };
    counts.forEach((count, row) => {
      later(at, () => { canvas.current?.clear(); setCurrent({ row, reducing: false }); });
      for (let i = 0; i < count; i++) later(at + 60 + i * DROP_MS, () => canvas.current?.addMarkAuto());
      at += 60 + count * DROP_MS + 200;
      later(at, () => { canvas.current?.reduce(count % 2 === 1 ? 1 : 2); setCurrent({ row, reducing: true }); });
      at += REDUCE_MS + ROW_PAUSE_MS;
      later(at, () => {
        setDone(row + 1);
        if (row % 4 === 3) setAnnounce(`第${ORDINAL[(row - 3) / 4]}母象完成：${figureOf(motherFigure(counts, (row - 3) / 4)).zh}`);
      });
      if (row % 4 === 3) at += MOTHER_PAUSE_MS;
    });
    later(at + 200, () => setCurrent(null));
    return () => timers.forEach(t => clearTimeout(t));
  }, [counts, reducedMotion]);

  const finished = done === 16;
  const mothersDone = Math.floor(done / 4);
  const row = current?.row ?? Math.min(done, 15);
  return (
    <div className="dots auto-show">
      <p className="cast-progress">
        {finished ? <strong>十六列都落定了</strong> : <>
          <strong>第{ORDINAL[Math.floor(row / 4)]}母象／第{ORDINAL[row % 4]}列</strong>
          <span className="muted">（{ROW_ELEMENT[row % 4]}行・全部第 {row + 1}／16 列）</span>
        </>}
      </p>
      <ol className="row-progress" aria-label={`已落定 ${done} 列，共 16 列`}>
        {counts.map((count, i) => (
          <li key={i} className={`${i < done ? 'is-done' : ''}${!finished && i === row ? ' is-current' : ''}${i % 4 === 3 ? ' ends-mother' : ''}`}>
            <span aria-hidden="true">{i < done ? (count % 2 === 1 ? '•' : '••') : ''}</span>
            <span className="sr-only">第 {i + 1} 列：{i < done ? `${count} 粒，${dotWord(count % 2)}` : '未開始'}</span>
          </li>
        ))}
      </ol>
      {!reducedMotion && (
        <div className="sand-tray is-locked" aria-hidden="true">
          <SandCanvas ref={canvas} reducedMotion={reducedMotion} />
          {current?.reducing && (
            <div className="tray-overlay">
              <p>第 {current.row + 1} 列：{counts[current.row]} 粒，{counts[current.row] % 2 === 1 ? '奇數' : '偶數'} → {dotWord(counts[current.row] % 2)}</p>
            </div>
          )}
        </div>
      )}
      {mothersDone > 0 && (
        <section aria-label="已完成的母象" className="mothers-strip">
          {Array.from({ length: mothersDone }, (_, i) => (
            <figure key={i}>
              <FigureGlyph figure={motherFigure(counts, i)} size={finished ? 44 : 28} />
              <figcaption>第{ORDINAL[i]}母象{finished && <><br />{figureOf(motherFigure(counts, i)).zh}</>}</figcaption>
            </figure>
          ))}
        </section>
      )}
      <p className="muted">這一盤已經保存；動畫只是顯示，略過不會改變結果。</p>
      <div className="action-bar">
        <button type="button" className={finished ? 'primary' : ''} onClick={onDone}>{finished ? '看盤面與解讀' : '略過動畫，看結果'}</button>
      </div>
      <p className="sr-only" role="status" aria-live="polite">{announce}</p>
    </div>
  );
}
