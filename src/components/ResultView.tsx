import { useMemo, useState, type ReactNode } from 'react';
import type { CastSource, Chart, NodeId } from '../domain/geomancy.ts';
import { HOUSES } from '../domain/catalog.ts';
import type { Claim, Question, Reading } from '../domain/reading.ts';
import { METHOD_LABEL, NODE_LABEL, RULE_LABEL, TOPIC_LABEL, figureById } from '../content/labels.ts';
import { sourceById } from '../content/sources.ts';
import { fromDots } from '../domain/geomancy.ts';
import { FigureGlyph } from './FigureGlyph.tsx';
import { ChartPanel } from './ChartPanel.tsx';
import { AdvancedReading } from './AdvancedReading.tsx';
import { ASPECT_LABEL, PERFECTION_LABEL, buildAdvancedReading, type AdvancedReading as Advanced } from '../domain/advanced.ts';
import { figureInfo } from '../domain/catalog.ts';

type Props = {
  question: Question;
  dateLabel: string;
  source: CastSource;
  chart: Chart;
  reading: Reading;
  animate: boolean;
  onSkipAnimation: () => void;
  onEvidenceOpened?: () => void;
  /** Notes and feedback; omitted for the teaching example. */
  notes?: ReactNode;
  banner?: ReactNode;
};

/** At-a-glance panel: the two witnesses meeting in the judge, with the main advanced signals. Same data as below. */
function Verdict({ chart, advanced, onShowNode }: { chart: Chart; advanced: Advanced; onShowNode: (node: NodeId) => void }) {
  const right = figureInfo(chart.RW), left = figureInfo(chart.LW), judge = figureInfo(chart.J);
  const { perfection, aspects } = advanced;
  const fig = (node: NodeId, label: string, info: typeof judge, big = false) => (
    <button type="button" className={`verdict-figure link-button${big ? ' is-judge' : ''}`} onClick={() => onShowNode(node)}
      aria-label={`${label}：${info.zh}／${info.latin}，在盤面上看`}>
      <FigureGlyph figure={chart[node]} size={big ? 46 : 32} decorative />
      <strong>{info.zh}</strong>
      <span>{label}</span>
    </button>
  );
  return (
    <section className="verdict" aria-labelledby="verdict-title">
      <div className="verdict-court">
        {fig('RW', '右證人', right)}
        <span className="verdict-op" aria-hidden="true">＋</span>
        {fig('LW', '左證人', left)}
        <span className="verdict-op" aria-hidden="true">→</span>
        {fig('J', '裁判', judge, true)}
      </div>
      <div className="verdict-text">
        <h2 id="verdict-title">裁判：{judge.zh}<span className="latin">{judge.latin}</span></h2>
        <ul className="keyword-chips" aria-label="裁判的象徵主題">{judge.keywords.map(k => <li key={k}>{k}</li>)}</ul>
        {perfection.status === 'checked' && (
          <p><strong>成事關係：</strong>{perfection.hits.length
            ? `找到${PERFECTION_LABEL[perfection.hits[0].mode]}${perfection.hits.length > 1 ? `等 ${perfection.hits.length} 種` : ''}`
            : '不成事（四種方式都沒有出現）'}
            {aspects.status === 'checked' && aspects.base && <>；宮位相位：{ASPECT_LABEL[aspects.base]}</>}</p>
        )}
        <p className="muted">完整說明與依據在下方。這是象徵性的觀察，不是預測。</p>
      </div>
    </section>
  );
}

function ClaimCard({ claim, onShowNode, onEvidenceOpened }: { claim: Claim; onShowNode: (node: NodeId) => void; onEvidenceOpened?: () => void }) {
  const [open, setOpen] = useState(false);
  const panelId = `evidence-${claim.claimId}`;
  return (
    <article className="card claim">
      <h3>{claim.title}{claim.kind === 'reflection' && <span className="tag">反思提示</span>}</h3>
      <p>{claim.text}</p>
      <button type="button" className="link-button" aria-expanded={open} aria-controls={panelId}
        onClick={() => { if (!open) onEvidenceOpened?.(); setOpen(!open); }}>
        {open ? '收起依據' : '查看依據'}
      </button>
      {open && (
        <div id={panelId} className="evidence">
          <h4>這段文字來自這些盤位</h4>
          <ul className="evidence-list">
            {claim.evidence.map(e => {
              const info = figureById(e.figureId);
              return (
                <li key={e.nodeId}>
                  <FigureGlyph figure={fromDots(e.dots)} size={24} decorative />
                  <span>
                    <strong>{NODE_LABEL[e.nodeId]}</strong>
                    {e.house ? `（第 ${e.house} 宮：${HOUSES[e.house - 1]}）` : ''}
                    ：{info ? `${info.zh}／${info.latin}` : e.figureId}，圖式 {e.dots}
                  </span>
                  <button type="button" className="link-button" onClick={() => onShowNode(e.nodeId)}>在盤面上看</button>
                </li>
              );
            })}
          </ul>
          <p>使用的規則：{RULE_LABEL[claim.ruleId] ?? claim.ruleId}。
            {claim.kind === 'reflection' && '這是本產品原創的反思提示，不是歷史文獻的判詞。'}</p>
          <h4>來源</h4>
          <ul className="source-list">
            {claim.sourceIds.map(id => {
              const entry = sourceById(id);
              return (
                <li key={id}>
                  {entry?.url
                    ? <a href={entry.url} target="_blank" rel="noopener noreferrer">{entry.title}（外部網頁，需要網路）</a>
                    : <span>{entry?.title ?? id}</span>}
                  {entry && <span className="muted">　{entry.note}</span>}
                </li>
              );
            })}
          </ul>
          <details className="advanced">
            <summary>進階資訊</summary>
            <p>段落 ID：{claim.claimId}<br />規則 ID：{claim.ruleId}<br />來源 ID：{claim.sourceIds.join('、')}</p>
          </details>
        </div>
      )}
    </article>
  );
}

