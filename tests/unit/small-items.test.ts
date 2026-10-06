// 0.11.0: planned next step and review date, persistent storage request, low-power sand tray (DECISIONS D37–D39).
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { mothersFromCounts } from '../../src/domain/geomancy.ts';
import { openRepository } from '../../src/infrastructure/db.ts';
import { MemoryRepository, type Repository } from '../../src/infrastructure/repository.ts';
import { buildExportFiles, checkRecord, parseImport, planImport } from '../../src/infrastructure/importExport.ts';
import { isCalendarDate, isReviewDue, localDate } from '../../src/infrastructure/records.ts';
import { persistState, requestPersist, storageUsage } from '../../src/app/storage.ts';
import { looksLowPower } from '../../src/features/casting/SandCanvas.tsx';
import type { ReadingRecord } from '../../src/domain/contracts.ts';
import type { AppError } from '../../src/infrastructure/errors.ts';

const fixture = JSON.parse(readFileSync(new URL('../../fixtures/teaching.json', import.meta.url), 'utf8'));
const NOW = '2026-10-06T00:00:00.000Z';
const code = (promise: Promise<unknown>) => promise.then(() => 'resolved', (e: AppError) => e.code);

const makers: [string, () => Promise<Repository>][] = [
  ['IndexedDB', async () => { globalThis.indexedDB = new IDBFactory(); return openRepository(); }],
  ['memory', async () => new MemoryRepository()],
];
async function savedRecord(repo: Repository): Promise<ReadingRecord> {
  const draft = await repo.createDraft(fixture.question, 'manual');
  await repo.prepareSource(draft.id, 0, { kind: 'manual', mothers: mothersFromCounts(fixture.counts) });
  return repo.finalizeDraft(draft.id);
}

describe.each(makers)('%s repository: planned next step', (_name, make) => {
  test('save, replace and remove with the same revision rules as notes; follow-up and notes are kept', async () => {
    const repo = await make();
    const record = await savedRecord(repo);
    const first = await repo.savePlan(record.id, 0, { action: '先寫信問職位細節。', reviewOn: '2026-10-20' });
    expect(first).toMatchObject({ revision: 1, plan: { action: '先寫信問職位細節。', reviewOn: '2026-10-20' } });
    expect(Date.parse(first.plan!.recordedAt)).not.toBeNaN();
    expect(await code(repo.savePlan(record.id, 0, { action: 'x' }))).toBe('REVISION_CONFLICT');
    // Only a date, or only an action, is fine.
    const dateOnly = await repo.savePlan(record.id, 1, { action: '', reviewOn: '2026-11-01' });
    expect(dateOnly.plan).toMatchObject({ action: '', reviewOn: '2026-11-01' });
    const actionOnly = await repo.savePlan(record.id, 2, { action: '觀察一週' });
    expect('reviewOn' in actionOnly.plan!).toBe(false);
    const withOutcome = await repo.saveOutcome(record.id, 3, { status: 'unclear', text: '' });
    const noted = await repo.saveNotes(record.id, 4, '筆記');
    expect(noted.plan?.action).toBe('觀察一週');
    expect(noted.outcome).toEqual(withOutcome.outcome);
    const removed = await repo.savePlan(record.id, 5, null);
    expect(removed.plan).toBeUndefined();
    expect(removed.outcome?.status).toBe('unclear');
  });

  test('rejects an empty plan, an impossible date or an over-long action without changing the record', async () => {
    const repo = await make();
    const record = await savedRecord(repo);
    for (const plan of [{ action: '   ' }, { action: '', reviewOn: '2026-02-30' }, { action: 'x', reviewOn: '2026/10/20' },
      { action: 'x', reviewOn: '' }, { action: 'x'.repeat(1001) }]) {
      expect(await code(repo.savePlan(record.id, 0, plan))).toBe('INVALID_PLAN');
    }
    expect(await repo.getReading(record.id)).toMatchObject({ revision: 0 });
  });
});

