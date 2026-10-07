import { toDots, type Figure } from './geomancy.ts';

/** Original Traditional Chinese editorial drafts; NOT expert-reviewed interpretations. */
export const CONTENT_VERSION = 'zh-TW-basic-draft-v2' as const;
export const FIGURES = [
  { id: 'via', latin: 'Via', zh: '道路', dots: '1111', keywords: ['移動', '變化', '歷程'], reflection: '有哪些條件正在改變？先選一個可以調整的小步驟。' },
  { id: 'populus', latin: 'Populus', zh: '群眾', dots: '2222', keywords: ['群體', '承接', '環境影響'], reflection: '分辨自己的想法與他人的期待，再決定要回應什麼。' },
  { id: 'fortuna-major', latin: 'Fortuna Major', zh: '大幸運', dots: '2211', keywords: ['穩定力量', '累積', '持續'], reflection: '盤點已經累積的能力，選擇能持續投入的一項。' },
  { id: 'fortuna-minor', latin: 'Fortuna Minor', zh: '小幸運', dots: '1122', keywords: ['短期助力', '機會', '外援'], reflection: '確認目前可用的協助，以及它能維持多久。' },
  { id: 'acquisitio', latin: 'Acquisitio', zh: '獲得', dots: '2121', keywords: ['增加', '取得', '聚集'], reflection: '說清楚希望增加的是什麼，以及取得它需要的代價。' },
  { id: 'amissio', latin: 'Amissio', zh: '失去', dots: '1212', keywords: ['減少', '付出', '放下'], reflection: '辨認值得保留與可以放下的事物，避免只以得失評價自己。' },
  { id: 'conjunctio', latin: 'Conjunctio', zh: '交會', dots: '2112', keywords: ['連結', '相遇', '結合'], reflection: '列出可以接觸的人或資訊，確認彼此需要交換的內容。' },
  { id: 'carcer', latin: 'Carcer', zh: '囚牢', dots: '1221', keywords: ['限制', '固定', '邊界'], reflection: '分清必要的界線與可以協商的限制，再挑一項處理。' },
  { id: 'laetitia', latin: 'Laetitia', zh: '喜悅', dots: '1222', keywords: ['上升', '欣喜', '展開'], reflection: '留意讓自己願意投入的部分，也檢查所需資源。' },
  { id: 'tristitia', latin: 'Tristitia', zh: '悲傷', dots: '2221', keywords: ['下沉', '沉重', '收束'], reflection: '把沉重的事情拆小，辨認現在需要的支持或休息。' },
  { id: 'puer', latin: 'Puer', zh: '少年', dots: '1121', keywords: ['行動', '衝勁', '衝突'], reflection: '在採取行動前，寫下目標與不想跨越的界線。' },
  { id: 'puella', latin: 'Puella', zh: '少女', dots: '1211', keywords: ['和諧', '吸引', '協調'], reflection: '確認自己希望維持的關係，也把真實需求說清楚。' },
  { id: 'albus', latin: 'Albus', zh: '白', dots: '2212', keywords: ['澄清', '審慎', '理性'], reflection: '先補一項缺少的資訊，再作下一個選擇。' },
  { id: 'rubeus', latin: 'Rubeus', zh: '紅', dots: '2122', keywords: ['激烈', '慾望', '失序'], reflection: '先記下強烈感受，等狀態穩定後再處理重要決定。' },
  { id: 'caput-draconis', latin: 'Caput Draconis', zh: '龍首', dots: '2111', keywords: ['進入', '開始', '新階段'], reflection: '若準備開始，先確認最小可行的第一步與必要條件。' },
  { id: 'cauda-draconis', latin: 'Cauda Draconis', zh: '龍尾', dots: '1112', keywords: ['離開', '結束', '清除'], reflection: '整理需要收尾的事項，留意結束過程中的責任。' },
] as const;
export type FigureId = typeof FIGURES[number]['id'];
/**
 * English gloss, keywords and reflection for each figure (DECISIONS D43). Original editorial drafts written
 * alongside the Chinese ones; NOT expert-reviewed. In English the Latin name leads, as in English geomancy books.
 */
