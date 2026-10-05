/** Display labels. Logical node order stays in the domain; nothing here reorders data. */
import { HOUSE_NODES, toDots, type Figure, type NodeId, type CastSource } from '../domain/geomancy.ts';
import { FIGURES } from '../domain/catalog.ts';
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

export const houseOfNode = (node: NodeId): number | null => {
  const index = HOUSE_NODES.indexOf(node);
  return index === -1 ? null : index + 1;
};
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

export const RULE_LABEL: Record<string, string> = {
  'basic.judge-theme.v1': '裁判的象徵主題',
  'basic.witness-pair.v1': '兩證人並列',
  'basic.house-context.v1': '宮位與所在的象',
  'editorial.reflection.v1': '本產品原創的反思提示',
};

export function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('zh-TW', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}
