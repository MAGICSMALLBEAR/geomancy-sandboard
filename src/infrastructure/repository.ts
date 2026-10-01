/** Storage boundary. UI state must only advance after these promises resolve. */
import type { CastSource } from '../domain/geomancy.ts';
import type { Question } from '../domain/reading.ts';
import type { Draft, ReadingRecord } from '../domain/contracts.ts';
import { AppError } from './errors.ts';
import { newDraft, newId, recordFromDraft, withConfirmedRow, withNotes, withPreparedSource, type CastMethod } from './records.ts';

export type MotionSetting = 'system' | 'reduce' | 'full';
export type Settings = { motion: MotionSetting; sound: boolean; pilotLogging: boolean };
export const DEFAULT_SETTINGS: Settings = { motion: 'system', sound: false, pilotLogging: false };

/** See docs/PILOT.md: no question, notes, counts, figures, record IDs or coordinates. */
export type PilotEvent = {
  schemaVersion: 1;
  sessionId: string;
  name: 'session_started' | 'method_chosen' | 'row_confirmed' | 'chart_completed'
    | 'evidence_opened' | 'note_saved' | 'session_left' | 'error_shown';
  elapsedMs: number;
  method?: CastMethod;
  rowIndex?: number;
  errorCode?: string;
};
export type FeedbackEntry =
  | { id: string; createdAt: string; kind: 'event'; event: PilotEvent }
  | { id: string; createdAt: string; kind: 'rating'; ease: number; clarity: number; improve: string };
export const FEEDBACK_EVENT_LIMIT = 5000;

/** Read-only import whose versions this build does not understand. Never interpreted as a ReadingRecord. */
export type ArchiveEntry = {
  archiveId: string;
  importedAt: string;
  preview: { questionText: string; createdAt: string; schemaVersion: string; ruleVersion: string; contentVersion: string };
  raw: string;
};

export interface Repository {
  readonly mode: 'persistent' | 'memory';
  getActiveDraft(): Promise<Draft | null>;
  createDraft(question: Question, method: CastMethod): Promise<Draft>;
  loadDraft(id: string): Promise<Draft | null>;
  discardDraft(id: string): Promise<void>;
  confirmRow(id: string, expectedRevision: number, count: number): Promise<Draft>;
  prepareSource(id: string, expectedRevision: number, source: CastSource): Promise<Draft>;
  finalizeDraft(id: string): Promise<ReadingRecord>;
  getReading(id: string): Promise<ReadingRecord | null>;
  listReadings(): Promise<ReadingRecord[]>;
  saveNotes(id: string, expectedRevision: number, notes: string): Promise<ReadingRecord>;
  deleteReading(id: string): Promise<void>;
  /** All-or-nothing; never overwrites an existing ID. */
  importBatch(records: ReadingRecord[], archives: ArchiveEntry[]): Promise<void>;
  clearAll(): Promise<void>;
  getSettings(): Promise<Settings>;
  setSetting<K extends keyof Settings>(key: K, value: Settings[K]): Promise<void>;
  addFeedback(entry: FeedbackEntry): Promise<void>;
  listFeedback(): Promise<FeedbackEntry[]>;
  clearFeedback(): Promise<void>;
  listArchives(): Promise<ArchiveEntry[]>;
  deleteArchive(archiveId: string): Promise<void>;
}

export type Clock = () => string;
export const systemClock: Clock = () => new Date().toISOString();
const byCreatedDesc = (a: { createdAt: string }, b: { createdAt: string }) => a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0;
export const sortNewestFirst = <T extends { createdAt: string }>(items: T[]): T[] => [...items].sort(byCreatedDesc);

/** Explicitly labelled temporary mode used when IndexedDB cannot be opened. Lost when the tab closes. */
export class MemoryRepository implements Repository {
  readonly mode = 'memory' as const;
  private drafts = new Map<string, Draft>();
  private readings = new Map<string, ReadingRecord>();
  private settings: Settings = { ...DEFAULT_SETTINGS };
  private feedback: FeedbackEntry[] = [];
  private archives = new Map<string, ArchiveEntry>();
  private clock: Clock;
  constructor(clock: Clock = systemClock) { this.clock = clock; }

