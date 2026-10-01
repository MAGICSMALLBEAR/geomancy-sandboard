import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { constructChart, fromDots, toDots, xor, transpose, mothersFromCounts,
  sourceToMothers, houseNode, NODES, VISUAL_ROWS, PARENTS, assertFigure } from '../src/domain/geomancy.ts';
import { FIGURES, figureInfo } from '../src/domain/catalog.ts';
import { buildReading, assertQuestion } from '../src/domain/reading.ts';
import { drawQuickSource } from '../src/domain/random.ts';
const fixture = JSON.parse(readFileSync(new URL('../fixtures/teaching.json', import.meta.url), 'utf8'));
const allFigures = Array.from({ length: 16 }, (_, n) => [3,2,1,0].map(s => (n >> s) & 1));
const mothers = mothersFromCounts(fixture.counts);
const asDots = chart => Object.fromEntries(NODES.map(n => [n, toDots(chart[n])]));

test('16 named patterns are a bijection; display values are not bit values', () => {
  assert.equal(new Set(FIGURES.map(f => f.dots)).size, 16);
  for (const f of FIGURES) assert.equal(figureInfo(fromDots(f.dots)).id, f.id);
  assert.deepEqual(fromDots('2211'), [0,0,1,1]);
  assert.equal(figureInfo(fromDots('1121')).id, 'puer');
  assert.equal(figureInfo(fromDots('1211')).id, 'puella');
});
test('teaching fixture matches every node and fixed house allocation', () => {
  assert.deepEqual(asDots(constructChart(mothers)), fixture.expectedDots);
  assert.equal(houseNode(10), 'N2');
  assert.equal(houseNode(7), 'D3');
  assert.deepEqual(VISUAL_ROWS[0], ['D4','D3','D2','D1','M4','M3','M2','M1']);
  assert.deepEqual(PARENTS.J, ['RW','LW']);
  assert.deepEqual(PARENTS.R, ['J','M1']);
});
test('invalid counts, sparse arrays, malformed figures and houses fail explicitly', () => {
  for (const bad of [[], Array(16), Array(16).fill(0), Array(16).fill(-1), Array(16).fill(1.5), Array(16).fill(4097), Array(16).fill(NaN)]) {
    assert.throws(() => mothersFromCounts(bad));
  }
  for (const bad of [null, [1,2,1,2], [1,0,1], Array(4)]) assert.throws(() => assertFigure(bad));
  for (const bad of [0, 13, 2.5, NaN]) assert.throws(() => houseNode(bad));
  assert.throws(() => fromDots('1010'));
  assert.throws(() => constructChart(Array(4)));
});
test('chart construction neither changes input nor aliases input tuples', () => {
  const input = structuredClone(mothers), before = structuredClone(input);
  const a = constructChart(input), b = constructChart(input);
  assert.deepEqual(input, before); assert.deepEqual(a, b);
  input[0][0] ^= 1;
  assert.deepEqual(a, b);
});

