import { useRef, useState } from 'react';
import { Link } from 'react-router';
import { constructChart, mothersFromCounts, toDots, type Bit, type CastSource, type Chart, type Figure, type Mothers, type NodeId } from '../../domain/geomancy.ts';
import { figureOf } from '../../content/labels.ts';
import { useApp } from '../../app/AppContext.tsx';
import { Derivation } from '../../components/Derivation.tsx';
import { FigureGlyph } from '../../components/FigureGlyph.tsx';
import { ShieldChart } from '../../components/ShieldChart.tsx';
import teaching from '../../../fixtures/teaching.json';

type Step = { title: readonly [string, string]; nodes: readonly NodeId[]; intro: readonly [string, string] };
const STEPS: readonly Step[] = [
  { title: ['四母象', 'The four Mothers'], nodes: ['M1', 'M2', 'M3', 'M4'],
    intro: ['起卦得到的只有這四個象。點沙時每列奇數記一點、偶數記兩點；這裡直接按「一點／兩點」設定，看後面怎麼跟著變。',
      'A cast produces only these four figures. When tapping, an odd row gives one dot and an even row two; here you set "one dot / two dots" directly and watch what follows change.'] },
  { title: ['四女象：轉置', 'The four Daughters: transposing'], nodes: ['D1', 'D2', 'D3', 'D4'],
    intro: ['不用計算，只是把四母象橫著讀：第一女象依序取第一到第四母象的第一行（火行），第二女象取第二行，依此類推。',
      'Nothing to compute: the Mothers are read sideways. The First Daughter takes the first line (Fire) of the First to Fourth Mothers in turn, the Second Daughter the second line, and so on.'] },
  { title: ['四姪象：兩兩合成', 'The four Nieces: combining pairs'], nodes: ['N1', 'N2', 'N3', 'N4'],
    intro: ['合成時逐行比較兩個象：相同（都是一點或都是兩點）得兩點，不同得一點。第一姪象＝第一母象＋第二母象，第二姪象＝第三＋第四母象，女象同理。',
      'Combining compares two figures line by line: the same (both one dot or both two) gives two dots, different gives one. First Niece = First Mother + Second Mother, Second Niece = Third + Fourth Mother, and likewise for the Daughters.'] },
  { title: ['兩證人', 'The two Witnesses'], nodes: ['RW', 'LW'],
    intro: ['同樣的合成規則再做一次：右證人＝第一姪象＋第二姪象，左證人＝第三姪象＋第四姪象。',
      'The same combining rule once more: Right Witness = First Niece + Second Niece, Left Witness = Third Niece + Fourth Niece.'] },
  { title: ['裁判', 'The Judge'], nodes: ['J'],
    intro: ['裁判＝右證人＋左證人。不管四母象是什麼，裁判的總點數一定是偶數。',
      'Judge = Right Witness + Left Witness. Whatever the Mothers are, the Judge always has an even number of dots.'] },
  { title: ['調和者與完整盾盤', 'The Reconciler and the full shield'], nodes: ['R'],
    intro: ['調和者＝裁判＋第一母象，部分傳統不使用。完成後可以在下方看到整張盾盤，點任一個位置看它的來源。',
      'Reconciler = Judge + First Mother; some traditions do not use it. The full shield then appears below; select any position to see where it comes from.'] },
];

const initialMothers = (): Bit[] => mothersFromCounts(teaching.counts).flat() as Bit[];

