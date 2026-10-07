import { PARENTS, type CastSource, type Chart, type NodeId } from '../domain/geomancy.ts';
import { useApp } from '../app/AppContext.tsx';

/** How one position was produced, in words. Mothers show their real origin, never invented dot counts. */
export function Derivation({ node, chart, source, manualNote }: { node: NodeId; chart: Chart; source: CastSource; manualNote?: string }) {
  const { L, T } = useApp();
  const { ORDINAL, ROW_ELEMENT, NODE_LABEL, dotWord } = T;
  const parents = PARENTS[node];
  if (node.startsWith('M')) {
    const index = Number(node[1]) - 1;
    if (source.kind === 'quick') return <p>{L('數位亂數來源：由裝置亂數一次產生的十六個位元，每四個位元組成一個母象。',
      'Digital random source: sixteen bits drawn at once from the device; every four bits make one Mother.')}</p>;
    if (source.kind === 'manual') return <p>{manualNote ?? L('手動設定：這個母象由你直接輸入。', 'Entered by hand: you set this Mother directly.')}</p>;
    if (source.kind === 'press') {
      return <p>{L(`四次長按：第${ORDINAL[index]}次長按放開時，由裝置亂數取一個位元組（${source.bytes[index]}），前四個位元由上到下決定四行的一點或兩點。按多久不影響結果。`,
        `Four long presses: when the ${ORDINAL[index]} press was released, one random byte (${source.bytes[index]}) was taken from the device; its first four bits, top to bottom, set one or two dots on each line. How long you pressed does not change the result.`)}</p>;
    }
    const auto = source.kind === 'auto';
    return (
      <>
      {auto && <p>{L('自動點沙：每列落下幾粒沙由裝置亂數一次決定（5–20 粒），奇偶規則與手動點沙相同。',
        'Automatic dots: how many grains fall on each row was decided once by the device (5–20 grains); odd and even work as with hand dots.')}</p>}
      <ol className="derive-rows">
        {source.counts.slice(index * 4, index * 4 + 4).map((count, row) => (
          <li key={row}>{L(
            `${ROW_ELEMENT[row]}行：${auto ? '裝置亂數落下' : '點了'} ${count} ${auto ? '粒' : '下'}，${count % 2 === 1 ? '奇數' : '偶數'} → ${dotWord(count % 2)}`,
            `${ROW_ELEMENT[row]} line: ${count} ${auto ? 'grains fell' : 'taps'}, ${count % 2 === 1 ? 'odd' : 'even'} → ${dotWord(count % 2)}`)}</li>
        ))}
      </ol>
      </>
    );
  }
  if (node.startsWith('D') && parents) {
    const row = Number(node[1]) - 1;
    return (
      <>
        <p>{L(`轉置：依序取四個母象的第${ORDINAL[row]}行（${ROW_ELEMENT[row]}行），不是相加。`,
          `Read across: take the ${ORDINAL[row]} line (${ROW_ELEMENT[row]}) of each Mother in turn; nothing is added.`)}</p>
        <ol className="derive-rows">
          {parents.map((mother, i) => (
            <li key={mother}>{L(`${NODE_LABEL[mother]}的第${ORDINAL[row]}行是${dotWord(chart[mother][row])} → 這裡的第${ORDINAL[i]}行`,
              `The ${ORDINAL[row]} line of the ${NODE_LABEL[mother]} is ${dotWord(chart[mother][row])} → this figure's ${ORDINAL[i]} line`)}</li>
          ))}
        </ol>
      </>
    );
  }
  if (!parents) return null;
  const [a, b] = parents;
  return (
    <>
      <p>{L(`${NODE_LABEL[a]}（${a}）＋${NODE_LABEL[b]}（${b}）逐行合成：相同得兩點，不同得一點。`,
        `${NODE_LABEL[a]} (${a}) + ${NODE_LABEL[b]} (${b}), line by line: the same gives two dots, different gives one.`)}</p>
      <ol className="derive-rows">
        {chart[node].map((bit, row) => (
          <li key={row}>{L(`${ROW_ELEMENT[row]}行：`, `${ROW_ELEMENT[row]}: `)}{dotWord(chart[a][row])}{L('＋', ' + ')}{dotWord(chart[b][row])} → {dotWord(bit)}</li>
        ))}
      </ol>
    </>
  );
}
