/**
 * Planets, zodiac signs and elements side by side (DECISIONS D33, D36). Tables are shown as the sources list them;
 * where traditions disagree, every listed answer is shown rather than one being picked silently.
 */
import { Link } from 'react-router';
import { fromDots } from '../../domain/geomancy.ts';
import { FIGURES } from '../../domain/catalog.ts';
import { PLANET } from '../../content/learn.ts';
import { ELEMENT_LABEL, ELEMENT_SYSTEMS, ZODIAC, elementAgreement } from '../../content/correspondences.ts';
import { sourceById } from '../../content/sources.ts';
import { FigureGlyph } from '../../components/FigureGlyph.tsx';

function SourceLink({ id }: { id: string }) {
  const entry = sourceById(id);
  return entry?.url
    ? <a href={entry.url} target="_blank" rel="noopener noreferrer">{entry.title}（外部網頁，需要網路）</a>
    : <span>{entry?.title ?? id}</span>;
}

/** The figure page's short section: one figure, every system. */
export function FigureCorrespondences({ figureId }: { figureId: string }) {
  const zodiac = ZODIAC[figureId], agreement = elementAgreement(figureId);
  return (
    <section aria-labelledby="corr-title">
      <h2 id="corr-title">星座與元素</h2>
      <p>星座：<strong>{zodiac.agrippa}</strong>（Agrippa 行星法）
        {zodiac.gerard === zodiac.agrippa ? '；Gerard of Cremona 的說法相同。' : <>；Gerard of Cremona 的說法是<strong>{zodiac.gerard}</strong>。</>}</p>
      <p>元素：最早的 Cattan（1591）配<strong>{ELEMENT_LABEL[agreement.element]}</strong>，
        {agreement.same === ELEMENT_SYSTEMS.length ? '七份文獻全部一致。' : `七份文獻中有 ${agreement.same} 份相同，其他說法：`}</p>
      {agreement.same < ELEMENT_SYSTEMS.length && (
        <ul className="corr-inline">
          {ELEMENT_SYSTEMS.map(s => (
            <li key={s.id} className={s.values[figureId] === agreement.element ? '' : 'is-different'}>
              {s.label} {s.year}：{ELEMENT_LABEL[s.values[figureId]]}
            </li>
          ))}
        </ul>
      )}
      <p className="muted">這裡的元素是整個象的元素，和上面「圖式結構」的四行（火、風、水、土行）是不同的概念。
        <Link to="/learn/correspondences">看十六象完整對照表</Link>。來源：G09、G11、G12。</p>
    </section>
  );
}

export function CorrespondencesPage() {
  return (
    <div className="correspondences">
      <p className="eyebrow"><Link to="/learn">教學</Link>・對照表</p>
      <h1 className="page-title">行星、星座與元素對照</h1>
      <p className="page-lede">十六象和占星的對應在歷史上有好幾套。行星的配法各家一致；星座和元素則說法不一，
        這裡把查得到出處的版本照原表並列，不替你挑出「唯一正確」的一套。這些對應不會影響本 App 的排盤與解讀。</p>

      <section className="card">
        <h2>行星與星座</h2>
        <p className="muted">Agrippa 行星法：依象所屬的行星決定星座，例如月亮的兩個象都配巨蟹座。
          Gerard of Cremona 法：出自中世紀的〈On Astronomical Geomancy〉，依月宿推導。兩者有一半以上不同。</p>
        <div className="table-scroll" tabIndex={0} role="region" aria-label="行星與星座對照表，可左右捲動">
          <table className="corr-table">
            <thead><tr><th scope="col">象</th><th scope="col">行星</th><th scope="col">星座（Agrippa）</th><th scope="col">星座（Gerard）</th></tr></thead>
            <tbody>
              {FIGURES.map(f => (
                <tr key={f.id}>
                  <th scope="row"><Link to={`/learn/${f.id}`} className="corr-figure"><FigureGlyph figure={fromDots(f.dots)} size={14} decorative />{f.zh}</Link></th>
                  <td>{PLANET[f.id].zh}</td>
                  <td>{ZODIAC[f.id].agrippa}</td>
                  <td className={ZODIAC[f.id].gerard === ZODIAC[f.id].agrippa ? '' : 'is-different'}>{ZODIAC[f.id].gerard}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted">標示底色的格子表示和 Agrippa 法不同。來源：<SourceLink id="G09" />、<SourceLink id="G11" />。</p>
      </section>

      <section className="card">
        <h2>元素：七份文獻比較</h2>
        <p className="muted">依年代排列。Cattan（1591）、Agrippa 通俗系統（1655）與 Fludd（1687）幾乎一致，是較常見的傳統說法；
          其餘各家差異很大。這裡以最早的 Cattan 為對照基準，標示底色的格子表示和 Cattan 不同。
          不用「多數決」：七份中有三份是 Agrippa 自己的不同版本，而且白與少女會三對三平手。數值照來源原表列出：其中「Agrippa（星座推導）」有三個象
          （少女、獲得、喜悅）和上表 Agrippa 星座的元素對不上，本產品不擅自修正。</p>
        <div className="table-scroll" tabIndex={0} role="region" aria-label="元素對照表，可左右捲動">
          <table className="corr-table">
            <thead>
              <tr><th scope="col">象</th>
                {ELEMENT_SYSTEMS.map(s => <th key={s.id} scope="col">{s.label}<br /><span className="muted">{s.year}</span></th>)}
                </tr>
            </thead>
            <tbody>
              {FIGURES.map(f => {
                const agreement = elementAgreement(f.id);
                return (
                  <tr key={f.id}>
                    <th scope="row"><Link to={`/learn/${f.id}`} className="corr-figure"><FigureGlyph figure={fromDots(f.dots)} size={14} decorative />{f.zh}</Link></th>
                    {ELEMENT_SYSTEMS.map(s => (
                      <td key={s.id} className={s.values[f.id] === agreement.element ? '' : 'is-different'}>{ELEMENT_LABEL[s.values[f.id]]}</td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <ul className="source-list">
          {ELEMENT_SYSTEMS.map(s => <li key={s.id}>{s.label}（{s.year}）：{s.work}</li>)}
        </ul>
        <p className="muted">來源：<SourceLink id="G12" />。原始文獻未由本案直接核對。</p>
      </section>
    </div>
  );
}
