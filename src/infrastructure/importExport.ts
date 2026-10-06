/**
 * Backup export and untrusted import. Imported JSON is never merged into live objects:
 * every record is rebuilt from whitelisted fields and re-derived from its own source.
 */
import { constructChart, sourceToMothers, toDots, NODES, RULE_VERSION,
  type CastSource, type Chart, type Figure, type Mothers, type NodeId } from '../domain/geomancy.ts';
import { FIGURES } from '../domain/catalog.ts';
import { assertQuestion, buildReading, cleanQuestion, isKnownContentVersion, type Claim, type ContentVersion, type Evidence, type Question, type Reading } from '../domain/reading.ts';
import { OUTCOME_STATUSES, type ExportEnvelope, type OutcomeStatus, type ReadingRecord } from '../domain/contracts.ts';
import { NOTES_MAX, OUTCOME_TEXT_MAX, PLAN_ACTION_MAX, isCalendarDate, newId } from './records.ts';
import type { AppErrorCode } from './errors.ts';
import type { ArchiveEntry } from './repository.ts';

export const MAX_IMPORT_BYTES = 10 * 1024 * 1024;
export const MAX_IMPORT_RECORDS = 100;
export const MAX_JSON_DEPTH = 16;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHORT = 80;

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
/** Own-property read only, so `__proto__`/inherited keys can never be picked up. */
const own = (o: Obj, key: string): unknown => Object.prototype.hasOwnProperty.call(o, key) ? o[key] : undefined;
const shortText = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= SHORT;
const isoDate = (v: unknown): v is string => {
  if (typeof v !== 'string' || v.length > 40) return false;
  const time = Date.parse(v);
  return Number.isFinite(time) && new Date(time).toISOString() === v;
};

class Reject extends Error {
  code: AppErrorCode;
  constructor(code: AppErrorCode, reason: string) { super(reason); this.code = code; }
}
const bad = (reason: string): never => { throw new Reject('IMPORT_INVALID', reason); };
const mismatch = (reason: string): never => { throw new Reject('INTEGRITY_MISMATCH', reason); };

/** Bracket depth outside strings, measured before JSON.parse so deep input cannot exhaust the stack. */
export function jsonDepth(text: string): number {
  let depth = 0, max = 0, inString = false, escaped = false;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (inString) {
      if (escaped) escaped = false;
      else if (c === 92) escaped = true;
      else if (c === 34) inString = false;
    } else if (c === 34) inString = true;
    else if (c === 123 || c === 91) { if (++depth > max) max = depth; }
    else if (c === 125 || c === 93) depth--;
  }
  return max;
}

