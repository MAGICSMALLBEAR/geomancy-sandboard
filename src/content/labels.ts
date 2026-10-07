/** Display labels. Logical node order stays in the domain; nothing here reorders data. */
import { houseOf, RULE_VERSION, toDots, type Figure, type NodeId, type CastSource, type RuleVersion } from '../domain/geomancy.ts';
import { FIGURES, HOUSES, HOUSES_EN, FIGURES_EN, figureFullName, figureKeywords, figureName, figureReflection } from '../domain/catalog.ts';
import type { Lang } from '../app/lang.ts';
import { ERROR_TEXT, ERROR_TEXT_EN, type AppErrorCode } from '../infrastructure/errors.ts';
import type { Question } from '../domain/reading.ts';
import type { OutcomeStatus } from '../domain/contracts.ts';

export const NODE_LABEL: Record<NodeId, string> = {
  M1: '第一母象', M2: '第二母象', M3: '第三母象', M4: '第四母象',
  D1: '第一女象', D2: '第二女象', D3: '第三女象', D4: '第四女象',
  N1: '第一姪象', N2: '第二姪象', N3: '第三姪象', N4: '第四姪象',
  RW: '右證人', LW: '左證人', J: '裁判', R: '調和者',
};
export const ROW_ELEMENT = ['火', '風', '水', '土'] as const;
export const ORDINAL = ['一', '二', '三', '四'] as const;
export const dotWord = (bit: number): string => bit === 1 ? '一點' : '兩點';

export const houseOfNode = (node: NodeId, rule: RuleVersion = RULE_VERSION): number | null => houseOf(node, rule);
export function figureOf(figure: Figure) {
  const dots = toDots(figure);
  return FIGURES.find(f => f.dots === dots)!;
}
export const figureById = (id: string) => FIGURES.find(f => f.id === id);
export const figureAria = (figure: Figure): string => {
  const f = figureOf(figure);
  return `${f.zh} ${f.latin}，由上到下：${figure.map(dotWord).join('、')}`;
};

/** Follow-up wording compares what happened with the reading; it never claims the reading predicted anything. */
export const OUTCOME_LABEL: Record<OutcomeStatus, string> = {
  matched: '和解讀相符', partly: '部分相符', 'not-matched': '和解讀不同', unclear: '還看不出來',
};

export const TOPIC_LABEL: Record<Question['topic'], string> = { general: '一般反思', work: '工作', relationship: '關係' };
export const METHOD_LABEL: Record<CastSource['kind'], string> = {
  dots: '十六列點沙', press: '四次長按（裝置亂數）', auto: '自動點沙（裝置亂數）', quick: '快速起卦（裝置亂數）', manual: '手動輸入四母象',
};

export const TOPIC_HOUSES: Record<Exclude<Question['topic'], 'general'>, { house: 5 | 6 | 7 | 10; label: string }[]> = {
  work: [
    { house: 10, label: '職位／發展' },
    { house: 6, label: '日常工作' },
    { house: 7, label: '合作／合約' },
  ],
  relationship: [
    { house: 7, label: '伴侶／互動' },
    { house: 5, label: '戀愛／約會' },
  ],
};
export const TOPIC_EXAMPLE: Record<Question['topic'], string> = {
  general: '我面對這件事時，有哪些值得留意的條件？',
  work: '未來三個月，我申請這個職位時有哪些助力與限制？',
  relationship: '我在這段關係的互動中，可以觀察與調整什麼？',
};

/** House rules (DECISIONS D41). */
export const HOUSE_RULE_LABEL: Record<RuleVersion, string> = {
  'western-sequential-v1': '順序入宮', 'western-golden-dawn-v1': 'Golden Dawn 入宮',
};
export const HOUSE_RULE_HELP: Record<RuleVersion, string> = {
  'western-sequential-v1': '中世紀以來的傳統做法：四母象、四女象、四姪象依序放進第 1 到第 12 宮。',
  'western-golden-dawn-v1': '十九世紀黃金黎明會的做法：四母象放進角宮（第 10、1、4、7 宮），四女象放進續宮（11、2、5、8），四姪象放進果宮（12、3、6、9）。',
};
export const RULE_LABEL: Record<string, string> = {
  'basic.judge-theme.v1': '裁判的象徵主題',
  'basic.witness-pair.v1': '兩證人並列',
  'basic.house-context.v1': '宮位與所在的象',
  'editorial.reflection.v1': '本產品原創的反思提示',
};

export function formatDate(iso: string, lang: Lang = 'zh-TW'): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : 'zh-TW', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

/** `YYYY-MM-DD` as a date without time, e.g. 2026年10月13日 星期二. */
export function formatCalendarDate(day: string, lang: Lang = 'zh-TW'): string {
  const [y, m, d] = day.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  if (Number.isNaN(date.getTime())) return day;
  return new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : 'zh-TW', { dateStyle: 'full' }).format(date);
}

// ── English (DECISIONS D43) ───────────────────────────────────────────────────────────────────────────

