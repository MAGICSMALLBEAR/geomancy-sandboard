// 0.12.0: AI retelling with the user's own key (DECISIONS D42). The SDK is mocked: no network, no cost.
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { constructChart, mothersFromCounts, RULE_GOLDEN_DAWN, RULE_VERSION } from '../../src/domain/geomancy.ts';
import { buildReading } from '../../src/domain/reading.ts';
import type { AiReading, ReadingRecord } from '../../src/domain/contracts.ts';
import { buildAiPayload, checkParagraph, estimateCostUsd, isAiReading, parseAiOutput } from '../../src/infrastructure/ai.ts';
import { openRepository } from '../../src/infrastructure/db.ts';
import { MemoryRepository, type Repository } from '../../src/infrastructure/repository.ts';
import { buildExportFiles, checkRecord, parseImport } from '../../src/infrastructure/importExport.ts';

const sdk = vi.hoisted(() => {
  class APIError extends Error { status?: number; constructor(status?: number) { super(`status ${status}`); this.status = status; } }
  class AuthenticationError extends APIError {}
  class PermissionDeniedError extends APIError {}
  class RateLimitError extends APIError {}
  class BadRequestError extends APIError {}
  class InternalServerError extends APIError {}
  class APIConnectionError extends APIError {}
  class APIUserAbortError extends APIError {}
  const state = { params: null as unknown, options: null as unknown, reply: null as unknown, error: null as unknown };
  class Anthropic {
    static APIError = APIError; static AuthenticationError = AuthenticationError; static PermissionDeniedError = PermissionDeniedError;
    static RateLimitError = RateLimitError; static BadRequestError = BadRequestError; static InternalServerError = InternalServerError;
    static APIConnectionError = APIConnectionError; static APIUserAbortError = APIUserAbortError;
    options: unknown;
    constructor(options: unknown) { this.options = options; state.options = options; }
    beta = { messages: { stream: (params: unknown) => {
      state.params = params;
      return { finalMessage: async () => { if (state.error) throw state.error; return state.reply; } };
    } } };
  }
  return { Anthropic, state, AuthenticationError, RateLimitError };
});
vi.mock('@anthropic-ai/sdk', () => ({ default: sdk.Anthropic }));
const { requestAiReading } = await import('../../src/app/aiClient.ts');

const fixture = JSON.parse(readFileSync(new URL('../../fixtures/teaching.json', import.meta.url), 'utf8'));
const mothers = mothersFromCounts(fixture.counts);
const chart = constructChart(mothers);
const question = { ...fixture.question, text: '我在接下來三個月申請這個職位順利嗎？', originalText: '心裡的話' };
const input = { chart, question, reading: buildReading(mothers, question), rule: RULE_VERSION };
const NOW = '2026-10-07T00:00:00.000Z';
const good = { paragraphs: [
  { heading: '整體', text: '裁判是「交會」，第 10 宮的「大幸運」顯示穩定的力量。', cites: ['J', 'N2'] },
  { heading: '下一步', text: '寫下一個可以觀察的小步驟。', cites: ['J'] },
] };

describe('what is sent', () => {
  test('no question text unless chosen; never notes, follow-up, plan or IDs', () => {
    const without = JSON.stringify(buildAiPayload(input, false));
    expect(without).not.toContain(question.text);
    expect(without).not.toContain('心裡的話');
    for (const key of ['notes', 'outcome', 'plan', 'id', 'createdAt', '筆記']) expect(without).not.toContain(`"${key}"`);
    const withQ = buildAiPayload(input, true);
    expect(withQ).toMatchObject({ 問題文字: question.text, 時間範圍: question.timeframe, 問題範圍: { 主題: '工作', 問題宮: 10 } });
    expect(JSON.stringify(withQ)).not.toContain('心裡的話');
  });
  test('all sixteen positions with their houses under the chart rule', () => {
    const seq = buildAiPayload(input, false), gd = buildAiPayload({ ...input, rule: RULE_GOLDEN_DAWN }, false);
    expect(seq.盾盤).toHaveLength(16);
    expect(seq.盾盤.find(p => p.盤位 === 'M1')).toMatchObject({ 象: '少年', 宮位: 1 });
    expect(gd.盾盤.find(p => p.盤位 === 'M1')).toMatchObject({ 象: '少年', 宮位: 10 });
    expect(gd.宮位配置).toBe('Golden Dawn 入宮');
    expect(seq.盾盤.find(p => p.盤位 === 'J')).not.toHaveProperty('宮位');
  });
});

describe('what comes back', () => {
  test('strict parsing', () => {
    expect(parseAiOutput(JSON.stringify(good))).toMatchObject({ ok: true });
    for (const bad of ['not json', '[]', '{}', JSON.stringify({ paragraphs: [] }),
      JSON.stringify({ paragraphs: [{ heading: 'x', text: '', cites: [] }] }),
      JSON.stringify({ paragraphs: [{ heading: 'x', text: 'y', cites: ['XX'] }] }),
      JSON.stringify({ paragraphs: Array(9).fill(good.paragraphs[1]) }),
      JSON.stringify({ paragraphs: [{ heading: 'x', text: 'y'.repeat(1501), cites: [] }] })]) {
      expect(parseAiOutput(bad), bad.slice(0, 40)).toMatchObject({ ok: false });
    }
  });
  test('citations are checked against the chart and the house rule', () => {
    expect(checkParagraph(good.paragraphs[0] as never, chart, RULE_VERSION)).toEqual([]);
    expect(checkParagraph({ heading: '', text: '有「群眾」的力量。', cites: ['J'] }, chart, RULE_VERSION)).toEqual(['提到的「群眾」不在這張盤上。']);
    expect(checkParagraph({ heading: '', text: '第 10 宮的「少年」很明顯。', cites: ['N2'] }, chart, RULE_VERSION))
      .toEqual(['第 10 宮的象是「大幸運」，不是「少年」。']);
    // The same sentence is right under Golden Dawn, where the first mother sits in house 10.
    expect(checkParagraph({ heading: '', text: '第 10 宮的「少年」很明顯。', cites: ['M1'] }, chart, RULE_GOLDEN_DAWN)).toEqual([]);
    expect(checkParagraph({ heading: '', text: '沒有依據。', cites: [] }, chart, RULE_VERSION)).toEqual(['這段沒有標出依據的盤位。']);
  });
  test('cost estimate', () => {
    expect(estimateCostUsd('claude-opus-5-5', { inputTokens: 1_000_000, outputTokens: 100_000 })).toBeCloseTo(6);
    expect(estimateCostUsd('claude-other', { inputTokens: 1, outputTokens: 1 })).toBeNull();
  });
});

