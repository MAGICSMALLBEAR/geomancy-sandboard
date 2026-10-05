/**
 * Classical prohibitions and casting customs (plan §07: "古典禁例放學習區"). Presented as history and as
 * suggestions; the app never blocks, forces a recast or uses a "bad chart" to push the user anywhere.
 */
import { Link } from 'react-router';
import { fromDots } from '../../domain/geomancy.ts';
import { FIGURES } from '../../domain/catalog.ts';
import { sourceById } from '../../content/sources.ts';
import { FigureGlyph } from '../../components/FigureGlyph.tsx';

const HALTING = FIGURES.filter(f => f.id === 'rubeus' || f.id === 'cauda-draconis');

function Source({ id }: { id: string }) {
  const entry = sourceById(id);
  if (!entry) return null;
  return entry.url
    ? <a href={entry.url} target="_blank" rel="noopener noreferrer">{entry.title}（外部網頁，需要網路）</a>
    : <span>{entry.title}</span>;
}

export function CustomsPage() {
  return (
    <div className="customs">
      <p className="eyebrow"><Link to="/learn">教學</Link>・古典禁例</p>
      <h1 className="page-title">古典禁例與起卦習慣</h1>
      <p className="page-lede">傳統地占文本對「什麼時候不該起卦」「哪些盤不該判斷」有一些規矩。這裡把它們當作歷史與反思的材料介紹；
        本 App 不會因此阻止你、強迫重起，也不會用「壞盤」來嚇你。</p>

      <section className="card">
        <h2>停止盤：第一母象是紅或龍尾</h2>
        <div className="try-figure">
          {HALTING.map(f => (
            <Link key={f.id} to={`/learn/${f.id}`} className="figure-tile">
              <FigureGlyph figure={fromDots(f.dots)} size={30} decorative />
              <span><strong>{f.zh}</strong><br />{f.latin}</span>
            </Link>
          ))}
        </div>
        <p>部分舊歐洲地占文本說：第一母象（也就是第 1 宮、代表問卜者自己的位置）若是「紅」或「龍尾」，這一盤就該捨棄、不加判斷。
          兩個象本身都帶有強烈的負面色彩，又同時代表事情的開端與提問的人。</p>
        <p>現代實務者常把它改讀成「提問時的狀態」：</p>
        <ul>
          <li><strong>紅</strong>：情緒翻騰、還沒想清楚，或沒有認真看待這次占問。</li>
          <li><strong>龍尾</strong>：心裡其實已有定論，只想找確認，不太願意接受新的看法。</li>
        </ul>
        <p>也有實務者表示自己已經不遵守這條規矩。本 App 遇到這種盤時，會在進階解讀上方加一段說明，其餘照常顯示。</p>
        <p className="muted">來源：<Source id="G10" /></p>
      </section>

      <section className="card">
        <h2>起卦前的狀態</h2>
        <p>同一份資料也提到，傳統上不在惡劣天氣（雷雨、狂風、淹水、酷寒）中起卦，也避免在過度擔憂、偏見很深、
          生病、宿醉、疲倦或疼痛時起卦；問題要真誠，而不是早已決定答案。</p>
        <p>換成今天的做法，可以在起卦前先停一下：</p>
        <ul>
          <li>找一個不被打擾的時間，先深呼吸幾次。</li>
          <li>如果情緒還很激動，先把感受寫下來，晚一點再問。</li>
          <li>問自己：無論結果是什麼，我都願意看看嗎？</li>
        </ul>
        <p className="muted">來源：<Source id="G10" />；實際建議為<Source id="E01" />。</p>
      </section>

      <section className="card">
        <h2>同一件事要不要重問？</h2>
        <p className="muted">以下是本產品的建議，不是出自可核對的傳統文獻。</p>
        <ul>
          <li>短時間內對同一件事反覆起卦，往往只是在找想要的答案，結果會越看越亂。</li>
          <li>想再問時，先看看情況有沒有改變，或把問題改寫得更具體（換一個面向、換一個時間範圍）。</li>
          <li>與其重問，不如回到原本那一盤寫下筆記；過一段時間再到「後來怎樣了」補寫實際發展，對照當時的解讀。</li>
        </ul>
        <p><Link to="/journal">到日誌回顧舊的占問</Link></p>
      </section>
    </div>
  );
}
