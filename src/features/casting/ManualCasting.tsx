import { useEffect, useRef, useState } from 'react';
import { useBlocker } from 'react-router';
import { fromDots, type Bit, type CastSource, type Figure, type Mothers } from '../../domain/geomancy.ts';
import { FIGURES } from '../../domain/catalog.ts';
import { figureOf } from '../../content/labels.ts';
import { useApp } from '../../app/AppContext.tsx';
import { Dialog } from '../../components/Dialog.tsx';
import { FigureGlyph } from '../../components/FigureGlyph.tsx';

type Cell = Bit | null;

/** Sixteen explicit choices. Unfilled rows stay unfilled; mothers may repeat freely. */
export function ManualCasting({ onSource }: { onSource: (source: CastSource) => void }) {
  const { L, T } = useApp();
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
      <p className="hint">{L('依序填入四個母象，每個母象由上到下四行，每行選一點或兩點。也可以直接選象名填滿一個母象。', 'Fill in the four Mothers in order. Each has four rows from top to bottom; choose one dot or two dots for each row. You can also pick a figure by name to fill a whole Mother.')}</p>
      <div className="manual-grid">
        {[0, 1, 2, 3].map(mother => {
          const figure = motherAt(mother);
          return (
            <fieldset key={mother} className="card manual-card" disabled={submitted}>
              <legend>{T.mother(mother)}</legend>
              {[0, 1, 2, 3].map(row => {
                const index = mother * 4 + row, value = cells[index];
                return (
                  <div key={row} className="manual-row" role="radiogroup" aria-label={L(`${T.mother(mother)}第${T.ORDINAL[row]}行（${T.ROW_ELEMENT[row]}）`, `${T.mother(mother)}, row ${row + 1} (${T.ROW_ELEMENT[row]})`)}>
                    <span className="manual-row-label">{T.ROW_ELEMENT[row]}</span>
                    <button type="button" role="radio" aria-checked={value === 1} onClick={() => setCell(index, 1)}>{L('一點', 'One dot')} •</button>
                    <button type="button" role="radio" aria-checked={value === 0} onClick={() => setCell(index, 0)}>{L('兩點', 'Two dots')} ••</button>
                  </div>
                );
              })}
              <label className="manual-select">
                {L('或選象名', 'Or choose a figure')}
                <select value={figure ? figureOf(figure).dots : ''} onChange={event => { if (event.target.value) fillMother(mother, event.target.value); }}>
                  <option value="">{L('（未選）', '(none)')}</option>
                  {FIGURES.map(f => <option key={f.id} value={f.dots}>{T.fullName(f)}</option>)}
                </select>
              </label>
              <p className="manual-preview" aria-live="polite">
                {figure
                  ? <><FigureGlyph figure={figure} size={28} decorative /> {T.fullName(figureOf(figure))}</>
                  : <span className="muted">{L('尚未填完', 'Not complete')}</span>}
              </p>
            </fieldset>
          );
        })}
      </div>
      <div className="action-bar">
        <p className="muted" role="status">{L(`已填 ${filled}／16 行${complete ? '，可以排盤。' : '，全部填完才能排盤。'}`, `${filled} of 16 rows filled${complete ? '. Ready to build the chart.' : '. Fill them all to build the chart.'}`)}</p>
        <button type="button" className="primary" disabled={!complete || submitted} onClick={submit}>
          {submitted ? L('正在保存…', 'Saving…') : L('依這四母象排盤', 'Build the chart from these Mothers')}
        </button>
      </div>

      <Dialog open={blocker.state === 'blocked'} title={L('四母象還沒保存', 'The Mothers are not saved')} onClose={() => blocker.reset?.()}>
        <p>{L('離開後問題會保留，但四母象需要重新輸入。', 'If you leave, the question is kept but the Mothers will need to be entered again.')}</p>
        <div className="dialog-actions">
          <button type="button" className="primary" onClick={() => blocker.reset?.()}>{L('繼續輸入', 'Keep entering')}</button>
          <button type="button" onClick={() => blocker.proceed?.()}>{L('離開', 'Leave')}</button>
        </div>
      </Dialog>
    </div>
  );
}