function readFigure(v: unknown, where: string): Figure {
  if (!Array.isArray(v) || v.length !== 4 || !Array.from(v).every(x => x === 0 || x === 1)) bad(`${where} 不是合法的四行圖式`);
  const [a, b, c, d] = v as Figure;
  return [a, b, c, d];
}
function readQuestion(v: unknown): Question {
  if (!isObj(v)) bad('缺少問題資料');
  const o = v as Obj;
  const original = own(o, 'originalText');
  const question = { text: own(o, 'text'), timeframe: own(o, 'timeframe'), topic: own(o, 'topic'), targetHouse: own(o, 'targetHouse'),
    ...(original === undefined ? {} : { originalText: original }) };
  try { assertQuestion(question); } catch { bad('問題、原句、時間範圍或主題宮位不合規格'); }
  return cleanQuestion(question as Question);
}
function readSource(v: unknown): CastSource {
  if (!isObj(v)) bad('缺少起卦來源');
  const o = v as Obj, kind = own(o, 'kind');
  let source: CastSource;
  if (kind === 'dots') {
    const counts = own(o, 'counts');
    if (!Array.isArray(counts)) bad('點沙來源缺少 16 列數量');
    source = { kind, counts: Array.from(counts as unknown[]) as number[] };
  } else if (kind === 'auto') {
    const counts = own(o, 'counts');
    if (!Array.isArray(counts)) bad('自動點沙來源缺少 16 列數量');
    source = { kind, algorithm: own(o, 'algorithm') as 'webcrypto-counts-v1', counts: Array.from(counts as unknown[]) as number[] };
  } else if (kind === 'press') {
    const bytes = own(o, 'bytes');
    if (!Array.isArray(bytes) || bytes.length !== 4) bad('四次長按來源需要四個位元組');
    const b = bytes as number[];
    source = { kind, algorithm: own(o, 'algorithm') as 'webcrypto-press-v1', bytes: [b[0], b[1], b[2], b[3]] };
  } else if (kind === 'quick') {
    const bytes = own(o, 'bytes');
    if (!Array.isArray(bytes) || bytes.length !== 2) bad('快速來源需要兩個位元組');
    source = { kind, algorithm: own(o, 'algorithm') as 'webcrypto-16bits-v1', bytes: [(bytes as number[])[0], (bytes as number[])[1]] };
  } else if (kind === 'manual') {
    const mothers = own(o, 'mothers');
    if (!Array.isArray(mothers) || mothers.length !== 4) bad('手動來源需要四個母象');
    source = { kind, mothers: (mothers as unknown[]).map((m, i) => readFigure(m, `來源母象 ${i + 1}`)) as unknown as Mothers };
  } else {
    return bad('未知的起卦來源');
  }
  try { sourceToMothers(source); } catch { bad('起卦來源的數值不合規格'); }
  return source;
}
function readEvidence(v: unknown): Evidence {
  if (!isObj(v)) bad('依據格式不正確');
  const o = v as Obj;
  const nodeId = own(o, 'nodeId'), figureId = own(o, 'figureId'), dots = own(o, 'dots'), house = own(o, 'house');
  if (!NODES.includes(nodeId as NodeId)) bad('依據的盤位不存在');
  if (!FIGURES.some(f => f.id === figureId)) bad('依據的象名不存在');
  if (typeof dots !== 'string' || !/^[12]{4}$/.test(dots)) bad('依據的圖式不是四位 1/2');
  if (house !== undefined && !(Number.isInteger(house) && (house as number) >= 1 && (house as number) <= 12)) bad('依據的宮位超出範圍');
  return { nodeId: nodeId as NodeId, figureId: figureId as string, dots: dots as string,
    ...(house === undefined ? {} : { house: house as number }) };
}
function readClaim(v: unknown): Claim {
  if (!isObj(v)) bad('解讀段落格式不正確');
  const o = v as Obj;
  const claimId = own(o, 'claimId'), ruleId = own(o, 'ruleId'), kind = own(o, 'kind');
  const title = own(o, 'title'), text = own(o, 'text'), evidence = own(o, 'evidence'), sourceIds = own(o, 'sourceIds');
  if (!shortText(claimId) || !shortText(ruleId)) bad('解讀段落缺少規則 ID');
  if (kind !== 'symbolic-theme' && kind !== 'reflection') bad('解讀段落種類不明');
  if (typeof title !== 'string' || title.length > 100) bad('解讀標題過長');
  if (typeof text !== 'string' || text.length > 2000) bad('解讀文字過長');
  if (!Array.isArray(evidence) || evidence.length > 16) bad('解讀依據過多');
  if (!Array.isArray(sourceIds) || sourceIds.length > 16 || !sourceIds.every(shortText)) bad('來源 ID 不合規格');
  return { claimId: claimId as string, ruleId: ruleId as string, kind: kind as Claim['kind'], title: title as string,
    text: text as string, evidence: (evidence as unknown[]).map(readEvidence), sourceIds: [...(sourceIds as string[])] };
}
function readReading(v: unknown, version: ContentVersion): Reading {
  if (!isObj(v)) bad('缺少解讀快照');
  const o = v as Obj, claims = own(o, 'claims'), reviewStatus = own(o, 'reviewStatus');
  if (own(o, 'ruleVersion') !== RULE_VERSION || own(o, 'contentVersion') !== version || own(o, 'scope') !== 'basic-symbolic' ||
      (reviewStatus !== 'editorial-draft' && reviewStatus !== 'expert-reviewed')) bad('解讀快照的版本欄位與記錄不一致');
  if (!Array.isArray(claims) || claims.length > 16) bad('解讀段落過多');
  return { ruleVersion: RULE_VERSION, contentVersion: version, scope: 'basic-symbolic',
    reviewStatus: reviewStatus as Reading['reviewStatus'], claims: (claims as unknown[]).map(readClaim) };
}

/**
 * Strict validation for a record that claims the current schema/rule version and a content version this build knows.
 * Returns a freshly built object; throws Reject with a human-readable reason otherwise.
 */
