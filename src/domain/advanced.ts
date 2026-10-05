/**
 * Advanced reading (DECISIONS D24): perfection, the Way of the Points, witnesses and judge, and every house.
 * Recomputed from the chart each time it is shown and never stored, so saved records and their integrity
 * checks are untouched. Wording is an original Traditional Chinese editorial draft, not expert-reviewed.
 */
import { HOUSE_NODES, PARENTS, toDots, type Chart, type NodeId } from './geomancy.ts';
import { figureInfo, HOUSES } from './catalog.ts';
import type { Question } from './reading.ts';

export const ADVANCED_VERSION = 'zh-TW-advanced-draft-v2' as const;

type Info = ReturnType<typeof figureInfo>;
const name = (f: Info) => `${f.zh}／${f.latin}`;
const houseFigure = (chart: Chart, house: number) => chart[HOUSE_NODES[house - 1]];
const sameFigure = (chart: Chart, a: number, b: number) => toDots(houseFigure(chart, a)) === toDots(houseFigure(chart, b));

/** Houses on either side, in a circle: house 12 neighbours house 1. */
export function neighbours(house: number): [number, number] {
  return [house === 1 ? 12 : house - 1, house === 12 ? 1 : house + 1];
}

// ── Perfection (G06): querent = house 1, quesited = the house the user chose ──────────────────────────

export type PerfectionMode = 'occupation' | 'conjunction' | 'mutation' | 'translation';
export type PerfectionHit = {
  mode: PerfectionMode;
  /** Houses that show the pattern, in the order they are named in `text`. */
  houses: number[];
  text: string;
};
export type PerfectionResult =
  | { status: 'no-quesited' }
  | { status: 'checked'; quesited: number; querentFigure: Info; quesitedFigure: Info; hits: PerfectionHit[]; summary: string };

export const PERFECTION_LABEL: Record<PerfectionMode, string> = {
  occupation: '同象（Occupation）', conjunction: '接合（Conjunction）',
  mutation: '轉移（Mutation）', translation: '傳遞（Translation）',
};
/** Strongest first. A product choice for ordering the summary; every hit found is still listed. */
const ORDER: readonly PerfectionMode[] = ['occupation', 'conjunction', 'mutation', 'translation'];

