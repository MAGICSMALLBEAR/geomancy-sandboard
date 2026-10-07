import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { fromDots, mothersFromCounts, toDots, NODES, type CastSource, type Mothers } from '../../src/domain/geomancy.ts';
import { openRepository, type IdbRepository } from '../../src/infrastructure/db.ts';
import { MemoryRepository, FEEDBACK_EVENT_LIMIT, trimEvents, type FeedbackEntry, type Repository } from '../../src/infrastructure/repository.ts';
import type { ReadingRecord } from '../../src/domain/contracts.ts';
import { AppError } from '../../src/infrastructure/errors.ts';
import { completeCast } from '../../src/features/casting/pending.ts';

const fixture = JSON.parse(readFileSync(new URL('../../fixtures/teaching.json', import.meta.url), 'utf8'));
const QUESTION = fixture.question;
const code = (promise: Promise<unknown>) => promise.then(() => 'resolved', (e: AppError) => e.code);

const makers: [string, () => Promise<Repository>][] = [
  ['IndexedDB', async () => { globalThis.indexedDB = new IDBFactory(); return openRepository(); }],
  ['memory', async () => new MemoryRepository()],
];

describe.each(makers)('%s repository', (_name, make) => {
  test('one active draft at a time; questions are validated', async () => {
    const repo = await make();
    const draft = await repo.createDraft(QUESTION, 'dots');
    expect(draft).toMatchObject({ revision: 0, state: 'casting', confirmedCounts: [], preparedSource: null });
    expect(await code(repo.createDraft(QUESTION, 'quick'))).toBe('DRAFT_EXISTS');
    expect((await repo.getActiveDraft())?.id).toBe(draft.id);
    await repo.discardDraft(draft.id);
    expect(await code(repo.createDraft({ ...QUESTION, text: '  ' }, 'dots'))).toBe('INVALID_QUESTION');
    expect(await code(repo.createDraft({ ...QUESTION, topic: 'general' }, 'dots'))).toBe('INVALID_QUESTION');
  });

  test('E06: rows reject 0, negatives, fractions and oversized counts without advancing', async () => {
    const repo = await make();
    const draft = await repo.createDraft(QUESTION, 'dots');
    for (const bad of [0, -1, 1.5, 4097, Number.NaN]) {
      expect(await code(repo.confirmRow(draft.id, 0, bad))).toBe('INVALID_COUNTS');
    }
    expect(await repo.loadDraft(draft.id)).toMatchObject({ revision: 0, confirmedCounts: [] });
  });

  test('C07/S04: two submissions with the same revision store one row and report one conflict', async () => {
    const repo = await make();
    const draft = await repo.createDraft(QUESTION, 'dots');
    const results = await Promise.all([code(repo.confirmRow(draft.id, 0, 3)), code(repo.confirmRow(draft.id, 0, 4))]);
    expect(results.sort()).toEqual(['REVISION_CONFLICT', 'resolved']);
    expect(await repo.loadDraft(draft.id)).toMatchObject({ revision: 1 });
    expect((await repo.loadDraft(draft.id))!.confirmedCounts).toHaveLength(1);
  });

  test('C09/S02/S03: sixteen rows finalise into one record under the draft ID, idempotently', async () => {
    const repo = await make();
    let draft = await repo.createDraft(QUESTION, 'dots');
    for (const count of fixture.counts) draft = await repo.confirmRow(draft.id, draft.revision, count);
    expect(draft).toMatchObject({ state: 'ready-to-finalize', revision: 16, preparedSource: { kind: 'dots', counts: fixture.counts } });
    expect(await code(repo.confirmRow(draft.id, 16, 1))).toBe('INVALID_STATE');

    const [a, b] = await Promise.all([repo.finalizeDraft(draft.id), repo.finalizeDraft(draft.id)]);
    expect(a).toEqual(b);
    expect(a.id).toBe(draft.id);
    expect(Object.fromEntries(NODES.map(n => [n, toDots(a.chart[n])]))).toEqual(fixture.expectedDots);
    expect(a.reading.claims.find(c => c.claimId === 'topic')?.evidence[0]).toMatchObject({ nodeId: 'N2', house: 10 });
    expect(await repo.listReadings()).toHaveLength(1);
    expect(await repo.loadDraft(draft.id)).toBeNull();
    // Reopening after a crash: the same ID still resolves to the stored record.
    expect(await repo.finalizeDraft(draft.id)).toEqual(a);
    expect(await code(repo.finalizeDraft('00000000-0000-4000-8000-00000000dead'))).toBe('NOT_FOUND');
  });

  test('a draft that is still casting cannot be finalised', async () => {
    const repo = await make();
    const draft = await repo.createDraft(QUESTION, 'dots');
    await repo.confirmRow(draft.id, 0, 5);
    expect(await code(repo.finalizeDraft(draft.id))).toBe('INVALID_STATE');
    expect(await repo.listReadings()).toHaveLength(0);
  });

  test('C11: a prepared quick source is never replaced, whatever a retry sends', async () => {
    const repo = await make();
    const draft = await repo.createDraft(QUESTION, 'quick');
    const first: CastSource = { kind: 'quick', algorithm: 'webcrypto-16bits-v1', bytes: [0xAC, 0xF0] };
    const other: CastSource = { kind: 'quick', algorithm: 'webcrypto-16bits-v1', bytes: [1, 2] };
    expect(await code(repo.prepareSource(draft.id, 0, { kind: 'manual', mothers: mothersFromCounts(fixture.counts) }))).toBe('INVALID_STATE');
    const prepared = await repo.prepareSource(draft.id, 0, first);
    expect(prepared).toMatchObject({ state: 'ready-to-finalize', revision: 1, preparedSource: first });
    expect((await repo.prepareSource(draft.id, 0, other)).preparedSource).toEqual(first);
    // Retry path used by the UI after a failed save: stale draft object, same source.
    const record = await completeCast(repo, draft, first);
    expect(record.source).toEqual(first);
    expect(record.mothers.map(toDots)).toEqual(['1212', '1122', '1111', '2222']);
  });

  test('E03/E04: every source kind agrees, and repeated mothers are legal', async () => {
    const repo = await make();
    const mothers = mothersFromCounts(fixture.counts);
    const bits = mothers.flat().join('');
    const bytes: [number, number] = [parseInt(bits.slice(0, 8), 2), parseInt(bits.slice(8), 2)];
    const charts: Pick<ReadingRecord, 'chart' | 'reading'>[] = [];
    for (const [method, source] of [
      ['quick', { kind: 'quick', algorithm: 'webcrypto-16bits-v1', bytes }],
      ['manual', { kind: 'manual', mothers }],
      // The fixture's counts (12–17) are inside the automatic range, so the same parities give the same chart.
      ['auto', { kind: 'auto', algorithm: 'webcrypto-counts-v1', counts: fixture.counts }],
    ] as ['quick' | 'manual' | 'auto', CastSource][]) {
      const draft = await repo.createDraft(QUESTION, method);
      const record = await completeCast(repo, draft, source);
      charts.push({ chart: record.chart, reading: record.reading });
    }
    expect(charts[0]).toEqual(charts[1]);
    expect(charts[2]).toEqual(charts[0]);
    expect(Object.fromEntries(NODES.map(n => [n, toDots(charts[0].chart[n])]))).toEqual(fixture.expectedDots);

    for (const dots of ['2222', '1111']) {
      const draft = await repo.createDraft(QUESTION, 'manual');
      const same = [0, 1, 2, 3].map(() => fromDots(dots)) as unknown as Mothers;
      const record = await completeCast(repo, draft, { kind: 'manual', mothers: same });
      expect(record.mothers.map(toDots)).toEqual([dots, dots, dots, dots]);
    }
  });

  test('S05/S07: notes use revisions, keep the chart untouched, and deletion removes only that record', async () => {
    const repo = await make();
    const make1 = async () => completeCast(repo, await repo.createDraft(QUESTION, 'manual'), { kind: 'manual', mothers: mothersFromCounts(fixture.counts) });
    const a = await make1(), b = await make1();
    const saved = await repo.saveNotes(a.id, 0, '第一版筆記');
    expect(saved).toMatchObject({ revision: 1, notes: '第一版筆記' });
    expect(saved.chart).toEqual(a.chart);
    expect(await code(repo.saveNotes(a.id, 0, '舊分頁的筆記'))).toBe('REVISION_CONFLICT');
    expect((await repo.getReading(a.id))?.notes).toBe('第一版筆記');
    expect(await code(repo.saveNotes(a.id, 1, 'x'.repeat(5001)))).toBe('INVALID_NOTES');
    await repo.deleteReading(a.id);
    expect(await repo.getReading(a.id)).toBeNull();
    expect((await repo.listReadings()).map(r => r.id)).toEqual([b.id]);
  });

  test('I09: a batch import is all-or-nothing and never overwrites', async () => {
    const repo = await make();
    const existing = await completeCast(repo, await repo.createDraft(QUESTION, 'manual'), { kind: 'manual', mothers: mothersFromCounts(fixture.counts) });
    await repo.saveNotes(existing.id, 0, '原本的筆記');
    const fresh = { ...existing, id: '11111111-1111-4111-8111-111111111111' };
    expect(await code(repo.importBatch([fresh, { ...existing, notes: '想覆寫' }], []))).not.toBe('resolved');
    expect(await repo.getReading(fresh.id)).toBeNull();
    expect((await repo.getReading(existing.id))?.notes).toBe('原本的筆記');
    await repo.importBatch([fresh], []);
    expect(await repo.listReadings()).toHaveLength(2);
  });

  test('settings, archives, feedback and clearAll', async () => {
    const repo = await make();
    expect(await repo.getSettings()).toEqual({ motion: 'system', sound: false, haptics: false, pilotLogging: false, theme: 'sand', houseRule: 'western-sequential-v1', aiKey: '', aiModel: 'claude-opus-5-5', language: expect.stringMatching(/^(zh-TW|en)$/) });
    await repo.setSetting('motion', 'reduce');
    await repo.setSetting('pilotLogging', true);
    await repo.setSetting('theme', 'ritual');
    await repo.setSetting('haptics', true);
    await repo.setSetting('houseRule', 'western-golden-dawn-v1');
    expect(await repo.getSettings()).toEqual({ motion: 'reduce', sound: false, haptics: true, pilotLogging: true, theme: 'ritual', houseRule: 'western-golden-dawn-v1', aiKey: '', aiModel: 'claude-opus-5-5', language: expect.stringMatching(/^(zh-TW|en)$/) });
    await repo.importBatch([], [{ archiveId: 'a1', importedAt: '2026-01-01T00:00:00.000Z', raw: '{}',
      preview: { questionText: 'q', createdAt: '', schemaVersion: '9', ruleVersion: 'r', contentVersion: 'c' } }]);
    expect(await repo.listArchives()).toHaveLength(1);
    await repo.addFeedback({ id: 'f1', createdAt: '2026-01-01T00:00:00.000Z', kind: 'rating', ease: 4, clarity: 3, improve: '' });
    await repo.createDraft(QUESTION, 'dots');
    await repo.clearAll();
    expect(await repo.listArchives()).toHaveLength(0);
    expect(await repo.listFeedback()).toHaveLength(0);
    expect(await repo.getActiveDraft()).toBeNull();
    expect((await repo.getSettings()).motion).toBe('reduce');
  });
});

