/** Pure draft/record transitions shared by the IndexedDB and in-memory repositories. */
import { constructChart, isRuleVersion, pressFigure, sourceToMothers, RULE_VERSION, type CastSource, type RuleVersion } from '../domain/geomancy.ts';
import { CONTENT_VERSION } from '../domain/catalog.ts';
import { assertQuestion, buildReading, cleanQuestion, type ContentVersion, type Question } from '../domain/reading.ts';
import { CONTENT_EN1 } from '../domain/readingEn1.ts';
import { OUTCOME_STATUSES, type ActionPlan, type AiReading, type Draft, type Outcome, type ReadingRecord } from '../domain/contracts.ts';
import { isAiReading } from './ai.ts';
import { AppError, toAppError } from './errors.ts';

export const NOTES_MAX = 5000;
export const OUTCOME_TEXT_MAX = 2000;
export const PLAN_ACTION_MAX = 1000;
export const ROW_MAX_DOTS = 4096;
export type CastMethod = Draft['method'];

/** crypto.randomUUID needs a secure context; getRandomValues does not. IDs are not cast randomness. */
export function newId(): string {
  const b = new Uint8Array(16);
  globalThis.crypto.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const hex = Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function newDraft(id: string, question: Question, method: CastMethod, now: string, rule: RuleVersion = RULE_VERSION,
  content: ContentVersion = CONTENT_VERSION): Draft {
  try { assertQuestion(question); } catch (e) { throw toAppError(e); }
  if (method !== 'dots' && method !== 'press' && method !== 'auto' && method !== 'quick' && method !== 'manual') throw new AppError('INVALID_STATE');
  if (!isRuleVersion(rule) || (content !== CONTENT_VERSION && content !== CONTENT_EN1)) throw new AppError('INVALID_STATE');
  return {
    schemaVersion: 1, id, revision: 0, createdAt: now, updatedAt: now,
    question: cleanQuestion(question),
    ruleVersion: rule, contentVersion: content,
    method, confirmedCounts: [], ...(method === 'press' ? { confirmedPresses: [] } : {}), preparedSource: null, state: 'casting',
  };
}

/** Long-press method: store one press's byte. The fourth press locks the source, like row 16 for dots. */
export function withConfirmedPress(draft: Draft, expectedRevision: number, byte: number, now: string): Draft {
  if (draft.revision !== expectedRevision) throw new AppError('REVISION_CONFLICT');
  const presses = draft.confirmedPresses ?? [];
  if (draft.method !== 'press' || draft.state !== 'casting' || presses.length >= 4) throw new AppError('INVALID_STATE');
  try { pressFigure(byte); } catch (e) { throw toAppError(e); }
  const confirmedPresses = [...presses, byte];
  const done = confirmedPresses.length === 4;
  return {
    ...draft, confirmedPresses, revision: draft.revision + 1, updatedAt: now,
    state: done ? 'ready-to-finalize' : 'casting',
    preparedSource: done
      ? { kind: 'press', algorithm: 'webcrypto-press-v1',
          bytes: [confirmedPresses[0], confirmedPresses[1], confirmedPresses[2], confirmedPresses[3]] }
      : null,
  };
}

export function withConfirmedRow(draft: Draft, expectedRevision: number, count: number, now: string): Draft {
  if (draft.revision !== expectedRevision) throw new AppError('REVISION_CONFLICT');
  if (draft.method !== 'dots' || draft.state !== 'casting' || draft.confirmedCounts.length >= 16) {
    throw new AppError('INVALID_STATE');
  }
  if (!Number.isSafeInteger(count) || count < 1 || count > ROW_MAX_DOTS) throw new AppError('INVALID_COUNTS');
  const confirmedCounts = [...draft.confirmedCounts, count];
  const done = confirmedCounts.length === 16;
  return {
    ...draft, confirmedCounts, revision: draft.revision + 1, updatedAt: now,
    state: done ? 'ready-to-finalize' : 'casting',
    preparedSource: done ? { kind: 'dots', counts: confirmedCounts } : null,
  };
}

/** Auto/quick/manual only. An already prepared source is returned untouched and never overwritten. */
export function withPreparedSource(draft: Draft, expectedRevision: number, source: CastSource, now: string): Draft {
  if (draft.preparedSource) return draft;
  if (draft.revision !== expectedRevision) throw new AppError('REVISION_CONFLICT');
  if (draft.method === 'dots' || draft.method === 'press' || source.kind !== draft.method || draft.state !== 'casting') {
    throw new AppError('INVALID_STATE');
  }
  try { sourceToMothers(source); } catch (e) { throw toAppError(e); }
  const prepared: CastSource = source.kind === 'quick'
    ? { kind: 'quick', algorithm: source.algorithm, bytes: [source.bytes[0], source.bytes[1]] }
    : source.kind === 'auto'
      ? { kind: 'auto', algorithm: source.algorithm, counts: [...source.counts] }
      : { kind: 'manual', mothers: sourceToMothers(source) };
  return { ...draft, preparedSource: prepared, state: 'ready-to-finalize', revision: draft.revision + 1, updatedAt: now };
}

/** Same ID as the draft; the chart and reading are recomputed from the locked source only. */
export function recordFromDraft(draft: Draft, now: string): ReadingRecord {
  if (draft.state !== 'ready-to-finalize' || !draft.preparedSource) throw new AppError('INVALID_STATE');
  // Drafts from before 0.12.0 may carry an older Chinese version: new records always use the current one.
  const content: ContentVersion = draft.contentVersion === CONTENT_EN1 ? CONTENT_EN1 : CONTENT_VERSION;
  try {
    const mothers = sourceToMothers(draft.preparedSource);
    return {
      schemaVersion: 1, id: draft.id, revision: 0, createdAt: now, updatedAt: now,
      ruleVersion: draft.ruleVersion, contentVersion: content,
      question: draft.question, source: draft.preparedSource, mothers,
      chart: constructChart(mothers), reading: buildReading(mothers, draft.question, content, draft.ruleVersion),
      notes: '', integrity: 'verified',
    };
  } catch (e) { throw toAppError(e); }
}

export function withNotes(record: ReadingRecord, expectedRevision: number, notes: string, now: string): ReadingRecord {
  if (record.revision !== expectedRevision) throw new AppError('REVISION_CONFLICT');
  if (typeof notes !== 'string' || notes.length > NOTES_MAX) throw new AppError('INVALID_NOTES');
  return { ...record, notes, revision: record.revision + 1, updatedAt: now };
}

/** Add, replace or (with null) remove the follow-up. Same revision guard as notes. */
export function withOutcome(record: ReadingRecord, expectedRevision: number, outcome: Omit<Outcome, 'recordedAt'> | null, now: string): ReadingRecord {
  if (record.revision !== expectedRevision) throw new AppError('REVISION_CONFLICT');
  const base = { ...record, revision: record.revision + 1, updatedAt: now };
  if (outcome === null) {
    delete base.outcome;
    return base;
  }
  if (!OUTCOME_STATUSES.includes(outcome.status) || typeof outcome.text !== 'string' || outcome.text.length > OUTCOME_TEXT_MAX) {
    throw new AppError('INVALID_OUTCOME');
  }
  return { ...base, outcome: { status: outcome.status, text: outcome.text, recordedAt: now } };
}

/** A real calendar date written as `YYYY-MM-DD` (no time, no zone). */
export function isCalendarDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/** Add, replace or (with null) remove the planned next step. Same revision guard as notes. */
export function withPlan(record: ReadingRecord, expectedRevision: number, plan: Omit<ActionPlan, 'recordedAt'> | null, now: string): ReadingRecord {
  if (record.revision !== expectedRevision) throw new AppError('REVISION_CONFLICT');
  const base = { ...record, revision: record.revision + 1, updatedAt: now };
  if (plan === null) {
    delete base.plan;
    return base;
  }
  if (typeof plan.action !== 'string' || plan.action.length > PLAN_ACTION_MAX
    || (plan.reviewOn !== undefined && !isCalendarDate(plan.reviewOn))
    || (plan.action.trim() === '' && plan.reviewOn === undefined)) {
    throw new AppError('INVALID_PLAN');
  }
  return { ...base, plan: { action: plan.action, ...(plan.reviewOn === undefined ? {} : { reviewOn: plan.reviewOn }), recordedAt: now } };
}

/** Records with no follow-up and no review date are suggested for review after this long. */
export const REVIEW_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

/** The device's local calendar date, `YYYY-MM-DD`, optionally shifted by whole days. */
export function localDate(now: Date, addDays = 0): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + addDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Due for "what happened afterwards": the chosen review date has come, or (without one) a week has passed. */
export function isReviewDue(record: ReadingRecord, now: Date): boolean {
  if (record.outcome) return false;
  if (record.plan?.reviewOn) return localDate(now) >= record.plan.reviewOn;
  return now.getTime() - Date.parse(record.createdAt) > REVIEW_AFTER_MS;
}

/** Store (or with null remove) the AI retelling exactly as returned and checked. Same revision guard as notes. */
export function withAi(record: ReadingRecord, expectedRevision: number, ai: AiReading | null, now: string): ReadingRecord {
  if (record.revision !== expectedRevision) throw new AppError('REVISION_CONFLICT');
  const base = { ...record, revision: record.revision + 1, updatedAt: now };
  if (ai === null) {
    delete base.ai;
    return base;
  }
  if (!isAiReading(ai)) throw new AppError('INVALID_STATE');
  return { ...base, ai: structuredClone(ai) };
}
