import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Link } from 'react-router';
import { RULE_VERSION } from '../../domain/geomancy.ts';
import { CONTENT_VERSION } from '../../domain/catalog.ts';
import { useApp } from '../../app/AppContext.tsx';
import { isIos, promptInstall, usePwa } from '../../app/pwa.ts';
import { ERROR_TEXT, toAppError } from '../../infrastructure/errors.ts';
import { buildFeedbackExport } from '../../infrastructure/feedback.ts';
import { MAX_IMPORT_BYTES, asCopy, buildExportFiles, downloadText, parseImport, planImport,
  type ImportPlanItem } from '../../infrastructure/importExport.ts';
import { THEMES, type ArchiveEntry, type MotionSetting, type ThemeSetting } from '../../infrastructure/repository.ts';
import { formatDate } from '../../content/labels.ts';
import { Dialog } from '../../components/Dialog.tsx';

const APP_VERSION = '0.3.0';
const MOTION_LABEL: Record<MotionSetting, string> = { system: '跟隨系統設定', reduce: '減少動態效果', full: '完整動態效果' };
const THEME_LABEL: Record<ThemeSetting, { name: string; help: string }> = {
  sand: { name: '安靜沙盤', help: '自然沙色、立體沙面與凹痕，柔和安靜。' },
  manuscript: { name: '古典手稿', help: '羊皮紙、墨點、楷體與朱紅標記，像古代地占書。' },
  ritual: { name: '現代儀式', help: '深色背景、金色線條與發光的點，偏神秘感。' },
};
type Message = { kind: 'ok' | 'error'; text: string } | null;