const NODE_LABEL_EN: Record<NodeId, string> = {
  M1: 'First Mother', M2: 'Second Mother', M3: 'Third Mother', M4: 'Fourth Mother',
  D1: 'First Daughter', D2: 'Second Daughter', D3: 'Third Daughter', D4: 'Fourth Daughter',
  N1: 'First Niece', N2: 'Second Niece', N3: 'Third Niece', N4: 'Fourth Niece',
  RW: 'Right Witness', LW: 'Left Witness', J: 'Judge', R: 'Reconciler',
};
const OUTCOME_LABEL_EN: Record<OutcomeStatus, string> = {
  matched: 'Matched the reading', partly: 'Partly matched', 'not-matched': 'Differed from the reading', unclear: 'Too early to tell',
};
const TOPIC_LABEL_EN: Record<Question['topic'], string> = { general: 'General reflection', work: 'Work', relationship: 'Relationships' };
const METHOD_LABEL_EN: Record<CastSource['kind'], string> = {
  dots: 'Sixteen rows of dots', press: 'Four long presses (device random)', auto: 'Automatic dots (device random)',
  quick: 'Quick cast (device random)', manual: 'Four Mothers entered by hand',
};
const TOPIC_HOUSES_EN: typeof TOPIC_HOUSES = {
  work: [{ house: 10, label: 'Position / career' }, { house: 6, label: 'Daily work' }, { house: 7, label: 'Partnership / contract' }],
  relationship: [{ house: 7, label: 'Partner / how you interact' }, { house: 5, label: 'Romance / dating' }],
};
const TOPIC_EXAMPLE_EN: Record<Question['topic'], string> = {
  general: 'What conditions are worth noticing as I face this?',
  work: 'Over the next three months, what helps and what limits me as I apply for this position?',
  relationship: 'In how we get along, what can I notice and adjust?',
};
const HOUSE_RULE_LABEL_EN: Record<RuleVersion, string> = {
  'western-sequential-v1': 'Sequential houses', 'western-golden-dawn-v1': 'Golden Dawn houses',
};
const HOUSE_RULE_HELP_EN: Record<RuleVersion, string> = {
  'western-sequential-v1': 'The traditional method since the Middle Ages: the four Mothers, four Daughters and four Nieces go into houses 1 to 12 in order.',
  'western-golden-dawn-v1': 'The 19th-century Golden Dawn method: the Mothers go into the angular houses (10, 1, 4, 7), the Daughters into the succedent houses (11, 2, 5, 8), the Nieces into the cadent houses (12, 3, 6, 9).',
};
const RULE_LABEL_EN: Record<string, string> = {
  'basic.judge-theme.v1': "The Judge's symbolic themes",
  'basic.witness-pair.v1': 'The two Witnesses side by side',
  'basic.house-context.v1': 'A house and the figure in it',
  'editorial.reflection.v1': "This App's own reflection prompt",
};

type Entry = typeof FIGURES[number];
/** Every display table for one language. The Chinese exports above stay for Chinese-only code (e.g. stored text). */
export function labelsFor(lang: Lang) {
  const en = lang === 'en';
  const dot = (bit: number) => (en ? (bit === 1 ? 'one dot' : 'two dots') : dotWord(bit));
  return {
    lang,
    NODE_LABEL: en ? NODE_LABEL_EN : NODE_LABEL,
    OUTCOME_LABEL: en ? OUTCOME_LABEL_EN : OUTCOME_LABEL,
    TOPIC_LABEL: en ? TOPIC_LABEL_EN : TOPIC_LABEL,
    METHOD_LABEL: en ? METHOD_LABEL_EN : METHOD_LABEL,
    TOPIC_HOUSES: en ? TOPIC_HOUSES_EN : TOPIC_HOUSES,
    TOPIC_EXAMPLE: en ? TOPIC_EXAMPLE_EN : TOPIC_EXAMPLE,
    HOUSE_RULE_LABEL: en ? HOUSE_RULE_LABEL_EN : HOUSE_RULE_LABEL,
    HOUSE_RULE_HELP: en ? HOUSE_RULE_HELP_EN : HOUSE_RULE_HELP,
    RULE_LABEL: en ? RULE_LABEL_EN : RULE_LABEL,
    HOUSES: (en ? HOUSES_EN : HOUSES) as readonly string[],
    ROW_ELEMENT: (en ? ['Fire', 'Air', 'Water', 'Earth'] : ROW_ELEMENT) as readonly string[],
    ORDINAL: (en ? ['first', 'second', 'third', 'fourth'] : ORDINAL) as readonly string[],
    dotWord: dot,
    /** 第一母象 or First Mother, for index 0–3. */
    mother: (index: number) => (en ? NODE_LABEL_EN : NODE_LABEL)[`M${index + 1}` as NodeId],
    /** 奇數／偶數 or odd／even, from a count of dots. */
    parity: (count: number) => (count % 2 === 1 ? (en ? 'odd' : '奇數') : (en ? 'even' : '偶數')),
    /** 「獲得」 or "Acquisitio". */
    name: (f: Entry) => figureName(f, lang),
    /** 「獲得／Acquisitio」 or "Acquisitio (Gain)". */
    fullName: (f: Entry) => figureFullName(f, lang),
    keywords: (f: Entry) => figureKeywords(f, lang),
    reflection: (f: Entry) => figureReflection(f, lang),
    error: (code: AppErrorCode) => (en ? ERROR_TEXT_EN : ERROR_TEXT)[code],
    /** Joins a list the way each language does: 、 or a comma. */
    list: (items: readonly string[]) => (en ? items.join(', ') : items.join('、')),
    formatDate: (iso: string) => formatDate(iso, lang),
    formatCalendarDate: (day: string) => formatCalendarDate(day, lang),
    figureAria: (figure: Figure) => {
      if (!en) return figureAria(figure);
      const f = figureOf(figure);
      return `${f.latin} (${FIGURES_EN[f.id].gloss}), top to bottom: ${figure.map(dot).join(', ')}`;
    },
  };
}
export type Labels = ReturnType<typeof labelsFor>;
