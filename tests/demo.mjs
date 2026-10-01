import { readFileSync } from 'node:fs';
import { mothersFromCounts, constructChart, NODES, toDots } from '../src/domain/geomancy.ts';
import { figureInfo } from '../src/domain/catalog.ts';
import { buildReading } from '../src/domain/reading.ts';
const fixture = JSON.parse(readFileSync(new URL('../fixtures/teaching.json', import.meta.url), 'utf8'));
const mothers = mothersFromCounts(fixture.counts), chart = constructChart(mothers);
console.log('教學固定輸入，非實際占問。');
for (const node of NODES) console.log(node.padEnd(3), toDots(chart[node]), figureInfo(chart[node]).latin);
console.log(JSON.stringify(buildReading(mothers, fixture.question), null, 2));
