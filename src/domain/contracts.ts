/** Application contracts. Persistence, migration and import validators are still to be built. */
import type { CastSource, Chart, Mothers } from './geomancy.ts';
import type { ContentVersion, Question, Reading } from './reading.ts';

export interface ReadingRecord {
  schemaVersion: 1;
  id: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
  ruleVersion: 'western-sequential-v1';
  contentVersion: ContentVersion;
  question: Question;
  source: CastSource;
  mothers: Mothers;
  chart: Chart;
  reading: Reading;
  notes: string;
  /** What happened afterwards, written by the user later (DECISIONS D30). Optional; older records have none. */
  outcome?: Outcome;
  /** What the user means to do next and when to look back (DECISIONS D37). Optional; older records have none. */
  plan?: ActionPlan;
  integrity: 'verified';
  importOrigin?: { originalId: string; importedAt: string };
}
export type OutcomeStatus = 'matched' | 'partly' | 'not-matched' | 'unclear';
export const OUTCOME_STATUSES: readonly OutcomeStatus[] = ['matched', 'partly', 'not-matched', 'unclear'];
export interface Outcome {
  status: OutcomeStatus;
  text: string;
  recordedAt: string;
}
export interface ActionPlan {
  /** May be empty when only a review date is set. */
  action: string;
  /** Local calendar date `YYYY-MM-DD`; absent when the user set none. */
  reviewOn?: string;
  recordedAt: string;
}
export interface Draft {
  schemaVersion: 1;
  id: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
  question: Question;
  ruleVersion: 'western-sequential-v1';
  contentVersion: ContentVersion;
  method: 'dots' | 'press' | 'auto' | 'quick' | 'manual';
  confirmedCounts: number[];
  /** Long-press method: one saved device byte per completed press. */
  confirmedPresses?: number[];
  /** auto/quick/manual data captured once; set before finalization, then never redraw on retry. */
  preparedSource: CastSource | null;
  state: 'casting' | 'ready-to-finalize';
}
export interface ExportEnvelope {
  format: 'geomancy-journal';
  schemaVersion: 1;
  exportedAt: string;
  records: ReadingRecord[];
}