test('S01: a storage failure reports an error and leaves the stored draft unchanged', async () => {
  globalThis.indexedDB = new IDBFactory();
  const repo: IdbRepository = await openRepository();
  const draft = await repo.createDraft(QUESTION, 'dots');
  await repo.confirmRow(draft.id, 0, 7);
  repo.close();
  expect(await code(repo.confirmRow(draft.id, 1, 9))).toBe('STORAGE_UNAVAILABLE');
  const reopened = await openRepository();
  expect(await reopened.loadDraft(draft.id)).toMatchObject({ revision: 1, confirmedCounts: [7] });
});

test('timestamps come from the injected clock and stay ISO UTC', async () => {
  globalThis.indexedDB = new IDBFactory();
  const repo = await openRepository({}, () => '2026-09-30T00:00:00.000Z');
  const draft = await repo.createDraft(QUESTION, 'quick');
  const record = await completeCast(repo, draft, { kind: 'quick', algorithm: 'webcrypto-16bits-v1', bytes: [0, 255] });
  expect(record).toMatchObject({ createdAt: '2026-09-30T00:00:00.000Z', updatedAt: '2026-09-30T00:00:00.000Z', revision: 0, integrity: 'verified' });
});

test('pilot events are capped at the newest 5000; ratings are kept', () => {
  const event = (i: number): FeedbackEntry => ({ id: `e${i}`, createdAt: String(i).padStart(6, '0'), kind: 'event',
    event: { schemaVersion: 1, sessionId: 's', name: 'row_confirmed', elapsedMs: i } });
  const rating: FeedbackEntry = { id: 'r', createdAt: '000000', kind: 'rating', ease: 5, clarity: 5, improve: '' };
  const { kept, dropped } = trimEvents([rating, ...Array.from({ length: FEEDBACK_EVENT_LIMIT + 3 }, (_, i) => event(i))]);
  expect(dropped.map(e => e.id)).toEqual(['e0', 'e1', 'e2']);
  expect(kept).toHaveLength(FEEDBACK_EVENT_LIMIT + 1);
  expect(kept[0]).toBe(rating);
});