function readKnownRecord(o: Obj, version: ContentVersion): ReadingRecord {
  const id = own(o, 'id'), revision = own(o, 'revision'), createdAt = own(o, 'createdAt'), updatedAt = own(o, 'updatedAt');
  if (typeof id !== 'string' || !UUID.test(id)) bad('記錄 ID 不是 UUID');
  if (!Number.isSafeInteger(revision) || (revision as number) < 0) bad('revision 必須是非負整數');
  if (!isoDate(createdAt) || !isoDate(updatedAt)) bad('日期必須是 UTC ISO 8601');
  const question = readQuestion(own(o, 'question'));
  const source = readSource(own(o, 'source'));
  const mothers = sourceToMothers(source), chart = constructChart(mothers);

  const rawMothers = own(o, 'mothers');
  if (!Array.isArray(rawMothers) || rawMothers.length !== 4) bad('缺少四母象');
  (rawMothers as unknown[]).forEach((m, i) => {
    if (toDots(readFigure(m, `母象 ${i + 1}`)) !== toDots(mothers[i])) mismatch(`第 ${i + 1} 母象與原始來源不一致`);
  });
  const rawChart = own(o, 'chart');
  if (!isObj(rawChart)) bad('缺少盤面');
  for (const node of NODES) {
    if (toDots(readFigure(own(rawChart as Obj, node), `盤位 ${node}`)) !== toDots(chart[node])) mismatch(`盤位 ${node} 與原始來源不一致`);
  }
  // Known content version => the stored text must be exactly what that version composes, old versions included.
  const reading = readReading(own(o, 'reading'), version);
  if (JSON.stringify(reading) !== JSON.stringify(canonicalReading(buildReading(mothers, question, version)))) {
    mismatch('解讀文字或依據與此內容版本不一致');
  }
  const notes = own(o, 'notes');
  if (typeof notes !== 'string' || notes.length > NOTES_MAX) bad('筆記過長或格式不正確');
  if (own(o, 'integrity') !== 'verified') bad('integrity 欄位不正確');

  const record: ReadingRecord = {
    schemaVersion: 1, id: id as string, revision: revision as number,
    createdAt: createdAt as string, updatedAt: updatedAt as string,
    ruleVersion: RULE_VERSION, contentVersion: version,
    question, source, mothers, chart, reading, notes: notes as string, integrity: 'verified',
  };
  const outcome = own(o, 'outcome');
  if (outcome !== undefined) {
    if (!isObj(outcome)) bad('outcome 格式不正確');
    const status = own(outcome as Obj, 'status'), text = own(outcome as Obj, 'text'), recordedAt = own(outcome as Obj, 'recordedAt');
    if (!OUTCOME_STATUSES.includes(status as OutcomeStatus) || typeof text !== 'string' || text.length > OUTCOME_TEXT_MAX || !isoDate(recordedAt)) {
      bad('事後回顧（outcome）格式不正確');
    }
    record.outcome = { status: status as OutcomeStatus, text: text as string, recordedAt: recordedAt as string };
  }
  const plan = own(o, 'plan');
  if (plan !== undefined) {
    if (!isObj(plan)) bad('plan 格式不正確');
    const action = own(plan as Obj, 'action'), reviewOn = own(plan as Obj, 'reviewOn'), recordedAt = own(plan as Obj, 'recordedAt');
    if (typeof action !== 'string' || action.length > PLAN_ACTION_MAX || (reviewOn !== undefined && !isCalendarDate(reviewOn))
      || (action.trim() === '' && reviewOn === undefined) || !isoDate(recordedAt)) {
      bad('預計行動與回顧日期（plan）格式不正確');
    }
    record.plan = { action: action as string, ...(reviewOn === undefined ? {} : { reviewOn: reviewOn as string }), recordedAt: recordedAt as string };
  }
  const origin = own(o, 'importOrigin');
  if (origin !== undefined) {
    if (!isObj(origin)) bad('importOrigin 格式不正確');
    const originalId = own(origin as Obj, 'originalId'), importedAt = own(origin as Obj, 'importedAt');
    if (typeof originalId !== 'string' || !UUID.test(originalId) || !isoDate(importedAt)) bad('importOrigin 格式不正確');
    record.importOrigin = { originalId: originalId as string, importedAt: importedAt as string };
  }
  return record;
}

