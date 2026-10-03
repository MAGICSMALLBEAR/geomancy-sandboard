import { Link } from 'react-router';
import { HOUSE_NODES, PARENTS } from '../../domain/geomancy.ts';
import { HOUSES } from '../../domain/catalog.ts';
import { PERFECTION_LABEL } from '../../domain/advanced.ts';
import { NODE_LABEL, TOPIC_HOUSES, TOPIC_LABEL } from '../../content/labels.ts';
import { HOUSE_EXAMPLES, ROLE_NOTES } from '../../content/learn.ts';

/** Which topic choices on the question form point at a house, e.g. "工作：職位／發展". */
function topicUses(house: number): string[] {
  return (Object.keys(TOPIC_HOUSES) as (keyof typeof TOPIC_HOUSES)[]).flatMap(topic =>
    TOPIC_HOUSES[topic].filter(choice => choice.house === house).map(choice => `${TOPIC_LABEL[topic]}：${choice.label}`));
}

export function HousesPage() {
  return (
    <div className="learn houses-page">
      <p><Link to="/learn">← 回教學</Link></p>
      <h1>十二宮與盤位</h1>
      <p>一張盾盤有十六個位置。前十二個依序放進十二宮，用來看問題的不同面向；證人、裁判與調和者不入宮，用來看整體。
        本產品採用順序入宮（規則 western-sequential-v1），其他傳統有不同做法。</p>

      <section className="card">
        <h2>十六個位置從哪裡來</h2>
        {ROLE_NOTES.map(role => (
          <div key={role.title} className="role-note">
            <h3>{role.title}</h3>
            <p>{role.text}</p>
            <ul className="role-nodes">
              {role.nodes.map(node => {
                const parents = PARENTS[node];
                const house = HOUSE_NODES.indexOf(node) + 1;
                return (
                  <li key={node}>
                    <strong>{NODE_LABEL[node]}</strong>（{node}）
                    {parents ? (node.startsWith('D')
                      ? `：取四個母象的第${'一二三四'[Number(node[1]) - 1]}行`
                      : `＝${parents.map(p => NODE_LABEL[p]).join('＋')}`) : '：起卦得出'}
                    {house > 0 ? `・第 ${house} 宮` : '・不入宮'}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
        <p><Link to="/learn/practice">到推盤練習自己算一次</Link></p>
      </section>

      <section>
        <h2>十二宮</h2>
        <p className="muted">每一宮列的是常見的觀察範圍，用來幫助你決定問題該看哪一宮；文字是本產品的編輯草稿，尚未經地占專家審校。</p>
        <ol className="house-guide">
          {HOUSES.map((label, i) => {
            const house = i + 1, uses = topicUses(house);
            return (
              <li key={house} className="card">
                <h3>第 {house} 宮：{label}</h3>
                <p>例如：{HOUSE_EXAMPLES[i]}。</p>
                <p className="muted">盤位：{NODE_LABEL[HOUSE_NODES[i]]}（{HOUSE_NODES[i]}）
                  {house === 1 && '・每次都代表你自己（問卜者）'}
                  {uses.length > 0 && `・新增占問時可選：${uses.join('、')}`}</p>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="card">
        <h2>進階解讀用到的術語</h2>
        <p className="muted">結果頁的「進階解讀」會用到以下技法。定義依規則與來源的 G06、G07；說明文字是編輯草稿。</p>
        <h3>成事關係</h3>
        <p>比較第 1 宮（你自己）與所問之事的宮位，看兩邊的象能不能「接上」。只有選了問題宮（工作或關係主題）時才計算。</p>
        <dl className="term-list">
          <dt>{PERFECTION_LABEL.occupation}</dt>
          <dd>第 1 宮與問題宮是同一個象。</dd>
          <dt>{PERFECTION_LABEL.conjunction}</dt>
          <dd>其中一方的象也出現在另一方的隔壁宮。</dd>
          <dt>{PERFECTION_LABEL.mutation}</dt>
          <dd>雙方的象一起出現在另外兩個相鄰的宮。</dd>
          <dt>{PERFECTION_LABEL.translation}</dt>
          <dd>第三個象同時出現在兩方的隔壁，像中間人一樣把兩邊連起來。</dd>
          <dt>不成事</dt>
          <dd>以上都沒有出現。這只表示這張盤沒有顯示直接的連結，不等於事情一定不會發生。</dd>
        </dl>
        <p className="muted">相鄰採環狀：第 12 宮與第 1 宮也算相鄰。</p>
        <h3>點之道</h3>
        <p>看裁判的第一行（火行）。如果是一點，就往上找第一行同樣是一點的來源，一路追到母象或女象；兩點時則追兩點。
          追得到的路徑顯示這個結論主要從哪幾個位置來，中途斷掉代表沒有單一明確的源頭。</p>
      </section>
    </div>
  );
}
