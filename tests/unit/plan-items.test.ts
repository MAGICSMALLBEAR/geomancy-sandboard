// 0.9.0: original question text, halted-chart note, planetary rulers.
import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { constructChart, fromDots, mothersFromCounts, type Mothers } from '../../src/domain/geomancy.ts';
import { FIGURES } from '../../src/domain/catalog.ts';
import { assertQuestion, ORIGINAL_TEXT_MAX } from '../../src/domain/reading.ts';
import { haltedChart } from '../../src/domain/advanced.ts';
import { PLANET } from '../../src/content/learn.ts';
import { MemoryRepository } from '../../src/infrastructure/repository.ts';
import { buildExportFiles, checkRecord, parseImport } from '../../src/infrastructure/importExport.ts';

const fixture = JSON.parse(readFileSync(new URL('../../fixtures/teaching.json', import.meta.url), 'utf8'));
const NOW = '2026-10-05T00:00:00.000Z';

describe('original question text', () => {
  test('optional, string, at most 1000 characters', () => {
    expect(() => assertQuestion({ ...fixture.question, originalText: '亂七八糟的想法' })).not.toThrow();
    expect(() => assertQuestion({ ...fixture.question, originalText: 'x'.repeat(ORIGINAL_TEXT_MAX + 1) })).toThrow('INVALID_QUESTION');
    expect(() => assertQuestion({ ...fixture.question, originalText: 42 })).toThrow('INVALID_QUESTION');
  });

  test('kept through draft, record and backup; an empty original is not stored; the reading ignores it', async () => {
    const repo = new MemoryRepository();
    const make = async (originalText: string) => {
      const draft = await repo.createDraft({ ...fixture.question, originalText }, 'manual');
      await repo.prepareSource(draft.id, 0, { kind: 'manual', mothers: mothersFromCounts(fixture.counts) });
      return repo.finalizeDraft(draft.id);
    };
    const withOriginal = await make('工作好累，要不要換？還是先忍？');
    expect(withOriginal.question.originalText).toBe('工作好累，要不要換？還是先忍？');
    const text = buildExportFiles([withOriginal], NOW)[0].text;
    const parsed = parseImport(text, text.length * 3, NOW);
    expect(parsed.ok && parsed.items[0].status === 'valid' && parsed.items[0].record).toEqual(withOriginal);

    const plain = await make('   '.trim());
    expect('originalText' in plain.question).toBe(false);
    expect(plain.reading).toEqual(withOriginal.reading);
  });

  test('an over-long original in a backup rejects the record', async () => {
    const repo = new MemoryRepository();
    const draft = await repo.createDraft(fixture.question, 'manual');
    await repo.prepareSource(draft.id, 0, { kind: 'manual', mothers: mothersFromCounts(fixture.counts) });
    const record = await repo.finalizeDraft(draft.id);
    const bad = { ...record, question: { ...record.question, originalText: 'x'.repeat(1001) } };
    expect(checkRecord(bad)).toMatchObject({ ok: false, code: 'IMPORT_INVALID' });
  });
});

describe('halted chart (G10)', () => {
  const chartWithFirst = (dots: string) => {
    const mothers = mothersFromCounts(fixture.counts);
    return constructChart([fromDots(dots), mothers[1], mothers[2], mothers[3]] as unknown as Mothers);
  };
  test('only Rubeus or Cauda Draconis as the first mother; never tells the user to recast', () => {
    for (const f of FIGURES) {
      const note = haltedChart(chartWithFirst(f.dots));
      if (f.id === 'rubeus' || f.id === 'cauda-draconis') {
        expect(note?.figure.id).toBe(f.id);
        expect(note?.text).toContain('不要求重起');
      } else {
        expect(note).toBeNull();
      }
    }
  });
});

describe('planetary rulers (G09)', () => {
  test('every figure has one; each planet has exactly two figures', () => {
    expect(FIGURES.every(f => PLANET[f.id])).toBe(true);
    const counts = new Map<string, number>();
    for (const f of FIGURES) {
      const key = PLANET[f.id].latin.includes('Node') ? 'Nodes' : PLANET[f.id].latin;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    expect([...counts.values()].every(n => n === 2)).toBe(true);
    expect(counts.size).toBe(8);
    expect(PLANET['fortuna-major'].latin).toBe('Sun');
    expect(PLANET.carcer.latin).toBe('Saturn');
  });
});