function canonicalReading(r: Reading): Reading {
  return { ruleVersion: r.ruleVersion, contentVersion: r.contentVersion, scope: r.scope, reviewStatus: r.reviewStatus,
    claims: r.claims.map(c => ({ claimId: c.claimId, ruleId: c.ruleId, kind: c.kind, title: c.title, text: c.text,
      evidence: c.evidence.map(e => ({ nodeId: e.nodeId, figureId: e.figureId, dots: e.dots,
        ...(e.house === undefined ? {} : { house: e.house }) })),
      sourceIds: [...c.sourceIds] })) };
}
const canonicalFigure = (f: Figure): Figure => [f[0], f[1], f[2], f[3]];
const canonicalSource = (s: CastSource): CastSource =>
  s.kind === 'dots' ? { kind: 'dots', counts: [...s.counts] }
  : s.kind === 'auto' ? { kind: 'auto', algorithm: s.algorithm, counts: [...s.counts] }
  : s.kind === 'quick' ? { kind: 'quick', algorithm: s.algorithm, bytes: [s.bytes[0], s.bytes[1]] }
  : s.kind === 'press' ? { kind: 'press', algorithm: s.algorithm, bytes: [s.bytes[0], s.bytes[1], s.bytes[2], s.bytes[3]] }
  : { kind: 'manual', mothers: s.mothers.map(canonicalFigure) as unknown as Mothers };

/** Fixed key order so two equal records always serialise identically. */
export function canonicalRecord(r: ReadingRecord): ReadingRecord {
  return {
    schemaVersion: 1, id: r.id, revision: r.revision, createdAt: r.createdAt, updatedAt: r.updatedAt,
    ruleVersion: r.ruleVersion, contentVersion: r.contentVersion,
    question: cleanQuestion(r.question),
    source: canonicalSource(r.source),
    mothers: r.mothers.map(canonicalFigure) as unknown as Mothers,
    chart: Object.fromEntries(NODES.map(n => [n, canonicalFigure(r.chart[n])])) as unknown as Chart,
    reading: canonicalReading(r.reading), notes: r.notes,
    ...(r.outcome ? { outcome: { status: r.outcome.status, text: r.outcome.text, recordedAt: r.outcome.recordedAt } } : {}),
    ...(r.plan ? { plan: { action: r.plan.action, ...(r.plan.reviewOn === undefined ? {} : { reviewOn: r.plan.reviewOn }), recordedAt: r.plan.recordedAt } } : {}),
    integrity: 'verified',
    ...(r.importOrigin ? { importOrigin: { originalId: r.importOrigin.originalId, importedAt: r.importOrigin.importedAt } } : {}),
  };
}

export type RecordCheck =
  | { ok: true; record: ReadingRecord }
  | { ok: false; code: AppErrorCode; reason: string };

/** Used for imports and for re-checking a locally stored record before it is displayed. */
export function checkRecord(raw: unknown): RecordCheck {
  try {
    if (!isObj(raw)) bad('記錄不是物件');
    const o = raw as Obj;
    const version = own(o, 'contentVersion');
    if (own(o, 'schemaVersion') !== 1 || own(o, 'ruleVersion') !== RULE_VERSION || !isKnownContentVersion(version)) {
      throw new Reject('UNSUPPORTED_VERSION', '版本不支援');
    }
    return { ok: true, record: readKnownRecord(o, version) };
  } catch (e) {
    if (e instanceof Reject) return { ok: false, code: e.code, reason: e.message };
    return { ok: false, code: 'IMPORT_INVALID', reason: '記錄格式不正確' };
  }
}

export type ImportItem =
  | { index: number; status: 'valid'; record: ReadingRecord }
  | { index: number; status: 'unsupported'; archive: ArchiveEntry }
  | { index: number; status: 'invalid'; code: AppErrorCode; reason: string };
export type ImportParse =
  | { ok: true; items: ImportItem[] }
  | { ok: false; code: AppErrorCode };

const versionLabel = (v: unknown): string | null =>
  typeof v === 'string' && v.length <= SHORT ? v : typeof v === 'number' && Number.isFinite(v) ? String(v) : null;

/** Structure is readable but the versions are not ours: keep the original JSON as a read-only archive. */
function toArchive(o: Obj, envelopeSchema: unknown, now: string): ArchiveEntry | null {
  const schema = versionLabel(own(o, 'schemaVersion') ?? envelopeSchema);
  const rule = versionLabel(own(o, 'ruleVersion')), content = versionLabel(own(o, 'contentVersion'));
  if (schema === null || rule === null || content === null) return null;
  const question = own(o, 'question');
  const text = isObj(question) ? own(question, 'text') : undefined;
  const createdAt = own(o, 'createdAt');
  return {
    archiveId: newId(), importedAt: now,
    preview: {
      questionText: typeof text === 'string' ? text.slice(0, 500) : '',
      createdAt: isoDate(createdAt) ? createdAt : '',
      schemaVersion: schema, ruleVersion: rule, contentVersion: content,
    },
    raw: JSON.stringify(o, null, 2),
  };
}

