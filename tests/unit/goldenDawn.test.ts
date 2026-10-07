// 0.12.0: Golden Dawn house rule (DECISIONS D41; sources G02, G13).
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  constructChart, houseNode, houseNodes, houseOf, mothersFromCounts, HOUSE_NODES, NODES, RULE_GOLDEN_DAWN, RULE_VERSION,
  type Bit, type Chart, type Figure, type Mothers, type NodeId,
} from '../../src/domain/geomancy.ts';
import { buildReading } from '../../src/domain/reading.ts';
import { findAspects, findPerfection, findRecurrences, haltedChart, houseReadings, wayOfPoints } from '../../src/domain/advanced.ts';
import { openRepository } from '../../src/infrastructure/db.ts';
import { MemoryRepository, type Repository } from '../../src/infrastructure/repository.ts';
import { buildExportFiles, checkRecord, parseImport } from '../../src/infrastructure/importExport.ts';
import { buildShareQuery, parseShareQuery } from '../../src/infrastructure/shareLink.ts';

const fixture = JSON.parse(readFileSync(new URL('../../fixtures/teaching.json', import.meta.url), 'utf8'));
const GD = RULE_GOLDEN_DAWN;
const NOW = '2026-10-06T00:00:00.000Z';

test('house map is exactly the Golden Dawn text: the 1st to 12th figures go to houses 10,1,4,7,11,2,5,8,12,3,6,9 (G13)', () => {
  const order: NodeId[] = ['M1', 'M2', 'M3', 'M4', 'D1', 'D2', 'D3', 'D4', 'N1', 'N2', 'N3', 'N4'];
  expect(order.map(node => houseOf(node, GD))).toEqual([10, 1, 4, 7, 11, 2, 5, 8, 12, 3, 6, 9]);
  expect([...houseNodes(GD)].sort()).toEqual([...order].sort());
  for (let h = 1; h <= 12; h++) expect(houseOf(houseNode(h, GD), GD)).toBe(h);
  for (const node of ['RW', 'LW', 'J', 'R'] as NodeId[]) expect(houseOf(node, GD)).toBeNull();
  // The default is unchanged.
  expect(houseNodes()).toEqual(HOUSE_NODES);
  expect(houseNode(10)).toBe('N2');
});

/** A chart whose sequential houses hold what the Golden Dawn houses hold in `chart`. */
const asSequential = (chart: Chart): Chart => {
  const copy = { ...chart } as Record<NodeId, Figure>;
  HOUSE_NODES.forEach((node, i) => { copy[node] = chart[houseNode(i + 1, GD)]; });
  return copy as Chart;
};
const mothersOf = (n: number): Mothers =>
  [0, 1, 2, 3].map(m => [0, 1, 2, 3].map(r => ((n >> (m * 4 + r)) & 1) as Bit)) as unknown as Mothers;

test('perfection, aspects, recurrences and house readings under Golden Dawn equal the sequential rules on the re-housed figures (sampled charts)', () => {
  const problems: string[] = [];
  for (let n = 0; n < 65536; n += 13) {
    const chart = constructChart(mothersOf(n)), moved = asSequential(chart);
    for (const q of [null, 5, 6, 7, 10] as const) {
      const strip = (v: unknown) => JSON.stringify(v);
      if (strip(findPerfection(chart, q, GD)) !== strip(findPerfection(moved, q))) problems.push(`${n}/${q}: perfection`);
      if (strip(findAspects(chart, q, GD)) !== strip(findAspects(moved, q))) problems.push(`${n}/${q}: aspects`);
      if (strip(findRecurrences(chart, q, GD)) !== strip(findRecurrences(moved, q))) problems.push(`${n}/${q}: recurrences`);
      const a = houseReadings(chart, q, GD), b = houseReadings(moved, q);
      if (a.some((r, i) => r.text !== b[i].text || r.node !== houseNode(r.house, GD))) problems.push(`${n}/${q}: houses`);
    }
    const way = wayOfPoints(chart, GD);
    if (way.roots.some(r => r.house !== houseOf(r.node, GD))) problems.push(`${n}: way of points`);
  }
  expect(problems).toEqual([]);
}, 60_000);

test('halted-chart note names the house the first mother is in', () => {
  // First mother Rubeus = 2122 → counts with even/odd per line.
  const chart = constructChart(mothersFromCounts([2, 1, 2, 2, ...fixture.counts.slice(4)]));
  expect(haltedChart(chart)?.text).toContain('第一母象（第 1 宮）');
  expect(haltedChart(chart, GD)?.text).toContain('第一母象（第 10 宮）');
});

