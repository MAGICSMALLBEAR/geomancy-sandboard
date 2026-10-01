import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { DEFAULT_SETTINGS, type PilotEvent, type Repository, type Settings } from '../infrastructure/repository.ts';
import { makePilotEvent } from '../infrastructure/feedback.ts';
import type { CastMethod } from '../infrastructure/records.ts';

type EventExtra = { method?: CastMethod; rowIndex?: number; errorCode?: string };
export type AppContextValue = {
  repo: Repository;
  settings: Settings;
  updateSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => Promise<void>;
  /** Result of the user's setting combined with the system preference. */
  reducedMotion: boolean;
  /** No-op unless the user switched on local pilot logging. */
  logEvent: (name: PilotEvent['name'], extra?: EventExtra) => void;
};

const Ctx = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const value = useContext(Ctx);
  if (!value) throw new Error('AppContext missing');
  return value;
}

const systemReduced = () => window.matchMedia('(prefers-reduced-motion: reduce)');

export function AppProvider({ repo, initialSettings, children }: { repo: Repository; initialSettings: Settings; children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>({ ...DEFAULT_SETTINGS, ...initialSettings });
  const [systemReduce, setSystemReduce] = useState(() => systemReduced().matches);

  useEffect(() => {
    const query = systemReduced();
    const onChange = () => setSystemReduce(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  const reducedMotion = settings.motion === 'reduce' || (settings.motion === 'system' && systemReduce);
  useEffect(() => {
    document.documentElement.dataset.motion = reducedMotion ? 'reduce' : 'full';
  }, [reducedMotion]);

  const updateSetting = useCallback(async <K extends keyof Settings>(key: K, value: Settings[K]) => {
    // Settings are display preferences: apply at once, and put the old value back if saving fails.
    let previous: Settings[K] | undefined;
    setSettings(current => { previous = current[key]; return { ...current, [key]: value }; });
    try {
      await repo.setSetting(key, value);
    } catch (error) {
      setSettings(current => ({ ...current, [key]: previous as Settings[K] }));
      throw error;
    }
  }, [repo]);

  const logging = settings.pilotLogging;
  const logEvent = useCallback((name: PilotEvent['name'], extra?: EventExtra) => {
    if (!logging) return;
    // Pilot logging must never break or delay the main flow.
    repo.addFeedback(makePilotEvent(name, extra)).catch(() => undefined);
  }, [logging, repo]);

  const value = useMemo(() => ({ repo, settings, updateSetting, reducedMotion, logEvent }),
    [repo, settings, updateSetting, reducedMotion, logEvent]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