export function parseImport(text: string, byteSize: number, now: string): ImportParse {
  if (byteSize > MAX_IMPORT_BYTES) return { ok: false, code: 'IMPORT_TOO_LARGE' };
  if (jsonDepth(text) > MAX_JSON_DEPTH) return { ok: false, code: 'IMPORT_INVALID' };
  let root: unknown;
  try { root = JSON.parse(text); } catch { return { ok: false, code: 'IMPORT_INVALID' }; }
  if (!isObj(root) || own(root, 'format') !== 'geomancy-journal') return { ok: false, code: 'IMPORT_INVALID' };
  const records = own(root, 'records');
  if (!Array.isArray(records)) return { ok: false, code: 'IMPORT_INVALID' };
  if (records.length > MAX_IMPORT_RECORDS) return { ok: false, code: 'IMPORT_TOO_LARGE' };
  const envelopeSchema = own(root, 'schemaVersion');

  const seen = new Set<string>();
  const items = records.map((raw, index): ImportItem => {
    const checked = envelopeSchema === 1 ? checkRecord(raw) : { ok: false as const, code: 'UNSUPPORTED_VERSION' as const, reason: '' };
    if (checked.ok) {
      if (seen.has(checked.record.id)) return { index, status: 'invalid', code: 'IMPORT_INVALID', reason: '檔案內有重複的記錄 ID' };
      seen.add(checked.record.id);
      return { index, status: 'valid', record: checked.record };
    }
    if (checked.code === 'UNSUPPORTED_VERSION' && isObj(raw)) {
      const archive = toArchive(raw, envelopeSchema, now);
      if (archive) return { index, status: 'unsupported', archive };
      return { index, status: 'invalid', code: 'IMPORT_INVALID', reason: '版本欄位無法辨識' };
    }
    return { index, status: 'invalid', code: checked.code, reason: checked.reason || '記錄格式不正確' };
  });
  return { ok: true, items };
}

export type ImportPlanItem =
  | { index: number; kind: 'new'; record: ReadingRecord }
  | { index: number; kind: 'duplicate'; record: ReadingRecord }
  | { index: number; kind: 'conflict'; record: ReadingRecord }
  | { index: number; kind: 'archive'; archive: ArchiveEntry }
  | { index: number; kind: 'invalid'; code: AppErrorCode; reason: string };

/** Compares valid records with what this browser already has. Nothing is written here. */
export function planImport(items: ImportItem[], existing: ReadingRecord[]): ImportPlanItem[] {
  const byId = new Map(existing.map(r => [r.id, r]));
  return items.map((item): ImportPlanItem => {
    if (item.status === 'invalid') return { index: item.index, kind: 'invalid', code: item.code, reason: item.reason };
    if (item.status === 'unsupported') return { index: item.index, kind: 'archive', archive: item.archive };
    const mine = byId.get(item.record.id);
    if (!mine) return { index: item.index, kind: 'new', record: item.record };
    const same = JSON.stringify(canonicalRecord(mine)) === JSON.stringify(canonicalRecord(item.record));
    return { index: item.index, kind: same ? 'duplicate' : 'conflict', record: item.record };
  });
}

/** A conflicting record kept as a separate copy: new ID, origin recorded, existing data untouched. */
export function asCopy(record: ReadingRecord, now: string): ReadingRecord {
  return { ...record, id: newId(), importOrigin: { originalId: record.id, importedAt: now } };
}

export type ExportFile = { filename: string; text: string };

/** Splits so that every file stays within what our own importer accepts. */
export function buildExportFiles(records: ReadingRecord[], now: string): ExportFile[] {
  const encoder = new TextEncoder();
  const envelope = (chunk: ReadingRecord[]) => JSON.stringify(
    { format: 'geomancy-journal', schemaVersion: 1, exportedAt: now, records: chunk } satisfies ExportEnvelope, null, 2);
  const chunks: ReadingRecord[][] = [];
  let current: ReadingRecord[] = [];
  for (const record of records.map(canonicalRecord)) {
    const candidate = [...current, record];
    if (current.length > 0 && (candidate.length > MAX_IMPORT_RECORDS || encoder.encode(envelope(candidate)).length > MAX_IMPORT_BYTES)) {
      chunks.push(current);
      current = [record];
    } else current = candidate;
  }
  if (current.length > 0 || chunks.length === 0) chunks.push(current);
  const day = now.slice(0, 10);
  return chunks.map((chunk, i) => ({
    filename: chunks.length === 1 ? `geomancy-backup-${day}.json` : `geomancy-backup-${day}-part${i + 1}of${chunks.length}.json`,
    text: envelope(chunk),
  }));
}

export function downloadText(filename: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