export const FIGURES_EN: Record<FigureId, { gloss: string; keywords: readonly string[]; reflection: string }> = {
  via: { gloss: 'Way', keywords: ['movement', 'change', 'journey'], reflection: 'Which conditions are changing right now? Pick one small step you can adjust first.' },
  populus: { gloss: 'People', keywords: ['the group', 'receptiveness', 'surroundings'], reflection: "Tell your own view apart from what others expect, then decide what to answer." },
  'fortuna-major': { gloss: 'Greater Fortune', keywords: ['steady strength', 'accumulation', 'endurance'], reflection: 'Take stock of the abilities you have built up, and choose one you can keep investing in.' },
  'fortuna-minor': { gloss: 'Lesser Fortune', keywords: ['short-term help', 'opportunity', 'outside aid'], reflection: 'Check what help is available now, and how long it will last.' },
  acquisitio: { gloss: 'Gain', keywords: ['increase', 'acquiring', 'gathering'], reflection: 'Say clearly what you want more of, and what getting it will cost.' },
  amissio: { gloss: 'Loss', keywords: ['decrease', 'giving', 'letting go'], reflection: "Sort out what is worth keeping and what you can let go; don't judge yourself only by gains and losses." },
  conjunctio: { gloss: 'Conjunction', keywords: ['connection', 'meeting', 'joining'], reflection: 'List the people or information you can reach, and what each side needs to exchange.' },
  carcer: { gloss: 'Prison', keywords: ['restriction', 'fixity', 'boundaries'], reflection: 'Separate the boundaries you need from the limits you can negotiate, then deal with one.' },
  laetitia: { gloss: 'Joy', keywords: ['rising', 'delight', 'opening'], reflection: 'Notice what makes you want to engage, and check the resources it needs.' },
  tristitia: { gloss: 'Sorrow', keywords: ['sinking', 'heaviness', 'contraction'], reflection: 'Break the heavy thing into smaller parts, and name the support or rest you need now.' },
  puer: { gloss: 'Boy', keywords: ['action', 'drive', 'conflict'], reflection: "Before acting, write down your goal and the line you don't want to cross." },
  puella: { gloss: 'Girl', keywords: ['harmony', 'attraction', 'accord'], reflection: 'Be clear about the relationships you want to keep, and say what you really need.' },
  albus: { gloss: 'White', keywords: ['clarity', 'caution', 'reason'], reflection: 'Find one missing piece of information before your next choice.' },
  rubeus: { gloss: 'Red', keywords: ['intensity', 'desire', 'disorder'], reflection: 'Write down the strong feelings first; leave important decisions until you are steadier.' },
  'caput-draconis': { gloss: 'Head of the Dragon', keywords: ['entering', 'beginning', 'a new stage'], reflection: 'If you are about to start, define the smallest workable first step and what it requires.' },
  'cauda-draconis': { gloss: 'Tail of the Dragon', keywords: ['leaving', 'ending', 'clearing'], reflection: 'List what needs wrapping up, and mind your responsibilities as it ends.' },
};
type FigureEntry = typeof FIGURES[number];
/** Display name: Chinese name in Chinese, Latin name in English. */
export const figureName = (f: FigureEntry, lang: 'zh-TW' | 'en') => (lang === 'en' ? f.latin : f.zh);
/** Name with its other form: 「獲得／Acquisitio」 or "Acquisitio (Gain)". */
export const figureFullName = (f: FigureEntry, lang: 'zh-TW' | 'en') =>
  (lang === 'en' ? `${f.latin} (${FIGURES_EN[f.id].gloss})` : `${f.zh}／${f.latin}`);
export const figureKeywords = (f: FigureEntry, lang: 'zh-TW' | 'en'): readonly string[] => (lang === 'en' ? FIGURES_EN[f.id].keywords : f.keywords);
export const figureReflection = (f: FigureEntry, lang: 'zh-TW' | 'en') => (lang === 'en' ? FIGURES_EN[f.id].reflection : f.reflection);
export function figureInfo(figure: Figure) {
  const result = FIGURES.find(f => f.dots === toDots(figure));
  if (!result) throw new Error('UNKNOWN_FIGURE');
  return result;
}
export const HOUSES = [
  '自己與當下處境', '資源與財物', '近距離往來與訊息', '家庭與根基',
  '戀愛與創作', '日常工作與照料', '伴侶、合作與對手', '共享資源與失落',
  '遠行與學習', '職位與公共角色', '朋友與支持', '隱藏的限制',
] as const;
export const HOUSES_EN = [
  'Self and present situation', 'Resources and money', 'Nearby contacts and messages', 'Home and foundations',
  'Love and creativity', 'Daily work and care', 'Partners, cooperation and opponents', 'Shared resources and loss',
  'Travel and learning', 'Career and public role', 'Friends and support', 'Hidden limits',
] as const;
export const housesFor = (lang: 'zh-TW' | 'en'): readonly string[] => (lang === 'en' ? HOUSES_EN : HOUSES);
export const CONTENT_PROVENANCE = {
  reviewStatus: 'editorial-draft',
  patternSourceIds: ['G03'],
  contextSourceIds: ['G04', 'G05'],
  reflectionSource: 'original-product-editorial',
} as const;