export function findPerfection(chart: Chart, quesited: number | null): PerfectionResult {
  if (quesited === null) return { status: 'no-quesited' };
  const q = quesited;
  const querentFigure = figureInfo(houseFigure(chart, 1)), quesitedFigure = figureInfo(houseFigure(chart, q));
  const hits: PerfectionHit[] = [];
  const fig = (h: number) => figureInfo(houseFigure(chart, h));

  if (sameFigure(chart, 1, q)) {
    hits.push({ mode: 'occupation', houses: [1, q], text:
      `第 1 宮與第 ${q} 宮是同一個象（${name(querentFigure)}）。你這一方與所問的事落在同一個象上，是四種方式中最直接的一種。` });
  }
  for (const h of neighbours(q).filter(h => h !== 1)) {
    if (sameFigure(chart, 1, h)) hits.push({ mode: 'conjunction', houses: [1, h, q], text:
      `你的象（第 1 宮 ${name(querentFigure)}）也出現在第 ${h} 宮，緊鄰所問的第 ${q} 宮：傳統上看作你這一方主動靠近這件事。` });
  }
  for (const h of neighbours(1).filter(h => h !== q)) {
    if (sameFigure(chart, q, h)) hits.push({ mode: 'conjunction', houses: [q, h, 1], text:
      `所問之事的象（第 ${q} 宮 ${name(quesitedFigure)}）也出現在第 ${h} 宮，緊鄰第 1 宮：傳統上看作事情自己往你這邊來。` });
  }
  // Both significators side by side somewhere else; each adjacent pair counted once.
  for (let a = 1; a <= 12; a++) {
    const b = a === 12 ? 1 : a + 1;
    if ([a, b].some(h => h === 1 || h === q)) continue;
    const pairs: [number, number][] = [[a, b], [b, a]];
    for (const [x, y] of pairs) {
      if (sameFigure(chart, x, 1) && sameFigure(chart, y, q)) {
        hits.push({ mode: 'mutation', houses: [x, y], text:
          `你的象出現在第 ${x} 宮，所問之事的象出現在相鄰的第 ${y} 宮：雙方在別的領域（${HOUSES[x - 1]}、${HOUSES[y - 1]}）相遇，傳統上看作透過其他場合或條件接上。` });
        break;
      }
    }
  }
  // A third figure, neither significator, next to both significators.
  const querentDots = toDots(houseFigure(chart, 1)), quesitedDots = toDots(houseFigure(chart, q));
  const seen = new Set<string>();
  for (const a of neighbours(1).filter(h => h !== q)) {
    for (const b of neighbours(q).filter(h => h !== 1)) {
      const dots = toDots(houseFigure(chart, a));
      if (!sameFigure(chart, a, b) || dots === querentDots || dots === quesitedDots) continue;
      const key = [a, b].sort().join('-');
      if (seen.has(key)) continue;
      seen.add(key);
      const third = fig(a);
      hits.push({ mode: 'translation', houses: a === b ? [a] : [a, b], text: a === b
        ? `第 ${a} 宮同時緊鄰第 1 宮與第 ${q} 宮，落在這裡的第三個象（${name(third)}）把雙方接起來：傳統上看作有中間人或中介條件促成。`
        : `第三個象（${name(third)}）同時出現在緊鄰第 1 宮的第 ${a} 宮，與緊鄰第 ${q} 宮的第 ${b} 宮：傳統上看作有中間人或中介條件把雙方接起來。` });
    }
  }
  hits.sort((x, y) => ORDER.indexOf(x.mode) - ORDER.indexOf(y.mode));

  const summary = hits.length
    ? `找到 ${hits.length} 個成事關係，最直接的是「${PERFECTION_LABEL[hits[0].mode]}」。在傳統成事技法中，這表示你與所問之事之間有連結的管道；它不保證結果，也不說明過程是否順利，請和裁判、證人一起看。`
    : `第 1 宮（${name(querentFigure)}）與第 ${q} 宮（${name(quesitedFigure)}）之間，四種成事方式都沒有出現，傳統稱為「不成事（Denial）」。它通常被讀作事情不容易自己水到渠成；這是象徵性的觀察，不是預測，也可能表示需要換一條路或補上缺少的條件。`;
  return { status: 'checked', quesited: q, querentFigure, quesitedFigure, hits, summary };
}

// ── Way of the Points (G07): follow the Judge's fire line back to the Mothers or Daughters ────────────

export type WayOfPoints = {
  /** The Judge's first (fire) line: 1 = one dot, 0 = two dots. */
  line: 0 | 1;
  /** Every node the way passes through, Judge first. */
  nodes: NodeId[];
  /** Mothers or Daughters where it ends: the root of the question. Empty when the way breaks. */
  roots: { node: NodeId; house: number }[];
  /** Nodes where the way stopped before reaching the Mothers or Daughters. */
  brokenAt: NodeId[];
  text: string;
};

export function wayOfPoints(chart: Chart): WayOfPoints {
  const line = chart.J[0];
  const nodes: NodeId[] = [];
  const roots: { node: NodeId; house: number }[] = [];
  const brokenAt: NodeId[] = [];
  const visit = (node: NodeId) => {
    nodes.push(node);
    if (node.startsWith('M') || node.startsWith('D')) { roots.push({ node, house: HOUSE_NODES.indexOf(node) + 1 }); return; }
    const next = (PARENTS[node] ?? []).filter(parent => chart[parent][0] === line);
    if (next.length === 0) { brokenAt.push(node); return; }
    next.forEach(visit);
  };
  visit('J');

  const lineWord = line === 1 ? '一點' : '兩點';
  let text: string;
  if (roots.length === 0) {
    text = `裁判的火行是${lineWord}，往上追溯時在${brokenAt.map(n => NODE_TEXT[n]).join('、')}中斷，沒有連到母象或女象。傳統上這表示問題的根源不容易從盤面上單獨指出，可能是多種因素交織。`;
  } else {
    const where = roots.map(r => `第 ${r.house} 宮（${HOUSES[r.house - 1]}）的${NODE_TEXT[r.node]}「${figureInfo(chart[r.node]).zh}」`).join('，以及');
    text = `裁判的火行是${lineWord}，沿著同樣是${lineWord}的火行一路往上，連到${where}。點之道用來看「事情為什麼這樣發生」：火行代表意圖、目標與渴望，這條路徑指向的領域，是這個問題背後主要的動機來源。${roots.length > 1 ? '路徑分成多條，表示根源不只一個。' : ''}`;
  }
  return { line, nodes, roots, brokenAt, text };
}
const NODE_TEXT: Record<NodeId, string> = {
  M1: '第一母象', M2: '第二母象', M3: '第三母象', M4: '第四母象', D1: '第一女象', D2: '第二女象', D3: '第三女象', D4: '第四女象',
  N1: '第一姪象', N2: '第二姪象', N3: '第三姪象', N4: '第四姪象', RW: '右證人', LW: '左證人', J: '裁判', R: '調和者',
};

