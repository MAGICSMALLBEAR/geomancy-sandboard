// Four long presses (DECISIONS D28): one device byte per completed press, saved before the next.
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { pressFigure, sourceToMothers, toDots, type CastSource } from '../../src/domain/geomancy.ts';
import { drawPressByte } from '../../src/domain/random.ts';
import { openRepository } from '../../src/infrastructure/db.ts';
import { MemoryRepository, type Repository } from '../../src/infrastructure/repository.ts';
import { newDraft, withConfirmedPress, withPreparedSource } from '../../src/infrastructure/records.ts';
import { buildExportFiles, checkRecord, parseImport } from '../../src/infrastructure/importExport.ts';
import { AppError } from '../../src/infrastructure/errors.ts';

const fixture = JSON.parse(readFileSync(new URL('../../fixtures/teaching.json', import.meta.url), 'utf8'));
const QUESTION = fixture.question;
const NOW = '2026-10-04T00:00:00.000Z';
const code = (fn: () => unknown) => { try { fn(); return 'ok'; } catch (e) { return (e as AppError).code; } };
const asyncCode = (p: Promise<unknown>) => p.then(() => 'resolved', (e: AppError) => e.code);
/** The teaching fixture's mothers (Puer 1121, Caput 2111, Tristitia 2221, Albus 2212) as press bytes. */
const FIXTURE_BYTES = [0b1101_0110, 0b0111_0000, 0b0001_1111, 0b0010_1001];

describe('press source', () => {
  test('a byte becomes one mother from its top four bits, fire row first', () => {
    expect(toDots(pressFigure(0b1000_0000))).toBe('1222');
    expect(toDots(pressFigure(0b0001_1111))).toBe('2221');
    expect(toDots(pressFigure(0xff))).toBe('1111');
    expect(toDots(pressFigure(0x0f))).toBe('2222');
    const source: CastSource = { kind: 'press', algorithm: 'webcrypto-press-v1', bytes: [FIXTURE_BYTES[0], FIXTURE_BYTES[1], FIXTURE_BYTES[2], FIXTURE_BYTES[3]] };
    expect(sourceToMothers(source).map(toDots)).toEqual(['1121', '2111', '2221', '2212']);
  });

  test('E06: out-of-range bytes, wrong length and unknown algorithms are rejected', () => {
    for (const bytes of [[256, 0, 0, 0], [-1, 0, 0, 0], [1.5, 0, 0, 0], [0, 0, 0]]) {
      expect(() => sourceToMothers({ kind: 'press', algorithm: 'webcrypto-press-v1', bytes } as unknown as CastSource)).toThrow();
    }
    expect(() => sourceToMothers({ kind: 'press', algorithm: 'other', bytes: [0, 0, 0, 0] } as unknown as CastSource)).toThrow();
  });

  test('one draw asks the device for exactly one byte', () => {
    const calls: number[] = [];
    expect(drawPressByte(bytes => { calls.push(bytes.length); bytes[0] = 200; })).toBe(200);
    expect(calls).toEqual([1]);
  });
});

describe('press draft transitions', () => {
  test('four presses lock the source; a fifth, a stale revision or another method is refused', () => {
    let d = newDraft('00000000-0000-4000-8000-000000000001', QUESTION, 'press', NOW);
    expect(d.confirmedPresses).toEqual([]);
    expect(code(() => withConfirmedPress(d, 1, 5, NOW))).toBe('REVISION_CONFLICT');
    expect(code(() => withConfirmedPress(d, 0, 256, NOW))).toBe('INVALID_SOURCE');
    for (const byte of FIXTURE_BYTES) d = withConfirmedPress(d, d.revision, byte, NOW);
    expect(d).toMatchObject({ revision: 4, state: 'ready-to-finalize',
      preparedSource: { kind: 'press', algorithm: 'webcrypto-press-v1', bytes: FIXTURE_BYTES } });
    expect(code(() => withConfirmedPress(d, 4, 1, NOW))).toBe('INVALID_STATE');

    const dots = newDraft('00000000-0000-4000-8000-000000000002', QUESTION, 'dots', NOW);
    expect(code(() => withConfirmedPress(dots, 0, 1, NOW))).toBe('INVALID_STATE');
    const press = newDraft('00000000-0000-4000-8000-000000000003', QUESTION, 'press', NOW);
    const source: CastSource = { kind: 'press', algorithm: 'webcrypto-press-v1', bytes: [0, 0, 0, 0] };
    expect(code(() => withPreparedSource(press, 0, source, NOW))).toBe('INVALID_STATE');
  });
});

const makers: [string, () => Promise<Repository>][] = [
  ['IndexedDB', async () => { globalThis.indexedDB = new IDBFactory(); return openRepository(); }],
  ['memory', async () => new MemoryRepository()],
];

describe.each(makers)('%s repository: presses', (_name, make) => {
  test('each press is stored at once, survives a reload, and four finalise into the fixture chart', async () => {
    const repo = await make();
    let draft = await repo.createDraft(QUESTION, 'press');
    draft = await repo.confirmPress(draft.id, 0, FIXTURE_BYTES[0]);
    expect((await repo.loadDraft(draft.id))!.confirmedPresses).toEqual([FIXTURE_BYTES[0]]);
    for (const byte of FIXTURE_BYTES.slice(1)) draft = await repo.confirmPress(draft.id, draft.revision, byte);
    const record = await repo.finalizeDraft(draft.id);
    expect(record.source).toEqual({ kind: 'press', algorithm: 'webcrypto-press-v1', bytes: FIXTURE_BYTES });
    expect(Object.fromEntries(Object.entries(record.chart).map(([n, f]) => [n, toDots(f)]))).toEqual(fixture.expectedDots);
  });

  test('C07/S04: two tabs submitting the same revision store one press', async () => {
    const repo = await make();
    const draft = await repo.createDraft(QUESTION, 'press');
    const results = await Promise.all([asyncCode(repo.confirmPress(draft.id, 0, 1)), asyncCode(repo.confirmPress(draft.id, 0, 2))]);
    expect(results.sort()).toEqual(['REVISION_CONFLICT', 'resolved']);
    expect((await repo.loadDraft(draft.id))!.confirmedPresses).toHaveLength(1);
  });
});

describe('press records: export and import', () => {
  const pressRecord = async () => {
    const repo = new MemoryRepository();
    let draft = await repo.createDraft(QUESTION, 'press');
    for (const byte of FIXTURE_BYTES) draft = await repo.confirmPress(draft.id, draft.revision, byte);
    return repo.finalizeDraft(draft.id);
  };

  test('I01: a press record survives export and import unchanged', async () => {
    const record = await pressRecord();
    expect(checkRecord(record)).toMatchObject({ ok: true });
    const text = buildExportFiles([record], NOW)[0].text;
    const parsed = parseImport(text, text.length, NOW);
    expect(parsed.ok && parsed.items[0]).toMatchObject({ status: 'valid', record });
  });

  test('I05: a changed byte that changes a mother is caught', async () => {
    const record = await pressRecord();
    const bytes = [...record.source.kind === 'press' ? record.source.bytes : []];
    bytes[0] ^= 0b1000_0000;
    const tampered = { ...record, source: { ...record.source, bytes } };
    expect(checkRecord(tampered)).toMatchObject({ ok: false, code: 'INTEGRITY_MISMATCH' });
  });
});
