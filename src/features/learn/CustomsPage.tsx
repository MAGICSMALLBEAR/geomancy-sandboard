/**
 * Classical prohibitions and casting customs (plan §07: "古典禁例放學習區"). Presented as history and as
 * suggestions; the app never blocks, forces a recast or uses a "bad chart" to push the user anywhere.
 */
import { Link } from 'react-router';
import { fromDots } from '../../domain/geomancy.ts';
import { FIGURES } from '../../domain/catalog.ts';
import { sourceById, sourceText } from '../../content/sources.ts';
import { useApp } from '../../app/AppContext.tsx';
import { FigureGlyph } from '../../components/FigureGlyph.tsx';

const HALTING = FIGURES.filter(f => f.id === 'rubeus' || f.id === 'cauda-draconis');

function Source({ id }: { id: string }) {
  const { lang, L } = useApp();
  const entry = sourceById(id);
  if (!entry) return null;
  const { title } = sourceText(entry, lang);
  return entry.url
    ? <a href={entry.url} target="_blank" rel="noopener noreferrer">{title}{L('（外部網頁，需要網路）', ' (external page, needs internet)')}</a>
    : <span>{title}</span>;
}

export function CustomsPage() {
  const { L, T } = useApp();
  return (
    <div className="customs">
      <p className="eyebrow"><Link to="/learn">{L('教學', 'Learn')}</Link>{L('・古典禁例', ' · Classical prohibitions')}</p>
      <h1 className="page-title">{L('古典禁例與起卦習慣', 'Classical prohibitions and casting customs')}</h1>
      <p className="page-lede">{L('傳統地占文本對「什麼時候不該起卦」「哪些盤不該判斷」有一些規矩。這裡把它們當作歷史與反思的材料介紹；本 App 不會因此阻止你、強迫重起，也不會用「壞盤」來嚇你。',
        'Traditional geomancy texts have rules about when not to cast and which charts not to judge. They are presented here as history and as material for reflection; this App will never stop you, force a recast, or use a "bad chart" to frighten you.')}</p>

      <section className="card">
        <h2>{L('停止盤：第一母象是紅或龍尾', 'A halted chart: Rubeus or Cauda Draconis as the First Mother')}</h2>
        <div className="try-figure">
          {HALTING.map(f => (
            <Link key={f.id} to={`/learn/${f.id}`} className="figure-tile">
              <FigureGlyph figure={fromDots(f.dots)} size={30} decorative />
              {L(<span><strong>{f.zh}</strong><br />{f.latin}</span>, <span><strong>{f.latin}</strong><br />{T.fullName(f).slice(f.latin.length + 1)}</span>)}
            </Link>
          ))}
        </div>
        <p>{L('部分舊歐洲地占文本說：第一母象（也就是第 1 宮、代表問卜者自己的位置）若是「紅」或「龍尾」，這一盤就該捨棄、不加判斷。兩個象本身都帶有強烈的負面色彩，又同時代表事情的開端與提問的人。',
          "Some old European geomancy texts say that if the First Mother (house 1, the querent's own position) is Rubeus or Cauda Draconis, the chart should be set aside unjudged. Both figures carry a strongly negative colour, and that position stands for both the start of the matter and the person asking.")}</p>
        <p>{L('現代實務者常把它改讀成「提問時的狀態」：', 'Modern practitioners often read it instead as the state of mind when asking:')}</p>
        <ul>
          <li><strong>{L('紅', 'Rubeus')}</strong>{L('：情緒翻騰、還沒想清楚，或沒有認真看待這次占問。', ': emotions running high, not yet thought through, or not taking the question seriously.')}</li>
          <li><strong>{L('龍尾', 'Cauda Draconis')}</strong>{L('：心裡其實已有定論，只想找確認，不太願意接受新的看法。', ': the mind is already made up and only wants confirmation, not a new view.')}</li>
        </ul>
        <p>{L('也有實務者表示自己已經不遵守這條規矩。本 App 遇到這種盤時，會在進階解讀上方加一段說明，其餘照常顯示。', 'Some practitioners say they no longer follow this rule. For such a chart, this App adds a note above the advanced reading and shows everything else as usual.')}</p>
        <p className="muted">{L('來源：', 'Source: ')}<Source id="G10" /></p>
      </section>

      <section className="card">
        <h2>{L('起卦前的狀態', 'Your state before casting')}</h2>
        <p>{L('同一份資料也提到，傳統上不在惡劣天氣（雷雨、狂風、淹水、酷寒）中起卦，也避免在過度擔憂、偏見很深、生病、宿醉、疲倦或疼痛時起卦；問題要真誠，而不是早已決定答案。',
          'The same source says that traditionally one does not cast in foul weather (thunderstorms, gales, floods, bitter cold), nor when overly anxious, deeply biased, ill, hung over, tired or in pain; and the question should be sincere, not one whose answer is already decided.')}</p>
        <p>{L('換成今天的做法，可以在起卦前先停一下：', 'In today\'s terms, you can pause before casting:')}</p>
        <ul>
          <li>{L('找一個不被打擾的時間，先深呼吸幾次。', 'Find a time without interruptions and take a few deep breaths.')}</li>
          <li>{L('如果情緒還很激動，先把感受寫下來，晚一點再問。', 'If feelings are still running high, write them down and ask later.')}</li>
          <li>{L('問自己：無論結果是什麼，我都願意看看嗎？', 'Ask yourself: whatever the result, am I willing to look at it?')}</li>
        </ul>
        <p className="muted">{L('來源：', 'Source: ')}<Source id="G10" />{L('；實際建議為', '; the practical suggestions are ')}<Source id="E01" />{L('。', '.')}</p>
      </section>

      <section className="card">
        <h2>{L('同一件事要不要重問？', 'Should you ask the same thing again?')}</h2>
        <p className="muted">{L('以下是本產品的建議，不是出自可核對的傳統文獻。', "The following is this App's suggestion, not taken from a traditional text that can be checked.")}</p>
        <ul>
          <li>{L('短時間內對同一件事反覆起卦，往往只是在找想要的答案，結果會越看越亂。', 'Casting again and again on the same matter in a short time is often a search for the answer you want, and only gets more confusing.')}</li>
          <li>{L('想再問時，先看看情況有沒有改變，或把問題改寫得更具體（換一個面向、換一個時間範圍）。', 'Before asking again, see whether the situation has changed, or make the question more specific (another side of it, another time frame).')}</li>
          <li>{L('與其重問，不如回到原本那一盤寫下筆記；過一段時間再到「後來怎樣了」補寫實際發展，對照當時的解讀。', 'Rather than asking again, go back to the original chart and write notes; later, record what actually happened under "What happened afterwards" and compare it with the reading.')}</li>
        </ul>
        <p><Link to="/journal">{L('到日誌回顧舊的占問', 'Look back on past questions in the journal')}</Link></p>
      </section>
    </div>
  );
}