/** Teaching sandbox: nothing here is a cast, nothing is stored, and no device randomness is used. */
export function PracticePage() {
  const { L, T } = useApp();
  const [bits, setBits] = useState<Bit[]>(initialMothers);
  const [step, setStep] = useState(0);
  const [quiz, setQuiz] = useState(false);
  const [guesses, setGuesses] = useState<Partial<Record<NodeId, (Bit | null)[]>>>({});
  const [checked, setChecked] = useState<Partial<Record<NodeId, true>>>({});
  const [selected, setSelected] = useState<NodeId | null>(null);

  const mothers = [0, 4, 8, 12].map(i => bits.slice(i, i + 4)) as unknown as Mothers;
  const chart = constructChart(mothers);
  const current = STEPS[step];
  const source: CastSource = { kind: 'manual', mothers };
  const heading = useRef<HTMLHeadingElement>(null);
  // Announce the new step by moving focus to its heading.
  const goTo = (next: number) => {
    setStep(next);
    requestAnimationFrame(() => heading.current?.focus());
  };

  const changeMothers = (next: Bit[]) => {
    setBits(next);
    setGuesses({});
    setChecked({});
    setSelected(null);
  };
  const setRow = (index: number, value: Bit) => changeMothers(bits.map((bit, i) => i === index ? value : bit));
  // A deterministic rotation through the sixteen figures, so "another set" never touches the casting RNG.
  const shift = () => changeMothers(bits.map((_, i) => bits[(i + 5) % 16] ^ (i % 3 === 0 ? 1 : 0)) as Bit[]);

  const guess = (node: NodeId, row: number, value: Bit) =>
    setGuesses(all => ({ ...all, [node]: (all[node] ?? [null, null, null, null]).map((g, i) => i === row ? value : g) }));

  const score = (Object.keys(checked) as NodeId[]).reduce((sum, node) =>
    sum + (guesses[node] ?? []).filter((g, row) => g === chart[node][row]).length, 0);
  const total = Object.keys(checked).length * 4;
  const shieldHidden = quiz && !checked.R;

  return (
    <div className="learn practice">
      <p><Link to="/learn">{L('← 回教學', '← Back to learning')}</Link></p>
      <h1>{L('推盤練習', 'Derivation practice')}</h1>
      <p>{L('從四母象開始，一步一步推出整張盾盤。這裡只是練習：不是占卜，不會存進日誌，也不使用起卦的亂數。', 'Start from four Mothers and work out the whole shield step by step. This is only practice: not a reading, not saved to the journal, and it uses no casting randomness.')}</p>

      <label className="check">
        <input type="checkbox" checked={quiz} onChange={event => { setQuiz(event.target.checked); setGuesses({}); setChecked({}); }} />
        {L('先自己算，再對答案（每個位置先選四行，再按「對答案」）', 'Work it out first, then check (choose the four lines for each position, then press "Check")')}
      </label>
      {quiz && total > 0 && <p role="status">{L(`目前答對 ${score}／${total} 行。`, `${score} of ${total} lines right so far.`)}</p>}

      <ol className="practice-steps" aria-label={L('步驟', 'Steps')}>
        {STEPS.map((s, i) => (
          <li key={s.title[0]}>
            <button type="button" aria-current={i === step ? 'step' : undefined} onClick={() => goTo(i)}>
              {i + 1}. {L(s.title[0], s.title[1])}
            </button>
          </li>
        ))}
      </ol>

      <section className="card" aria-labelledby="practice-step-title">
        <h2 id="practice-step-title" ref={heading} tabIndex={-1}>{L(`第 ${step + 1} 步：${current.title[0]}`, `Step ${step + 1}: ${current.title[1]}`)}</h2>
        <p>{L(current.intro[0], current.intro[1])}</p>

        {step === 0 ? (
          <>
            <div className="manual-grid">
              {[0, 1, 2, 3].map(mother => (
                <fieldset key={mother} className="card manual-card">
                  <legend>{L(`${T.mother(mother)}（M${mother + 1}）`, `${T.mother(mother)} (M${mother + 1})`)}</legend>
                  {[0, 1, 2, 3].map(row => {
                    const index = mother * 4 + row, value = bits[index];
                    return (
                      <div key={row} className="manual-row" role="radiogroup" aria-label={L(`${T.mother(mother)}第${T.ORDINAL[row]}行（${T.ROW_ELEMENT[row]}）`, `${T.mother(mother)}, row ${row + 1} (${T.ROW_ELEMENT[row]})`)}>
                        <span className="manual-row-label">{T.ROW_ELEMENT[row]}</span>
                        <button type="button" role="radio" aria-checked={value === 1} onClick={() => setRow(index, 1)}>{L('一點', 'One dot')} •</button>
                        <button type="button" role="radio" aria-checked={value === 0} onClick={() => setRow(index, 0)}>{L('兩點', 'Two dots')} ••</button>
                      </div>
                    );
                  })}
                  <p className="manual-preview">
                    <FigureGlyph figure={mothers[mother]} size={28} decorative /> {T.fullName(figureOf(mothers[mother]))}
                  </p>
                </fieldset>
              ))}
            </div>
            <div className="dialog-actions">
              <button type="button" onClick={shift}>{L('換一組四母象', 'Another set of Mothers')}</button>
              <button type="button" onClick={() => changeMothers(initialMothers())}>{L('回到教學例題', 'Back to the teaching example')}</button>
            </div>
          </>
        ) : (
          <ol className="practice-nodes">
            {current.nodes.map(node => (
              <PracticeNode key={node} node={node} chart={chart} source={source}
                quiz={quiz} guess={guesses[node] ?? [null, null, null, null]} checked={!!checked[node]}
                onGuess={(row, value) => guess(node, row, value)}
                onCheck={() => setChecked(all => ({ ...all, [node]: true }))} />
            ))}
          </ol>
        )}

        <div className="dialog-actions">
          {step > 0 && <button type="button" onClick={() => goTo(step - 1)}>{L('上一步', 'Previous step')}</button>}
          {step < STEPS.length - 1 && <button type="button" className="primary" onClick={() => goTo(step + 1)}>{L(`下一步：${STEPS[step + 1].title[0]}`, `Next: ${STEPS[step + 1].title[1]}`)}</button>}
        </div>
      </section>

      {step === STEPS.length - 1 && (
        <section aria-labelledby="practice-shield-title">
          <h2 id="practice-shield-title">{L('完整盾盤', 'The full shield')}</h2>
          {shieldHidden ? (
            <p className="muted">{L('對完調和者的答案後顯示整張盾盤。', 'The full shield appears once you have checked the Reconciler.')}</p>
          ) : (
            <>
              <ShieldChart chart={chart} showReconciler selected={selected} onSelect={setSelected} animate={false} />
              {selected && (
                <div className="card practice-detail" aria-live="polite">
                  <h3>{L(`${T.NODE_LABEL[selected]}（${selected}）：${figureOf(chart[selected]).zh}`, `${T.NODE_LABEL[selected]} (${selected}): ${T.name(figureOf(chart[selected]))}`)}</h3>
                  <Derivation node={selected} chart={chart} source={source} />
                </div>
              )}
              <p className="hint">{L('點盾盤上的位置，會在下方說明它從哪裡來。想用真正的起卦流程，請到', 'Select a position on the shield to see below where it comes from. For a real cast, go to ')}<Link to="/new">{L('新增占問', 'New question')}</Link>{L('。', '.')}</p>
            </>
          )}
        </section>
      )}
    </div>
  );
}

