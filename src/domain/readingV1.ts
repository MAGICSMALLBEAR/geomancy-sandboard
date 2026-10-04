/**
 * Content version zh-TW-basic-draft-v1, FROZEN (ACCEPTANCE R05).
 * Saved records and backups carry this exact text; validation rebuilds it and compares word for word.
 * Never edit its text. Changed wording goes into a new version (see docs/ENGINE-AND-DATA.md §10);
 * later versions may import these tables when they keep the same wording.
 */
import { constructChart, houseNode, toDots, RULE_VERSION, type Mothers, type NodeId } from './geomancy.ts';
import type { Claim, Evidence, Question, Reading } from './reading.ts';

export const CONTENT_V1 = 'zh-TW-basic-draft-v1' as const;

export const FIGURES_V1: Record<string, { id: string; zh: string; latin: string; keywords: readonly string[]; reflection: string }> = {
  '1111': { id: 'via', zh: '道路', latin: 'Via', keywords: ['移動', '變化', '歷程'], reflection: '有哪些條件正在改變？先選一個可以調整的小步驟。' },
  '2222': { id: 'populus', zh: '群眾', latin: 'Populus', keywords: ['群體', '承接', '環境影響'], reflection: '分辨自己的想法與他人的期待，再決定要回應什麼。' },
  '2211': { id: 'fortuna-major', zh: '大幸運', latin: 'Fortuna Major', keywords: ['穩定力量', '累積', '持續'], reflection: '盤點已經累積的能力，選擇能持續投入的一項。' },
  '1122': { id: 'fortuna-minor', zh: '小幸運', latin: 'Fortuna Minor', keywords: ['短期助力', '機會', '外援'], reflection: '確認目前可用的協助，以及它能維持多久。' },
  '2121': { id: 'acquisitio', zh: '獲得', latin: 'Acquisitio', keywords: ['增加', '取得', '聚集'], reflection: '說清楚希望增加的是什麼，以及取得它需要的代價。' },
  '1212': { id: 'amissio', zh: '失去', latin: 'Amissio', keywords: ['減少', '付出', '放下'], reflection: '辨認值得保留與可以放下的事物，避免只以得失評價自己。' },
  '2112': { id: 'conjunctio', zh: '交會', latin: 'Conjunctio', keywords: ['連結', '相遇', '結合'], reflection: '列出可以接觸的人或資訊，確認彼此需要交換的內容。' },
  '1221': { id: 'carcer', zh: '囚牢', latin: 'Carcer', keywords: ['限制', '固定', '邊界'], reflection: '分清必要的界線與可以協商的限制，再挑一項處理。' },
  '1222': { id: 'laetitia', zh: '喜悅', latin: 'Laetitia', keywords: ['上升', '欣喜', '展開'], reflection: '留意讓自己願意投入的部分，也檢查所需資源。' },
  '2221': { id: 'tristitia', zh: '悲傷', latin: 'Tristitia', keywords: ['下沉', '沉重', '收束'], reflection: '把沉重的事情拆小，辨認現在需要的支持或休息。' },
  '1121': { id: 'puer', zh: '少年', latin: 'Puer', keywords: ['行動', '衝勁', '衝突'], reflection: '在採取行動前，寫下目標與不想跨越的界線。' },
  '1211': { id: 'puella', zh: '少女', latin: 'Puella', keywords: ['和諧', '吸引', '協調'], reflection: '確認自己希望維持的關係，也把真實需求說清楚。' },
  '2212': { id: 'albus', zh: '白', latin: 'Albus', keywords: ['澄清', '審慎', '理性'], reflection: '先補一項缺少的資訊，再作下一個選擇。' },
  '2122': { id: 'rubeus', zh: '紅', latin: 'Rubeus', keywords: ['激烈', '慾望', '失序'], reflection: '先記下強烈感受，等狀態穩定後再處理重要決定。' },
  '2111': { id: 'caput-draconis', zh: '龍首', latin: 'Caput Draconis', keywords: ['進入', '開始', '新階段'], reflection: '若準備開始，先確認最小可行的第一步與必要條件。' },
  '1112': { id: 'cauda-draconis', zh: '龍尾', latin: 'Cauda Draconis', keywords: ['離開', '結束', '清除'], reflection: '整理需要收尾的事項，留意結束過程中的責任。' },
};
export const HOUSES_V1 = [
  '自己與當下處境', '資源與財物', '近距離往來與訊息', '家庭與根基',
  '戀愛與創作', '日常工作與照料', '伴侶、合作與對手', '共享資源與失落',
  '遠行與學習', '職位與公共角色', '朋友與支持', '隱藏的限制',
] as const;
export const PROMPTS_V1: Record<Question['topic'], string> = {
  general: '寫下一個你能主動觀察或採取的小步驟。',
  work: '把實際條件、可用資源與待確認資訊分開記錄。',
  relationship: '分清自己的需求與對他人的猜測，考慮一個可以尊重彼此的溝通方式。',
};

