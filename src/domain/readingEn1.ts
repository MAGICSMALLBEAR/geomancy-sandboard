/**
 * Content version en-basic-draft-v1 (DECISIONS D43), FROZEN once released (ACCEPTANCE R05).
 * The English counterpart of zh-TW-basic-draft-v2: same claims, rule IDs, evidence and sources; original
 * English editorial drafts, NOT expert-reviewed. Saved English records carry this exact text.
 */
import { constructChart, houseNode, toDots, RULE_VERSION, type Mothers, type NodeId, type RuleVersion } from './geomancy.ts';
import type { Claim, Evidence, Question, Reading } from './reading.ts';
import { FIGURES_V1 } from './readingV1.ts';

export const CONTENT_EN1 = 'en-basic-draft-v1' as const;

/** Frozen copies: later edits to the live catalog must not change saved English records. */
const FIGURES_EN1: Record<string, { gloss: string; keywords: readonly [string, string, string]; reflection: string }> = {
  via: { gloss: 'Way', keywords: ['movement', 'change', 'journey'], reflection: 'Which conditions are changing right now? Pick one small step you can adjust first.' },
  populus: { gloss: 'People', keywords: ['the group', 'receptiveness', 'surroundings'], reflection: 'Tell your own view apart from what others expect, then decide what to answer.' },
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
const HOUSES_EN1 = [
  'yourself and your present situation', 'resources and money', 'nearby contacts and messages', 'home and foundations',
  'love and creativity', 'daily work and care', 'partners, cooperation and opponents', 'shared resources and loss',
  'travel and learning', 'career and public role', 'friends and support', 'hidden limits',
] as const;
const PROMPTS_EN1: Record<Question['topic'], string> = {
  general: ' Write down one small step you can watch for or take yourself.',
  work: ' Keep the actual conditions, the resources you have and the information still to confirm in separate notes.',
  relationship: ' Tell your own needs apart from your guesses about others, and consider a way of talking that respects both sides.',
};

/** Expects a question that already passed assertQuestion. */
export function buildReadingEn1(mothers: Mothers, question: Question, rule: RuleVersion = RULE_VERSION): Reading {
  const chart = constructChart(mothers);
  const info = (node: NodeId) => FIGURES_V1[toDots(chart[node])];
  const evidence = (nodeId: NodeId, house?: number): Evidence => ({
    nodeId, figureId: info(nodeId).id, dots: toDots(chart[nodeId]),
    ...(house === undefined ? {} : { house }),
  });
  const theme = (node: NodeId, label: string) => {
    const f = info(node), en = FIGURES_EN1[f.id];
    return `${label} is ${f.latin} (${en.gloss}), whose themes include ${en.keywords[0]}, ${en.keywords[1]} and ${en.keywords[2]}.`;
  };
  const querent = houseNode(1, rule);
  const claims: Claim[] = [
    { claimId: 'overall', ruleId: 'basic.judge-theme.v1', kind: 'symbolic-theme', title: 'Overall theme',
      text: theme('J', 'The Judge') + ' Take these themes back to your question; this layer does not yet say whether the matter comes about.',
      evidence: [evidence('J')], sourceIds: ['G01', 'G04', 'E01'] },
    { claimId: 'witnesses', ruleId: 'basic.witness-pair.v1', kind: 'symbolic-theme', title: 'The two Witnesses side by side',
      text: theme('RW', 'The Right Witness') + ' ' + theme('LW', 'The Left Witness') + ' Look at them side by side first: they do not cancel each other out, and they are not fixed as past and future.',
      evidence: [evidence('RW'), evidence('LW')], sourceIds: ['G01', 'E01'] },
    { claimId: 'querent', ruleId: 'basic.house-context.v1', kind: 'symbolic-theme', title: 'Your own situation',
      text: `House 1 is used to look at ${HOUSES_EN1[0]}. ` + theme(querent, 'The figure here'),
      evidence: [evidence(querent, 1)], sourceIds: ['G02', 'G04', 'E01'] },
  ];
  if (question.targetHouse !== null) {
    const h = question.targetHouse, node = houseNode(h, rule);
    claims.push({ claimId: 'topic', ruleId: 'basic.house-context.v1', kind: 'symbolic-theme', title: 'The area of your question',
      text: `You chose house ${h}: ${HOUSES_EN1[h - 1]}. ` + theme(node, 'The figure here') + ' Whether it is linked to house 1 is shown under "Perfection" in the advanced reading below.',
      evidence: [evidence(node, h)], sourceIds: ['G02', 'G04', 'E01'] });
  }
  claims.push({ claimId: 'reflection', ruleId: 'editorial.reflection.v1', kind: 'reflection', title: 'A next step to note',
    text: FIGURES_EN1[info('J').id].reflection + PROMPTS_EN1[question.topic], evidence: [evidence('J')], sourceIds: ['E01'] });
  return { ruleVersion: rule, contentVersion: CONTENT_EN1, scope: 'basic-symbolic', reviewStatus: 'editorial-draft', claims };
}
