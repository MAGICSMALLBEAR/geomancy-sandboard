// Expert review material (SPEC §9: every reviewed item records reviewer, date, source and reason).
// Writes docs/review/expert-review.csv (one row per Chinese text item, columns for the reviewer to fill)
// and docs/review/samples.md (complete readings for charts chosen to show every template).
// Run with `npm run review-sheet` after any wording change; the files are generated, do not edit them by hand.
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { constructChart, fromDots, NODES, RULE_VERSION, toDots, type Mothers } from '../src/domain/geomancy.ts';
import { CONTENT_VERSION, FIGURES, HOUSES } from '../src/domain/catalog.ts';
import { buildReading, type Question } from '../src/domain/reading.ts';
import { ADVANCED_VERSION, ASPECT_LABEL, PERFECTION_LABEL, REVIEW_TEXT, buildAdvancedReading, findPerfection } from '../src/domain/advanced.ts';
import { HOUSE_EXAMPLES, PLANET, ROLE_NOTES } from '../src/content/learn.ts';

const out = fileURLToPath(new URL('../docs/review/', import.meta.url));
mkdirSync(out, { recursive: true });

// ── Review sheet ────────────────────────────────────────────────────────────────────────────────────
type Row = { id: string; kind: string; item: string; text: string; where: string };
const rows: Row[] = [];
const add = (id: string, kind: string, item: string, text: string, where: string) => rows.push({ id, kind, item, text, where });

for (const f of FIGURES) {
  const label = `${f.zh}／${f.latin}（${f.dots}）`;
  add(`F-${f.id}-name`, '十六象', `${label} 中文譯名`, f.zh, 'src/domain/catalog.ts');
  add(`F-${f.id}-keywords`, '十六象', `${label} 關鍵詞`, f.keywords.join('、'), 'src/domain/catalog.ts');
  add(`F-${f.id}-reflection`, '十六象', `${label} 反思提示`, f.reflection, 'src/domain/catalog.ts');
  add(`F-${f.id}-in-house`, '十二宮逐宮', `${label} 落在任一宮時的傾向`, REVIEW_TEXT.IN_HOUSE[f.id], 'src/domain/advanced.ts');
  add(`F-${f.id}-planet`, '對應', `${label} 行星`, PLANET[f.id].zh, 'src/content/learn.ts（G09）');
}
HOUSES.forEach((name, i) => {
  const h = i + 1;
  add(`H-${h}-name`, '十二宮', `第 ${h} 宮 名稱`, name, 'src/domain/catalog.ts');
  add(`H-${h}-examples`, '十二宮', `第 ${h} 宮 常見觀察範圍（學習區）`, HOUSE_EXAMPLES[i], 'src/content/learn.ts');
  add(`H-${h}-prompt`, '十二宮逐宮', `第 ${h} 宮 反思問題`, REVIEW_TEXT.HOUSE_PROMPT[i], 'src/domain/advanced.ts');
});
for (const [mode, label] of Object.entries(PERFECTION_LABEL)) add(`P-${mode}`, '成事關係', `${label} 名稱`, label, 'src/domain/advanced.ts（G06）');
for (const [kind, text] of Object.entries(REVIEW_TEXT.ASPECT_TEXT)) {
  add(`A-${kind}`, '相位', `${ASPECT_LABEL[kind as keyof typeof ASPECT_LABEL]} 說明`, text, 'src/domain/advanced.ts（G08）');
}
for (const role of ROLE_NOTES) add(`L-role-${role.nodes[0]}`, '學習區', `${role.title} 的說明`, role.text, 'src/content/learn.ts');
add('L-customs', '學習區', '古典禁例與起卦習慣（整頁）', '見 App 的 #/learn/customs', 'src/features/learn/CustomsPage.tsx（G10）');
add('L-houses-page', '學習區', '十二宮與盤位：術語說明（整頁）', '見 App 的 #/learn/houses', 'src/features/learn/HousesPage.tsx（G06、G07）');
add('S-basic', '整段解讀', '基礎解讀（裁判、兩證人、宮位、反思）的組合句型', '見 samples.md 各盤的「基礎解讀」', 'src/domain/readingV2.ts');
add('S-advanced', '整段解讀', '進階解讀（成事、相位、象的重現、點之道、證人與裁判、停止盤）的組合句型', '見 samples.md 各盤的「進階解讀」', 'src/domain/advanced.ts');

const REVIEW_COLUMNS = ['審校結果（保留／修改／刪除／待討論）', '建議文字', '依據來源（書名、頁碼或網址）', '理由', '審校者', '日期'];
const cell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
const csv = [['編號', '類別', '項目', '目前文字', '程式位置', ...REVIEW_COLUMNS],
  ...rows.map(r => [r.id, r.kind, r.item, r.text, r.where, ...REVIEW_COLUMNS.map(() => '')])]
  .map(line => line.map(cell).join(',')).join('\r\n');
// BOM so Excel opens the Chinese text as UTF-8.
writeFileSync(`${out}expert-review.csv`, String.fromCharCode(0xfeff) + csv + '\r\n');

