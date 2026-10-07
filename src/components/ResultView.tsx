import { useMemo, useState, type ReactNode } from 'react';
import type { CastSource, Chart, NodeId } from '../domain/geomancy.ts';
import type { Claim, Question, Reading } from '../domain/reading.ts';
import { figureById } from '../content/labels.ts';
import { sourceById, sourceText } from '../content/sources.ts';
import { fromDots } from '../domain/geomancy.ts';
import { useApp } from '../app/AppContext.tsx';
import { FigureGlyph } from './FigureGlyph.tsx';
import { ChartPanel } from './ChartPanel.tsx';
import { AdvancedReading } from './AdvancedReading.tsx';
import { advancedLabels, buildAdvancedReading, type AdvancedReading as Advanced } from '../domain/advanced.ts';
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
  /** Replaces the casting-method label, e.g. for a chart opened from a share link. */
  methodLabel?: string;
  /** Passed to the chart panel for manual mothers. */
  manualNote?: string;
  /** Extra reading block (the AI retelling); gets the same "show this position" action as the cards. */
  readingExtra?: (showNode: (node: NodeId) => void) => ReactNode;
};

/** At-a-glance panel: the two witnesses meeting in the judge, with the main advanced signals. Same data as below. */
function Verdict({ chart, advanced, onShowNode }: { chart: Chart; advanced: Advanced; onShowNode: (node: NodeId) => void }) {
  const { L, T, lang } = useApp();
  const { perfection: PERFECTION_LABEL, aspect: ASPECT_LABEL } = advancedLabels(lang);
  const right = figureInfo(chart.RW), left = figureInfo(chart.LW), judge = figureInfo(chart.J);
  const { perfection, aspects } = advanced;
  const fig = (node: NodeId, label: string, info: typeof judge, big = false) => (
    <button type="button" className={`verdict-figure link-button${big ? ' is-judge' : ''}`} onClick={() => onShowNode(node)}
      aria-label={L(`${label}：${info.zh}／${info.latin}，在盤面上看`, `${label}: ${T.fullName(info)}, show on the chart`)}>
      <FigureGlyph figure={chart[node]} size={big ? 46 : 32} decorative />
      <strong>{T.name(info)}</strong>
      <span>{label}</span>
    </button>
  );
  return (
    <section className="verdict" aria-labelledby="verdict-title">
      <div className="verdict-court">
        {fig('RW', T.NODE_LABEL.RW, right)}
        <span className="verdict-op" aria-hidden="true">{L('＋', '+')}</span>
        {fig('LW', T.NODE_LABEL.LW, left)}
        <span className="verdict-op" aria-hidden="true">→</span>
        {fig('J', T.NODE_LABEL.J, judge, true)}
      </div>
      <div className="verdict-text">
        <h2 id="verdict-title">{L('裁判：', 'Judge: ')}{T.name(judge)}<span className="latin">{lang === 'en' ? T.fullName(judge).replace(/^.*\(|\)$/g, '') : judge.latin}</span></h2>
        <ul className="keyword-chips" aria-label={L('裁判的象徵主題', "The Judge's themes")}>{T.keywords(judge).map(k => <li key={k}>{k}</li>)}</ul>
        {perfection.status === 'checked' && (
          <p><strong>{L('成事關係：', 'Perfection: ')}</strong>{perfection.hits.length
            ? L(`找到${PERFECTION_LABEL[perfection.hits[0].mode]}${perfection.hits.length > 1 ? `等 ${perfection.hits.length} 種` : ''}`,
              `${PERFECTION_LABEL[perfection.hits[0].mode]}${perfection.hits.length > 1 ? ` and ${perfection.hits.length - 1} more` : ''}`)
            : L('不成事（四種方式都沒有出現）', 'denial (none of the four ways appears)')}
            {aspects.status === 'checked' && aspects.base && <>{L('；宮位相位：', '; house aspect: ')}{ASPECT_LABEL[aspects.base]}</>}</p>
        )}
        <p className="muted">{L('完整說明與依據在下方。這是象徵性的觀察，不是預測。', 'Full explanations and their sources are below. This is a symbolic observation, not a prediction.')}</p>
      </div>
    </section>
  );
}