// ── Witnesses and Judge ────────────────────────────────────────────────────────────────────────────────

export function courtReading(chart: Chart): string {
  const right = figureInfo(chart.RW), left = figureInfo(chart.LW), judge = figureInfo(chart.J);
  const same = toDots(chart.RW) === toDots(chart.LW);
  return [
    `右證人「${name(right)}」（${right.keywords.join('、')}）與左證人「${name(left)}」（${left.keywords.join('、')}）合成裁判「${name(judge)}」（${judge.keywords.join('、')}）。`,
    '在常見的西方解法中，右證人多被看作你這一方或事情的來由，左證人看作另一方或事情的走向，裁判則是兩者相遇後的整體結論。',
    same
      ? '兩個證人是同一個象，所以裁判必然是群眾（Populus）：兩股力量完全一致，結論更多取決於周遭的情勢。'
      : `可以這樣讀：從「${right.keywords[0]}」出發，遇上「${left.keywords[0]}」，整體落在「${judge.keywords[0]}」。`,
    '裁判一定是八個「總點數為偶數」的象之一，這是排盤規則的結果，不代表吉凶。',
  ].join('');
}

// ── Every house ────────────────────────────────────────────────────────────────────────────────────────

/** How each figure tends to act inside whichever house it falls in. Original editorial draft. */
const IN_HOUSE: Record<string, string> = {
  via: '這個領域正在移動或轉變，狀態不容易停在原地。',
  populus: '這個領域受周遭的人與環境左右，自己的主導較少。',
  'fortuna-major': '這個領域有穩固、可以持續累積的力量。',
  'fortuna-minor': '這個領域有來得快也去得快的助力，適合把握時機。',
  acquisitio: '這個領域傾向增加與取得，東西會往你這裡聚集。',
  amissio: '這個領域傾向減少或付出，可能需要放下某些東西。',
  conjunctio: '這個領域的重點在連結與相遇，人或條件會被接起來。',
  carcer: '這個領域有限制或固定的結構，可能卡住，也可能是保護。',
  laetitia: '這個領域有上升、開朗的氣氛。',
  tristitia: '這個領域偏沉重或往下收束，需要耐心處理。',
  puer: '這個領域充滿衝勁與行動，也容易起衝突。',
  puella: '這個領域偏向和諧、吸引與協調。',
  albus: '這個領域需要冷靜、澄清與審慎思考。',
  rubeus: '這個領域情緒或慾望強烈，容易失去秩序。',
  'caput-draconis': '這個領域正要進入新的開始。',
  'cauda-draconis': '這個領域有某些事正在結束或離開。',
};
/** One reflection question per house. Original editorial draft. */
const HOUSE_PROMPT: readonly string[] = [
  '你現在用什麼狀態與態度面對這件事？', '手上有哪些資源，哪些需要補足？', '身邊有哪些消息或往來值得留意？',
  '家庭或根基給你什麼支撐或牽絆？', '這件事和你的熱情、創造力有什麼關係？', '日常的工作與身體照顧跟得上嗎？',
  '合作對象或對手的立場是什麼？', '與他人共享的資源或可能的失落是什麼？', '有哪些需要學習或往外走的部分？',
  '這件事如何影響你的職位與公共角色？', '誰可以支持你？你期待什麼？', '有沒有看不到、卻在限制你的因素？',
];

