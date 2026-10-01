/** Application contracts. Persistence, migration and import validators are still to be built. */
import type { CastSource, Chart, Mothers } from './geomancy.ts';
import type { Question, Reading } from './reading.ts';

export interface ReadingRecord {
  schemaVersion: 1;
  id: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
  ruleVersion: 'western-sequential-v1';
  contentVersion: 'zh-TW-basic-draft-v1';
  question: Question;
  source: CastSource;
  mothers: Mothers;
  chart: Chart;
  reading: Reading;
  notes: string;
  integrity: 'verified';
  importOrigin?: { originalId: string; importedAt: string };
}
export interface Draft {
  schemaVersion: 1;
  id: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
  question: Question;
  ruleVersion: 'western-sequential-v1';
  contentVersion: 'zh-TW-basic-draft-v1';
  method: 'dots' | 'quick' | 'manual';
  confirmedCounts: number[];
  /** quick/manual data captured once; set before finalization, then never redraw on retry. */
  preparedSource: CastSource | null;
  state: 'casting' | 'ready-to-finalize';
}
export interface ExportEnvelope {
  format: 'geomancy-journal';
  schemaVersion: 1;
  exportedAt: string;
  records: ReadingRecord[];
}
