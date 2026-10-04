import { PARENTS, type CastSource, type Chart, type NodeId } from '../domain/geomancy.ts';
import { NODE_LABEL, ORDINAL, ROW_ELEMENT, dotWord } from '../content/labels.ts';

/** How one position was produced, in words. Mothers show their real origin, never invented dot counts. */
export function Derivation({ node, chart, source }: { node: NodeId; chart: Chart; source: CastSource }) {
  const parents = PARENTS[node];
  if (node.startsWith('M')) {
    const index = Number(node[1]) - 1;
    if (source.kind === 'quick') return <p>數位亂數來源：由裝置亂數一次產生的十六個位元，每四個位元組成一個母象。</p>;
    if (source.kind === 'manual') return <p>手動設定：這個母象由你直接輸入。</p>;
    if (source.kind === 'press') {
      return <p>四次長按：第{ORDINAL[index]}次長按放開時，由裝置亂數取一個位元組（{source.bytes[index]}），
        前四個位元由上到下決定四行的一點或兩點。按多久不影響結果。</p>;
    }
    const verb = source.kind === 'auto' ? '裝置亂數落下' : '點了';
    return (
      <>
      {source.kind === 'auto' && <p>自動點沙：每列落下幾粒沙由裝置亂數一次決定（5–20 粒），奇偶規則與手動點沙相同。</p>}
      <ol className="derive-rows">
        {source.counts.slice(index * 4, index * 4 + 4).map((count, row) => (
          <li key={row}>{ROW_ELEMENT[row]}行：{verb} {count} {source.kind === 'auto' ? '粒' : '下'}，{count % 2 === 1 ? '奇數' : '偶數'} → {dotWord(count % 2)}</li>
        ))}
      </ol>
      </>
    );
  }
  if (node.startsWith('D') && parents) {
    const row = Number(node[1]) - 1;
    return (
      <>
        <p>轉置：依序取四個母象的第{ORDINAL[row]}行（{ROW_ELEMENT[row]}行），不是相加。</p>
        <ol className="derive-rows">
          {parents.map((mother, i) => (
            <li key={mother}>{NODE_LABEL[mother]}的第{ORDINAL[row]}行是{dotWord(chart[mother][row])} → 這裡的第{ORDINAL[i]}行</li>
          ))}
        </ol>
      </>
    );
  }
  if (!parents) return null;
  const [a, b] = parents;
  return (
    <>
      <p>{NODE_LABEL[a]}（{a}）＋{NODE_LABEL[b]}（{b}）逐行合成：相同得兩點，不同得一點。</p>
      <ol className="derive-rows">
        {chart[node].map((bit, row) => (
          <li key={row}>{ROW_ELEMENT[row]}行：{dotWord(chart[a][row])}＋{dotWord(chart[b][row])} → {dotWord(bit)}</li>
        ))}
      </ol>
    </>
  );
}
