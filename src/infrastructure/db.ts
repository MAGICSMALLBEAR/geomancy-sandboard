/** IndexedDB `geomancy-local` v1. See docs/ENGINE-AND-DATA.md §7 for the stores and transaction rules. */
import { openDB, type DBSchema, type IDBPDatabase, type IDBPTransaction, type StoreNames } from 'idb';
import type { CastSource } from '../domain/geomancy.ts';
import type { Question } from '../domain/reading.ts';
import type { Draft, ReadingRecord } from '../domain/contracts.ts';
import { AppError, toAppError } from './errors.ts';
import { newDraft, newId, recordFromDraft, withConfirmedPress, withConfirmedRow, withNotes, withPreparedSource, type CastMethod } from './records.ts';
import { DEFAULT_SETTINGS, FEEDBACK_EVENT_LIMIT, THEMES, sortNewestFirst, systemClock, trimEvents,
  type ArchiveEntry, type ThemeSetting, type Clock, type FeedbackEntry, type Repository, type Settings } from './repository.ts';

export const DB_NAME = 'geomancy-local';
export const DB_VERSION = 1;

interface GeoDB extends DBSchema {
  drafts: { key: string; value: Draft; indexes: { updatedAt: string } };
  readings: { key: string; value: ReadingRecord; indexes: { createdAt: string; 'question.topic': string } };
  settings: { key: string; value: { key: string; value: unknown } };
  feedback: { key: string; value: FeedbackEntry; indexes: { createdAt: string } };
  archives: { key: string; value: ArchiveEntry };
}
type Name = StoreNames<GeoDB>;
type Tx<M extends IDBTransactionMode> = IDBPTransaction<GeoDB, Name[], M>;

export type DbEvents = {
  /** Another tab needs a newer schema: this connection was closed and the page should be reloaded. */
  onVersionChange?: () => void;
  /** An older tab is blocking our upgrade. */
  onBlocked?: () => void;
};

export async function openRepository(events: DbEvents = {}, clock: Clock = systemClock): Promise<IdbRepository> {
  try {
    const db = await openDB<GeoDB>(DB_NAME, DB_VERSION, {
      upgrade(database) {
        const drafts = database.createObjectStore('drafts', { keyPath: 'id' });
        drafts.createIndex('updatedAt', 'updatedAt');
        const readings = database.createObjectStore('readings', { keyPath: 'id' });
        readings.createIndex('createdAt', 'createdAt');
        readings.createIndex('question.topic', 'question.topic');
        database.createObjectStore('settings', { keyPath: 'key' });
        const feedback = database.createObjectStore('feedback', { keyPath: 'id' });
        feedback.createIndex('createdAt', 'createdAt');
        database.createObjectStore('archives', { keyPath: 'archiveId' });
      },
      blocked() { events.onBlocked?.(); },
      // Close instead of deleting data; the newer tab can then upgrade.
      blocking() { db.close(); events.onVersionChange?.(); },
    });
    return new IdbRepository(db, clock);
  } catch (e) {
    throw toAppError(e);
  }
}

export class IdbRepository implements Repository {
  readonly mode = 'persistent' as const;
  private db: IDBPDatabase<GeoDB>;
  private clock: Clock;
  constructor(db: IDBPDatabase<GeoDB>, clock: Clock) { this.db = db; this.clock = clock; }

  /** One atomic transaction. Any thrown error aborts everything written inside `work`. */
  private async run<M extends IDBTransactionMode, T>(stores: Name[], mode: M, work: (tx: Tx<M>) => Promise<T>): Promise<T> {
    let tx: Tx<M>;
    try { tx = this.db.transaction(stores, mode); } catch (e) { throw toAppError(e); }
    try {
      const result = await work(tx);
      await tx.done;
      return result;
    } catch (e) {
      tx.done.catch(() => undefined);
      try { tx.abort(); } catch { /* already finished */ }
      throw toAppError(e);
    }
  }

