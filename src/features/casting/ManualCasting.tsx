import { useEffect, useRef, useState } from 'react';
import { useBlocker } from 'react-router';
import { fromDots, type Bit, type CastSource, type Figure, type Mothers } from '../../domain/geomancy.ts';
import { FIGURES } from '../../domain/catalog.ts';
import { ORDINAL, ROW_ELEMENT, figureOf } from '../../content/labels.ts';
import { Dialog } from '../../components/Dialog.tsx';
import { FigureGlyph } from '../../components/FigureGlyph.tsx';

type Cell = Bit | null;

/** Sixteen explicit choices. Unfilled rows stay unfilled; mothers may repeat freely. */
export function ManualCasting({ onSource }: { onSource: (source: CastSource) => void }) {
  const [cells, setCells] = useState<Cell[]>(() => Array<Cell>(16).fill(null));
  const [submitted, setSubmitted] = useState(false);
  const locked = useRef(false);

  const filled = cells.filter(c => c !== null).length;
  const complete = filled === 16;
  const dirty = filled > 0 && !submitted;
  const blocker = useBlocker(dirty);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const setCell = (index: number, value: Bit) =>
    setCells(current => current.map((cell, i) => i === index ? value : cell));
  const fillMother = (mother: number, dots: string) => {
    const figure = fromDots(dots);
    setCells(current => current.map((cell, i) => Math.floor(i / 4) === mother ? figure[i % 4] : cell));
  };
  const motherAt = (mother: number): Figure | null => {
    const rows = cells.slice(mother * 4, mother * 4 + 4);
    return rows.every(r => r !== null) ? rows as unknown as Figure : null;
  };

  const submit = () => {
    if (locked.current || !complete) return;
    locked.current = true;
    setSubmitted(true);
    onSource({ kind: 'manual', mothers: [0, 1, 2, 3].map(m => motherAt(m)!) as unknown as Mothers });
  };

  return (
    <div className="manual">
      <p className="hint">依序填入四個母象，每個母象由上到下四行，每行選一點或兩點。也可以直接選象名填滿一個母象。</p>
      <div className="manual-grid">
        {[0, 1, 2, 3].map(mother => {
          const figure = motherAt(mother);
          return (
            <fieldset key={mother} className="card manual-card" disabled={submitted}>
              <legend>第{ORDINAL[mother]}母象</legend>
              {[0, 1, 2, 3].map(row => {
                const index = mother * 4 + row, value = cells[index];
                return (
                  <div key={row} className="manual-row" role="radiogroup" aria-label={`第${ORDINAL[mother]}母象第${ORDINAL[row]}行（${ROW_ELEMENT[row]}）`}>
                    <span className="manual-row-label">{ROW_ELEMENT[row]}</span>
                    <button type="button" role="radio" aria-checked={value === 1} onClick={() => setCell(index, 1)}>一點 •</button>
                    <button type="button" role="radio" aria-checked={value === 0} onClick={() => setCell(index, 0)}>兩點 ••</button>
                  </div>
                );
              })}
              <label className="manual-select">
                或選象名
                <select value={figure ? figureOf(figure).dots : ''} onChange={event => { if (event.target.value) fillMother(mother, event.target.value); }}>
                  <option value="">（未選）</option>
                  {FIGURES.map(f => <option key={f.id} value={f.dots}>{f.zh}／{f.latin}</option>)}
                </select>
              </label>
              <p className="manual-preview" aria-live="polite">
                {figure
                  ? <><FigureGlyph figure={figure} size={28} decorative /> {figureOf(figure).zh}／{figureOf(figure).latin}</>
                  : <span className="muted">尚未填完</span>}
              </p>
            </fieldset>
          );
        })}
      </div>
      <div className="action-bar">
        <p className="muted" role="status">已填 {filled}／16 行{complete ? '，可以排盤。' : '，全部填完才能排盤。'}</p>
        <button type="button" className="primary" disabled={!complete || submitted} onClick={submit}>
          {submitted ? '正在保存…' : '依這四母象排盤'}
        </button>
      </div>

      <Dialog open={blocker.state === 'blocked'} title="四母象還沒保存" onClose={() => blocker.reset?.()}>
        <p>離開後問題會保留，但四母象需要重新輸入。</p>
        <div className="dialog-actions">
          <button type="button" className="primary" onClick={() => blocker.reset?.()}>繼續輸入</button>
          <button type="button" onClick={() => blocker.proceed?.()}>離開</button>
        </div>
      </Dialog>
    </div>
  );
}
