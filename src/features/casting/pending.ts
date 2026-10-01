/**
 * "暫存結果": a chart whose save failed. It lives only in this tab's memory, is always shown as
 * unsaved, and a retry persists the exact same source — it never draws again.
 */
import type { CastSource } from '../../domain/geomancy.ts';
import type { Draft, ReadingRecord } from '../../domain/contracts.ts';
import type { Repository } from '../../infrastructure/repository.ts';
import { recordFromDraft, withPreparedSource } from '../../infrastructure/records.ts';

export type PendingCast = { draft: Draft; unsavedSource: CastSource | null; record: ReadingRecord };
const pending = new Map<string, PendingCast>();

export const getPending = (id: string): PendingCast | undefined => pending.get(id);
export const hasPending = (): boolean => pending.size > 0;
export const clearPending = (id: string): void => { pending.delete(id); };

/** Persist a not-yet-saved quick/manual source (if any), then atomically turn the draft into a record. */
export async function completeCast(repo: Repository, draft: Draft, unsavedSource: CastSource | null): Promise<ReadingRecord> {
  const saved = unsavedSource && !draft.preparedSource
    ? await repo.prepareSource(draft.id, draft.revision, unsavedSource)
    : draft;
  return repo.finalizeDraft(saved.id);
}

export function keepAsPending(draft: Draft, unsavedSource: CastSource | null): PendingCast {
  const now = new Date().toISOString();
  const ready = unsavedSource && !draft.preparedSource
    ? withPreparedSource(draft, draft.revision, unsavedSource, now)
    : draft;
  const entry = { draft, unsavedSource, record: recordFromDraft(ready, now) };
  pending.set(draft.id, entry);
  return entry;
}
