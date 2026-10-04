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
export const CONTENT_PROVENANCE = {
  reviewStatus: 'editorial-draft',
  patternSourceIds: ['G03'],
  contextSourceIds: ['G04', 'G05'],
  reflectionSource: 'original-product-editorial',
} as const;
