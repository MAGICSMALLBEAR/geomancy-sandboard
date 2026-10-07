import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import type { Bit, CastSource, Figure } from '../../domain/geomancy.ts';
import { drawAutoSource } from '../../domain/random.ts';
import { useApp } from '../../app/AppContext.tsx';
import { figureOf } from '../../content/labels.ts';
import { FigureGlyph } from '../../components/FigureGlyph.tsx';
import { REDUCE_MS, SandCanvas, type SandCanvasHandle } from './SandCanvas.tsx';

/**
 * The automatic method reaches the device RNG here, once, from the button's click handler.
 * The page saves the source before AutoSandShow plays it back.
 */
export function AutoCasting({ onSource }: { onSource: (source: CastSource) => void }) {
  const { L, T } = useApp();
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
        <p>{T.error('RNG_UNAVAILABLE')}</p>
        <p>{L('請放棄這筆草稿，回到新增占問改選其他起卦方式。', 'Please discard this draft and choose another casting method on the new-question page.')}</p>
        <Link to="/new">{L('回到新增占問', 'Back to new question')}</Link>
      </div>
    );
  }
  return (
    <section className="card quick">
      <h2>{L('自動點沙', 'Automatic dots')}</h2>
      <p>{L('不用自己點：按一次按鈕，裝置亂數會決定十六列各落下幾粒沙（每列 5–20 粒），接著你會看到沙子自動落下，每列依奇偶化約成一點或兩點，每四列組成一個母象。',
        'No tapping needed: press once and device random decides how many grains fall in each of the sixteen rows (5–20 per row). Then you watch the sand fall; each row reduces to one dot or two by odd or even, and every four rows make a Mother.')}</p>
      <p className="muted">{L('每列的粒數在按下的瞬間就固定並保存；動畫只是把它播出來，可以略過，重新整理也不會換一盤。', 'The count for every row is fixed and saved the moment you press. The animation only plays it back; you can skip it, and reloading will not give a different chart.')}</p>
      <button type="button" className="primary big" disabled={started} onClick={cast}>
        {started ? L('正在保存…', 'Saving…') : L('開始自動點沙', 'Start automatic dots')}
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
  const { reducedMotion, L, T } = useApp();
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
        if (row % 4 === 3) setAnnounce(L(`${T.mother((row - 3) / 4)}完成：${figureOf(motherFigure(counts, (row - 3) / 4)).zh}`,
          `${T.mother((row - 3) / 4)} complete: ${T.name(figureOf(motherFigure(counts, (row - 3) / 4)))}`));
      });
      if (row % 4 === 3) at += MOTHER_PAUSE_MS;
    });
    later(at + 200, () => setCurrent(null));
    return () => timers.forEach(t => clearTimeout(t));
  }, [counts, reducedMotion, L, T]);

  const finished = done === 16;
  const mothersDone = Math.floor(done / 4);
  const row = current?.row ?? Math.min(done, 15);
  return (
    <div className="dots auto-show">
      <p className="cast-progress">
        {finished ? <strong>{L('十六列都落定了', 'All sixteen rows have settled')}</strong> : <>
          <strong>{L(`${T.mother(Math.floor(row / 4))}／第${T.ORDINAL[row % 4]}列`, `${T.mother(Math.floor(row / 4))}, row ${row % 4 + 1}`)}</strong>
          <span className="muted">{L(`（${T.ROW_ELEMENT[row % 4]}行・全部第 ${row + 1}／16 列）`, ` (${T.ROW_ELEMENT[row % 4]} line · row ${row + 1} of 16)`)}</span>
        </>}
      </p>
      <ol className="row-progress" aria-label={L(`已落定 ${done} 列，共 16 列`, `${done} of 16 rows settled`)}>
        {counts.map((count, i) => (
          <li key={i} className={`${i < done ? 'is-done' : ''}${!finished && i === row ? ' is-current' : ''}${i % 4 === 3 ? ' ends-mother' : ''}`}>
            <span aria-hidden="true">{i < done ? (count % 2 === 1 ? '•' : '••') : ''}</span>
            <span className="sr-only">{L(`第 ${i + 1} 列：`, `Row ${i + 1}: `)}{i < done ? L(`${count} 粒，${T.dotWord(count % 2)}`, `${count} grains, ${T.dotWord(count % 2)}`) : L('未開始', 'not started')}</span>
          </li>
        ))}
      </ol>
      {!reducedMotion && (
        <div className="sand-tray is-locked" aria-hidden="true">
          <SandCanvas ref={canvas} reducedMotion={reducedMotion} />
          {current?.reducing && (
            <div className="tray-overlay">
              <p>{L(`第 ${current.row + 1} 列：${counts[current.row]} 粒，${T.parity(counts[current.row])} → ${T.dotWord(counts[current.row] % 2)}`, `Row ${current.row + 1}: ${counts[current.row]} grains, ${T.parity(counts[current.row])} → ${T.dotWord(counts[current.row] % 2)}`)}</p>
            </div>
          )}
        </div>
      )}
      {mothersDone > 0 && (
        <section aria-label={L('已完成的母象', 'Completed Mothers')} className="mothers-strip">
          {Array.from({ length: mothersDone }, (_, i) => (
            <figure key={i}>
              <FigureGlyph figure={motherFigure(counts, i)} size={finished ? 44 : 28} />
              <figcaption>{T.mother(i)}{finished && <><br />{T.name(figureOf(motherFigure(counts, i)))}</>}</figcaption>
            </figure>
          ))}
        </section>
      )}
      <p className="muted">{L('這一盤已經保存；動畫只是顯示，略過不會改變結果。', 'This chart is already saved. The animation only shows it; skipping does not change the result.')}</p>
      <div className="action-bar">
        <button type="button" className={finished ? 'primary' : ''} onClick={onDone}>{finished ? L('看盤面與解讀', 'See the chart and reading') : L('略過動畫，看結果', 'Skip the animation and see the result')}</button>
      </div>
      <p className="sr-only" role="status" aria-live="polite">{announce}</p>
    </div>
  );
}