export type HouseReading = { house: number; node: NodeId; figure: Info; text: string; prompt: string; isQuerent: boolean; isQuesited: boolean };

export function houseReadings(chart: Chart, quesited: number | null): HouseReading[] {
  return HOUSES.map((label, i) => {
    const house = i + 1, node = HOUSE_NODES[i], figure = figureInfo(chart[node]);
    return { house, node, figure, text: `${label}：${name(figure)}。${IN_HOUSE[figure.id]}`, prompt: HOUSE_PROMPT[i],
      isQuerent: house === 1, isQuesited: house === quesited };
  });
}

// ── Aspects (G08): houses counted around the circle like astrological signs ───────────────────────────

export type AspectKind = 'sextile' | 'square' | 'trine' | 'opposition';
export const ASPECT_LABEL: Record<AspectKind, string> = {
  sextile: '六分相（Sextile）', square: '四分相（Square）', trine: '三分相（Trine）', opposition: '對分相（Opposition）',
};
/** Supportive or tense, as commonly taught. A product summary of the tradition, not a verdict. */
export const ASPECT_TONE: Record<AspectKind, 'easy' | 'hard'> = { sextile: 'easy', trine: 'easy', square: 'hard', opposition: 'hard' };
const ASPECT_TEXT: Record<AspectKind, string> = {
  sextile: '兩個領域之間有溫和的助力，需要主動去接。',
  trine: '兩個領域之間互相支持，事情較容易順著走。',
  square: '兩個領域之間有摩擦或拉扯，要付出力氣調整。',
  opposition: '兩個領域彼此對立，常見拉鋸、正面相對或需要協商。',
};

/** Aspect between two houses by the number of houses apart (2/10 sextile, 3/9 square, 4/8 trine, 6 opposition). */
export function aspectBetween(a: number, b: number): AspectKind | null {
  const d = Math.min((b - a + 12) % 12, (a - b + 12) % 12);
  return d === 2 ? 'sextile' : d === 3 ? 'square' : d === 4 ? 'trine' : d === 6 ? 'opposition' : null;
}

export type AspectHit = {
  kind: AspectKind;
  /** Where the figure sits and the significator's house it aspects. */
  from: number;
  to: number;
  /** Whose figure: the querent's (house 1) or the quesited's. 'base' is the two significator houses themselves. */
  who: 'base' | 'querent' | 'quesited';
  text: string;
};
export type AspectResult =
  | { status: 'no-quesited' }
  | { status: 'checked'; quesited: number; base: AspectKind | null; baseText: string; hits: AspectHit[]; summary: string };

export function findAspects(chart: Chart, quesited: number | null): AspectResult {
  if (quesited === null) return { status: 'no-quesited' };
  const q = quesited;
  const base = aspectBetween(1, q);
  const baseText = q === 1
    ? '你選的問題宮就是第 1 宮，兩者是同一個宮位，不另看相位。'
    : base
      ? `第 1 宮與第 ${q} 宮相隔形成${ASPECT_LABEL[base]}：${ASPECT_TEXT[base]}這是宮位本身的關係，每次問這一宮都一樣，重點要看下面兩個象有沒有移到彼此的相位上。`
      : `第 1 宮與第 ${q} 宮之間沒有主要相位（相鄰或相隔五宮）。宮位本身沒有直接的牽引，要看兩個象有沒有在別的宮位形成相位。`;

  const hits: AspectHit[] = [];
  const recurrences = (from: number) => {
    const dots = toDots(houseFigure(chart, from));
    return HOUSES.map((_, i) => i + 1).filter(h => h !== from && toDots(houseFigure(chart, h)) === dots);
  };
  const add = (who: 'querent' | 'quesited', at: number, target: number) => {
    if (at === target) return;
    const kind = aspectBetween(at, target);
    if (!kind) return;
    const owner = who === 'querent' ? '你的象（第 1 宮）' : `所問之事的象（第 ${q} 宮）`;
    const figure = figureInfo(houseFigure(chart, at));
    hits.push({ kind, from: at, to: target, who, text:
      `${owner}「${name(figure)}」也出現在第 ${at} 宮，與第 ${target} 宮形成${ASPECT_LABEL[kind]}：${ASPECT_TEXT[kind]}` });
  };
  if (q !== 1) {
    for (const h of recurrences(1)) add('querent', h, q);
    for (const h of recurrences(q)) add('quesited', h, 1);
  }
  const easy = hits.filter(h => ASPECT_TONE[h.kind] === 'easy').length, hard = hits.length - easy;
  const summary = q === 1
    ? '問題宮與第 1 宮相同，相位不另作判斷。'
    : hits.length === 0
      ? '兩個代表象都沒有移到對方的相位上。相位只是輔助：沒有相位不代表沒有關係，請以上面的成事判斷為主。'
      : `兩個代表象在別的宮位形成 ${hits.length} 個相位（助力 ${easy}、張力 ${hard}）。傳統上相位不算成事，而是說明雙方之間的氣氛：助力型讓過程較順，張力型表示需要磨合。`;
  return { status: 'checked', quesited: q, base, baseText, hits, summary };
}