function ImportSection({ onDone }: { onDone: () => void }) {
  const { repo } = useApp();
  const [plan, setPlan] = useState<ImportPlanItem[] | null>(null);
  const [copies, setCopies] = useState<ReadonlySet<number>>(new Set());
  const [message, setMessage] = useState<Message>(null);
  const [working, setWorking] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const choose = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    setPlan(null);
    setCopies(new Set());
    setMessage(null);
    if (!file) return;
    // Size is checked before the file is read or parsed.
    if (file.size > MAX_IMPORT_BYTES) { setMessage({ kind: 'error', text: ERROR_TEXT.IMPORT_TOO_LARGE }); return; }
    try {
      const parsed = parseImport(await file.text(), file.size, new Date().toISOString());
      if (!parsed.ok) { setMessage({ kind: 'error', text: ERROR_TEXT[parsed.code] }); return; }
      setPlan(planImport(parsed.items, await repo.listReadings()));
    } catch (reason) {
      setMessage({ kind: 'error', text: ERROR_TEXT[toAppError(reason).code] });
    }
  };

  const toAdd = (plan ?? []).filter(item => item.kind === 'new' || (item.kind === 'conflict' && copies.has(item.index)));
  const toArchive = (plan ?? []).filter(item => item.kind === 'archive');

  const confirm = async () => {
    if (!plan || working) return;
    setWorking(true);
    const now = new Date().toISOString();
    try {
      await repo.importBatch(
        toAdd.map(item => item.kind === 'conflict' ? asCopy(item.record, now) : (item as Extract<ImportPlanItem, { kind: 'new' }>).record),
        toArchive.map(item => (item as Extract<ImportPlanItem, { kind: 'archive' }>).archive),
      );
      setMessage({ kind: 'ok', text: `已匯入 ${toAdd.length} 筆記錄${toArchive.length ? `，並封存 ${toArchive.length} 筆不支援版本的資料` : ''}。` });
      setPlan(null);
      onDone();
    } catch (reason) {
      // One transaction: nothing from this batch was written.
      setMessage({ kind: 'error', text: `匯入失敗，這批資料完全沒有寫入，可以再試一次。${ERROR_TEXT[toAppError(reason).code]}` });
    } finally {
      setWorking(false);
    }
  };

  const describe = (item: ImportPlanItem) => {
    switch (item.kind) {
      case 'new': return '可匯入';
      case 'duplicate': return '重複（已有相同記錄，將略過）';
      case 'conflict': return '衝突：相同 ID 但內容或筆記不同';
      case 'archive': return `不支援的版本（${item.archive.preview.ruleVersion}／${item.archive.preview.contentVersion}），只能存為只讀封存`;
      case 'invalid': return `無效：${ERROR_TEXT[item.code]}${item.reason}`;
    }
  };
  const questionOf = (item: ImportPlanItem) =>
    item.kind === 'invalid' ? '（無法讀取）' : item.kind === 'archive' ? item.archive.preview.questionText || '（無問題文字）' : item.record.question.text;

  return (
    <div>
      <input ref={input} type="file" accept="application/json,.json" className="sr-only" aria-label="選擇備份檔" onChange={event => void choose(event)} />
      <button type="button" onClick={() => input.current?.click()}>匯入備份檔…</button>
      {message && <p className={`notice ${message.kind === 'ok' ? 'is-ok' : 'is-error'}`} role={message.kind === 'ok' ? 'status' : 'alert'}>{message.text}</p>}
      {plan && (
        <div className="import-preview" role="region" aria-label="匯入預覽">
          <h3>匯入預覽（尚未寫入）</h3>
          {plan.length === 0 && <p>這個檔案沒有任何記錄。</p>}
          <ol>
            {plan.map(item => (
              <li key={item.index} className={`import-item is-${item.kind}`}>
                <span className="question-text">{questionOf(item)}</span>
                <span className="muted">{describe(item)}</span>
                {item.kind === 'conflict' && (
                  <label className="check">
                    <input type="checkbox" checked={copies.has(item.index)} onChange={() => setCopies(current => {
                      const next = new Set(current);
                      if (!next.delete(item.index)) next.add(item.index);
                      return next;
                    })} />
                    另存成副本（不勾選就略過；既有記錄不會被覆寫）
                  </label>
                )}
              </li>
            ))}
          </ol>
          <div className="dialog-actions">
            <button type="button" className="primary" disabled={working || toAdd.length + toArchive.length === 0} onClick={() => void confirm()}>
              確認匯入 {toAdd.length} 筆{toArchive.length > 0 && `、封存 ${toArchive.length} 筆`}
            </button>
            <button type="button" onClick={() => setPlan(null)}>取消</button>
          </div>
        </div>
      )}
    </div>
  );
}

