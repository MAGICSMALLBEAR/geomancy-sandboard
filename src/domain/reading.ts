import { constructChart, houseNode, toDots, RULE_VERSION, type Mothers, type NodeId } from './geomancy.ts';
import { CONTENT_VERSION, CONTENT_PROVENANCE, figureInfo, HOUSES } from './catalog.ts';

export type Question = {
  text: string; timeframe: string;
  topic: 'general' | 'work' | 'relationship';
  targetHouse: null | 5 | 6 | 7 | 10;
};
export function assertQuestion(value: unknown): asserts value is Question {
  if (!value || typeof value !== 'object') throw new Error('INVALID_QUESTION');
  const q = value as Question;
  const legalHouse = q.topic === 'general' ? q.targetHouse === null
    : q.topic === 'work' ? [6, 7, 10].includes(q.targetHouse as number)
    : q.topic === 'relationship' ? [5, 7].includes(q.targetHouse as number) : false;
  if (typeof q.text !== 'string' || q.text.trim().length < 1 || q.text.length > 500 ||
      typeof q.timeframe !== 'string' || q.timeframe.length > 80 || !legalHouse) throw new Error('INVALID_QUESTION');
}
export type Evidence = { nodeId: NodeId; figureId: string; dots: string; house?: number };
export type Claim = {
  claimId: string;
  ruleId: string;
  kind: 'symbolic-theme' | 'reflection';
  title: string;
  text: string;
  evidence: Evidence[];
  sourceIds: string[];
};
export type Reading = {
  ruleVersion: typeof RULE_VERSION;
  contentVersion: typeof CONTENT_VERSION;
  scope: 'basic-symbolic';
  reviewStatus: 'editorial-draft';
  claims: Claim[];
};

/** Recomputes the chart; ignores question text for symbolic inference. No prediction or AI. */
export function buildReading(mothers: Mothers, question: Question): Reading {
  assertQuestion(question);
  const chart = constructChart(mothers);
  const evidence = (nodeId: NodeId, house?: number): Evidence => ({
    nodeId, figureId: figureInfo(chart[nodeId]).id, dots: toDots(chart[nodeId]),
    ...(house === undefined ? {} : { house }),
  });
  const theme = (node: NodeId, label: string) => {
    const f = figureInfo(chart[node]);
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
      text: `第 1 宮用於觀察${HOUSES[0]}。` + theme('M1', '此宮的象'),
      evidence: [evidence('M1', 1)], sourceIds: ['G02', 'G04', 'E01'] },
  ];
  if (question.targetHouse !== null) {
    const h = question.targetHouse, node = houseNode(h);
    claims.push({ claimId: 'topic', ruleId: 'basic.house-context.v1', kind: 'symbolic-theme', title: '問題所屬範圍',
      text: `你選擇第 ${h} 宮：${HOUSES[h - 1]}。` + theme(node, '此宮的象') + '本版尚未計算它與第 1 宮之間的成就關係。',
      evidence: [evidence(node, h)], sourceIds: ['G02', 'G04', 'E01'] });
  }
  const prompts = {
    general: '寫下一個你能主動觀察或採取的小步驟。',
    work: '把實際條件、可用資源與待確認資訊分開記錄。',
    relationship: '分清自己的需求與對他人的猜測，考慮一個可以尊重彼此的溝通方式。',
  };
  claims.push({ claimId: 'reflection', ruleId: 'editorial.reflection.v1', kind: 'reflection', title: '可以記下的下一步',
    text: figureInfo(chart.J).reflection + prompts[question.topic], evidence: [evidence('J')], sourceIds: ['E01'] });
  return { ruleVersion: RULE_VERSION, contentVersion: CONTENT_VERSION, scope: 'basic-symbolic',
    reviewStatus: CONTENT_PROVENANCE.reviewStatus, claims };
}
