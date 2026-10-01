import { useState, type ReactNode } from 'react';
import type { CastSource, Chart, NodeId } from '../domain/geomancy.ts';
import { HOUSES } from '../domain/catalog.ts';
import type { Claim, Question, Reading } from '../domain/reading.ts';
import { METHOD_LABEL, NODE_LABEL, RULE_LABEL, TOPIC_LABEL, figureById } from '../content/labels.ts';
import { sourceById } from '../content/sources.ts';
import { fromDots } from '../domain/geomancy.ts';
import { FigureGlyph } from './FigureGlyph.tsx';
import { ChartPanel } from './ChartPanel.tsx';

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

  return (
    <div className="result">
      {banner}
      <header className="result-head">
        <p className="eyebrow">{TOPIC_LABEL[question.topic]}
          {question.targetHouse ? `・第 ${question.targetHouse} 宮：${HOUSES[question.targetHouse - 1]}` : ''}</p>
        <h1 className="question-text">{question.text}</h1>
        <p className="muted">
          {question.timeframe && <>時間範圍：{question.timeframe}・</>}
          {dateLabel && <>{dateLabel}・</>}{METHOD_LABEL[source.kind]}
        </p>
        <details className="scope-note">
          <summary>基礎象徵解讀・內容草稿</summary>
          <p>這一版只說明裁判、兩個證人、第 1 宮與你選的問題宮各自的象徵主題，並附上反思提示。
            尚未包含成就關係、相位等技法，也不是完整的傳統斷事，因此不會告訴你事情「會不會成」。
            中文象義是本產品的編輯草稿，尚未經地占專家逐條審校。重要決定仍需要實際資訊。</p>
          <p className="muted">規則版本 {reading.ruleVersion}・內容版本 {reading.contentVersion}</p>
        </details>
      </header>

      <div className="segmented result-tabs" role="group" aria-label="結果內容">
        <button type="button" aria-pressed={tab === 'reading'} onClick={() => setTab('reading')}>解讀</button>
        <button type="button" aria-pressed={tab === 'chart'} onClick={() => setTab('chart')}>盤面</button>
        {notes && <button type="button" aria-pressed={tab === 'notes'} onClick={() => setTab('notes')}>筆記</button>}
      </div>

      <div className="result-body">
        <div className={`result-pane pane-chart${tab === 'chart' ? ' is-active' : ''}`}>
          <h2>盤面</h2>
          <ChartPanel chart={chart} source={source} targetHouse={question.targetHouse} selected={selected}
            onSelect={setSelected} animate={animate} onSkipAnimation={onSkipAnimation} />
        </div>
        <div className="result-side">
          <div className={`result-pane pane-reading${tab === 'reading' ? ' is-active' : ''}`}>
            <h2>解讀</h2>
            {reading.claims.map(claim => (
              <ClaimCard key={claim.claimId} claim={claim} onShowNode={showNode} onEvidenceOpened={onEvidenceOpened} />
            ))}
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
