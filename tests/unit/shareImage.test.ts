import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { constructChart, fromDots, mothersFromCounts, type Mothers } from '../../src/domain/geomancy.ts';
import { buildShareContent } from '../../src/features/result/shareImage.ts';

const fixture = JSON.parse(readFileSync(new URL('../../fixtures/teaching.json', import.meta.url), 'utf8'));
const chart = constructChart(mothersFromCounts(fixture.counts));
const input = { chart, question: fixture.question, dateLabel: '2026年10月2日', methodLabel: '手動輸入四母象' };

describe('share image content (D25)', () => {
  test('the question text is left out unless asked for', () => {
    const plain = buildShareContent(input, false);
    expect(plain.question).toBeNull();
    expect(JSON.stringify(plain)).not.toContain(fixture.question.text);
    expect(buildShareContent(input, true).question).toBe(fixture.question.text);
  });

  test('shield rows 8 / 4 / 2 / 1 without the reconciler, first mother on the right', () => {
    const { rows } = buildShareContent(input, false);
    expect(rows.map(r => r.length)).toEqual([8, 4, 2, 1]);
    expect(rows[0][7]).toMatchObject({ node: 'M1', dots: '1121', name: '少年' });
    expect(rows[3][0]).toMatchObject({ node: 'J', dots: '2112', name: '交會' });
  });

  test('judge, topic and the perfection line follow the chart and question', () => {
    const content = buildShareContent(input, false);
    expect(content.judge).toEqual({ name: '交會', latin: 'Conjunctio', keywords: '連結、相遇、結合' });
    expect(content.topic).toBe('工作・第 10 宮：職位與公共角色');
    expect(content.perfection).toBe('成事關係（第 1 宮 × 第 10 宮）：不成事（Denial）');
    expect(content.footer).toContain('未經專家審校');

    const general = buildShareContent({ ...input, question: { ...fixture.question, topic: 'general', targetHouse: null } }, false);
    expect(general.perfection).toContain('不判斷成事關係');

    const linked = constructChart(['1222', '1111', '1111', '1111'].map(fromDots) as unknown as Mothers);
    expect(buildShareContent({ ...input, chart: linked }, false).perfection).toBe('成事關係（第 1 宮 × 第 10 宮）：接合（Conjunction）　等 3 項');
  });
});
