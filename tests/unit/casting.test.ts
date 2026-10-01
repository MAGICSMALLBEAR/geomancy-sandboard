import { describe, expect, test } from 'vitest';
import { beginTap, judgeRelease, trackTap, TAP_MAX_MOVE_PX, TAP_MAX_MS } from '../../src/features/casting/gesture.ts';
import { canConfirm, dotsReducer, initDots, type DotsState } from '../../src/features/casting/dotsReducer.ts';
import { newDraft, withConfirmedRow, ROW_MAX_DOTS } from '../../src/infrastructure/records.ts';
import type { Draft } from '../../src/domain/contracts.ts';
import { AUTO_MAX_DOTS, AUTO_MIN_DOTS, mothersFromCounts, sourceToMothers } from '../../src/domain/geomancy.ts';
import { drawAutoSource } from '../../src/domain/random.ts';

const down = (over: Partial<Parameters<typeof beginTap>[1]> = {}) =>
  ({ pointerId: 1, isPrimary: true, button: 0, x: 100, y: 100, time: 1000, ...over });
const up = (over: Partial<Parameters<typeof judgeRelease>[1]> = {}) =>
  ({ pointerId: 1, x: 100, y: 100, time: 1100, inside: true, ...over });

describe('tap judgement (C01–C04)', () => {
  test('a primary press and release in place is exactly one tap', () => {
    const c = beginTap(null, down());
    expect(judgeRelease(c, up())).toBe('tap');
  });
  test('boundary values still count: 12 px and 1500 ms', () => {
    const c = beginTap(null, down());
    expect(judgeRelease(c, up({ x: 100 + TAP_MAX_MOVE_PX, time: 1000 + TAP_MAX_MS }))).toBe('tap');
  });
  test('just past the movement limit, overtime and outside releases do not count', () => {
    const c = beginTap(null, down());
    expect(judgeRelease(c, up({ x: 100 + TAP_MAX_MOVE_PX + 1 }))).toBe('moved');
    expect(judgeRelease(c, up({ time: 1000 + TAP_MAX_MS + 1 }))).toBe('too-long');
    expect(judgeRelease(c, up({ inside: false }))).toBe('outside');
  });
  test('movement is judged by the farthest point, not the release point', () => {
    let c = beginTap(null, down());
    c = trackTap(c, 1, 140, 100);
    c = trackTap(c, 1, 100, 100);
    expect(judgeRelease(c, up())).toBe('moved');
  });
  test('second finger, non-primary button and pen side button never start or finish a tap', () => {
    expect(beginTap(null, down({ isPrimary: false }))).toBeNull();
    expect(beginTap(null, down({ button: 2 }))).toBeNull();
    expect(beginTap(null, down({ button: 5 }))).toBeNull();
    const first = beginTap(null, down());
    expect(beginTap(first, down({ pointerId: 2 }))).toBe(first);
    expect(trackTap(first, 2, 500, 500)).toBe(first);
    expect(judgeRelease(first, up({ pointerId: 2 }))).toBe('ignored');
    expect(judgeRelease(null, up())).toBe('ignored');
  });
});

const QUESTION = { text: '測試問題', timeframe: '', topic: 'general', targetHouse: null } as const;
const draftWith = (rows: number): Draft => {
  let d = newDraft('00000000-0000-4000-8000-000000000001', QUESTION, 'dots', '2026-01-01T00:00:00.000Z');
  for (let i = 0; i < rows; i++) d = withConfirmedRow(d, d.revision, i + 1, '2026-01-01T00:00:00.000Z');
  return d;
};
const run = (state: DotsState, ...types: Parameters<typeof dotsReducer>[1][]) => types.reduce(dotsReducer, state);

