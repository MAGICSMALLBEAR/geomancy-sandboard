/**
 * Persistent storage (SPEC §5, plan §14). A granted request keeps the browser from evicting this site's
 * IndexedDB under storage pressure; it is not a backup, and clearing site data still removes everything.
 * Firefox asks the user, so this is only ever called from a button.
 */
export type PersistState = 'unsupported' | 'persisted' | 'not-persisted';

const api = (): StorageManager | null =>
  typeof navigator !== 'undefined' && navigator.storage && typeof navigator.storage.persisted === 'function' ? navigator.storage : null;

export async function persistState(): Promise<PersistState> {
  const storage = api();
  if (!storage) return 'unsupported';
  try {
    return (await storage.persisted()) ? 'persisted' : 'not-persisted';
  } catch {
    return 'unsupported';
  }
}

/** Resolves to the new state; a refusal is a normal answer, not an error. */
export async function requestPersist(): Promise<PersistState> {
  const storage = api();
  if (!storage || typeof storage.persist !== 'function') return 'unsupported';
  try {
    return (await storage.persist()) ? 'persisted' : 'not-persisted';
  } catch {
    return 'not-persisted';
  }
}

/** Bytes used by this site, or null when the browser does not say. */
export async function storageUsage(): Promise<number | null> {
  const storage = api();
  if (!storage || typeof storage.estimate !== 'function') return null;
  try {
    const { usage } = await storage.estimate();
    return typeof usage === 'number' ? usage : null;
  } catch {
    return null;
  }
}