describe('planned next step in backups', () => {
  const parse = (text: string) => {
    const result = parseImport(text, new TextEncoder().encode(text).length, NOW);
    if (!result.ok) throw new Error(result.code);
    return result.items;
  };
  test('survives export and import exactly; a different plan is a conflict, the same one a duplicate', async () => {
    const repo = new MemoryRepository();
    const record = await repo.savePlan((await savedRecord(repo)).id, 0, { action: '找朋友聊聊', reviewOn: '2026-12-01' });
    const [item] = parse(buildExportFiles([record], NOW)[0].text);
    expect(item.status === 'valid' && item.record).toEqual(record);
    expect(planImport([item], [record])[0].kind).toBe('duplicate');
    expect(planImport([item], [{ ...record, plan: { ...record.plan!, reviewOn: '2026-12-02' } }])[0].kind).toBe('conflict');
    const plain = await savedRecord(new MemoryRepository());
    const [back] = parse(buildExportFiles([plain], NOW)[0].text);
    expect(back.status === 'valid' && 'plan' in back.record).toBe(false);
  });

  test('a malformed plan rejects the whole record', async () => {
    const record = await savedRecord(new MemoryRepository());
    for (const plan of [{ action: 5, recordedAt: NOW }, { action: '', recordedAt: NOW }, { action: 'x', reviewOn: '2026-13-01', recordedAt: NOW },
      { action: 'x', recordedAt: 'yesterday' }, 'x']) {
      expect(checkRecord({ ...record, plan })).toMatchObject({ ok: false, code: 'IMPORT_INVALID' });
    }
  });
});

describe('review dates', () => {
  const base = { createdAt: '2026-10-01T09:00:00.000Z' } as ReadingRecord;
  const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h);
  test('calendar dates are checked for real days', () => {
    expect(isCalendarDate('2028-02-29')).toBe(true);
    expect(isCalendarDate('2026-02-29')).toBe(false);
    expect(isCalendarDate('2026-1-5')).toBe(false);
    expect(localDate(at(2026, 10, 31), 1)).toBe('2026-11-01');
    expect(localDate(at(2026, 12, 31, 23), 7)).toBe('2027-01-07');
  });
  test('due on the chosen day in local time; without a date, after a week; never once a follow-up exists', () => {
    const planned = { ...base, plan: { action: '', reviewOn: '2026-10-03', recordedAt: NOW } };
    expect(isReviewDue(planned, at(2026, 10, 2, 23))).toBe(false);
    expect(isReviewDue(planned, at(2026, 10, 3, 0))).toBe(true);
    // A later date wins over the one-week default.
    expect(isReviewDue({ ...base, plan: { action: 'x', reviewOn: '2026-12-01', recordedAt: NOW } }, at(2026, 11, 1))).toBe(false);
    expect(isReviewDue(base, at(2026, 10, 7))).toBe(false);
    expect(isReviewDue(base, at(2026, 10, 9))).toBe(true);
    expect(isReviewDue({ ...planned, outcome: { status: 'matched', text: '', recordedAt: NOW } }, at(2026, 10, 9))).toBe(false);
  });
});

describe('persistent storage request', () => {
  afterEach(() => { vi.unstubAllGlobals(); });
  test('no Storage API: unsupported, and nothing throws', async () => {
    vi.stubGlobal('navigator', {});
    expect(await persistState()).toBe('unsupported');
    expect(await requestPersist()).toBe('unsupported');
    expect(await storageUsage()).toBeNull();
  });
  test('reports the current state and the answer to a request; a throwing browser counts as a refusal', async () => {
    let granted = false;
    const persist = vi.fn(async () => granted);
    vi.stubGlobal('navigator', { storage: { persisted: async () => granted, persist, estimate: async () => ({ usage: 2048 }) } });
    expect(await persistState()).toBe('not-persisted');
    expect(await requestPersist()).toBe('not-persisted');
    granted = true;
    expect(await requestPersist()).toBe('persisted');
    expect(await persistState()).toBe('persisted');
    expect(await storageUsage()).toBe(2048);
    persist.mockRejectedValueOnce(new Error('denied'));
    expect(await requestPersist()).toBe('not-persisted');
  });
});

test('low-power guess: two cores or 2 GB or less; unknown values do not count', () => {
  expect(looksLowPower({ hardwareConcurrency: 2 })).toBe(true);
  expect(looksLowPower({ hardwareConcurrency: 8, deviceMemory: 1 })).toBe(true);
  expect(looksLowPower({ hardwareConcurrency: 8, deviceMemory: 8 })).toBe(false);
  expect(looksLowPower({})).toBe(false);
  expect(looksLowPower({ hardwareConcurrency: 0 })).toBe(false);
});