  private draft(id: string): Draft {
    const d = this.drafts.get(id);
    if (!d) throw new AppError('NOT_FOUND');
    return d;
  }
  async getActiveDraft() { return structuredClone(sortNewestFirst([...this.drafts.values()])[0] ?? null); }
  async createDraft(question: Question, method: CastMethod) {
    if (this.drafts.size > 0) throw new AppError('DRAFT_EXISTS');
    const d = newDraft(newId(), question, method, this.clock());
    this.drafts.set(d.id, d);
    return structuredClone(d);
  }
  async loadDraft(id: string) { return structuredClone(this.drafts.get(id) ?? null); }
  async discardDraft(id: string) { this.drafts.delete(id); }
  async confirmRow(id: string, expectedRevision: number, count: number) {
    const d = withConfirmedRow(this.draft(id), expectedRevision, count, this.clock());
    this.drafts.set(id, d);
    return structuredClone(d);
  }
  async prepareSource(id: string, expectedRevision: number, source: CastSource) {
    const d = withPreparedSource(this.draft(id), expectedRevision, source, this.clock());
    this.drafts.set(id, d);
    return structuredClone(d);
  }
  async finalizeDraft(id: string) {
    const existing = this.readings.get(id);
    if (existing) return structuredClone(existing);
    const record = recordFromDraft(this.draft(id), this.clock());
    this.readings.set(id, record);
    this.drafts.delete(id);
    return structuredClone(record);
  }
  async getReading(id: string) { return structuredClone(this.readings.get(id) ?? null); }
  async listReadings() { return structuredClone(sortNewestFirst([...this.readings.values()])); }
  async saveNotes(id: string, expectedRevision: number, notes: string) {
    const current = this.readings.get(id);
    if (!current) throw new AppError('NOT_FOUND');
    const next = withNotes(current, expectedRevision, notes, this.clock());
    this.readings.set(id, next);
    return structuredClone(next);
  }
  async deleteReading(id: string) { this.readings.delete(id); }
  async importBatch(records: ReadingRecord[], archives: ArchiveEntry[]) {
    if (records.some(r => this.readings.has(r.id)) || archives.some(a => this.archives.has(a.archiveId))) {
      throw new AppError('STORAGE_UNAVAILABLE');
    }
    for (const r of records) this.readings.set(r.id, structuredClone(r));
    for (const a of archives) this.archives.set(a.archiveId, structuredClone(a));
  }
  async clearAll() { this.drafts.clear(); this.readings.clear(); this.archives.clear(); this.feedback = []; }
  async getSettings() { return { ...this.settings }; }
  async setSetting<K extends keyof Settings>(key: K, value: Settings[K]) { this.settings[key] = value; }
  async addFeedback(entry: FeedbackEntry) {
    this.feedback.push(structuredClone(entry));
    this.feedback = trimEvents(this.feedback).kept;
  }
  async listFeedback() { return structuredClone(this.feedback); }
  async clearFeedback() { this.feedback = []; }
  async listArchives() { return structuredClone([...this.archives.values()]); }
  async deleteArchive(archiveId: string) { this.archives.delete(archiveId); }
}

/** Keeps every rating and only the newest FEEDBACK_EVENT_LIMIT events. Input must be oldest-first. */
export function trimEvents(entries: FeedbackEntry[]): { kept: FeedbackEntry[]; dropped: FeedbackEntry[] } {
  const events = entries.filter(e => e.kind === 'event');
  const excess = events.length - FEEDBACK_EVENT_LIMIT;
  if (excess <= 0) return { kept: entries, dropped: [] };
  const dropped = new Set<FeedbackEntry>(events.slice(0, excess));
  return { kept: entries.filter(e => !dropped.has(e)), dropped: [...dropped] };
}