// ── Recurring figures: the same figure in several houses ties those areas together ───────────────────

export type Recurrence = {
  figure: Info;
  houses: number[];
  /** Which significators this figure belongs to. */
  roles: ('querent' | 'quesited' | 'judge')[];
  text: string;
};

export function findRecurrences(chart: Chart, quesited: number | null): Recurrence[] {
  const groups = new Map<string, number[]>();
  HOUSES.forEach((_, i) => {
    const dots = toDots(chart[HOUSE_NODES[i]]);
    groups.set(dots, [...(groups.get(dots) ?? []), i + 1]);
  });
  const judgeDots = toDots(chart.J);
  const result: Recurrence[] = [];
  for (const [dots, houses] of groups) {
    const isJudge = dots === judgeDots;
    if (houses.length < 2 && !isJudge) continue;
    const figure = figureInfo(houseFigure(chart, houses[0]));
    const roles: Recurrence['roles'] = [];
    if (houses.includes(1)) roles.push('querent');
    if (quesited !== null && quesited !== 1 && houses.includes(quesited)) roles.push('quesited');
    if (isJudge) roles.push('judge');
    const where = houses.map(h => `第 ${h} 宮（${HOUSES[h - 1]}）`).join('、');
    const lead = houses.length > 1
      ? `「${name(figure)}」出現在${where}，同一股「${figure.keywords[0]}」的力量把這 ${houses.length} 個領域串在一起。`
      : `「${name(figure)}」只出現在${where}。`;
    const notes = [
      roles.includes('querent') && houses.length > 1 ? '這是你自己（第 1 宮）的象：它重現的地方，常被看作你會投入或被牽動的領域。' : '',
      roles.includes('quesited') && houses.length > 1 ? '這是所問之事的象：它重現的地方，說明這件事還牽涉到哪些面向。' : '',
      isJudge ? '它也是裁判的象：結論的性質在這些宮位落地，可以從這些領域觀察結果怎麼顯現。' : '',
    ].filter(Boolean).join('');
    result.push({ figure, houses, roles, text: lead + notes });
  }
  // Significators first, then by how often the figure recurs.
  const weight = (r: Recurrence) => (r.roles.includes('querent') ? 4 : 0) + (r.roles.includes('quesited') ? 2 : 0) + (r.roles.includes('judge') ? 1 : 0);
  return result.sort((a, b) => weight(b) - weight(a) || b.houses.length - a.houses.length || a.houses[0] - b.houses[0]);
}

export type AdvancedReading = {
  version: typeof ADVANCED_VERSION;
  reviewStatus: 'editorial-draft';
  perfection: PerfectionResult;
  aspects: AspectResult;
  recurrences: Recurrence[];
  way: WayOfPoints;
  court: string;
  houses: HouseReading[];
};

export function buildAdvancedReading(chart: Chart, question: Question): AdvancedReading {
  return {
    version: ADVANCED_VERSION, reviewStatus: 'editorial-draft',
    perfection: findPerfection(chart, question.targetHouse),
    aspects: findAspects(chart, question.targetHouse),
    recurrences: findRecurrences(chart, question.targetHouse),
    way: wayOfPoints(chart), court: courtReading(chart), houses: houseReadings(chart, question.targetHouse),
  };
}
