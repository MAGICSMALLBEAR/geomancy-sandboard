/**
 * Planets, zodiac signs and elements side by side (DECISIONS D33, D36). Tables are shown as the sources list them;
 * where traditions disagree, every listed answer is shown rather than one being picked silently.
 */
import { Link } from 'react-router';
import { fromDots } from '../../domain/geomancy.ts';
import { FIGURES } from '../../domain/catalog.ts';
import { PLANET } from '../../content/learn.ts';
import { ELEMENT_LABEL, ELEMENT_SYSTEMS, ZODIAC, elementAgreement, type Element } from '../../content/correspondences.ts';
import { sourceById, sourceText } from '../../content/sources.ts';
import { FigureGlyph } from '../../components/FigureGlyph.tsx';
import { useApp } from '../../app/AppContext.tsx';
import type { Lang } from '../../app/lang.ts';

// English display names. The generated tables above stay exactly as published (DECISIONS D36).
const SIGN_EN: Record<string, string> = {
  牡羊座: 'Aries', 金牛座: 'Taurus', 雙子座: 'Gemini', 巨蟹座: 'Cancer', 獅子座: 'Leo', 處女座: 'Virgo',
  天秤座: 'Libra', 天蠍座: 'Scorpio', 射手座: 'Sagittarius', 摩羯座: 'Capricorn', 水瓶座: 'Aquarius', 雙魚座: 'Pisces',
};
const ELEMENT_EN: Record<Element, string> = { fire: 'Fire', air: 'Air', water: 'Water', earth: 'Earth' };
const SYSTEM_EN: Record<string, { label: string; work: string }> = {
  'agrippa-vulgar': { label: 'Agrippa (common)', work: 'The common system listed in Agrippa, Of Geomancy' },
  'agrippa-planet': { label: 'Agrippa (from planets)', work: 'Agrippa, Of Geomancy, derived from the planets' },
  'agrippa-sign': { label: 'Agrippa (from signs)', work: 'Agrippa, Of Geomancy, derived from the signs' },
  cattan: { label: 'Cattan', work: 'Christopher Cattan, The Geomancie' },
};
const sign = (zh: string, lang: Lang) => (lang === 'en' ? SIGN_EN[zh] ?? zh : zh);
const element = (e: Element, lang: Lang) => (lang === 'en' ? ELEMENT_EN[e] : ELEMENT_LABEL[e]);
const system = (s: typeof ELEMENT_SYSTEMS[number], lang: Lang) =>
  (lang === 'en' ? { label: SYSTEM_EN[s.id]?.label ?? s.label, work: SYSTEM_EN[s.id]?.work ?? s.work } : { label: s.label, work: s.work });

function SourceLink({ id }: { id: string }) {
  const { lang, L } = useApp();
  const entry = sourceById(id);
  const title = entry ? sourceText(entry, lang).title : id;
  return entry?.url
    ? <a href={entry.url} target="_blank" rel="noopener noreferrer">{title}{L('（外部網頁，需要網路）', ' (external page, needs internet)')}</a>
    : <span>{title}</span>;
}

/** The figure page's short section: one figure, every system. */
export function FigureCorrespondences({ figureId }: { figureId: string }) {
  const { lang, L } = useApp();
  const zodiac = ZODIAC[figureId], agreement = elementAgreement(figureId);
  return (
    <section aria-labelledby="corr-title">
      <h2 id="corr-title">{L('星座與元素', 'Sign and element')}</h2>
      <p>{L('星座：', 'Sign: ')}<strong>{sign(zodiac.agrippa, lang)}</strong>{L('（Agrippa 行星法）', " (Agrippa's planetary method)")}
        {zodiac.gerard === zodiac.agrippa ? L('；Gerard of Cremona 的說法相同。', '; Gerard of Cremona gives the same.')
          : <>{L('；Gerard of Cremona 的說法是', '; Gerard of Cremona gives ')}<strong>{sign(zodiac.gerard, lang)}</strong>{L('。', '.')}</>}</p>
      <p>{L('元素：最早的 Cattan（1591）配', 'Element: the earliest, Cattan (1591), gives ')}<strong>{element(agreement.element, lang)}</strong>{L('，', '; ')}
        {agreement.same === ELEMENT_SYSTEMS.length ? L('七份文獻全部一致。', 'all seven sources agree.') : L(`七份文獻中有 ${agreement.same} 份相同，其他說法：`, `${agreement.same} of the seven sources agree. The others:`)}</p>
      {agreement.same < ELEMENT_SYSTEMS.length && (
        <ul className="corr-inline">
          {ELEMENT_SYSTEMS.map(s => (
            <li key={s.id} className={s.values[figureId] === agreement.element ? '' : 'is-different'}>
              {system(s, lang).label} {s.year}{L('：', ': ')}{element(s.values[figureId], lang)}
            </li>
          ))}
        </ul>
      )}
      <p className="muted">{L('這裡的元素是整個象的元素，和上面「圖式結構」的四行（火、風、水、土行）是不同的概念。', "This is the element of the whole figure, a different idea from the four lines (Fire, Air, Water, Earth) under Structure above. ")}
        <Link to="/learn/correspondences">{L('看十六象完整對照表', 'See the full table for all sixteen figures')}</Link>{L('。來源：G09、G11、G12。', '. Sources: G09, G11, G12.')}</p>
    </section>
  );
}

