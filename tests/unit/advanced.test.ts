import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { constructChart, fromDots, HOUSE_NODES, mothersFromCounts, PARENTS, type Chart, type Figure, type Mothers } from '../../src/domain/geomancy.ts';
import { buildAdvancedReading, findPerfection, houseReadings, neighbours, wayOfPoints } from '../../src/domain/advanced.ts';

const fixture = JSON.parse(readFileSync(new URL('../../fixtures/teaching.json', import.meta.url), 'utf8'));
const teaching = constructChart(mothersFromCounts(fixture.counts));

/** The teaching chart with some houses replaced: perfection only reads houses 1–12. */
const withHouses = (houses: Record<number, string>): Chart => {
  const chart = { ...teaching } as Record<string, Figure>;
  for (const [house, dots] of Object.entries(houses)) chart[HOUSE_NODES[Number(house) - 1]] = fromDots(dots);
  return chart as Chart;
};
const modes = (chart: Chart, quesited: number) => {
  const result = findPerfection(chart, quesited);
  if (result.status !== 'checked') throw new Error('not checked');
  return result.hits.map(h => `${h.mode}:${h.houses.join('-')}`);
};

describe('perfection (G06)', () => {
  test('houses neighbour in a circle', () => {
    expect(neighbours(1)).toEqual([12, 2]);
    expect(neighbours(12)).toEqual([11, 1]);
    expect(neighbours(7)).toEqual([6, 8]);
  });

  test('teaching chart: twelve different figures, so house 10 is in denial', () => {
    const result = findPerfection(teaching, 10);
    expect(result.status === 'checked' && result.hits).toEqual([]);
    expect(result.status === 'checked' && result.summary).toContain('不成事（Denial）');
  });

  test('no chosen house: perfection is not judged', () => {
    expect(findPerfection(teaching, null)).toEqual({ status: 'no-quesited' });
  });

  test('occupation: the same figure in house 1 and the quesited house', () => {
    expect(modes(withHouses({ 10: '1121' }), 10)).toEqual(['occupation:1-10']);
  });

  test('conjunction both ways, never counting the significators\' own houses', () => {
    // Querent's figure (Puer 1121) beside house 10.
    expect(modes(withHouses({ 11: '1121' }), 10)).toEqual(['conjunction:1-11-10']);
    // Quesited figure (Fortuna Major 2211) beside house 1, via the 12↔1 wrap.
    expect(modes(withHouses({ 12: '2211' }), 10)).toEqual(['conjunction:10-12-1']);
    // Quesited = 2: house 1 is its neighbour but is not a conjunction by itself.
    expect(modes(teaching, 2)).toEqual([]);
  });

  test('mutation: both significators side by side elsewhere', () => {
    expect(modes(withHouses({ 4: '1121', 5: '2211' }), 10)).toEqual(['mutation:4-5']);
    expect(modes(withHouses({ 5: '1121', 4: '2211' }), 10)).toEqual(['mutation:5-4']);
  });

  test('translation: a third figure beside both, including one house beside both', () => {
    // Via (1111) in house 2 (beside 1) and house 9 (beside 10).
    expect(modes(withHouses({ 2: '1111', 9: '1111' }), 10)).toEqual(['translation:2-9']);
    // Quesited 3: house 2 sits beside both house 1 and house 3.
    expect(modes(teaching, 3).filter(m => m.startsWith('translation'))).toEqual(['translation:2']);
    // A significator's own figure next to both does not count as a third figure.
    expect(modes(withHouses({ 2: '2211', 9: '2211' }), 10)).toEqual(['conjunction:10-2-1']);
  });

  test('several hits are listed strongest first', () => {
    const result = findPerfection(withHouses({ 10: '1121', 2: '1111', 9: '1111' }), 10);
    expect(result.status === 'checked' && result.hits.map(h => h.mode)).toEqual(['occupation', 'translation']);
    expect(result.status === 'checked' && result.summary).toContain('同象（Occupation）');
  });
});

describe('way of the points (G07)', () => {
  test('teaching chart: a two-dot fire line that neither witness shares stops at the judge', () => {
    const way = wayOfPoints(teaching);
    expect(way.line).toBe(0);
    expect(way.nodes).toEqual(['J']);
    expect(way.roots).toEqual([]);
    expect(way.brokenAt).toEqual(['J']);
    expect(way.text).toContain('中斷');
  });

  test('all 65,536 charts: every step keeps the judge\'s fire line; a one-dot line gives exactly one unbroken path', () => {
    const bad: number[] = [];
    for (let n = 0; n < 65536; n++) {
      const bits = Array.from({ length: 16 }, (_, i) => (n >> (15 - i)) & 1) as (0 | 1)[];
      const mothers = [0, 4, 8, 12].map(i => bits.slice(i, i + 4)) as unknown as Mothers;
      const chart = constructChart(mothers);
      const way = wayOfPoints(chart);
      const ok = way.nodes.every(node => chart[node][0] === way.line)
        && way.nodes.slice(1).every(node => way.nodes.some(child => (PARENTS[child] ?? []).includes(node)))
        && (way.line === 0 || (way.roots.length === 1 && way.brokenAt.length === 0 && way.nodes.length === 4))
        && way.roots.every(root => root.house === HOUSE_NODES.indexOf(root.node) + 1)
        && (way.roots.length > 0 || way.brokenAt.length > 0);
      if (!ok) bad.push(n);
    }
    expect(bad).toEqual([]);
  }, 60_000);
});

describe('houses and the whole advanced reading', () => {
  test('twelve houses, each with its figure, a draft line and a question; the chosen house is marked', () => {
    const houses = houseReadings(teaching, 10);
    expect(houses).toHaveLength(12);
    expect(houses[0]).toMatchObject({ house: 1, node: 'M1', isQuerent: true });
    expect(houses[0].text).toContain('少年／Puer');
    expect(houses[9]).toMatchObject({ house: 10, node: 'N2', isQuesited: true });
    expect(houses.every(h => h.text.length > 10 && h.prompt.endsWith('？'))).toBe(true);
  });

  test('deterministic, labelled as a draft, and independent of the question text', () => {
    const q = { ...fixture.question };
    const a = buildAdvancedReading(teaching, q);
    const b = buildAdvancedReading(teaching, { ...q, text: '完全不同的問題文字' });
    expect(a).toEqual(b);
    expect(a.reviewStatus).toBe('editorial-draft');
    expect(a.version).toBe('zh-TW-advanced-draft-v3');
    expect(a.court).toContain('交會／Conjunctio');
  });
});