describe('sixteen-row reducer', () => {
  test('C06: an empty row cannot be confirmed; zero is never read as even', () => {
    const s = initDots(draftWith(0));
    expect(canConfirm(s)).toBe(false);
    expect(dotsReducer(s, { type: 'confirm-start' })).toBe(s);
    expect(() => withConfirmedRow(draftWith(0), 0, 0, 'x')).toThrowError('INVALID_COUNTS');
  });
  test('C08: taps while a row is being saved do not change the fixed count', () => {
    const saving = run(initDots(draftWith(0)), { type: 'tap' }, { type: 'tap' }, { type: 'confirm-start' });
    expect(saving.phase).toBe('saving');
    expect(run(saving, { type: 'tap' }, { type: 'clear' }).count).toBe(2);
  });
  test('S01: a failed save stays on the row and keeps the dots', () => {
    const failed = run(initDots(draftWith(2)), { type: 'tap' }, { type: 'tap' }, { type: 'tap' }, { type: 'confirm-start' },
      { type: 'confirm-fail', code: 'STORAGE_UNAVAILABLE' });
    expect(failed).toMatchObject({ phase: 'collecting', count: 3, error: 'STORAGE_UNAVAILABLE' });
    expect(failed.confirmed).toHaveLength(2);
  });
  test('rows advance only from the stored draft; rows 4/8/12 pause on the mother review', () => {
    const before = run(initDots(draftWith(3)), { type: 'tap' }, { type: 'confirm-start' });
    const stored = withConfirmedRow(draftWith(3), 3, 1, 'x');
    const revealed = dotsReducer(before, { type: 'confirm-ok', draft: stored });
    expect(revealed).toMatchObject({ phase: 'reveal', revision: 4 });
    const review = dotsReducer(revealed, { type: 'reveal-done' });
    expect(review).toMatchObject({ phase: 'mother-review', count: 0 });
    expect(dotsReducer(review, { type: 'tap' })).toBe(review);
    expect(dotsReducer(review, { type: 'continue' }).phase).toBe('collecting');
  });
  test('C10: resuming keeps confirmed rows only and re-shows a finished mother', () => {
    expect(initDots(draftWith(5))).toMatchObject({ phase: 'collecting', count: 0, confirmed: [1, 2, 3, 4, 5] });
    expect(initDots(draftWith(8)).phase).toBe('mother-review');
    expect(initDots(draftWith(16)).phase).toBe('finalizing');
  });
  test('the per-row cap stops counting without wrapping or auto-confirming', () => {
    let s = initDots(draftWith(0));
    for (let i = 0; i < ROW_MAX_DOTS + 5; i++) s = dotsReducer(s, { type: 'tap' });
    expect(s).toMatchObject({ phase: 'collecting', count: ROW_MAX_DOTS, capped: true });
    expect(dotsReducer(s, { type: 'clear' })).toMatchObject({ count: 0, capped: false });
  });
});

describe('automatic sand source', () => {
  test('16 bytes become counts 5–20 whose parity follows the low bit', () => {
    const source = drawAutoSource(bytes => bytes.set(Array.from({ length: 16 }, (_, i) => i * 17)));
    expect(source.counts).toEqual(Array.from({ length: 16 }, (_, i) => AUTO_MIN_DOTS + ((i * 17) & 15)));
    expect(source.counts.every(n => n >= AUTO_MIN_DOTS && n <= AUTO_MAX_DOTS)).toBe(true);
    expect(sourceToMothers(source)).toEqual(mothersFromCounts(source.counts));
  });
  test('the fill is called exactly once per draw', () => {
    let calls = 0;
    drawAutoSource(() => { calls += 1; });
    expect(calls).toBe(1);
  });
  test('wrong algorithm, out-of-range or missing counts are rejected', () => {
    const counts = Array(16).fill(10);
    expect(() => sourceToMothers({ kind: 'auto', algorithm: 'x' as 'webcrypto-counts-v1', counts })).toThrow();
    expect(() => sourceToMothers({ kind: 'auto', algorithm: 'webcrypto-counts-v1', counts: [...counts.slice(1), 4] })).toThrow();
    expect(() => sourceToMothers({ kind: 'auto', algorithm: 'webcrypto-counts-v1', counts: [...counts.slice(1), 21] })).toThrow();
    expect(() => sourceToMothers({ kind: 'auto', algorithm: 'webcrypto-counts-v1', counts: counts.slice(1) })).toThrow();
  });
});