function ClaimCard({ claim, onShowNode, onEvidenceOpened }: { claim: Claim; onShowNode: (node: NodeId) => void; onEvidenceOpened?: () => void }) {
  const { L, T, lang } = useApp();
  const [open, setOpen] = useState(false);
  const panelId = `evidence-${claim.claimId}`;
  return (
    <article className="card claim">
      <h3>{claim.title}{claim.kind === 'reflection' && <span className="tag">{L('反思提示', 'Reflection')}</span>}</h3>
      <p>{claim.text}</p>
      <button type="button" className="link-button" aria-expanded={open} aria-controls={panelId}
        onClick={() => { if (!open) onEvidenceOpened?.(); setOpen(!open); }}>
        {open ? L('收起依據', 'Hide sources') : L('查看依據', 'Show sources')}
      </button>
      {open && (
        <div id={panelId} className="evidence">
          <h4>{L('這段文字來自這些盤位', 'This text comes from these positions')}</h4>
          <ul className="evidence-list">
            {claim.evidence.map(e => {
              const info = figureById(e.figureId);
              return (
                <li key={e.nodeId}>
                  <FigureGlyph figure={fromDots(e.dots)} size={24} decorative />
                  <span>
                    <strong>{T.NODE_LABEL[e.nodeId]}</strong>
                    {e.house ? L(`（第 ${e.house} 宮：${T.HOUSES[e.house - 1]}）`, ` (house ${e.house}: ${T.HOUSES[e.house - 1]})`) : ''}
                    {L('：', ': ')}{info ? T.fullName(info) : e.figureId}{L('，圖式 ', ', pattern ')}{e.dots}
                  </span>
                  <button type="button" className="link-button" onClick={() => onShowNode(e.nodeId)}>{L('在盤面上看', 'Show on the chart')}</button>
                </li>
              );
            })}
          </ul>
          <p>{L('使用的規則：', 'Rule used: ')}{T.RULE_LABEL[claim.ruleId] ?? claim.ruleId}{L('。', '. ')}
            {claim.kind === 'reflection' && L('這是本產品原創的反思提示，不是歷史文獻的判詞。', 'This is a reflection prompt written for this App, not a judgement from historical texts.')}</p>
          <h4>{L('來源', 'Sources')}</h4>
          <ul className="source-list">
            {claim.sourceIds.map(id => {
              const entry = sourceById(id), text = entry ? sourceText(entry, lang) : null;
              return (
                <li key={id}>
                  {entry?.url
                    ? <a href={entry.url} target="_blank" rel="noopener noreferrer">{text!.title}{L('（外部網頁，需要網路）', ' (external page, needs a connection)')}</a>
                    : <span>{text?.title ?? id}</span>}
                  {text && <span className="muted">　{text.note}</span>}
                </li>
              );
            })}
          </ul>
          <details className="advanced">
            <summary>{L('進階資訊', 'Technical details')}</summary>
            <p>{L('段落 ID：', 'Claim ID: ')}{claim.claimId}<br />{L('規則 ID：', 'Rule ID: ')}{claim.ruleId}<br />{L('來源 ID：', 'Source IDs: ')}{T.list(claim.sourceIds)}</p>
          </details>
        </div>
      )}
    </article>
  );
}