export function ResultView({ question, dateLabel, source, chart, reading, animate, onSkipAnimation, onEvidenceOpened, notes, banner }: Props) {
  const [tab, setTab] = useState<'reading' | 'chart' | 'notes'>('reading');
  const [selected, setSelected] = useState<NodeId | null>(null);
  const showNode = (node: NodeId) => { setSelected(node); setTab('chart'); };
  const advanced = useMemo(() => buildAdvancedReading(chart, question), [chart, question]);
  const [pathShown, setPathShown] = useState(false);
  const togglePath = () => {
    const next = !pathShown;
    setPathShown(next);
    if (next) setTab('chart');
  };

  return (
    <div className="result">
      {banner}
      <header className="result-head">
        <p className="eyebrow">{TOPIC_LABEL[question.topic]}
          {question.targetHouse ? `・第 ${question.targetHouse} 宮：${HOUSES[question.targetHouse - 1]}` : ''}</p>
        <h1 className="question-text">{question.text}</h1>
        {question.originalText && (
          <details className="scope-note">
            <summary>最初寫下的話</summary>
            <p className="original-text">{question.originalText}</p>
          </details>
        )}
        <p className="muted">
          {question.timeframe && <>時間範圍：{question.timeframe}・</>}
          {dateLabel && <>{dateLabel}・</>}{METHOD_LABEL[source.kind]}
        </p>
        <details className="scope-note">
          <summary>基礎象徵解讀・內容草稿</summary>
          <p>基礎解讀說明裁判、兩個證人、第 1 宮與你選的問題宮各自的象徵主題，並附上反思提示。
            下方的進階解讀另外依傳統技法計算成事關係、相位、象的重現、點之道、證人與裁判，以及十二宮逐宮；它是象徵性的觀察，不是預測。中文文字是本產品的編輯草稿，尚未經地占專家逐條審校。重要決定仍需要實際資訊。</p>
          <p className="muted">規則版本 {reading.ruleVersion}・內容版本 {reading.contentVersion}</p>
        </details>
      </header>

      <Verdict chart={chart} advanced={advanced} onShowNode={showNode} />

      <div className="segmented result-tabs" role="group" aria-label="結果內容">
        <button type="button" aria-pressed={tab === 'reading'} onClick={() => setTab('reading')}>解讀</button>
        <button type="button" aria-pressed={tab === 'chart'} onClick={() => setTab('chart')}>盤面</button>
        {notes && <button type="button" aria-pressed={tab === 'notes'} onClick={() => setTab('notes')}>筆記</button>}
      </div>

      <div className="result-body">
        <div className={`result-pane pane-chart${tab === 'chart' ? ' is-active' : ''}`}>
          <h2>盤面</h2>
          <ChartPanel chart={chart} source={source} targetHouse={question.targetHouse} selected={selected}
            onSelect={setSelected} animate={animate} onSkipAnimation={onSkipAnimation} path={pathShown ? advanced.way.nodes : undefined}
            aspects={advanced.aspects} />
        </div>
        <div className="result-side">
          <div className={`result-pane pane-reading${tab === 'reading' ? ' is-active' : ''}`}>
            <h2>解讀</h2>
            {reading.claims.map(claim => (
              <ClaimCard key={claim.claimId} claim={claim} onShowNode={showNode} onEvidenceOpened={onEvidenceOpened} />
            ))}
            <AdvancedReading advanced={advanced} onShowNode={showNode} pathShown={pathShown} onTogglePath={togglePath} />
          </div>
          {notes && (
            <div className={`result-pane pane-notes${tab === 'notes' ? ' is-active' : ''}`}>
              <h2>筆記</h2>
              {notes}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