// Independent oracle adds DISPLAY dot counts, reducing odd to 1 and even to 2.
function countOracle(ms) {
  const add = (a,b) => [...a].map((v,i) => ((+v + +b[i]) % 2 ? '1' : '2')).join('');
  const ds = [0,1,2,3].map(i => ms.map(m => m[i]).join(''));
  const ns = [add(ms[0],ms[1]), add(ms[2],ms[3]), add(ds[0],ds[1]), add(ds[2],ds[3])];
  const rw = add(ns[0],ns[1]), lw = add(ns[2],ns[3]), j = add(rw,lw);
  return [...ms, ...ds, ...ns, rw, lw, j, add(j,ms[0])];
}
test('all 65,536 ordered mother combinations match independent arithmetic and invariants', () => {
  const histogram = new Map();
  for (let n = 0; n < 65536; n++) {
    const ms = [12,8,4,0].map(s => allFigures[(n >> s) & 15]);
    const chart = constructChart(ms), dots = NODES.map(id => toDots(chart[id]));
    assert.deepEqual(dots, countOracle(ms.map(toDots)));
    assert.deepEqual(transpose(transpose(ms)), ms);
    const judge = toDots(chart.J);
    assert.equal([...judge].reduce((sum,c) => sum + +c, 0) % 2, 0);
    histogram.set(judge, (histogram.get(judge) || 0) + 1);
    assert.ok(new Set(dots).size < 16);
    assert.deepEqual(xor(chart.N1, chart.J), xor(chart.M2, chart.R));
    assert.deepEqual(xor(chart.N1, chart.J), xor(chart.N2, chart.LW));
  }
  assert.deepEqual([...histogram.keys()].sort(), ['1111','1122','1212','1221','2112','2121','2211','2222']);
  assert.ok([...histogram.values()].every(count => count === 8192));
});
test('XOR identity, self cancellation and transpose properties cover all figures', () => {
  for (const figure of allFigures) {
    assert.deepEqual(xor(figure, figure), fromDots('2222'));
    assert.deepEqual(xor(figure, fromDots('2222')), figure);
  }
});
test('all quick byte pairs map bijectively to mother sets with documented bit order', () => {
  const keys = new Set();
  for (let n = 0; n < 65536; n++) {
    const ms = sourceToMothers({ kind: 'quick', algorithm: 'webcrypto-16bits-v1', bytes: [n >> 8, n & 255] });
    keys.add(ms.map(toDots).join(''));
  }
  assert.equal(keys.size, 65536);
  assert.deepEqual(sourceToMothers({ kind: 'quick', algorithm: 'webcrypto-16bits-v1', bytes: [0xAC,0xF0] }),
    ['1212','1122','1111','2222'].map(fromDots));
});
test('random adapter calls provider once; sources replay without calling RNG', () => {
  let calls = 0;
  const source = drawQuickSource(bytes => { calls++; bytes.set([0xAC, 0xF0]); });
  assert.equal(calls, 1);
  assert.deepEqual(sourceToMothers(source), sourceToMothers(source));
  assert.equal(calls, 1);
  assert.throws(() => drawQuickSource(() => { throw new Error('unavailable'); }));
  assert.throws(() => sourceToMothers({ kind:'quick', algorithm:'wrong', bytes:[0,0] }));
  assert.throws(() => sourceToMothers({ kind:'quick', algorithm:'webcrypto-16bits-v1', bytes:[-1,256] }));
  assert.throws(() => sourceToMothers({ kind:'unknown' }));
  assert.deepEqual(sourceToMothers({ kind:'dots', counts:fixture.counts }), mothers);
  assert.deepEqual(sourceToMothers({ kind:'manual', mothers }), mothers);
});
test('question topic and house must agree; required fields cannot silently default', () => {
  assertQuestion(fixture.question);
  assert.throws(() => assertQuestion({ ...fixture.question, topic:'general' }));
  assert.throws(() => assertQuestion({ ...fixture.question, targetHouse:5 }));
  assert.throws(() => assertQuestion({ ...fixture.question, text:' ' }));
  assert.throws(() => assertQuestion({ ...fixture.question, text:'a'.repeat(501) }));
});
test('readings retain evidence, deterministic drafts and optional topic house', () => {
  const reading = buildReading(mothers, fixture.question), chart = constructChart(mothers);
  assert.deepEqual(reading, buildReading(mothers, fixture.question));
  assert.equal(reading.reviewStatus, 'editorial-draft');
  assert.equal(reading.scope, 'basic-symbolic');
  assert.equal(reading.claims.length, 5);
  assert.deepEqual(reading.claims.find(c => c.claimId === 'topic').evidence, [
    { nodeId:'N2', figureId:'fortuna-major', dots:'2211', house:10 },
  ]);
  for (const claim of reading.claims) {
    assert.ok(claim.ruleId && claim.sourceIds.length && claim.evidence.length);
    for (const e of claim.evidence) assert.equal(e.dots, toDots(chart[e.nodeId]));
  }
  const general = buildReading(mothers, { text:'教學問題', timeframe:'', topic:'general', targetHouse:null });
  assert.equal(general.claims.length, 4);
  assert.ok(!general.claims.some(c => c.claimId === 'topic'));
  // User text is preserved by records, but never treated as instructions by this pure reading composer.
  assert.deepEqual(reading, buildReading(mothers, { ...fixture.question, text:'<script>alert(1)</script>' }));
});
