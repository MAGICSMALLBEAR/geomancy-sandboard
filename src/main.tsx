import { StrictMode, useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App.tsx';
import { AppProvider } from './app/AppContext.tsx';
import { initPwa } from './app/pwa.ts';
import { openRepository } from './infrastructure/db.ts';
import { DEFAULT_SETTINGS, MemoryRepository, type Repository, type Settings } from './infrastructure/repository.ts';
import { browserLang, pick } from './app/lang.ts';
import './styles/app.css';
import './styles/visual.css';

type Boot =
  | { status: 'opening' }
  | { status: 'failed' }
  | { status: 'ready'; repo: Repository; settings: Settings };

/** Before settings load, the browser language decides. */
const L = pick(browserLang());

function Root() {
  const [boot, setBoot] = useState<Boot>({ status: 'opening' });
  const [dbNotice, setDbNotice] = useState<'closed' | 'blocked' | null>(null);
  const started = useRef(false);

  const open = useCallback(async () => {
    setBoot({ status: 'opening' });
    try {
      const repo = await openRepository({
        onVersionChange: () => setDbNotice('closed'),
        onBlocked: () => setDbNotice('blocked'),
      });
      setBoot({ status: 'ready', repo, settings: await repo.getSettings() });
    } catch {
      setBoot({ status: 'failed' });
    }
  }, []);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void open();
  }, [open]);

  if (boot.status === 'opening') {
    return (
      <main className="boot">
        <p role="status">{L('正在開啟本機資料…', 'Opening local data…')}</p>
        {dbNotice === 'blocked' && <p className="notice is-error" role="alert">{L('另一個分頁正在使用舊版資料。請關閉其他開著地占沙盤的分頁。',
          'Another tab is using an older version of the data. Close the other tabs that have this App open.')}</p>}
      </main>
    );
  }
  if (boot.status === 'failed') {
    return (
      <main className="boot">
        <h1>{L('地占沙盤', 'Geomancy Sand Tray')}</h1>
        <div className="notice is-error" role="alert">
          <p>{L('這個瀏覽器目前無法使用本機儲存（可能是私密瀏覽模式、儲存空間已滿，或被設定停用）。',
            'This browser cannot use local storage right now (private browsing, full storage, or a setting may be blocking it).')}</p>
          <p>{L('你可以用暫存模式體驗：起卦與解讀都能使用，但記錄只留在這個分頁，關閉後就會消失，需要保留請匯出。',
            'You can continue in temporary mode: casting and readings work, but records stay only in this tab and disappear when it closes. Export anything you want to keep.')}</p>
        </div>
        <div className="dialog-actions">
          <button type="button" onClick={() => void open()}>{L('重試', 'Try again')}</button>
          <button type="button" className="primary"
            onClick={() => setBoot({ status: 'ready', repo: new MemoryRepository(), settings: { ...DEFAULT_SETTINGS, language: browserLang() } })}>
            {L('以暫存模式繼續', 'Continue in temporary mode')}
          </button>
        </div>
      </main>
    );
  }
  return (
    <AppProvider repo={boot.repo} initialSettings={boot.settings}>
      {dbNotice === 'closed' && (
        <p className="notice is-error banner" role="alert">{boot.settings.language === 'en'
          ? 'Another tab has upgraded this App’s data format; this tab can no longer save. Please reload.'
          : '另一個分頁已更新地占沙盤的資料格式，這個分頁無法再保存。請重新整理頁面。'}</p>
      )}
      <App />
    </AppProvider>
  );
}

initPwa();
createRoot(document.getElementById('root')!).render(<StrictMode><Root /></StrictMode>);
