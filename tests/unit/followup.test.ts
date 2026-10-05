// 0.8.0: aspects, recurring figures (advanced reading) and the "what happened afterwards" follow-up.
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { constructChart, fromDots, HOUSE_NODES, mothersFromCounts, toDots, type Chart, type Figure, type Mothers } from '../../src/domain/geomancy.ts';
import { aspectBetween, findAspects, findRecurrences } from '../../src/domain/advanced.ts';
import { openRepository } from '../../src/infrastructure/db.ts';
import { MemoryRepository, type Repository } from '../../src/infrastructure/repository.ts';
import { buildExportFiles, checkRecord, parseImport, planImport } from '../../src/infrastructure/importExport.ts';
import type { ReadingRecord } from '../../src/domain/contracts.ts';
import type { AppError } from '../../src/infrastructure/errors.ts';

const fixture = JSON.parse(readFileSync(new URL('../../fixtures/teaching.json', import.meta.url), 'utf8'));
const teaching = constructChart(mothersFromCounts(fixture.counts));
const withHouses = (houses: Record<number, string>): Chart => {
  const chart = { ...teaching } as Record<string, Figure>;
  for (const [house, dots] of Object.entries(houses)) chart[HOUSE_NODES[Number(house) - 1]] = fromDots(dots);
  return chart as Chart;
};
const NOW = '2026-10-05T00:00:00.000Z';
const code = (promise: Promise<unknown>) => promise.then(() => 'resolved', (e: AppError) => e.code);

describe('aspects (G08)', () => {
  test('houses apart: 2 sextile, 3 square, 4 trine, 6 opposition; 1 and 5 none; symmetric around the circle', () => {
    expect(aspectBetween(1, 3)).toBe('sextile');
    expect(aspectBetween(1, 11)).toBe('sextile');
    expect(aspectBetween(1, 4)).toBe('square');
    expect(aspectBetween(1, 10)).toBe('square');
    expect(aspectBetween(1, 5)).toBe('trine');
    expect(aspectBetween(1, 9)).toBe('trine');
    expect(aspectBetween(1, 7)).toBe('opposition');
    for (const h of [2, 6, 8, 12]) expect(aspectBetween(1, h)).toBeNull();
    for (let a = 1; a <= 12; a++) for (let b = 1; b <= 12; b++) expect(aspectBetween(a, b)).toBe(aspectBetween(b, a));
  });

  test('teaching chart, house 10: base square, and no figure recurs, so no extra aspects', () => {
    const result = findAspects(teaching, 10);
    expect(result.status).toBe('checked');
    if (result.status !== 'checked') return;
    expect(result.base).toBe('square');
    expect(result.hits).toEqual([]);
  });

  test("the querent's figure in house 4 opposes house 10; the quesited's figure in house 5 is trine to house 1", () => {
    const chart = withHouses({ 4: toDots(teaching.M1), 5: toDots(teaching.N2) });
    const result = findAspects(chart, 10);
    if (result.status !== 'checked') throw new Error('not checked');
    expect(result.hits.map(h => `${h.who}:${h.from}->${h.to}:${h.kind}`)).toEqual(['querent:4->10:opposition', 'quesited:5->1:trine']);
  });

  test('no quesited house: not judged', () => {
    expect(findAspects(teaching, null)).toEqual({ status: 'no-quesited' });
  });
});

describe('recurring figures', () => {
  test('teaching chart: twelve different figures and the judge (Conjunctio) is in no house', () => {
    expect(findRecurrences(teaching, 10)).toEqual([]);
  });

  test("a repeat of the querent's figure is listed first, with its houses", () => {
    const chart = withHouses({ 7: toDots(teaching.M1), 3: toDots(teaching.N3) });
    const result = findRecurrences(chart, 10);
    expect(result[0]).toMatchObject({ houses: [1, 7], roles: ['querent'] });
    expect(result[0].text).toContain('第 1 宮');
    expect(result.some(r => r.houses.join() === '3,11')).toBe(true);
  });

  test('all 65,536 charts: each group shares one figure, repeats or carries the judge, and covers houses once', () => {
    const problems: string[] = [];
    for (let n = 0; n < 65536 && problems.length < 5; n++) {
      const mothers = [0, 1, 2, 3].map(i => [0, 1, 2, 3].map(j => (n >> (i * 4 + j)) & 1)) as unknown as Mothers;
      const chart = constructChart(mothers);
      const at = (h: number) => toDots(chart[HOUSE_NODES[h - 1]]);
      const seen = new Set<number>();
      for (const g of findRecurrences(chart, 10)) {
        if (new Set(g.houses.map(at)).size !== 1) problems.push(`${n}: mixed figures`);
        if (g.houses.length < 2 && !g.roles.includes('judge')) problems.push(`${n}: lone figure listed`);
        for (const h of g.houses) { if (seen.has(h)) problems.push(`${n}: house ${h} twice`); seen.add(h); }
      }
      const aspects = findAspects(chart, 10);
      if (aspects.status === 'checked') {
        for (const hit of aspects.hits) {
          if (at(hit.from) !== at(hit.who === 'querent' ? 1 : 10)) problems.push(`${n}: aspect from a different figure`);
          if (aspectBetween(hit.from, hit.to) !== hit.kind) problems.push(`${n}: wrong aspect kind`);
        }
      }
    }
    expect(problems).toEqual([]);
  }, 60_000);
});

