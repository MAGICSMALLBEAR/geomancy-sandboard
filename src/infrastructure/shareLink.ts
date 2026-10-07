/**
 * Share a chart by link (DECISIONS D40): `#/shared?v=1&m=<16 digits of 1/2>&t=<topic>[&h=<house>][&r=gd][&q=<question>]`.
 * `r=gd` marks the Golden Dawn house rule (D41); without it the chart uses the sequential rule.
 * The link carries the four mothers and the question's topic and house so the reading can be rebuilt;
 * the question text only when the sharer ticks it. Never notes, follow-up, dates or record IDs.
 * Everything read from a link is untrusted: parsed strictly, rendered as text, never stored.
 */
import { fromDots, RULE_GOLDEN_DAWN, RULE_VERSION, toDots, type Mothers, type RuleVersion } from '../domain/geomancy.ts';
import { assertQuestion, type Question } from '../domain/reading.ts';

export const SHARE_FORMAT = '1';
/** Shown in place of the question when the link has none. */
export const NO_QUESTION_TEXT = '（分享者沒有附上問題）';
export const NO_QUESTION_TEXT_EN = '(The sharer did not include a question)';

export type SharedChart = { mothers: Mothers; question: Question; hasQuestion: boolean; rule: RuleVersion };

export function buildShareQuery(mothers: Mothers, question: Question, includeQuestion: boolean, rule: RuleVersion = RULE_VERSION): string {
  const params = new URLSearchParams({ v: SHARE_FORMAT, m: mothers.map(toDots).join(''), t: question.topic });
  if (question.targetHouse !== null) params.set('h', String(question.targetHouse));
  if (rule === RULE_GOLDEN_DAWN) params.set('r', 'gd');
  if (includeQuestion) params.set('q', question.text);
  return params.toString();
}

/** Absolute link for the app at its current address (works for any host or sub-path). */
export function buildShareUrl(base: { origin: string; pathname: string }, mothers: Mothers, question: Question, includeQuestion: boolean,
  rule: RuleVersion = RULE_VERSION): string {
  return `${base.origin}${base.pathname}#/shared?${buildShareQuery(mothers, question, includeQuestion, rule)}`;
}

export function parseShareQuery(params: URLSearchParams): SharedChart | null {
  // Reject repeated or unknown keys rather than guess which one was meant.
  const allowed = new Set(['v', 'm', 't', 'h', 'r', 'q']);
  const keys = [...params.keys()];
  if (keys.some(k => !allowed.has(k)) || new Set(keys).size !== keys.length) return null;
  if (params.get('v') !== SHARE_FORMAT) return null;
  const m = params.get('m') ?? '';
  if (!/^[12]{16}$/.test(m)) return null;
  const mothers = [0, 4, 8, 12].map(i => fromDots(m.slice(i, i + 4))) as unknown as Mothers;
  const topic = params.get('t');
  const h = params.get('h');
  if (h !== null && !/^(5|6|7|10)$/.test(h)) return null;
  const r = params.get('r');
  if (r !== null && r !== 'gd') return null;
  const q = params.get('q');
  const question = {
    text: q ?? NO_QUESTION_TEXT, timeframe: '',
    topic, targetHouse: h === null ? null : Number(h),
  } as Question;
  try { assertQuestion(question); } catch { return null; }
  return { mothers, question, hasQuestion: q !== null, rule: r === 'gd' ? RULE_GOLDEN_DAWN : RULE_VERSION };
}