export function CorrespondencesPage() {
  const { lang, L, T } = useApp();
  return (
    <div className="correspondences">
      <p className="eyebrow"><Link to="/learn">{L('教學', 'Learn')}</Link>{L('・對照表', ' · Tables')}</p>
      <h1 className="page-title">{L('行星、星座與元素對照', 'Planets, signs and elements')}</h1>
      <p className="page-lede">{L('十六象和占星的對應在歷史上有好幾套。行星的配法各家一致；星座和元素則說法不一，這裡把查得到出處的版本照原表並列，不替你挑出「唯一正確」的一套。這些對應不會影響本 App 的排盤與解讀。',
        'History has several sets of astrological correspondences for the sixteen figures. The planets agree across traditions; signs and elements do not. The versions with a traceable source are listed side by side as published, without picking a single "correct" one. None of this affects how this App builds or reads a chart.')}</p>

      <section className="card">
        <h2>{L('行星與星座', 'Planets and signs')}</h2>
        <p className="muted">{L('Agrippa 行星法：依象所屬的行星決定星座，例如月亮的兩個象都配巨蟹座。Gerard of Cremona 法：出自中世紀的〈On Astronomical Geomancy〉，依月宿推導。兩者有一半以上不同。',
          "Agrippa's planetary method: the sign follows the figure's planet, so both Moon figures get Cancer. Gerard of Cremona's method, from the medieval On Astronomical Geomancy, derives signs from the lunar mansions. They differ for more than half the figures.")}</p>
        <div className="table-scroll" tabIndex={0} role="region" aria-label={L('行星與星座對照表，可左右捲動', 'Planets and signs table, scrolls sideways')}>
          <table className="corr-table">
            <thead><tr><th scope="col">{L('象', 'Figure')}</th><th scope="col">{L('行星', 'Planet')}</th><th scope="col">{L('星座（Agrippa）', 'Sign (Agrippa)')}</th><th scope="col">{L('星座（Gerard）', 'Sign (Gerard)')}</th></tr></thead>
            <tbody>
              {FIGURES.map(f => (
                <tr key={f.id}>
                  <th scope="row"><Link to={`/learn/${f.id}`} className="corr-figure"><FigureGlyph figure={fromDots(f.dots)} size={14} decorative />{T.name(f)}</Link></th>
                  <td>{L(PLANET[f.id].zh, PLANET[f.id].latin)}</td>
                  <td>{sign(ZODIAC[f.id].agrippa, lang)}</td>
                  <td className={ZODIAC[f.id].gerard === ZODIAC[f.id].agrippa ? '' : 'is-different'}>{sign(ZODIAC[f.id].gerard, lang)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted">{L('標示底色的格子表示和 Agrippa 法不同。來源：', "Shaded cells differ from Agrippa's method. Sources: ")}<SourceLink id="G09" />{L('、', ', ')}<SourceLink id="G11" />{L('。', '.')}</p>
      </section>

      <section className="card">
        <h2>{L('元素：七份文獻比較', 'Elements: seven sources compared')}</h2>
        <p className="muted">{L('依年代排列。Cattan（1591）、Agrippa 通俗系統（1655）與 Fludd（1687）幾乎一致，是較常見的傳統說法；其餘各家差異很大。這裡以最早的 Cattan 為對照基準，標示底色的格子表示和 Cattan 不同。不用「多數決」：七份中有三份是 Agrippa 自己的不同版本，而且白與少女會三對三平手。數值照來源原表列出：其中「Agrippa（星座推導）」有三個象（少女、獲得、喜悅）和上表 Agrippa 星座的元素對不上，本產品不擅自修正。',
          "In order of date. Cattan (1591), Agrippa's common system (1655) and Fludd (1687) almost agree and are the more usual tradition; the rest differ widely. The earliest, Cattan, is the reference: shaded cells differ from Cattan. There is no majority vote: three of the seven are Agrippa's own variants, and Albus and Puella would tie 3–3. Values are as the source table lists them: for three figures (Puella, Acquisitio, Laetitia), \"Agrippa (from signs)\" does not match the element of Agrippa's sign in the table above, and this App does not correct it.")}</p>
        <div className="table-scroll" tabIndex={0} role="region" aria-label={L('元素對照表，可左右捲動', 'Elements table, scrolls sideways')}>
          <table className="corr-table">
            <thead>
              <tr><th scope="col">{L('象', 'Figure')}</th>
                {ELEMENT_SYSTEMS.map(s => <th key={s.id} scope="col">{system(s, lang).label}<br /><span className="muted">{s.year}</span></th>)}
                </tr>
            </thead>
            <tbody>
              {FIGURES.map(f => {
                const agreement = elementAgreement(f.id);
                return (
                  <tr key={f.id}>
                    <th scope="row"><Link to={`/learn/${f.id}`} className="corr-figure"><FigureGlyph figure={fromDots(f.dots)} size={14} decorative />{T.name(f)}</Link></th>
                    {ELEMENT_SYSTEMS.map(s => (
                      <td key={s.id} className={s.values[f.id] === agreement.element ? '' : 'is-different'}>{element(s.values[f.id], lang)}</td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <ul className="source-list">
          {ELEMENT_SYSTEMS.map(s => <li key={s.id}>{L(`${s.label}（${s.year}）：${s.work}`, `${system(s, lang).label} (${s.year}): ${system(s, lang).work}`)}</li>)}
        </ul>
        <p className="muted">{L('來源：', 'Source: ')}<SourceLink id="G12" />{L('。原始文獻未由本案直接核對。', '. The original texts were not checked directly for this App.')}</p>
      </section>
    </div>
  );
}