const makers: [string, () => Promise<Repository>][] = [
  ['IndexedDB', async () => { globalThis.indexedDB = new IDBFactory(); return openRepository(); }],
  ['memory', async () => new MemoryRepository()],
];
async function savedRecord(repo: Repository): Promise<ReadingRecord> {
  const draft = await repo.createDraft(fixture.question, 'manual');
  await repo.prepareSource(draft.id, 0, { kind: 'manual', mothers: mothersFromCounts(fixture.counts) });
  return repo.finalizeDraft(draft.id);
}

describe.each(makers)('%s repository: follow-up', (_name, make) => {
  test('save, replace and remove a follow-up with the same revision rules as notes', async () => {
    const repo = await make();
    const record = await savedRecord(repo);
    const first = await repo.saveOutcome(record.id, 0, { status: 'partly', text: '面試有進展，但職位改了。' });
    expect(first).toMatchObject({ revision: 1, outcome: { status: 'partly', text: '面試有進展，但職位改了。' } });
    expect(Date.parse(first.outcome!.recordedAt)).not.toBeNaN();
    expect(await code(repo.saveOutcome(record.id, 0, { status: 'matched', text: '' }))).toBe('REVISION_CONFLICT');
    const second = await repo.saveOutcome(record.id, 1, { status: 'matched', text: '' });
    expect(second.outcome?.status).toBe('matched');
    // Notes still work on top, and keep the follow-up.
    const noted = await repo.saveNotes(record.id, 2, '補一句筆記');
    expect(noted.outcome?.status).toBe('matched');
    const removed = await repo.saveOutcome(record.id, 3, null);
    expect(removed.outcome).toBeUndefined();
    expect((await repo.getReading(record.id))?.outcome).toBeUndefined();
  });

  test('rejects an unknown status or an over-long text without changing the record', async () => {
    const repo = await make();
    const record = await savedRecord(repo);
    expect(await code(repo.saveOutcome(record.id, 0, { status: 'won' as never, text: '' }))).toBe('INVALID_OUTCOME');
    expect(await code(repo.saveOutcome(record.id, 0, { status: 'unclear', text: 'x'.repeat(2001) }))).toBe('INVALID_OUTCOME');
    expect(await repo.getReading(record.id)).toMatchObject({ revision: 0 });
  });
});

describe('follow-up in backups', () => {
  const parse = (text: string) => {
    const result = parseImport(text, new TextEncoder().encode(text).length, NOW);
    if (!result.ok) throw new Error(result.code);
    return result.items;
  };
  test('survives export and import exactly; a different follow-up is a conflict, the same one a duplicate', async () => {
    const repo = new MemoryRepository();
    const record = await repo.saveOutcome((await savedRecord(repo)).id, 0, { status: 'not-matched', text: '後來沒有申請。' });
    const [item] = parse(buildExportFiles([record], NOW)[0].text);
    expect(item.status === 'valid' && item.record).toEqual(record);
    expect(planImport([item], [record])[0].kind).toBe('duplicate');
    const other = { ...record, outcome: { ...record.outcome!, status: 'matched' as const } };
    expect(planImport([item], [other])[0].kind).toBe('conflict');
    // Records without a follow-up still round-trip without gaining one.
    const plain = await savedRecord(new MemoryRepository());
    const [back] = parse(buildExportFiles([plain], NOW)[0].text);
    expect(back.status === 'valid' && 'outcome' in back.record).toBe(false);
  });

  test('a malformed follow-up rejects the whole record', async () => {
    const repo = new MemoryRepository();
    const record = await savedRecord(repo);
    for (const outcome of [{ status: 'won', text: '', recordedAt: NOW }, { status: 'matched', text: 5, recordedAt: NOW },
      { status: 'matched', text: '', recordedAt: 'yesterday' }, 'matched']) {
      const check = checkRecord({ ...record, outcome });
      expect(check).toMatchObject({ ok: false, code: 'IMPORT_INVALID' });
    }
  });
});
