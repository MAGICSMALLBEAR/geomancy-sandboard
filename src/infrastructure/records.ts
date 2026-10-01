/** Pure draft/record transitions shared by the IndexedDB and in-memory repositories. */
import { constructChart, sourceToMothers, RULE_VERSION, type CastSource } from '../domain/geomancy.ts';
import { CONTENT_VERSION } from '../domain/catalog.ts';
import { assertQuestion, buildReading, type Question } from '../domain/reading.ts';
import type { Draft, ReadingRecord } from '../domain/contracts.ts';
import { AppError, toAppError } from './errors.ts';

export const NOTES_MAX = 5000;
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

export function newDraft(id: string, question: Question, method: CastMethod, now: string): Draft {
  try { assertQuestion(question); } catch (e) { throw toAppError(e); }
  if (method !== 'dots' && method !== 'auto' && method !== 'quick' && method !== 'manual') throw new AppError('INVALID_STATE');
  return {
    schemaVersion: 1, id, revision: 0, createdAt: now, updatedAt: now,
    question: { text: question.text, timeframe: question.timeframe, topic: question.topic, targetHouse: question.targetHouse },
    ruleVersion: RULE_VERSION, contentVersion: CONTENT_VERSION,
    method, confirmedCounts: [], preparedSource: null, state: 'casting',
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
  if (draft.method === 'dots' || source.kind !== draft.method || draft.state !== 'casting') {
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
  try {
    const mothers = sourceToMothers(draft.preparedSource);
    return {
      schemaVersion: 1, id: draft.id, revision: 0, createdAt: now, updatedAt: now,
      ruleVersion: RULE_VERSION, contentVersion: CONTENT_VERSION,
      question: draft.question, source: draft.preparedSource, mothers,
      chart: constructChart(mothers), reading: buildReading(mothers, draft.question),
      notes: '', integrity: 'verified',
    };
  } catch (e) { throw toAppError(e); }
}

export function withNotes(record: ReadingRecord, expectedRevision: number, notes: string, now: string): ReadingRecord {
  if (record.revision !== expectedRevision) throw new AppError('REVISION_CONFLICT');
  if (typeof notes !== 'string' || notes.length > NOTES_MAX) throw new AppError('INVALID_NOTES');
  return { ...record, notes, revision: record.revision + 1, updatedAt: now };
}
