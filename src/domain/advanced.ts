/**
 * Advanced reading (DECISIONS D24): perfection, the Way of the Points, witnesses and judge, and every house.
 * Recomputed from the chart each time it is shown and never stored, so saved records and their integrity
 * checks are untouched. Wording is an original editorial draft in Traditional Chinese and, since 0.12.0
 * (DECISIONS D43), English; neither is expert-reviewed.
 */
import { houseNodes, houseOf, PARENTS, RULE_VERSION, toDots, type Chart, type NodeId, type RuleVersion } from './geomancy.ts';
import { FIGURES_EN, figureInfo, HOUSES, HOUSES_EN } from './catalog.ts';
import type { Question } from './reading.ts';

export const ADVANCED_VERSION = 'zh-TW-advanced-draft-v3' as const;
type Lang = 'zh-TW' | 'en';

type Info = ReturnType<typeof figureInfo>;
const nameOf = (lang: Lang) => (f: Info) => (lang === 'en' ? `${f.latin} (${FIGURES_EN[f.id].gloss})` : `${f.zh}／${f.latin}`);
const keywordsOf = (lang: Lang) => (f: Info): readonly string[] => (lang === 'en' ? FIGURES_EN[f.id].keywords : f.keywords);
const housesText = (lang: Lang): readonly string[] => (lang === 'en' ? HOUSES_EN : HOUSES);
/** The figure in each house and a same-figure test, under the chart's house rule. */
const housesOf = (chart: Chart, rule: RuleVersion) => {
  const nodes = houseNodes(rule);
  const hf = (house: number) => chart[nodes[house - 1]];
  return { hf, same: (a: number, b: number) => toDots(hf(a)) === toDots(hf(b)) };
};

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
const PERFECTION_LABEL_EN: Record<PerfectionMode, string> = {
  occupation: 'Occupation', conjunction: 'Conjunction', mutation: 'Mutation', translation: 'Translation',
};
/** Strongest first. A product choice for ordering the summary; every hit found is still listed. */
const ORDER: readonly PerfectionMode[] = ['occupation', 'conjunction', 'mutation', 'translation'];