  getActiveDraft() {
    return this.run(['drafts'], 'readonly', async tx =>
      (await tx.objectStore('drafts').index('updatedAt').getAll()).at(-1) ?? null);
  }
  createDraft(question: Question, method: CastMethod) {
    return this.run(['drafts'], 'readwrite', async tx => {
      const store = tx.objectStore('drafts');
      if (await store.count() > 0) throw new AppError('DRAFT_EXISTS');
      const draft = newDraft(newId(), question, method, this.clock());
      await store.add(draft);
      return draft;
    });
  }
  loadDraft(id: string) {
    return this.run(['drafts'], 'readonly', async tx => (await tx.objectStore('drafts').get(id)) ?? null);
  }
  discardDraft(id: string) {
    return this.run(['drafts'], 'readwrite', tx => tx.objectStore('drafts').delete(id));
  }
  confirmRow(id: string, expectedRevision: number, count: number) {
    return this.run(['drafts'], 'readwrite', async tx => {
      const store = tx.objectStore('drafts');
      const current = await store.get(id);
      if (!current) throw new AppError('NOT_FOUND');
      const next = withConfirmedRow(current, expectedRevision, count, this.clock());
      await store.put(next);
      return next;
    });
  }
  confirmPress(id: string, expectedRevision: number, byte: number) {
    return this.run(['drafts'], 'readwrite', async tx => {
      const store = tx.objectStore('drafts');
      const current = await store.get(id);
      if (!current) throw new AppError('NOT_FOUND');
      const next = withConfirmedPress(current, expectedRevision, byte, this.clock());
      await store.put(next);
      return next;
    });
  }
  prepareSource(id: string, expectedRevision: number, source: CastSource) {
    return this.run(['drafts'], 'readwrite', async tx => {
      const store = tx.objectStore('drafts');
      const current = await store.get(id);
      if (!current) throw new AppError('NOT_FOUND');
      const next = withPreparedSource(current, expectedRevision, source, this.clock());
      if (next !== current) await store.put(next);
      return next;
    });
  }
  /** Idempotent per ID: an existing record wins; otherwise add the record and delete the draft together. */
  finalizeDraft(id: string) {
    return this.run(['drafts', 'readings'], 'readwrite', async tx => {
      const existing = await tx.objectStore('readings').get(id);
      if (existing) return existing;
      const draft = await tx.objectStore('drafts').get(id);
      if (!draft) throw new AppError('NOT_FOUND');
      const record = recordFromDraft(draft, this.clock());
      await tx.objectStore('readings').add(record);
      await tx.objectStore('drafts').delete(id);
      return record;
    });
  }
  getReading(id: string) {
    return this.run(['readings'], 'readonly', async tx => (await tx.objectStore('readings').get(id)) ?? null);
  }
  listReadings() {
    return this.run(['readings'], 'readonly', async tx => sortNewestFirst(await tx.objectStore('readings').getAll()));
  }
  saveNotes(id: string, expectedRevision: number, notes: string) {
    return this.run(['readings'], 'readwrite', async tx => {
      const store = tx.objectStore('readings');
      const current = await store.get(id);
      if (!current) throw new AppError('NOT_FOUND');
      const next = withNotes(current, expectedRevision, notes, this.clock());
      await store.put(next);
      return next;
    });
  }
  deleteReading(id: string) {
    return this.run(['readings'], 'readwrite', tx => tx.objectStore('readings').delete(id));
  }
  importBatch(records: ReadingRecord[], archives: ArchiveEntry[]) {
    return this.run(['readings', 'archives'], 'readwrite', async tx => {
      for (const record of records) await tx.objectStore('readings').add(record);
      for (const archive of archives) await tx.objectStore('archives').add(archive);
    });
  }
  clearAll() {
    return this.run(['drafts', 'readings', 'archives', 'feedback'], 'readwrite', async tx => {
      await tx.objectStore('drafts').clear();
      await tx.objectStore('readings').clear();
      await tx.objectStore('archives').clear();
      await tx.objectStore('feedback').clear();
    });
  }
  getSettings() {
    return this.run(['settings'], 'readonly', async tx => {
      const stored = Object.fromEntries((await tx.objectStore('settings').getAll()).map(r => [r.key, r.value]));
      const motion = stored.motion === 'reduce' || stored.motion === 'full' ? stored.motion : DEFAULT_SETTINGS.motion;
      const theme = THEMES.includes(stored.theme as ThemeSetting) ? stored.theme as ThemeSetting : DEFAULT_SETTINGS.theme;
      return { motion, sound: stored.sound === true, pilotLogging: stored.pilotLogging === true, theme } satisfies Settings;
    });
  }
  setSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
    return this.run(['settings'], 'readwrite', async tx => { await tx.objectStore('settings').put({ key, value }); });
  }
  addFeedback(entry: FeedbackEntry) {
    return this.run(['feedback'], 'readwrite', async tx => {
      const store = tx.objectStore('feedback');
      await store.add(entry);
      if (await store.count() > FEEDBACK_EVENT_LIMIT) {
        for (const old of trimEvents(await store.index('createdAt').getAll()).dropped) await store.delete(old.id);
      }
    });
  }
  listFeedback() {
    return this.run(['feedback'], 'readonly', tx => tx.objectStore('feedback').index('createdAt').getAll());
  }
  clearFeedback() {
    return this.run(['feedback'], 'readwrite', tx => tx.objectStore('feedback').clear());
  }
  listArchives() {
    return this.run(['archives'], 'readonly', tx => tx.objectStore('archives').getAll());
  }
  deleteArchive(archiveId: string) {
    return this.run(['archives'], 'readwrite', tx => tx.objectStore('archives').delete(archiveId));
  }
  close() { this.db.close(); }
}
