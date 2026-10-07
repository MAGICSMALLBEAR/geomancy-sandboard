import { Link } from 'react-router';
import { houseNodes, houseOf, PARENTS, RULE_GOLDEN_DAWN, RULE_VERSION } from '../../domain/geomancy.ts';
import { advancedLabels } from '../../domain/advanced.ts';
import { useApp } from '../../app/AppContext.tsx';
import type { Labels } from '../../content/labels.ts';
import { sourceById, sourceText } from '../../content/sources.ts';
import { HOUSE_EXAMPLES, HOUSE_EXAMPLES_EN, ROLE_NOTES } from '../../content/learn.ts';

/** Which topic choices on the question form point at a house, e.g. "工作：職位／發展". */
function topicUses(house: number, T: Labels): string[] {
  return (Object.keys(T.TOPIC_HOUSES) as (keyof typeof T.TOPIC_HOUSES)[]).flatMap(topic =>
    T.TOPIC_HOUSES[topic].filter(choice => choice.house === house).map(choice => `${T.TOPIC_LABEL[topic]}${T.lang === 'en' ? ': ' : '：'}${choice.label}`));
}

export function HousesPage() {
  const { lang, L, T } = useApp();
  const PERFECTION_LABEL = advancedLabels(lang).perfection;
  const examples = lang === 'en' ? HOUSE_EXAMPLES_EN : HOUSE_EXAMPLES;
  return (
    <div className="learn houses-page">
      <p><Link to="/learn">{L('← 回教學', '← Back to learning')}</Link></p>
      <h1>{L('十二宮與盤位', 'Houses and positions')}</h1>
      <p>{L('一張盾盤有十六個位置。其中十二個放進十二宮，用來看問題的不同面向；證人、裁判與調和者不入宮，用來看整體。放法有兩種，預設是順序入宮，可在',
        'A shield has sixteen positions. Twelve go into the twelve houses and show different sides of a question; the Witnesses, Judge and Reconciler stay outside the houses and show the whole. There are two ways to place them: sequential by default, or Golden Dawn, switchable in ')}<Link to="/settings">{L('設定', 'Settings')}</Link>{L('改用 Golden Dawn 入宮。', '.')}</p>

      <section className="card">
        <h2>{L('兩種入宮方式', 'Two house rules')}</h2>
        <p>{T.HOUSE_RULE_LABEL[RULE_VERSION]}{L('：', ': ')}{T.HOUSE_RULE_HELP[RULE_VERSION]}</p>
        <p>{T.HOUSE_RULE_LABEL[RULE_GOLDEN_DAWN]}{L('：', ': ')}{T.HOUSE_RULE_HELP[RULE_GOLDEN_DAWN]}</p>
        <div className="table-scroll">
          <table className="corr-table">
            <caption>{L('每一宮放的是哪個盤位', 'Which position fills each house')}</caption>
            <thead><tr><th scope="col">{L('宮位', 'House')}</th><th scope="col">{T.HOUSE_RULE_LABEL[RULE_VERSION]}</th><th scope="col">{T.HOUSE_RULE_LABEL[RULE_GOLDEN_DAWN]}</th></tr></thead>
            <tbody>
              {T.HOUSES.map((_, i) => (
                <tr key={i}>
                  <th scope="row">{L(`第 ${i + 1} 宮`, `House ${i + 1}`)}</th>
                  <td>{T.NODE_LABEL[houseNodes(RULE_VERSION)[i]]}</td>
                  <td>{T.NODE_LABEL[houseNodes(RULE_GOLDEN_DAWN)[i]]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted">{L('兩種方式的盾盤完全一樣，差別只在哪個象落在哪一宮，所以第 1 宮、問題宮、成事關係與相位都會不同。傳統派認為順序入宮才是原本的做法，Golden Dawn 的方式是為了貼近占星的角宮、續宮、果宮。',
          "The shield is identical either way; only which figure lands in which house differs, so the 1st house, the question house, perfection and aspects all change. Traditionalists hold that sequential placement is the original method; the Golden Dawn way was made to match astrology's angular, succedent and cadent houses. ")}
          {L('來源：', 'Sources: ')}{[sourceById('G02'), sourceById('G13')].map((s, i) => s && <span key={s.id}>{i > 0 && L('、', ', ')}<a href={s.url ?? undefined} target="_blank" rel="noopener noreferrer">{sourceText(s, lang).title}</a></span>)}{L('。', '.')}</p>
      </section>

      <section className="card">
        <h2>{L('十六個位置從哪裡來', 'Where the sixteen positions come from')}</h2>
        {ROLE_NOTES.map(role => (
          <div key={role.title} className="role-note">
            <h3>{L(role.title, role.titleEn)}</h3>
            <p>{L(role.text, role.textEn)}</p>
            <ul className="role-nodes">
              {role.nodes.map(node => {
                const parents = PARENTS[node];
                const house = houseOf(node, RULE_VERSION), gd = houseOf(node, RULE_GOLDEN_DAWN);
                return (
                  <li key={node}>
                    <strong>{T.NODE_LABEL[node]}</strong>{L(`（${node}）`, ` (${node})`)}
                    {parents ? (node.startsWith('D')
                      ? L(`：取四個母象的第${'一二三四'[Number(node[1]) - 1]}行`, `: line ${node[1]} of each Mother`)
                      : L(`＝${parents.map(p => T.NODE_LABEL[p]).join('＋')}`, ` = ${parents.map(p => T.NODE_LABEL[p]).join(' + ')}`)) : L('：起卦得出', ': from the cast')}
                    {house ? L(`・第 ${house} 宮（Golden Dawn：第 ${gd} 宮）`, ` · house ${house} (Golden Dawn: house ${gd})`) : L('・不入宮', ' · not in a house')}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
        <p><Link to="/learn/practice">{L('到推盤練習自己算一次', 'Work one out in the derivation practice')}</Link></p>
      </section>

      <section>
        <h2>{L('十二宮', 'The twelve houses')}</h2>
        <p className="muted">{L('每一宮列的是常見的觀察範圍，用來幫助你決定問題該看哪一宮；文字是本產品的編輯草稿，尚未經地占專家審校。', "Each house lists what it is commonly looked at for, to help you decide which house a question belongs to. The wording is this App's editorial draft, not yet expert-reviewed.")}</p>
        <ol className="house-guide">
          {T.HOUSES.map((label, i) => {
            const house = i + 1, uses = topicUses(house, T);
            return (
              <li key={house} className="card">
                <h3>{L(`第 ${house} 宮：${label}`, `House ${house}: ${label}`)}</h3>
                <p>{L(`例如：${examples[i]}。`, `For example: ${examples[i]}.`)}</p>
                <p className="muted">{L(`盤位：${T.NODE_LABEL[houseNodes(RULE_VERSION)[i]]}（Golden Dawn：${T.NODE_LABEL[houseNodes(RULE_GOLDEN_DAWN)[i]]}）`,
                  `Position: ${T.NODE_LABEL[houseNodes(RULE_VERSION)[i]]} (Golden Dawn: ${T.NODE_LABEL[houseNodes(RULE_GOLDEN_DAWN)[i]]})`)}
                  {house === 1 && L('・每次都代表你自己（問卜者）', ' · always you, the querent')}
                  {uses.length > 0 && L(`・新增占問時可選：${uses.join('、')}`, ` · offered on the question form: ${uses.join('; ')}`)}</p>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="card">
        <h2>{L('進階解讀用到的術語', 'Terms used in the advanced reading')}</h2>
        <p className="muted">{L('結果頁的「進階解讀」會用到以下技法。定義依規則與來源的 G06、G07；說明文字是編輯草稿。', "The result page's advanced reading uses these techniques. Definitions follow G06 and G07 under Rules and sources; the explanations are editorial drafts.")}</p>
        <h3>{L('成事關係', 'Perfection')}</h3>
        <p>{L('比較第 1 宮（你自己）與所問之事的宮位，看兩邊的象能不能「接上」。只有選了問題宮（工作或關係主題）時才計算。', 'Compares house 1 (you) with the house of the matter asked about, to see whether the two connect. Only computed when a question house is chosen (work or relationship topics).')}</p>
        <dl className="term-list">
          <dt>{PERFECTION_LABEL.occupation}</dt>
          <dd>{L('第 1 宮與問題宮是同一個象。', 'House 1 and the question house hold the same figure.')}</dd>
          <dt>{PERFECTION_LABEL.conjunction}</dt>
          <dd>{L('其中一方的象也出現在另一方的隔壁宮。', "One side's figure also appears in a house next to the other side.")}</dd>
          <dt>{PERFECTION_LABEL.mutation}</dt>
          <dd>{L('雙方的象一起出現在另外兩個相鄰的宮。', "Both sides' figures appear together in two other neighbouring houses.")}</dd>
          <dt>{PERFECTION_LABEL.translation}</dt>
          <dd>{L('第三個象同時出現在兩方的隔壁，像中間人一樣把兩邊連起來。', 'A third figure appears next to both sides, joining them like a go-between.')}</dd>
          <dt>{L('不成事', 'Denial')}</dt>
          <dd>{L('以上都沒有出現。這只表示這張盤沒有顯示直接的連結，不等於事情一定不會發生。', 'None of the above. It only means this chart shows no direct link, not that the matter cannot happen.')}</dd>
        </dl>
        <p className="muted">{L('相鄰採環狀：第 12 宮與第 1 宮也算相鄰。', 'Neighbours wrap around: house 12 and house 1 also count as neighbours.')}</p>
        <h3>{L('點之道', 'The Way of the Points')}</h3>
        <p>{L('看裁判的第一行（火行）。如果是一點，就往上找第一行同樣是一點的來源，一路追到母象或女象；兩點時則追兩點。追得到的路徑顯示這個結論主要從哪幾個位置來，中途斷掉代表沒有單一明確的源頭。',
          "Look at the Judge's first line (Fire). If it is one dot, follow upward to the parents whose first line is also one dot, all the way to the Mothers or Daughters; if two dots, follow two dots. The path shows which positions the conclusion mainly comes from; a break on the way means there is no single clear source.")}</p>
      </section>
    </div>
  );
}
