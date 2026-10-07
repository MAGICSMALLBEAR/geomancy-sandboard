/**
 * Content version zh-TW-basic-draft-v2, FROZEN once released (ACCEPTANCE R05; DECISIONS D29).
 * Same tables and wording as v1, except the topic card: v1 said perfection was not yet computed,
 * which became untrue in 0.4.0 when the advanced reading started computing it.
 * 0.12.0 (D41): the house rule became a parameter. Wording is unchanged; under the sequential rule the output
 * is identical to before, so every stored v2 record still verifies.
 */
import { constructChart, houseNode, toDots, RULE_VERSION, type Mothers, type NodeId, type RuleVersion } from './geomancy.ts';
import type { Claim, Evidence, Question, Reading } from './reading.ts';
import { FIGURES_V1, HOUSES_V1, PROMPTS_V1 } from './readingV1.ts';

export const CONTENT_V2 = 'zh-TW-basic-draft-v2' as const;

/** Expects a question that already passed assertQuestion. */
export function buildReadingV2(mothers: Mothers, question: Question, rule: RuleVersion = RULE_VERSION): Reading {
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
      text: `第 1 宮用於觀察${HOUSES_V1[0]}。` + theme(houseNode(1, rule), '此宮的象'),
      evidence: [evidence(houseNode(1, rule), 1)], sourceIds: ['G02', 'G04', 'E01'] },
  ];
  if (question.targetHouse !== null) {
    const h = question.targetHouse, node = houseNode(h, rule);
    claims.push({ claimId: 'topic', ruleId: 'basic.house-context.v1', kind: 'symbolic-theme', title: '問題所屬範圍',
      text: `你選擇第 ${h} 宮：${HOUSES_V1[h - 1]}。` + theme(node, '此宮的象') + '它與第 1 宮之間有沒有成事關係，請看下方進階解讀的「成事關係」。',
      evidence: [evidence(node, h)], sourceIds: ['G02', 'G04', 'E01'] });
  }
  claims.push({ claimId: 'reflection', ruleId: 'editorial.reflection.v1', kind: 'reflection', title: '可以記下的下一步',
    text: info('J').reflection + PROMPTS_V1[question.topic], evidence: [evidence('J')], sourceIds: ['E01'] });
  return { ruleVersion: rule, contentVersion: CONTENT_V2, scope: 'basic-symbolic',
    reviewStatus: 'editorial-draft', claims };
}