export function SettingsPage() {
  const { repo, settings, updateSetting } = useApp();
  const pwa = usePwa();
  const [message, setMessage] = useState<Message>(null);
  const [archives, setArchives] = useState<ArchiveEntry[]>([]);
  const [counts, setCounts] = useState({ readings: 0, feedback: 0 });
  const [clearOpen, setClearOpen] = useState(false);
  const [clearWord, setClearWord] = useState('');
  const [exportOpen, setExportOpen] = useState(false);

  const fail = (reason: unknown) => setMessage({ kind: 'error', text: ERROR_TEXT[toAppError(reason).code] });
  const refresh = useCallback(() => {
    Promise.all([repo.listArchives(), repo.listReadings(), repo.listFeedback()]).then(([a, r, f]) => {
      setArchives(a);
      setCounts({ readings: r.length, feedback: f.length });
    }, (reason: unknown) => setMessage({ kind: 'error', text: ERROR_TEXT[toAppError(reason).code] }));
  }, [repo]);
  useEffect(refresh, [refresh]);

  const change = <K extends keyof typeof settings>(key: K, value: (typeof settings)[K]) => {
    updateSetting(key, value).catch(fail);
  };
  const exportAll = async () => {
    setExportOpen(false);
    try {
      const files = buildExportFiles(await repo.listReadings(), new Date().toISOString());
      for (const file of files) downloadText(file.filename, file.text);
      setMessage({ kind: 'ok', text: files.length > 1 ? `記錄較多，已分成 ${files.length} 個檔案下載。` : '已下載備份檔。' });
    } catch (reason) { fail(reason); }
  };
  const exportFeedback = async () => {
    try {
      const file = buildFeedbackExport(await repo.listFeedback(), new Date().toISOString());
      downloadText(file.filename, file.text);
    } catch (reason) { fail(reason); }
  };
  const clearAll = async () => {
    try {
      await repo.clearAll();
      setClearOpen(false);
      setClearWord('');
      setMessage({ kind: 'ok', text: '已清除這個瀏覽器裡的草稿、日誌、封存檔與回饋。' });
      refresh();
    } catch (reason) { setClearOpen(false); fail(reason); }
  };

  return (
    <div className="settings">
      <h1>設定</h1>
      {message && <p className={`notice ${message.kind === 'ok' ? 'is-ok' : 'is-error'}`} role={message.kind === 'ok' ? 'status' : 'alert'}>{message.text}</p>}

      <section className="card">
        <h2>顯示與聲音</h2>
        <fieldset>
          <legend>外觀主題</legend>
          {THEMES.map(option => (
            <label key={option} className="choice">
              <input type="radio" name="theme" checked={settings.theme === option} onChange={() => change('theme', option)} />
              <span><strong>{THEME_LABEL[option].name}</strong><br />{THEME_LABEL[option].help}</span>
            </label>
          ))}
          <p className="muted">主題只改變外觀，不影響盤面、解讀與記錄。</p>
        </fieldset>
        <fieldset>
          <legend>動態效果</legend>
          {(Object.keys(MOTION_LABEL) as MotionSetting[]).map(option => (
            <label key={option} className="choice">
              <input type="radio" name="motion" checked={settings.motion === option} onChange={() => change('motion', option)} />
              <span>{MOTION_LABEL[option]}</span>
            </label>
          ))}
          <p className="muted">減少動態效果只改變顯示方式，不影響盤面與解讀。</p>
        </fieldset>
        <label className="check">
          <input type="checkbox" checked={settings.sound} onChange={event => change('sound', event.target.checked)} />
          點沙時播放音效（預設關閉）
        </label>
      </section>

      <section className="card">
        <h2>資料管理</h2>
        <p>這個瀏覽器裡有 {counts.readings} 筆記錄。{repo.mode === 'memory' && '目前是暫存模式：關閉分頁後記錄就會消失，請先匯出。'}</p>
        <p className="muted">記錄只存在這個瀏覽器，不會上傳。換裝置或清除網站資料前，請先匯出備份，再到另一邊匯入。</p>
        <div className="dialog-actions">
          <button type="button" disabled={counts.readings === 0} onClick={() => setExportOpen(true)}>全部匯出</button>
        </div>
        <ImportSection onDone={refresh} />

        <h3>封存檔</h3>
        {archives.length === 0
          ? <p className="muted">沒有封存檔。匯入時遇到這一版不支援的規則或內容版本，會放在這裡，只能檢視原始文字。</p>
          : (
            <ul className="archive-list">
              {archives.map(archive => (
                <li key={archive.archiveId}>
                  <p className="question-text">{archive.preview.questionText || '（無問題文字）'}</p>
                  <p className="muted">版本 {archive.preview.ruleVersion}／{archive.preview.contentVersion}
                    {archive.preview.createdAt && `・建立於 ${formatDate(archive.preview.createdAt)}`}・匯入於 {formatDate(archive.importedAt)}。不會用目前的規則重新解讀。</p>
                  <details><summary>純文字預覽</summary><pre className="raw">{archive.raw}</pre></details>
                  <div className="dialog-actions">
                    <button type="button" onClick={() => downloadText(`geomancy-archive-${archive.archiveId}.json`, archive.raw)}>下載原檔</button>
                    <button type="button" className="danger" onClick={() => { repo.deleteArchive(archive.archiveId).then(refresh, fail); }}>刪除封存</button>
                  </div>
                </li>
              ))}
            </ul>
          )}

        <h3>清除全部</h3>
        <button type="button" className="danger" onClick={() => setClearOpen(true)}>清除這個瀏覽器裡的所有記錄…</button>
      </section>

      <section className="card">
        <h2>試用回饋</h2>
        <label className="check">
          <input type="checkbox" checked={settings.pilotLogging} onChange={event => change('pilotLogging', event.target.checked)} />
          記錄本機試用流程（預設關閉）
        </label>
        <p className="muted">開啟後只記錄操作步驟與耗時（例如完成第幾列、是否打開依據），不記錄問題、筆記、點數或盤面。
          資料只存在這個瀏覽器，不會自動送出；需要你手動匯出交給測試主持人。</p>
        <p>目前有 {counts.feedback} 筆回饋與事件。匯出檔會包含你在「最想改善的一件事」填寫的文字。</p>
        <div className="dialog-actions">
          <button type="button" disabled={counts.feedback === 0} onClick={() => void exportFeedback()}>匯出回饋</button>
          <button type="button" className="danger" disabled={counts.feedback === 0}
            onClick={() => { repo.clearFeedback().then(refresh, fail); }}>清除回饋</button>
        </div>
      </section>

      <section className="card">
        <h2>離線與安裝</h2>
        <p role="status">
          {pwa.offline === 'ready' && '已可離線使用：App 與所有解讀內容都已存在這台裝置。'}
          {pwa.offline === 'pending' && '正在準備離線內容…完成前請保持連線。'}
          {pwa.offline === 'failed' && '離線內容準備失敗。請確認網路後重新整理頁面再試一次。'}
          {pwa.offline === 'unsupported' && '這個瀏覽器或這個網址不支援離線使用（需要 HTTPS 或 localhost）。'}
        </p>
        {pwa.canInstall && <button type="button" onClick={() => void promptInstall()}>安裝到這台裝置</button>}
        {isIos() && <p>iPhone／iPad：在 Safari 按「分享」，再選「加入主畫面」。</p>}
        <p className="muted">不安裝也可以直接在瀏覽器使用全部功能。</p>
      </section>

      <section className="card">
        <h2>版本與來源</h2>
        <p>App {APP_VERSION}（測試版）・規則 {RULE_VERSION}・內容 {CONTENT_VERSION}（編輯草稿，未經專家審校）</p>
        <p>儲存方式：{repo.mode === 'persistent' ? '這個瀏覽器的本機資料庫' : '暫存模式（僅限這個分頁）'}。沒有帳號、後端或第三方追蹤。</p>
        <p><Link to="/learn">規則與來源</Link></p>
      </section>

      <Dialog open={exportOpen} title="全部匯出" onClose={() => setExportOpen(false)}>
        <p>匯出的檔案包含所有問題文字、盤面、解讀與筆記，請自行妥善保管。不含未完成的草稿與設定。</p>
        <div className="dialog-actions">
          <button type="button" className="primary" onClick={() => void exportAll()}>下載 JSON</button>
          <button type="button" onClick={() => setExportOpen(false)}>取消</button>
        </div>
      </Dialog>
      <Dialog open={clearOpen} title="清除所有記錄" onClose={() => { setClearOpen(false); setClearWord(''); }}>
        <p>會刪除這個瀏覽器裡的草稿、全部日誌、封存檔與回饋，無法復原。設定與離線檔案不受影響。建議先匯出備份。</p>
        <label htmlFor="clear-word">請輸入「清除」兩個字以確認</label>
        <input id="clear-word" type="text" value={clearWord} onChange={event => setClearWord(event.target.value)} autoComplete="off" />
        <div className="dialog-actions">
          <button type="button" className="danger" disabled={clearWord.trim() !== '清除'} onClick={() => void clearAll()}>清除全部</button>
          <button type="button" className="primary" onClick={() => { setClearOpen(false); setClearWord(''); }}>取消</button>
        </div>
      </Dialog>
    </div>
  );
}
