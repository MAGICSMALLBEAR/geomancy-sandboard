import { RULE_VERSION, type Mothers, type NodeId } from './geomancy.ts';
import { CONTENT_VERSION } from './catalog.ts';
import { buildReadingV1, CONTENT_V1 } from './readingV1.ts';
import { buildReadingV2, CONTENT_V2 } from './readingV2.ts';

export type Question = {
  text: string; timeframe: string;
  topic: 'general' | 'work' | 'relationship';
  targetHouse: null | 5 | 6 | 7 | 10;
  /** What the user first wrote before focusing the question (plan §10, DECISIONS D34). Optional, never read by the reading. */
  originalText?: string;
};
export const ORIGINAL_TEXT_MAX = 1000;
/** Copy with a fixed key order; an empty original is dropped rather than stored. */
export const cleanQuestion = (q: Question): Question => ({
  text: q.text, timeframe: q.timeframe, topic: q.topic, targetHouse: q.targetHouse,
  ...(q.originalText ? { originalText: q.originalText } : {}),
});
export function assertQuestion(value: unknown): asserts value is Question {
  if (!value || typeof value !== 'object') throw new Error('INVALID_QUESTION');
  const q = value as Question;
  const legalHouse = q.topic === 'general' ? q.targetHouse === null
    : q.topic === 'work' ? [6, 7, 10].includes(q.targetHouse as number)
    : q.topic === 'relationship' ? [5, 7].includes(q.targetHouse as number) : false;
  if (typeof q.text !== 'string' || q.text.trim().length < 1 || q.text.length > 500 ||
      typeof q.timeframe !== 'string' || q.timeframe.length > 80 || !legalHouse ||
      (q.originalText !== undefined && (typeof q.originalText !== 'string' || q.originalText.length > ORIGINAL_TEXT_MAX))) {
    throw new Error('INVALID_QUESTION');
  }
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
  contentVersion: ContentVersion;
  scope: 'basic-symbolic';
  /** 'expert-reviewed' is reserved for a version whose every claim passed expert review. */
  reviewStatus: 'editorial-draft' | 'expert-reviewed';
  claims: Claim[];
};

/** Every content version this build can rebuild and verify. Add new ones; never remove or edit old ones (R05). */
const BUILDERS: Record<ContentVersion, (mothers: Mothers, question: Question) => Reading> = {
  [CONTENT_V1]: buildReadingV1,
  [CONTENT_V2]: buildReadingV2,
};
export type ContentVersion = typeof CONTENT_V1 | typeof CONTENT_V2;
export const isKnownContentVersion = (v: unknown): v is ContentVersion =>
  typeof v === 'string' && Object.prototype.hasOwnProperty.call(BUILDERS, v);

/**
 * Recomputes the chart; ignores question text for symbolic inference. No prediction or AI.
 * New records use the current CONTENT_VERSION; old records are rebuilt with the version they were saved with.
 */
export function buildReading(mothers: Mothers, question: Question, version: ContentVersion = CONTENT_VERSION): Reading {
  assertQuestion(question);
  return BUILDERS[version](mothers, question);
}