describe('the API call (mocked SDK)', () => {
  afterEach(() => { sdk.state.error = null; sdk.state.reply = null; });
  const reply = (text: string, stop = 'end_turn') => ({ model: 'claude-opus-5-5', stop_reason: stop,
    content: [{ type: 'thinking', thinking: '' }, { type: 'text', text }], usage: { input_tokens: 3000, output_tokens: 800 } });
  test('browser access with the user key, server-side fallback, structured output; returns the checked paragraphs', async () => {
    sdk.state.reply = reply(JSON.stringify(good));
    const payload = buildAiPayload(input, false);
    const result = await requestAiReading({ apiKey: 'sk-ant-test', model: 'claude-opus-5-5', payload, signal: new AbortController().signal });
    expect(sdk.state.options).toMatchObject({ apiKey: 'sk-ant-test', dangerouslyAllowBrowser: true });
    expect(sdk.state.params).toMatchObject({ model: 'claude-opus-5-5', betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default',
      thinking: { type: 'adaptive' }, output_config: { format: { type: 'json_schema' } } });
    expect(JSON.stringify(sdk.state.params)).not.toContain(question.text);
    expect(result).toEqual({ ok: true, reading: { model: 'claude-opus-5-5', promptVersion: 'zh-TW-ai-retell-v1',
      paragraphs: good.paragraphs, usage: { inputTokens: 3000, outputTokens: 800 } } });
  });
  test('refusal, truncation, bad JSON and typed API errors become clear failures; nothing is returned to save', async () => {
    const call = () => requestAiReading({ apiKey: 'k', model: 'claude-opus-5-5', payload: {}, signal: new AbortController().signal });
    sdk.state.reply = reply('', 'refusal');
    expect(await call()).toEqual({ ok: false, failure: 'refusal' });
    sdk.state.reply = reply('{"paragraphs":[', 'max_tokens');
    expect(await call()).toEqual({ ok: false, failure: 'truncated' });
    sdk.state.reply = reply('hello');
    expect(await call()).toMatchObject({ ok: false, failure: 'invalid-output' });
    sdk.state.error = new sdk.AuthenticationError(401);
    expect(await call()).toEqual({ ok: false, failure: 'auth' });
    sdk.state.error = new sdk.RateLimitError(429);
    expect(await call()).toEqual({ ok: false, failure: 'rate-limit' });
  });
});

const makers: [string, () => Promise<Repository>][] = [
  ['IndexedDB', async () => { globalThis.indexedDB = new IDBFactory(); return openRepository(); }],
  ['memory', async () => new MemoryRepository()],
];
async function savedRecord(repo: Repository): Promise<ReadingRecord> {
  const draft = await repo.createDraft(fixture.question, 'manual');
  await repo.prepareSource(draft.id, 0, { kind: 'manual', mothers });
  return repo.finalizeDraft(draft.id);
}
const ai: AiReading = { model: 'claude-opus-5-5', promptVersion: 'zh-TW-ai-retell-v1', sentQuestion: false,
  paragraphs: good.paragraphs as AiReading['paragraphs'], usage: { inputTokens: 3000, outputTokens: 800 }, recordedAt: NOW };

describe.each(makers)('%s repository: AI reading', (_name, make) => {
  test('saved with the revision guard, replaced, removed; malformed is refused', async () => {
    const repo = await make();
    const record = await savedRecord(repo);
    const saved = await repo.saveAi(record.id, 0, ai);
    expect(saved).toMatchObject({ revision: 1, ai });
    await expect(repo.saveAi(record.id, 0, null)).rejects.toMatchObject({ code: 'REVISION_CONFLICT' });
    await expect(repo.saveAi(record.id, 1, { ...ai, model: 'BAD MODEL' })).rejects.toMatchObject({ code: 'INVALID_STATE' });
    expect((await repo.saveAi(record.id, 1, null)).ai).toBeUndefined();
  });
});

test('AI reading in backups: round trip; malformed rejects the record', async () => {
  const repo = new MemoryRepository();
  const record = await repo.saveAi((await savedRecord(repo)).id, 0, ai);
  const text = buildExportFiles([record], NOW)[0].text;
  const parsed = parseImport(text, new TextEncoder().encode(text).length, NOW);
  expect(parsed.ok && parsed.items[0].status === 'valid' && parsed.items[0].record).toEqual(record);
  expect(isAiReading(ai)).toBe(true);
  for (const bad of [{ ...ai, paragraphs: [{ heading: 'x', text: 'y', cites: ['ZZ'] }] }, { ...ai, recordedAt: 'today' },
    { ...ai, usage: { inputTokens: -1, outputTokens: 0 } }, { ...ai, sentQuestion: 'no' }, 'ai']) {
    expect(checkRecord({ ...record, ai: bad })).toMatchObject({ ok: false, code: 'IMPORT_INVALID' });
  }
});
