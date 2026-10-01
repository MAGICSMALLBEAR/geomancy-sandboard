/** Service worker registration, offline readiness, deferred updates and the install prompt. */
import { useSyncExternalStore } from 'react';
import { registerSW } from 'virtual:pwa-register';

type InstallPromptEvent = Event & { prompt: () => Promise<void> };
export type PwaState = {
  offline: 'unsupported' | 'pending' | 'ready' | 'failed';
  needRefresh: boolean;
  canInstall: boolean;
  /** Keys of activities that must not be interrupted by a reload (casting, unsaved notes). */
  busy: readonly string[];
};

let state: PwaState = { offline: 'serviceWorker' in navigator ? 'pending' : 'unsupported', needRefresh: false, canInstall: false, busy: [] };
const listeners = new Set<() => void>();
const set = (patch: Partial<PwaState>) => { state = { ...state, ...patch }; listeners.forEach(l => l()); };
let installEvent: InstallPromptEvent | null = null;
let applyUpdate: ((reload?: boolean) => Promise<void>) | null = null;

export function initPwa(): void {
  if (!('serviceWorker' in navigator)) return;
  applyUpdate = registerSW({
    immediate: true,
    onOfflineReady() { set({ offline: 'ready' }); },
    onNeedRefresh() { set({ needRefresh: true }); },
    onRegisterError() { set({ offline: 'failed' }); },
  });
  // Later visits: the page is already controlled by a worker whose precache completed.
  if (navigator.serviceWorker.controller) set({ offline: 'ready' });
  navigator.serviceWorker.addEventListener('controllerchange', () => set({ offline: 'ready' }));
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    installEvent = event as InstallPromptEvent;
    set({ canInstall: true });
  });
  window.addEventListener('appinstalled', () => { installEvent = null; set({ canInstall: false }); });
}

export function setBusy(key: string, busy: boolean): void {
  const has = state.busy.includes(key);
  if (busy && !has) set({ busy: [...state.busy, key] });
  else if (!busy && has) set({ busy: state.busy.filter(k => k !== key) });
}
export async function promptInstall(): Promise<void> {
  const event = installEvent;
  if (!event) return;
  installEvent = null;
  set({ canInstall: false });
  await event.prompt();
}
/** Only called from an explicit user action, and only offered while nothing is busy. */
export function acceptUpdate(): void {
  void applyUpdate?.(true);
}
export const isIos = (): boolean =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export function usePwa(): PwaState {
  return useSyncExternalStore(listener => { listeners.add(listener); return () => listeners.delete(listener); }, () => state);
}