/** Expects a question that already passed assertQuestion. */
export function buildReadingV1(mothers: Mothers, question: Question): Reading {
  const chart = constructChart(mothers);
  const info = (node: NodeId) => FIGURES_V1[toDots(chart[node])];
  const evidence = (nodeId: NodeId, house?: number): Evidence => ({
    nodeId, figureId: info(nodeId).id, dots: toDots(chart[nodeId]),
    ...(house === undefined ? {} : { house }),
  });
  const theme = (node: NodeId, label: string) => {
    const f = info(node);
    return `${label}為「${f.zh}／${f.latin}」，象徵主題包括${f.keywords.join('、')}。`;
  };
  const claims: Claim[] = [
    { claimId: 'overall', ruleId: 'basic.judge-theme.v1', kind: 'symbolic-theme', title: '整體觀察主題',
      text: theme('J', '裁判') + '可將這些主題帶回問題思考；這一層尚未判斷事情是否成就。',
      evidence: [evidence('J')], sourceIds: ['G01', 'G04', 'E01'] },
    { claimId: 'witnesses', ruleId: 'basic.witness-pair.v1', kind: 'symbolic-theme', title: '兩個證人的並列觀察',
      text: theme('RW', '右證人') + theme('LW', '左證人') + '先並列觀察，不預設兩者互相抵消，也不固定解作過去與未來。',
      evidence: [evidence('RW'), evidence('LW')], sourceIds: ['G01', 'E01'] },
    { claimId: 'querent', ruleId: 'basic.house-context.v1', kind: 'symbolic-theme', title: '自己的處境',
      text: `第 1 宮用於觀察${HOUSES_V1[0]}。` + theme('M1', '此宮的象'),
      evidence: [evidence('M1', 1)], sourceIds: ['G02', 'G04', 'E01'] },
  ];
  if (question.targetHouse !== null) {
    const h = question.targetHouse, node = houseNode(h);
    claims.push({ claimId: 'topic', ruleId: 'basic.house-context.v1', kind: 'symbolic-theme', title: '問題所屬範圍',
      text: `你選擇第 ${h} 宮：${HOUSES_V1[h - 1]}。` + theme(node, '此宮的象') + '本版尚未計算它與第 1 宮之間的成就關係。',
      evidence: [evidence(node, h)], sourceIds: ['G02', 'G04', 'E01'] });
  }
  claims.push({ claimId: 'reflection', ruleId: 'editorial.reflection.v1', kind: 'reflection', title: '可以記下的下一步',
    text: info('J').reflection + PROMPTS_V1[question.topic], evidence: [evidence('J')], sourceIds: ['E01'] });
  return { ruleVersion: RULE_VERSION, contentVersion: CONTENT_V1, scope: 'basic-symbolic',
    reviewStatus: 'editorial-draft', claims };
}