describe('basic reading', () => {
  const mothers = mothersFromCounts(fixture.counts);
  test('sequential output is unchanged by the new parameter', () => {
    expect(buildReading(mothers, fixture.question)).toEqual(buildReading(mothers, fixture.question, undefined, RULE_VERSION));
    expect(buildReading(mothers, fixture.question).ruleVersion).toBe(RULE_VERSION);
  });
  test('Golden Dawn: the querent is the second mother, house 10 the first mother; same wording', () => {
    const seq = buildReading(mothers, fixture.question), gd = buildReading(mothers, fixture.question, undefined, GD);
    expect(gd.ruleVersion).toBe(GD);
    const ev = (claimId: string) => gd.claims.find(c => c.claimId === claimId)!.evidence[0];
    expect(ev('querent')).toMatchObject({ nodeId: 'M2', house: 1 });
    expect(ev('topic')).toMatchObject({ nodeId: 'M1', house: 10 });
    expect(gd.claims.map(c => c.claimId)).toEqual(seq.claims.map(c => c.claimId));
    expect(gd.claims.find(c => c.claimId === 'overall')).toEqual(seq.claims.find(c => c.claimId === 'overall'));
  });
  test('content v1 never pairs with another rule', () => {
    expect(() => buildReading(mothers, fixture.question, 'zh-TW-basic-draft-v1', GD)).toThrow('UNSUPPORTED_VERSION');
  });
});

const makers: [string, () => Promise<Repository>][] = [
  ['IndexedDB', async () => { globalThis.indexedDB = new IDBFactory(); return openRepository(); }],
  ['memory', async () => new MemoryRepository()],
];
describe.each(makers)('%s repository', (_name, make) => {
  test('a cast started under Golden Dawn is saved with that rule; the default stays sequential', async () => {
    const repo = await make();
    const draft = await repo.createDraft(fixture.question, 'manual', GD);
    expect(draft.ruleVersion).toBe(GD);
    await repo.prepareSource(draft.id, 0, { kind: 'manual', mothers: mothersFromCounts(fixture.counts) });
    const record = await repo.finalizeDraft(draft.id);
    expect(record).toMatchObject({ ruleVersion: GD, reading: { ruleVersion: GD } });
    expect(record.chart).toEqual(constructChart(mothersFromCounts(fixture.counts)));
    expect(checkRecord(record)).toMatchObject({ ok: true });
    const other = await make();
    const plain = await other.createDraft(fixture.question, 'manual');
    expect(plain.ruleVersion).toBe(RULE_VERSION);
  });
});

describe('backups', () => {
  const parse = (text: string) => {
    const result = parseImport(text, new TextEncoder().encode(text).length, NOW);
    if (!result.ok) throw new Error(result.code);
    return result.items;
  };
  test('a Golden Dawn record round-trips; relabelling its rule is caught; v1 with Golden Dawn is archived', async () => {
    const repo = new MemoryRepository();
    const draft = await repo.createDraft(fixture.question, 'manual', GD);
    await repo.prepareSource(draft.id, 0, { kind: 'manual', mothers: mothersFromCounts(fixture.counts) });
    const record = await repo.finalizeDraft(draft.id);
    const [item] = parse(buildExportFiles([record], NOW)[0].text);
    expect(item.status === 'valid' && item.record).toEqual(record);

    const relabelled = { ...record, ruleVersion: RULE_VERSION, reading: { ...record.reading, ruleVersion: RULE_VERSION } };
    expect(checkRecord(relabelled)).toMatchObject({ ok: false, code: 'INTEGRITY_MISMATCH' });
    expect(checkRecord({ ...record, ruleVersion: 'western-other-v9' })).toMatchObject({ ok: false, code: 'UNSUPPORTED_VERSION' });
    expect(checkRecord({ ...record, contentVersion: 'zh-TW-basic-draft-v1' })).toMatchObject({ ok: false, code: 'UNSUPPORTED_VERSION' });
  });
});

test('share links carry the rule only when it is Golden Dawn', () => {
  const mothers = mothersFromCounts(fixture.counts);
  const seq = buildShareQuery(mothers, fixture.question, false);
  const gd = buildShareQuery(mothers, fixture.question, false, GD);
  expect(seq).not.toContain('r=');
  expect(gd).toContain('r=gd');
  expect(parseShareQuery(new URLSearchParams(seq))?.rule).toBe(RULE_VERSION);
  expect(parseShareQuery(new URLSearchParams(gd))?.rule).toBe(GD);
  expect(parseShareQuery(new URLSearchParams(`${seq}&r=seq`))).toBeNull();
  expect(NODES).toHaveLength(16);
});