export function ResultView({ question, dateLabel, source, chart, reading, animate, onSkipAnimation, onEvidenceOpened, notes, banner, methodLabel, manualNote, readingExtra }: Props) {
  const { L, T, lang } = useApp();
  const [tab, setTab] = useState<'reading' | 'chart' | 'notes'>('reading');
  const [selected, setSelected] = useState<NodeId | null>(null);
  const showNode = (node: NodeId) => { setSelected(node); setTab('chart'); };
  const advanced = useMemo(() => buildAdvancedReading(chart, question, reading.ruleVersion, lang), [chart, question, reading.ruleVersion, lang]);
  const [pathShown, setPathShown] = useState(false);
  const togglePath = () => {
    const next = !pathShown;
    setPathShown(next);
    if (next) setTab('chart');
  };
  // The basic reading is a snapshot in the language it was saved in (DECISIONS D43).
  const readingIsEnglish = reading.contentVersion.startsWith('en-');

  return (
    <div className="result">
      {banner}
      <header className="result-head">
        <p className="eyebrow">{T.TOPIC_LABEL[question.topic]}
          {question.targetHouse ? L(`・第 ${question.targetHouse} 宮：${T.HOUSES[question.targetHouse - 1]}`, ` · House ${question.targetHouse}: ${T.HOUSES[question.targetHouse - 1]}`) : ''}</p>
        <h1 className="question-text">{question.text}</h1>
        {question.originalText && (
          <details className="scope-note">
            <summary>{L('最初寫下的話', 'What you first wrote')}</summary>
            <p className="original-text">{question.originalText}</p>
          </details>
        )}
        <p className="muted">
          {question.timeframe && <>{L('時間範圍：', 'Time frame: ')}{question.timeframe}・</>}
          {dateLabel && <>{dateLabel}・</>}{methodLabel ?? T.METHOD_LABEL[source.kind]}
          {reading.ruleVersion !== 'western-sequential-v1' && <>・{T.HOUSE_RULE_LABEL[reading.ruleVersion]}</>}
        </p>
        <details className="scope-note">
          <summary>{L('基礎象徵解讀・內容草稿', 'Basic symbolic reading · draft content')}</summary>
          <p>{L('基礎解讀說明裁判、兩個證人、第 1 宮與你選的問題宮各自的象徵主題，並附上反思提示。下方的進階解讀另外依傳統技法計算成事關係、相位、象的重現、點之道、證人與裁判，以及十二宮逐宮；它是象徵性的觀察，不是預測。中文文字是本產品的編輯草稿，尚未經地占專家逐條審校。重要決定仍需要實際資訊。',
            'The basic reading describes the themes of the Judge, the two Witnesses, house 1 and the house you chose, with a reflection prompt. The advanced reading below also computes perfection, aspects, recurring figures, the Way of the Points, the Witnesses and Judge, and each house with traditional techniques; it is a symbolic observation, not a prediction. The wording is this App’s editorial draft, not yet reviewed line by line by a geomancy expert. Important decisions still need real information.')}</p>
          <p className="muted">{L('規則版本 ', 'Rule version ')}{reading.ruleVersion}{L('・內容版本 ', ' · content version ')}{reading.contentVersion}</p>
        </details>
      </header>

      <Verdict chart={chart} advanced={advanced} onShowNode={showNode} />

      <div className="segmented result-tabs" role="group" aria-label={L('結果內容', 'Result sections')}>
        <button type="button" aria-pressed={tab === 'reading'} onClick={() => setTab('reading')}>{L('解讀', 'Reading')}</button>
        <button type="button" aria-pressed={tab === 'chart'} onClick={() => setTab('chart')}>{L('盤面', 'Chart')}</button>
        {notes && <button type="button" aria-pressed={tab === 'notes'} onClick={() => setTab('notes')}>{L('筆記', 'Notes')}</button>}
      </div>

      <div className="result-body">
        <div className={`result-pane pane-chart${tab === 'chart' ? ' is-active' : ''}`}>
          <h2>{L('盤面', 'Chart')}</h2>
          <ChartPanel chart={chart} source={source} manualNote={manualNote} rule={reading.ruleVersion} targetHouse={question.targetHouse} selected={selected}
            onSelect={setSelected} animate={animate} onSkipAnimation={onSkipAnimation} path={pathShown ? advanced.way.nodes : undefined}
            aspects={advanced.aspects} />
        </div>
        <div className="result-side">
          <div className={`result-pane pane-reading${tab === 'reading' ? ' is-active' : ''}`}>
            <h2>{L('解讀', 'Reading')}</h2>
            {readingIsEnglish !== (lang === 'en') && (
              <p className="notice">{L('這筆記錄是用英文介面建立的，基礎解讀保留當時的英文文字；進階解讀依目前的語言顯示。',
                'This record was made in the Chinese interface, so its basic reading keeps the Chinese text it was saved with; the advanced reading follows the current language.')}</p>
            )}
            {reading.claims.map(claim => (
              <ClaimCard key={claim.claimId} claim={claim} onShowNode={showNode} onEvidenceOpened={onEvidenceOpened} />
            ))}
            <AdvancedReading advanced={advanced} onShowNode={showNode} pathShown={pathShown} onTogglePath={togglePath} />
            {readingExtra?.(showNode)}
          </div>
          {notes && (
            <div className={`result-pane pane-notes${tab === 'notes' ? ' is-active' : ''}`}>
              <h2>{L('筆記', 'Notes')}</h2>
              {notes}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