type NodeProps = {
  node: NodeId; chart: Chart; source: CastSource; quiz: boolean; guess: (Bit | null)[]; checked: boolean;
  onGuess: (row: number, value: Bit) => void; onCheck: () => void;
};

function PracticeNode({ node, chart, source, quiz, guess, checked, onGuess, onCheck }: NodeProps) {
  const { L, T } = useApp();
  const answer: Figure = chart[node];
  const hidden = quiz && !checked;
  const info = figureOf(answer);
  return (
    <li className="card practice-node">
      <h3>{T.NODE_LABEL[node]}{L(`（${node}）`, ` (${node})`)}{!hidden && L(`：${info.zh}／${info.latin}`, `: ${T.fullName(info)}`)}</h3>
      {hidden ? (
        <>
          {[0, 1, 2, 3].map(row => (
            <div key={row} className="manual-row" role="radiogroup" aria-label={L(`${T.NODE_LABEL[node]}第${T.ORDINAL[row]}行（${T.ROW_ELEMENT[row]}）你的答案`, `${T.NODE_LABEL[node]}, row ${row + 1} (${T.ROW_ELEMENT[row]}), your answer`)}>
              <span className="manual-row-label">{T.ROW_ELEMENT[row]}</span>
              <button type="button" role="radio" aria-checked={guess[row] === 1} onClick={() => onGuess(row, 1)}>{L('一點', 'One dot')} •</button>
              <button type="button" role="radio" aria-checked={guess[row] === 0} onClick={() => onGuess(row, 0)}>{L('兩點', 'Two dots')} ••</button>
            </div>
          ))}
          <button type="button" className="primary" disabled={guess.some(g => g === null)} onClick={onCheck}>{L('對答案', 'Check')}</button>
        </>
      ) : (
        <>
          <p className="practice-figure"><FigureGlyph figure={answer} size={30} /> {L('圖式', 'Pattern')} {toDots(answer)}</p>
          {quiz && (
            <ul className="practice-check">
              {answer.map((bit, row) => guess[row] === bit
                ? <li key={row} className="is-right">{L(`✓ ${T.ROW_ELEMENT[row]}行：${T.dotWord(bit)}，答對`, `✓ ${T.ROW_ELEMENT[row]} line: ${T.dotWord(bit)}, right`)}</li>
                : <li key={row} className="is-wrong">{L(`✗ ${T.ROW_ELEMENT[row]}行：你選了${T.dotWord(guess[row] ?? 0)}，正確是${T.dotWord(bit)}`, `✗ ${T.ROW_ELEMENT[row]} line: you chose ${T.dotWord(guess[row] ?? 0)}, the answer is ${T.dotWord(bit)}`)}</li>)}
            </ul>
          )}
          <Derivation node={node} chart={chart} source={source} />
        </>
      )}
    </li>
  );
}