export function findPerfection(chart: Chart, quesited: number | null, rule: RuleVersion = RULE_VERSION, lang: Lang = 'zh-TW'): PerfectionResult {
  if (quesited === null) return { status: 'no-quesited' };
  const en = lang === 'en', name = nameOf(lang), HOUSE = housesText(lang), LABEL = en ? PERFECTION_LABEL_EN : PERFECTION_LABEL;
  const { hf, same } = housesOf(chart, rule);
  const q = quesited;
  const querentFigure = figureInfo(hf(1)), quesitedFigure = figureInfo(hf(q));
  const hits: PerfectionHit[] = [];
  const fig = (h: number) => figureInfo(hf(h));

  if (same(1, q)) {
    hits.push({ mode: 'occupation', houses: [1, q], text: en
      ? `House 1 and house ${q} hold the same figure (${name(querentFigure)}). You and the matter you asked about sit on one figure: the most direct of the four ways.`
      : `第 1 宮與第 ${q} 宮是同一個象（${name(querentFigure)}）。你這一方與所問的事落在同一個象上，是四種方式中最直接的一種。` });
  }
  for (const h of neighbours(q).filter(h => h !== 1)) {
    if (same(1, h)) hits.push({ mode: 'conjunction', houses: [1, h, q], text: en
      ? `Your figure (house 1, ${name(querentFigure)}) also appears in house ${h}, next to house ${q} that you asked about: traditionally read as your side moving towards the matter.`
      : `你的象（第 1 宮 ${name(querentFigure)}）也出現在第 ${h} 宮，緊鄰所問的第 ${q} 宮：傳統上看作你這一方主動靠近這件事。` });
  }
  for (const h of neighbours(1).filter(h => h !== q)) {
    if (same(q, h)) hits.push({ mode: 'conjunction', houses: [q, h, 1], text: en
      ? `The figure of the matter (house ${q}, ${name(quesitedFigure)}) also appears in house ${h}, next to house 1: traditionally read as the matter coming towards you.`
      : `所問之事的象（第 ${q} 宮 ${name(quesitedFigure)}）也出現在第 ${h} 宮，緊鄰第 1 宮：傳統上看作事情自己往你這邊來。` });
  }
  // Both significators side by side somewhere else; each adjacent pair counted once.
  for (let a = 1; a <= 12; a++) {
    const b = a === 12 ? 1 : a + 1;
    if ([a, b].some(h => h === 1 || h === q)) continue;
    const pairs: [number, number][] = [[a, b], [b, a]];
    for (const [x, y] of pairs) {
      if (same(x, 1) && same(y, q)) {
        hits.push({ mode: 'mutation', houses: [x, y], text: en
          ? `Your figure appears in house ${x} and the figure of the matter in the neighbouring house ${y}: the two meet in other areas (${HOUSE[x - 1]}; ${HOUSE[y - 1]}), traditionally read as linking up through other settings or conditions.`
          : `你的象出現在第 ${x} 宮，所問之事的象出現在相鄰的第 ${y} 宮：雙方在別的領域（${HOUSE[x - 1]}、${HOUSE[y - 1]}）相遇，傳統上看作透過其他場合或條件接上。` });
        break;
      }
    }
  }
  // A third figure, neither significator, next to both significators.
  const querentDots = toDots(hf(1)), quesitedDots = toDots(hf(q));
  const seen = new Set<string>();
  for (const a of neighbours(1).filter(h => h !== q)) {
    for (const b of neighbours(q).filter(h => h !== 1)) {
      const dots = toDots(hf(a));
      if (!same(a, b) || dots === querentDots || dots === quesitedDots) continue;
      const key = [a, b].sort().join('-');
      if (seen.has(key)) continue;
      seen.add(key);
      const third = fig(a);
      hits.push({ mode: 'translation', houses: a === b ? [a] : [a, b], text: a === b
        ? (en ? `House ${a} is next to both house 1 and house ${q}; the third figure there (${name(third)}) joins the two sides: traditionally read as a go-between or an intermediate condition making it happen.`
          : `第 ${a} 宮同時緊鄰第 1 宮與第 ${q} 宮，落在這裡的第三個象（${name(third)}）把雙方接起來：傳統上看作有中間人或中介條件促成。`)
        : (en ? `A third figure (${name(third)}) appears both in house ${a}, next to house 1, and in house ${b}, next to house ${q}: traditionally read as a go-between or an intermediate condition joining the two sides.`
          : `第三個象（${name(third)}）同時出現在緊鄰第 1 宮的第 ${a} 宮，與緊鄰第 ${q} 宮的第 ${b} 宮：傳統上看作有中間人或中介條件把雙方接起來。`) });
    }
  }
  hits.sort((x, y) => ORDER.indexOf(x.mode) - ORDER.indexOf(y.mode));

  const summary = hits.length
    ? (en ? `Found ${hits.length} way${hits.length > 1 ? 's' : ''} of perfection; the most direct is ${LABEL[hits[0].mode]}. In traditional perfection this means there is a channel between you and the matter; it does not promise the outcome or say whether the way is smooth, so read it together with the Judge and Witnesses.`
      : `找到 ${hits.length} 個成事關係，最直接的是「${LABEL[hits[0].mode]}」。在傳統成事技法中，這表示你與所問之事之間有連結的管道；它不保證結果，也不說明過程是否順利，請和裁判、證人一起看。`)
    : (en ? `Between house 1 (${name(querentFigure)}) and house ${q} (${name(quesitedFigure)}) none of the four ways of perfection appears, which tradition calls denial. It is usually read as the matter not coming about on its own; this is a symbolic observation, not a prediction, and may also mean another route or a missing condition is needed.`
      : `第 1 宮（${name(querentFigure)}）與第 ${q} 宮（${name(quesitedFigure)}）之間，四種成事方式都沒有出現，傳統稱為「不成事（Denial）」。它通常被讀作事情不容易自己水到渠成；這是象徵性的觀察，不是預測，也可能表示需要換一條路或補上缺少的條件。`);
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

const NODE_TEXT: Record<NodeId, string> = {
  M1: '第一母象', M2: '第二母象', M3: '第三母象', M4: '第四母象', D1: '第一女象', D2: '第二女象', D3: '第三女象', D4: '第四女象',
  N1: '第一姪象', N2: '第二姪象', N3: '第三姪象', N4: '第四姪象', RW: '右證人', LW: '左證人', J: '裁判', R: '調和者',
};
const NODE_TEXT_EN: Record<NodeId, string> = {
  M1: 'First Mother', M2: 'Second Mother', M3: 'Third Mother', M4: 'Fourth Mother', D1: 'First Daughter', D2: 'Second Daughter',
  D3: 'Third Daughter', D4: 'Fourth Daughter', N1: 'First Niece', N2: 'Second Niece', N3: 'Third Niece', N4: 'Fourth Niece',
  RW: 'Right Witness', LW: 'Left Witness', J: 'Judge', R: 'Reconciler',
};

export function wayOfPoints(chart: Chart, rule: RuleVersion = RULE_VERSION, lang: Lang = 'zh-TW'): WayOfPoints {
  const en = lang === 'en', HOUSE = housesText(lang), NODE = en ? NODE_TEXT_EN : NODE_TEXT;
  const line = chart.J[0];
  const nodes: NodeId[] = [];
  const roots: { node: NodeId; house: number }[] = [];
  const brokenAt: NodeId[] = [];
  const visit = (node: NodeId) => {
    nodes.push(node);
    if (node.startsWith('M') || node.startsWith('D')) { roots.push({ node, house: houseOf(node, rule)! }); return; }
    const next = (PARENTS[node] ?? []).filter(parent => chart[parent][0] === line);
    if (next.length === 0) { brokenAt.push(node); return; }
    next.forEach(visit);
  };
  visit('J');

  let text: string;
  if (en) {
    const lineWord = line === 1 ? 'one dot' : 'two dots';
    if (roots.length === 0) {
      text = `The Judge's fire line has ${lineWord}. Following it upwards, the way breaks at the ${brokenAt.map(n => NODE[n]).join(' and the ')} without reaching a Mother or Daughter. Traditionally this means the root of the question cannot be singled out on the chart; several factors may be woven together.`;
    } else {
      const where = roots.map(r => `the ${NODE[r.node]} "${figureInfo(chart[r.node]).latin}" in house ${r.house} (${HOUSE[r.house - 1]})`).join(', and ');
      text = `The Judge's fire line has ${lineWord}. Following fire lines that also have ${lineWord} upwards, the way reaches ${where}. The Way of the Points looks at why things happen: the fire line stands for intention, aims and desire, and the area it points to is the main motive behind the question.${roots.length > 1 ? ' The way splits, so there is more than one root.' : ''}`;
    }
  } else {
    const lineWord = line === 1 ? '一點' : '兩點';
    if (roots.length === 0) {
      text = `裁判的火行是${lineWord}，往上追溯時在${brokenAt.map(n => NODE[n]).join('、')}中斷，沒有連到母象或女象。傳統上這表示問題的根源不容易從盤面上單獨指出，可能是多種因素交織。`;
    } else {
      const where = roots.map(r => `第 ${r.house} 宮（${HOUSE[r.house - 1]}）的${NODE[r.node]}「${figureInfo(chart[r.node]).zh}」`).join('，以及');
      text = `裁判的火行是${lineWord}，沿著同樣是${lineWord}的火行一路往上，連到${where}。點之道用來看「事情為什麼這樣發生」：火行代表意圖、目標與渴望，這條路徑指向的領域，是這個問題背後主要的動機來源。${roots.length > 1 ? '路徑分成多條，表示根源不只一個。' : ''}`;
    }
  }
  return { line, nodes, roots, brokenAt, text };
}

// ── Witnesses and Judge ────────────────────────────────────────────────────────────────────────────────

export function courtReading(chart: Chart, lang: Lang = 'zh-TW'): string {
  const name = nameOf(lang), kw = keywordsOf(lang);
  const right = figureInfo(chart.RW), left = figureInfo(chart.LW), judge = figureInfo(chart.J);
  const same = toDots(chart.RW) === toDots(chart.LW);
  if (lang === 'en') {
    return [
      `The Right Witness "${name(right)}" (${kw(right).join(', ')}) and the Left Witness "${name(left)}" (${kw(left).join(', ')}) combine into the Judge "${name(judge)}" (${kw(judge).join(', ')}). `,
      'In common Western practice the Right Witness is often taken as your side or where the matter comes from, the Left Witness as the other side or where it is heading, and the Judge as the overall verdict when the two meet. ',
      same
        ? 'The two Witnesses are the same figure, so the Judge must be Populus: the two forces agree completely, and the verdict depends more on the surroundings.'
        : `One way to read it: starting from "${kw(right)[0]}", meeting "${kw(left)[0]}", the whole comes to "${kw(judge)[0]}".`,
      ' The Judge is always one of the eight figures with an even number of dots; this follows from how the chart is built and says nothing about good or bad.',
    ].join('');
  }
  return [
    `右證人「${name(right)}」（${kw(right).join('、')}）與左證人「${name(left)}」（${kw(left).join('、')}）合成裁判「${name(judge)}」（${kw(judge).join('、')}）。`,
    '在常見的西方解法中，右證人多被看作你這一方或事情的來由，左證人看作另一方或事情的走向，裁判則是兩者相遇後的整體結論。',
    same
      ? '兩個證人是同一個象，所以裁判必然是群眾（Populus）：兩股力量完全一致，結論更多取決於周遭的情勢。'
      : `可以這樣讀：從「${kw(right)[0]}」出發，遇上「${kw(left)[0]}」，整體落在「${kw(judge)[0]}」。`,
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
const IN_HOUSE_EN: Record<string, string> = {
  via: 'This area is moving or changing and does not easily stay put.',
  populus: 'This area is shaped by the people and surroundings around it, with little of your own direction.',
  'fortuna-major': 'This area has a steady strength that can keep building up.',
  'fortuna-minor': 'This area has help that comes and goes quickly; good for seizing the moment.',
  acquisitio: 'This area tends towards increase and gain; things gather towards you.',
  amissio: 'This area tends towards decrease or giving; something may need to be let go.',
  conjunctio: 'This area is about connection and meeting; people or conditions get joined up.',
  carcer: 'This area has limits or a fixed structure: it may be stuck, or it may be protected.',
  laetitia: 'This area has a rising, cheerful mood.',
  tristitia: 'This area is heavy or contracting and needs patience.',
  puer: 'This area is full of drive and action, and conflict comes easily.',
  puella: 'This area leans towards harmony, attraction and accord.',
  albus: 'This area needs calm, clarity and careful thought.',
  rubeus: 'This area holds strong emotion or desire and easily loses order.',
  'caput-draconis': 'This area is about to enter a new beginning.',
  'cauda-draconis': 'Something in this area is ending or leaving.',
};
/** One reflection question per house. Original editorial draft. */
const HOUSE_PROMPT: readonly string[] = [
  '你現在用什麼狀態與態度面對這件事？', '手上有哪些資源，哪些需要補足？', '身邊有哪些消息或往來值得留意？',
  '家庭或根基給你什麼支撐或牽絆？', '這件事和你的熱情、創造力有什麼關係？', '日常的工作與身體照顧跟得上嗎？',
  '合作對象或對手的立場是什麼？', '與他人共享的資源或可能的失落是什麼？', '有哪些需要學習或往外走的部分？',
  '這件事如何影響你的職位與公共角色？', '誰可以支持你？你期待什麼？', '有沒有看不到、卻在限制你的因素？',
];
const HOUSE_PROMPT_EN: readonly string[] = [
  'In what state and with what attitude are you facing this?', 'What resources do you have, and what is missing?', 'Which news or contacts around you are worth noticing?',
  'What support or ties does your home or foundation give you?', 'How does this relate to your passion and creativity?', 'Are your daily work and self-care keeping up?',
  'What is the position of your partner or opponent?', 'What resources are shared with others, and what might be lost?', 'What needs learning or reaching further out?',
  'How does this affect your position and public role?', 'Who can support you? What are you hoping for?', 'Is something unseen holding you back?',
];

export type HouseReading = { house: number; node: NodeId; figure: Info; text: string; prompt: string; isQuerent: boolean; isQuesited: boolean };

export function houseReadings(chart: Chart, quesited: number | null, rule: RuleVersion = RULE_VERSION, lang: Lang = 'zh-TW'): HouseReading[] {
  const en = lang === 'en', name = nameOf(lang);
  const nodes = houseNodes(rule);
  return housesText(lang).map((label, i) => {
    const house = i + 1, node = nodes[i], figure = figureInfo(chart[node]);
    return { house, node, figure, text: en ? `${label}: ${name(figure)}. ${IN_HOUSE_EN[figure.id]}` : `${label}：${name(figure)}。${IN_HOUSE[figure.id]}`,
      prompt: (en ? HOUSE_PROMPT_EN : HOUSE_PROMPT)[i], isQuerent: house === 1, isQuesited: house === quesited };
  });
}

// ── Aspects (G08): houses counted around the circle like astrological signs ───────────────────────────

export type AspectKind = 'sextile' | 'square' | 'trine' | 'opposition';
export const ASPECT_LABEL: Record<AspectKind, string> = {
  sextile: '六分相（Sextile）', square: '四分相（Square）', trine: '三分相（Trine）', opposition: '對分相（Opposition）',
};
const ASPECT_LABEL_EN: Record<AspectKind, string> = { sextile: 'a sextile', square: 'a square', trine: 'a trine', opposition: 'an opposition' };
/** Supportive or tense, as commonly taught. A product summary of the tradition, not a verdict. */
export const ASPECT_TONE: Record<AspectKind, 'easy' | 'hard'> = { sextile: 'easy', trine: 'easy', square: 'hard', opposition: 'hard' };
const ASPECT_TEXT: Record<AspectKind, string> = {
  sextile: '兩個領域之間有溫和的助力，需要主動去接。',
  trine: '兩個領域之間互相支持，事情較容易順著走。',
  square: '兩個領域之間有摩擦或拉扯，要付出力氣調整。',
  opposition: '兩個領域彼此對立，常見拉鋸、正面相對或需要協商。',
};
const ASPECT_TEXT_EN: Record<AspectKind, string> = {
  sextile: 'there is gentle help between the two areas that you need to reach for.',
  trine: 'the two areas support each other, and things flow more easily.',
  square: 'there is friction or pulling between the two areas that takes effort to adjust.',
  opposition: 'the two areas face each other, often as a tug of war, a direct confrontation or a need to negotiate.',
};
/** Labels for the interface; Chinese keeps the Latin term in brackets, English uses the plain term. */
export const advancedLabels = (lang: Lang) => ({
  perfection: lang === 'en' ? PERFECTION_LABEL_EN : PERFECTION_LABEL,
  aspect: lang === 'en'
    ? { sextile: 'Sextile', square: 'Square', trine: 'Trine', opposition: 'Opposition' } as Record<AspectKind, string>
    : ASPECT_LABEL,
});

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

export function findAspects(chart: Chart, quesited: number | null, rule: RuleVersion = RULE_VERSION, lang: Lang = 'zh-TW'): AspectResult {
  if (quesited === null) return { status: 'no-quesited' };
  const en = lang === 'en', name = nameOf(lang);
  const { hf } = housesOf(chart, rule);
  const q = quesited;
  const base = aspectBetween(1, q);
  const baseText = en
    ? (q === 1
      ? 'The house you chose is house 1 itself, so no aspect is read.'
      : base
        ? `House 1 and house ${q} form ${ASPECT_LABEL_EN[base]}: ${ASPECT_TEXT_EN[base]} This is a relation between the houses themselves and is the same whenever you ask about this house; what matters is whether the two figures move into aspect with each other below.`
        : `There is no major aspect between house 1 and house ${q} (they are adjacent or five houses apart). The houses themselves pull on nothing directly; look at whether the two figures form aspects from other houses.`)
    : (q === 1
      ? '你選的問題宮就是第 1 宮，兩者是同一個宮位，不另看相位。'
      : base
        ? `第 1 宮與第 ${q} 宮相隔形成${ASPECT_LABEL[base]}：${ASPECT_TEXT[base]}這是宮位本身的關係，每次問這一宮都一樣，重點要看下面兩個象有沒有移到彼此的相位上。`
        : `第 1 宮與第 ${q} 宮之間沒有主要相位（相鄰或相隔五宮）。宮位本身沒有直接的牽引，要看兩個象有沒有在別的宮位形成相位。`);

  const hits: AspectHit[] = [];
  const recurrences = (from: number) => {
    const dots = toDots(hf(from));
    return HOUSES.map((_, i) => i + 1).filter(h => h !== from && toDots(hf(h)) === dots);
  };
  const add = (who: 'querent' | 'quesited', at: number, target: number) => {
    if (at === target) return;
    const kind = aspectBetween(at, target);
    if (!kind) return;
    const figure = figureInfo(hf(at));
    const text = en
      ? `${who === 'querent' ? 'Your figure (house 1)' : `The figure of the matter (house ${q})`} "${name(figure)}" also appears in house ${at}, forming ${ASPECT_LABEL_EN[kind]} with house ${target}: ${ASPECT_TEXT_EN[kind]}`
      : `${who === 'querent' ? '你的象（第 1 宮）' : `所問之事的象（第 ${q} 宮）`}「${name(figure)}」也出現在第 ${at} 宮，與第 ${target} 宮形成${ASPECT_LABEL[kind]}：${ASPECT_TEXT[kind]}`;
    hits.push({ kind, from: at, to: target, who, text });
  };
  if (q !== 1) {
    for (const h of recurrences(1)) add('querent', h, q);
    for (const h of recurrences(q)) add('quesited', h, 1);
  }
  const easy = hits.filter(h => ASPECT_TONE[h.kind] === 'easy').length, hard = hits.length - easy;
  const summary = en
    ? (q === 1
      ? 'The house you chose is house 1, so aspects are not read.'
      : hits.length === 0
        ? 'Neither significator moves into aspect with the other. Aspects only support the reading: no aspect does not mean no relation; go by the perfection above.'
        : `The two significators form ${hits.length} aspect${hits.length > 1 ? 's' : ''} from other houses (${easy} supportive, ${hard} tense). Traditionally aspects are not perfection; they describe the mood between the two sides: supportive ones make the way smoother, tense ones mean adjusting to each other.`)
    : (q === 1
      ? '問題宮與第 1 宮相同，相位不另作判斷。'
      : hits.length === 0
        ? '兩個代表象都沒有移到對方的相位上。相位只是輔助：沒有相位不代表沒有關係，請以上面的成事判斷為主。'
        : `兩個代表象在別的宮位形成 ${hits.length} 個相位（助力 ${easy}、張力 ${hard}）。傳統上相位不算成事，而是說明雙方之間的氣氛：助力型讓過程較順，張力型表示需要磨合。`);
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

export function findRecurrences(chart: Chart, quesited: number | null, rule: RuleVersion = RULE_VERSION, lang: Lang = 'zh-TW'): Recurrence[] {
  const en = lang === 'en', name = nameOf(lang), kw = keywordsOf(lang), HOUSE = housesText(lang);
  const { hf } = housesOf(chart, rule);
  const groups = new Map<string, number[]>();
  HOUSES.forEach((_, i) => {
    const dots = toDots(hf(i + 1));
    groups.set(dots, [...(groups.get(dots) ?? []), i + 1]);
  });
  const judgeDots = toDots(chart.J);
  const result: Recurrence[] = [];
  for (const [dots, houses] of groups) {
    const isJudge = dots === judgeDots;
    if (houses.length < 2 && !isJudge) continue;
    const figure = figureInfo(hf(houses[0]));
    const roles: Recurrence['roles'] = [];
    if (houses.includes(1)) roles.push('querent');
    if (quesited !== null && quesited !== 1 && houses.includes(quesited)) roles.push('quesited');
    if (isJudge) roles.push('judge');
    let text: string;
    if (en) {
      const where = houses.map(h => `house ${h} (${HOUSE[h - 1]})`).join(', ');
      const lead = houses.length > 1
        ? `"${name(figure)}" appears in ${where}: the same force of "${kw(figure)[0]}" ties these ${houses.length} areas together.`
        : `"${name(figure)}" appears only in ${where}.`;
      const notes = [
        roles.includes('querent') && houses.length > 1 ? ' This is your own figure (house 1): where it recurs is often read as an area you will put yourself into or be drawn by.' : '',
        roles.includes('quesited') && houses.length > 1 ? ' This is the figure of the matter: where it recurs shows which other sides the matter touches.' : '',
        isJudge ? ' It is also the figure of the Judge: the nature of the verdict lands in these houses, so watch these areas to see how the outcome shows.' : '',
      ].join('');
      text = lead + notes;
    } else {
      const where = houses.map(h => `第 ${h} 宮（${HOUSE[h - 1]}）`).join('、');
      const lead = houses.length > 1
        ? `「${name(figure)}」出現在${where}，同一股「${kw(figure)[0]}」的力量把這 ${houses.length} 個領域串在一起。`
        : `「${name(figure)}」只出現在${where}。`;
      const notes = [
        roles.includes('querent') && houses.length > 1 ? '這是你自己（第 1 宮）的象：它重現的地方，常被看作你會投入或被牽動的領域。' : '',
        roles.includes('quesited') && houses.length > 1 ? '這是所問之事的象：它重現的地方，說明這件事還牽涉到哪些面向。' : '',
        isJudge ? '它也是裁判的象：結論的性質在這些宮位落地，可以從這些領域觀察結果怎麼顯現。' : '',
      ].filter(Boolean).join('');
      text = lead + notes;
    }
    result.push({ figure, houses, roles, text });
  }
  // Significators first, then by how often the figure recurs.
  const weight = (r: Recurrence) => (r.roles.includes('querent') ? 4 : 0) + (r.roles.includes('quesited') ? 2 : 0) + (r.roles.includes('judge') ? 1 : 0);
  return result.sort((a, b) => weight(b) - weight(a) || b.houses.length - a.houses.length || a.houses[0] - b.houses[0]);
}

// ── Halted chart (G10): Rubeus or Cauda Draconis as the first mother ───────────────────────────────────

export type HaltedChart = { figure: Info; text: string } | null;
/** Old European texts discard such a chart. Shown as history and a reflection, never as an instruction to recast. */
export function haltedChart(chart: Chart, rule: RuleVersion = RULE_VERSION, lang: Lang = 'zh-TW'): HaltedChart {
  const figure = figureInfo(chart.M1), name = nameOf(lang);
  if (figure.id !== 'rubeus' && figure.id !== 'cauda-draconis') return null;
  if (lang === 'en') {
    const reading = figure.id === 'rubeus'
      ? 'Modern readers often take it as the state you asked in: emotions churning, not yet thought through, or not taking the question seriously.'
      : 'Modern readers often take it as the state you asked in: your mind is already made up and you are looking for confirmation, not open to a new view.';
    return { figure, text:
      `The First Mother of this chart (house ${houseOf('M1', rule)}) is "${name(figure)}". Some old European geomancy texts have a rule: when the First Mother is Rubeus or Cauda Draconis, the chart should be discarded without judgement. ${reading} `
      + 'This App does not ask you to cast again, and it does not mean a bad outcome; ask yourself how you were when you asked, then decide whether to read on as usual, rephrase the question later, or stop here.' };
  }
  const reading = figure.id === 'rubeus'
    ? '現代的讀法常把它看成提問時的狀態：情緒翻騰、還沒想清楚，或沒有認真看待這次占問。'
    : '現代的讀法常把它看成提問時的狀態：心裡其實已經有定論，只是想找確認，不太願意接受新的看法。';
  return { figure, text:
    `這一盤的第一母象（第 ${houseOf('M1', rule)} 宮）是「${name(figure)}」。部分舊歐洲地占文本有一條禁例：第一母象是紅或龍尾時，這盤應該捨棄、不加判斷。${reading}`
    + '本 App 不要求重起，也不代表結果不好；你可以先問問自己提問時的狀態，再決定照常閱讀、隔一段時間改寫問題，或就此打住。' };
}

export type AdvancedReading = {
  version: typeof ADVANCED_VERSION;
  /** House rule the houses below were read with. */
  rule: RuleVersion;
  reviewStatus: 'editorial-draft';
  perfection: PerfectionResult;
  aspects: AspectResult;
  recurrences: Recurrence[];
  way: WayOfPoints;
  court: string;
  houses: HouseReading[];
  halted: HaltedChart;
};

export function buildAdvancedReading(chart: Chart, question: Question, rule: RuleVersion = RULE_VERSION, lang: Lang = 'zh-TW'): AdvancedReading {
  return {
    version: ADVANCED_VERSION, rule, reviewStatus: 'editorial-draft',
    perfection: findPerfection(chart, question.targetHouse, rule, lang),
    aspects: findAspects(chart, question.targetHouse, rule, lang),
    recurrences: findRecurrences(chart, question.targetHouse, rule, lang),
    way: wayOfPoints(chart, rule, lang), court: courtReading(chart, lang), houses: houseReadings(chart, question.targetHouse, rule, lang),
    halted: haltedChart(chart, rule, lang),
  };
}
