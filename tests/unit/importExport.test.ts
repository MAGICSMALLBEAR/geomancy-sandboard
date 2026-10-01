import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { asCopy, buildExportFiles, checkRecord, jsonDepth, parseImport, planImport,
  MAX_IMPORT_BYTES, MAX_IMPORT_RECORDS, type ImportItem } from '../../src/infrastructure/importExport.ts';
import type { ReadingRecord } from '../../src/domain/contracts.ts';

const NOW = '2026-10-01T00:00:00.000Z';
const backupText = readFileSync(new URL('../../fixtures/teaching-backup.json', import.meta.url), 'utf8');
const backup = () => JSON.parse(backupText);
const parse = (value: unknown) => {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return parseImport(text, new TextEncoder().encode(text).length, NOW);
};
const items = (value: unknown): ImportItem[] => {
  const result = parse(value);
  if (!result.ok) throw new Error(result.code);
  return result.items;
};
const only = (value: unknown) => items(value)[0];
const record = (): ReadingRecord => {
  const item = only(backup());
  if (item.status !== 'valid') throw new Error('fixture must be valid');
  return item.record;
};
const edited = (edit: (r: ReturnType<typeof backup>['records'][0]) => void) => {
  const file = backup();
  edit(file.records[0]);
  return only(file);
};

