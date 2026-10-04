import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { FIGURES, HOUSES } from '../../src/domain/catalog.ts';
import { buildReading, isKnownContentVersion } from '../../src/domain/reading.ts';
import { buildReadingV1, CONTENT_V1 } from '../../src/domain/readingV1.ts';
import { sourceToMothers } from '../../src/domain/geomancy.ts';
import { checkRecord } from '../../src/infrastructure/importExport.ts';
import type { ReadingRecord } from '../../src/domain/contracts.ts';

const stored = (): ReadingRecord =>
  JSON.parse(readFileSync(new URL('../../fixtures/teaching-backup.json', import.meta.url), 'utf8')).records[0];

describe('R05: content versions', () => {
  test('v1 still composes exactly the text saved in the teaching backup', () => {
    const r = stored();
    expect(r.contentVersion).toBe(CONTENT_V1);
    expect(buildReadingV1(sourceToMothers(r.source), r.question)).toEqual(r.reading);
    expect(buildReading(sourceToMothers(r.source), r.question, CONTENT_V1)).toEqual(r.reading);
  });

  test('editing the live catalog does not change v1 or invalidate a saved v1 record', () => {
    const figure = FIGURES[0] as unknown as { keywords: string[]; reflection: string };
    const houses = HOUSES as unknown as string[];
    const before = { keywords: figure.keywords, reflection: figure.reflection, house: houses[9] };
    try {
      figure.keywords = ['審校後的新詞'];
      figure.reflection = '審校後的新提示。';
      houses[9] = '審校後的宮名';
      const r = stored();
      expect(buildReadingV1(sourceToMothers(r.source), r.question)).toEqual(r.reading);
      expect(checkRecord(r)).toMatchObject({ ok: true });
    } finally {
      figure.keywords = before.keywords;
      figure.reflection = before.reflection;
      houses[9] = before.house;
    }
  });

  test('a v1 record with altered text is still rejected', () => {
    const r = stored();
    r.reading.claims[0].text += '（竄改）';
    expect(checkRecord(r)).toMatchObject({ ok: false, code: 'INTEGRITY_MISMATCH' });
  });

  test('only registered versions are known', () => {
    expect(isKnownContentVersion(CONTENT_V1)).toBe(true);
    expect(isKnownContentVersion('zh-TW-expert-v9')).toBe(false);
    expect(isKnownContentVersion('__proto__')).toBe(false);
    expect(isKnownContentVersion('toString')).toBe(false);
  });
});
