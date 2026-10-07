// 0.12.0: share a chart by link (DECISIONS D40). Links are untrusted input.
import { describe, expect, test } from 'vitest';
import { fromDots, type Mothers } from '../../src/domain/geomancy.ts';
import type { Question } from '../../src/domain/reading.ts';
import { NO_QUESTION_TEXT, buildShareQuery, buildShareUrl, parseShareQuery } from '../../src/infrastructure/shareLink.ts';

const mothers = ['1121', '2212', '2112', '1122'].map(fromDots) as unknown as Mothers;
const q = (topic: Question['topic'], targetHouse: Question['targetHouse'], text = '這次面試順利嗎？'): Question =>
  ({ text, timeframe: '三個月內', topic, targetHouse, originalText: '心裡很亂' });
const parse = (query: string) => parseShareQuery(new URLSearchParams(query));

describe('share link', () => {
  test('round trip for every topic and house; without the question only the topic and house travel', () => {
    for (const question of [q('general', null), q('work', 6), q('work', 7), q('work', 10), q('relationship', 5), q('relationship', 7)]) {
      const without = parse(buildShareQuery(mothers, question, false))!;
      expect(without.mothers).toEqual(mothers);
      expect(without).toMatchObject({ hasQuestion: false, question: { text: NO_QUESTION_TEXT, timeframe: '', topic: question.topic, targetHouse: question.targetHouse } });
      expect('originalText' in without.question).toBe(false);
      const withText = parse(buildShareQuery(mothers, question, true))!;
      expect(withText).toMatchObject({ hasQuestion: true, question: { text: question.text, timeframe: '' } });
    }
  });

  test('the link holds no timeframe, original text or anything not chosen', () => {
    const query = buildShareQuery(mothers, q('work', 10), false);
    expect([...new URLSearchParams(query).keys()].sort()).toEqual(['h', 'm', 't', 'v']);
    expect(query).not.toContain(encodeURIComponent('三個月'));
  });

  test('question text with URL-special characters survives', () => {
    const text = 'A&B #2 ?=50% <b>粗體</b> 🌙';
    expect(parse(buildShareQuery(mothers, q('general', null, text), true))!.question.text).toBe(text);
    const url = buildShareUrl({ origin: 'https://example.org', pathname: '/geo/' }, mothers, q('general', null, text), true);
    expect(url.startsWith('https://example.org/geo/#/shared?v=1&m=1121221221121122&t=general&q=')).toBe(true);
  });

  test('rejects anything malformed instead of guessing', () => {
    const good = buildShareQuery(mothers, q('work', 10), false);
    expect(parse(good)).not.toBeNull();
    for (const bad of [
      good.replace('v=1', 'v=2'), good.replace('v=1&', ''),
      good.replace(/m=\d+/, 'm=112122121112112'), good.replace(/m=\d+/, 'm=1121221221121123'),
      `${good}&x=1`, `${good}&m=1111111111111111`,
      good.replace('h=10', 'h=5'), good.replace('h=10', 'h=10.0'), good.replace('&h=10', ''),
      'v=1&m=1121221221121122&t=general&h=10', 'v=1&m=1121221221121122&t=other',
      `${good}&q=`, `${good}&q=%20%20`, `${good}&q=${'字'.repeat(501)}`,
    ]) {
      expect(parse(bad), bad).toBeNull();
    }
  });
});