describe('import validation', () => {
  test('I01b: an automatic-sand record survives export and import unchanged', () => {
    const auto = { ...record(), source: { kind: 'auto' as const, algorithm: 'webcrypto-counts-v1' as const, counts: [...(record().source as { counts: readonly number[] }).counts] } };
    const back = only(buildExportFiles([auto], NOW)[0].text);
    expect(back.status === 'valid' && back.record).toEqual(auto);
    expect(checkRecord(auto)).toMatchObject({ ok: true });
  });

  test('I01: export then import restores every field exactly', () => {
    const original = { ...record(), notes: '繁體中文筆記：回顧一下。', revision: 3, updatedAt: '2026-10-02T03:04:05.000Z' };
    const [file] = buildExportFiles([original], NOW);
    expect(file.filename).toBe('geomancy-backup-2026-10-01.json');
    expect(file.text).toContain('\n  "format": "geomancy-journal"');
    const back = only(file.text);
    expect(back).toMatchObject({ status: 'valid' });
    expect(back.status === 'valid' && back.record).toEqual(original);
  });

  test('I02/I03: same ID is a duplicate when identical and a conflict when notes differ', () => {
    const mine = record();
    const plan = (theirs: ReadingRecord) => planImport(items(buildExportFiles([theirs], NOW)[0].text), [mine])[0];
    expect(plan(mine).kind).toBe('duplicate');
    expect(plan({ ...mine, notes: '另一台裝置上的筆記' }).kind).toBe('conflict');
    expect(planImport(items(backup()), [])[0].kind).toBe('new');
    const copy = asCopy({ ...mine, notes: '另一台裝置上的筆記' }, NOW);
    expect(copy.id).not.toBe(mine.id);
    expect(copy.importOrigin).toEqual({ originalId: mine.id, importedAt: NOW });
    expect(checkRecord(copy).ok).toBe(true);
  });

  test('I04: any altered non-judge position is rejected even though the judge is still right', () => {
    for (const node of ['D1', 'N3', 'RW', 'M2', 'R']) {
      const item = edited(r => { r.chart[node][0] ^= 1; });
      expect(item, node).toMatchObject({ status: 'invalid', code: 'INTEGRITY_MISMATCH' });
    }
  });

  test('I05: a changed source with untouched mothers is rejected, not repaired', () => {
    expect(edited(r => { r.source.counts[0] += 1; })).toMatchObject({ status: 'invalid', code: 'INTEGRITY_MISMATCH' });
    expect(edited(r => { r.mothers[1][2] ^= 1; })).toMatchObject({ status: 'invalid', code: 'INTEGRITY_MISMATCH' });
  });

  test('I06: edited claim text or evidence cannot pass as this content version', () => {
    expect(edited(r => { r.reading.claims[0].text = '保證成功。'; })).toMatchObject({ status: 'invalid', code: 'INTEGRITY_MISMATCH' });
    expect(edited(r => { r.reading.claims[3].evidence[0].house = 7; })).toMatchObject({ status: 'invalid', code: 'INTEGRITY_MISMATCH' });
    expect(edited(r => { r.reading.claims.pop(); })).toMatchObject({ status: 'invalid', code: 'INTEGRITY_MISMATCH' });
    expect(edited(r => { r.reading.reviewStatus = 'expert-reviewed'; })).toMatchObject({ status: 'invalid' });
  });

  test('R04: unknown rule/content/schema versions become read-only archives and are never recomputed', () => {
    for (const edit of [
      (r: Record<string, unknown>) => { r.ruleVersion = 'western-golden-dawn-v2'; },
      (r: Record<string, unknown>) => { r.contentVersion = 'zh-TW-expert-v9'; },
      (r: Record<string, unknown>) => { r.schemaVersion = 2; },
    ]) {
      const item = edited(edit);
      expect(item.status).toBe('unsupported');
      if (item.status !== 'unsupported') continue;
      expect(item.archive.preview.questionText).toBe(backup().records[0].question.text);
      expect(JSON.parse(item.archive.raw).chart.J).toEqual([0, 1, 1, 0]);
      expect(planImport([item], [])[0].kind).toBe('archive');
    }
    const futureFile = backup();
    futureFile.schemaVersion = 2;
    expect(only(futureFile).status).toBe('unsupported');
    expect(edited(r => { r.ruleVersion = { nested: true }; })).toMatchObject({ status: 'invalid' });
  });

  test('field-level rules: IDs, dates, revisions, lengths, question and source shapes', () => {
    const invalid = (edit: Parameters<typeof edited>[0]) => expect(edited(edit).status).toBe('invalid');
    invalid(r => { r.id = 'not-a-uuid'; });
    invalid(r => { r.revision = -1; });
    invalid(r => { r.revision = 1.5; });
    invalid(r => { r.createdAt = '2026/09/30'; });
    invalid(r => { r.updatedAt = 'yesterday'; });
    invalid(r => { r.notes = 'x'.repeat(5001); });
    invalid(r => { r.notes = 42; });
    invalid(r => { r.integrity = 'unverified'; });
    invalid(r => { r.question.text = ' '; });
    invalid(r => { r.question.targetHouse = 5; });
    invalid(r => { r.question.timeframe = 'x'.repeat(81); });
    invalid(r => { r.source.counts[3] = 0; });
    invalid(r => { r.source.counts.pop(); });
    invalid(r => { r.source = { kind: 'quick', algorithm: 'math-random', bytes: [1, 2] }; });
    invalid(r => { r.source = { kind: 'dice' }; });
    invalid(r => { r.source = { kind: 'auto', algorithm: 'math-random', counts: r.source.counts }; });
    invalid(r => { r.source = { kind: 'auto', algorithm: 'webcrypto-counts-v1', counts: [...r.source.counts.slice(1), 21] }; });
    invalid(r => { r.source = { kind: 'auto', algorithm: 'webcrypto-counts-v1', counts: r.source.counts.slice(1) }; });
    invalid(r => { r.chart.J = [0, 1, 1]; });
    invalid(r => { delete r.chart.R; });
    invalid(r => { r.importOrigin = { originalId: 'x', importedAt: NOW }; });
    invalid(r => { r.reading.claims[0].sourceIds = Array(17).fill('G01'); });
    invalid(r => { r.reading.claims[0].evidence[0].dots = '0110'; });
    invalid(r => { r.reading.claims[0].evidence[0].nodeId = 'X9'; });
    expect(items({ ...backup(), records: ['text', null, 7] }).every(i => i.status === 'invalid')).toBe(true);
  });

  test('I07: size, depth and count limits reject the file before anything is interpreted', () => {
    expect(parseImport('{}', MAX_IMPORT_BYTES + 1, NOW)).toEqual({ ok: false, code: 'IMPORT_TOO_LARGE' });
    const deep = '['.repeat(5000) + ']'.repeat(5000);
    expect(jsonDepth(deep)).toBe(5000);
    expect(jsonDepth('{"a":"[[[[{{{{\\"[["}')).toBe(1);
    expect(parse(`{"format":"geomancy-journal","schemaVersion":1,"records":${deep}}`)).toEqual({ ok: false, code: 'IMPORT_INVALID' });
    expect(parse({ ...backup(), records: Array(MAX_IMPORT_RECORDS + 1).fill(backup().records[0]) })).toEqual({ ok: false, code: 'IMPORT_TOO_LARGE' });
    expect(edited(r => { r.reading.claims = Array(17).fill(r.reading.claims[0]); })).toMatchObject({ status: 'invalid' });
    for (const text of ['', 'not json', '[]', 'null', '{"format":"other","records":[]}', '{"format":"geomancy-journal"}']) {
      expect(parse(text), text).toEqual({ ok: false, code: 'IMPORT_INVALID' });
    }
    expect(items({ format: 'geomancy-journal', schemaVersion: 1, records: [] })).toEqual([]);
  });

  test('I08: prototype keys and extra fields are dropped; markup stays inert text', () => {
    const text = backupText
      .replace('"format": "geomancy-journal",', '"format": "geomancy-journal", "__proto__": {"polluted": true},')
      .replace('"revision": 0,', '"revision": 0, "__proto__": {"polluted": true}, "constructor": {"prototype": {"polluted": true}}, "extra": "<script>alert(1)</script>",')
      .replace('"text": "未來三個月，申請這個職位時有哪些值得留意的條件？",', '"text": "<img src=x onerror=alert(1)>", "__proto__": {"topic": "general"},');
    const item = only(text);
    expect(item.status).toBe('valid');
    if (item.status !== 'valid') return;
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(Object.keys(item.record)).not.toContain('extra');
    expect(Object.getPrototypeOf(item.record)).toBe(Object.prototype);
    expect(item.record.question).toEqual({ text: '<img src=x onerror=alert(1)>', timeframe: '未來三個月', topic: 'work', targetHouse: 10 });
  });

  test('two records with the same ID inside one file are not both accepted', () => {
    const file = backup();
    file.records.push(structuredClone(file.records[0]));
    expect(items(file).map(i => i.status)).toEqual(['valid', 'invalid']);
  });
});

describe('export', () => {
  test('more than 100 records are split into importable parts', () => {
    const base = record();
    const many = Array.from({ length: 205 }, (_, i) => ({ ...base, id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}` }));
    const files = buildExportFiles(many, NOW);
    expect(files.map(f => f.filename)).toEqual([1, 2, 3].map(n => `geomancy-backup-2026-10-01-part${n}of3.json`));
    expect(files.map(f => items(f.text).filter(i => i.status === 'valid').length)).toEqual([100, 100, 5]);
  });
  test('an empty journal still produces one valid, empty file', () => {
    const files = buildExportFiles([], NOW);
    expect(files).toHaveLength(1);
    expect(items(files[0].text)).toEqual([]);
  });
});