// ── Sample readings ─────────────────────────────────────────────────────────────────────────────────
const mothersOf = (dots: readonly string[]) => dots.map(fromDots) as unknown as Mothers;
const WORK: Question = { text: '未來三個月，申請這個職位時有哪些值得留意的條件？', timeframe: '未來三個月', topic: 'work', targetHouse: 10 };
const samples: { title: string; why: string; mothers: Mothers; question: Question }[] = [
  { title: '教學例題', why: '固定教學輸入，工作主題、第 10 宮。', mothers: mothersOf(['1121', '2111', '2221', '2212']), question: WORK },
];
// One chart per perfection outcome and one halted chart, found by walking every set of mothers in a fixed order.
const wanted = new Map<string, string>([['occupation', '成事：同象'], ['conjunction', '成事：接合'], ['mutation', '成事：轉移'],
  ['translation', '成事：傳遞'], ['denial', '不成事'], ['halted', '停止盤（第一母象為紅或龍尾）']]);
const dots = FIGURES.map(f => f.dots);
outer: for (const a of dots) for (const b of dots) for (const c of dots) for (const d of dots) {
  const mothers = mothersOf([a, b, c, d]), chart = constructChart(mothers);
  const p = findPerfection(chart, 10);
  // Rubeus (2122) or Cauda Draconis (1112) as the First Mother halts the chart; keep those out of the perfection samples.
  const halted = a === '2122' || a === '1112';
  const key = halted ? 'halted' : p.status === 'checked' ? (p.hits[0]?.mode ?? 'denial') : '';
  if (key && wanted.has(key)) {
    samples.push({ title: wanted.get(key)!, why: '依序找到的第一張符合條件的盤，工作主題、第 10 宮。', mothers, question: WORK });
    wanted.delete(key);
  }
  if (wanted.size === 0) break outer;
}
samples.push({ title: '關係主題（第 7 宮）', why: '教學例題的四母象，改看第 7 宮。', mothers: mothersOf(['1121', '2111', '2221', '2212']),
  question: { text: '我在這段關係的互動中，可以觀察與調整什麼？', timeframe: '', topic: 'relationship', targetHouse: 7 } });
samples.push({ title: '一般反思（不選宮）', why: '教學例題的四母象，不選問題宮，所以不判斷成事與相位。', mothers: mothersOf(['1121', '2111', '2221', '2212']),
  question: { text: '我面對這件事時，有哪些值得留意的條件？', timeframe: '', topic: 'general', targetHouse: null } });

const name = (dots: string) => { const f = FIGURES.find(x => x.dots === dots)!; return `${f.zh}（${f.latin}）`; };
const md: string[] = [
  '# 解讀範例（給審校者）',
  '',
  `由 \`npm run review-sheet\` 從程式產生，請勿手動修改。內容版本 ${CONTENT_VERSION}、進階解讀 ${ADVANCED_VERSION}、宮位配置 ${RULE_VERSION}（順序入宮）。`,
  '這些文字全部是本產品的編輯草稿，尚未經專家審校。審校意見請填在 expert-review.csv：單一詞句填對應的列；整段句型的意見填 S-basic 或 S-advanced 列，並註明是哪一盤哪一段。',
  '',
];
samples.forEach((s, i) => {
  const chart = constructChart(s.mothers);
  const reading = buildReading(s.mothers, s.question);
  const adv = buildAdvancedReading(chart, s.question);
  md.push(`## 範例 ${i + 1}：${s.title}`, '', s.why, '', `問題：${s.question.text}`, '');
  md.push('| 盤位 | 象 | 圖式 |', '|---|---|---|', ...NODES.map(n => `| ${n} | ${name(toDots(chart[n]))} | ${toDots(chart[n])} |`), '');
  md.push('### 基礎解讀', '');
  for (const c of reading.claims) md.push(`- **${c.title}**（${c.ruleId}）：${c.text}`);
  md.push('', '### 進階解讀', '');
  if (adv.halted) md.push(`- **停止盤**：${adv.halted.text}`);
  if (adv.perfection.status === 'checked') md.push(`- **成事關係**：${adv.perfection.summary}`, ...adv.perfection.hits.map(h => `  - ${h.text}`));
  if (adv.aspects.status === 'checked') md.push(`- **相位**：${adv.aspects.baseText} ${adv.aspects.summary}`, ...adv.aspects.hits.map(h => `  - ${h.text}`));
  if (adv.recurrences.length) md.push('- **象的重現**：', ...adv.recurrences.map(r => `  - ${r.text}`));
  md.push(`- **點之道**：${adv.way.text}`, `- **證人與裁判**：${adv.court}`, '- **十二宮逐宮**：', ...adv.houses.map(h => `  - ${h.text} ${h.prompt}`), '');
});
writeFileSync(`${out}samples.md`, md.join('\n'));
console.log(`expert-review.csv：${rows.length} 列；samples.md：${samples.length} 張盤`);
