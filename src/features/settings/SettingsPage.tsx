import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Link } from 'react-router';
import { RULE_VERSIONS, type RuleVersion } from '../../domain/geomancy.ts';
import { CONTENT_VERSION } from '../../domain/catalog.ts';
import { ADVANCED_VERSION } from '../../domain/advanced.ts';
import { useApp } from '../../app/AppContext.tsx';
import { isIos, promptInstall, usePwa } from '../../app/pwa.ts';
import { toAppError } from '../../infrastructure/errors.ts';
import { buildFeedbackExport } from '../../infrastructure/feedback.ts';
import { MAX_IMPORT_BYTES, asCopy, buildExportFiles, downloadText, parseImport, planImport,
  type ImportPlanItem } from '../../infrastructure/importExport.ts';
import type { ArchiveEntry, MotionSetting } from '../../infrastructure/repository.ts';
import { ThemePicker } from '../../components/ThemePicker.tsx';
import { hapticsSupported } from '../../app/haptics.ts';
import { persistState, requestPersist, storageUsage, type PersistState } from '../../app/storage.ts';
import { AI_MODELS, AI_MODEL_LABEL, AI_MODEL_LABEL_EN, type AiModel } from '../../infrastructure/ai.ts';
import { Dialog } from '../../components/Dialog.tsx';

const APP_VERSION = '0.12.0';
const MOTION_LABEL: Record<MotionSetting, readonly [string, string]> = {
  system: ['跟隨系統設定', 'Follow the system setting'], reduce: ['減少動態效果', 'Reduce motion'], full: ['完整動態效果', 'Full motion'],
};
type Message = { kind: 'ok' | 'error'; text: string } | null;

function ImportSection({ onDone }: { onDone: () => void }) {
  const { repo, L, T } = useApp();
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
    if (file.size > MAX_IMPORT_BYTES) { setMessage({ kind: 'error', text: T.error('IMPORT_TOO_LARGE') }); return; }
    try {
      const parsed = parseImport(await file.text(), file.size, new Date().toISOString());
      if (!parsed.ok) { setMessage({ kind: 'error', text: T.error(parsed.code) }); return; }
      setPlan(planImport(parsed.items, await repo.listReadings()));
    } catch (reason) {
      setMessage({ kind: 'error', text: T.error(toAppError(reason).code) });
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
      setMessage({ kind: 'ok', text: L(`已匯入 ${toAdd.length} 筆記錄${toArchive.length ? `，並封存 ${toArchive.length} 筆不支援版本的資料` : ''}。`,
        `Imported ${toAdd.length} records${toArchive.length ? `, and archived ${toArchive.length} in an unsupported version` : ''}.`) });
      setPlan(null);
      onDone();
    } catch (reason) {
      // One transaction: nothing from this batch was written.
      setMessage({ kind: 'error', text: L('匯入失敗，這批資料完全沒有寫入，可以再試一次。', 'Import failed. Nothing from this file was written; you can try again. ') + T.error(toAppError(reason).code) });
    } finally {
      setWorking(false);
    }
  };

  const describe = (item: ImportPlanItem) => {
    switch (item.kind) {
      case 'new': return L('可匯入', 'Can be imported');
      case 'duplicate': return L('重複（已有相同記錄，將略過）', 'Duplicate (the same record exists; it will be skipped)');
      case 'conflict': return L('衝突：相同 ID 但內容或筆記不同', 'Conflict: same ID but different content or notes');
      case 'archive': return L(`不支援的版本（${item.archive.preview.ruleVersion}／${item.archive.preview.contentVersion}），只能存為只讀封存`,
        `Unsupported version (${item.archive.preview.ruleVersion} / ${item.archive.preview.contentVersion}); it can only be kept as a read-only archive`);
      // The validator's detailed reasons are written in Chinese only.
      case 'invalid': return L(`無效：${T.error(item.code)}${item.reason}`, `Invalid: ${T.error(item.code)}`);
    }
  };
  const questionOf = (item: ImportPlanItem) =>
    item.kind === 'invalid' ? L('（無法讀取）', '(unreadable)') : item.kind === 'archive' ? item.archive.preview.questionText || L('（無問題文字）', '(no question text)') : item.record.question.text;

  return (
    <div>
      <input ref={input} type="file" accept="application/json,.json" className="sr-only" aria-label={L('選擇備份檔', 'Choose a backup file')} onChange={event => void choose(event)} />
      <button type="button" onClick={() => input.current?.click()}>{L('匯入備份檔…', 'Import a backup file…')}</button>
      {message && <p className={`notice ${message.kind === 'ok' ? 'is-ok' : 'is-error'}`} role={message.kind === 'ok' ? 'status' : 'alert'}>{message.text}</p>}
      {plan && (
        <div className="import-preview" role="region" aria-label={L('匯入預覽', 'Import preview')}>
          <h3>{L('匯入預覽（尚未寫入）', 'Import preview (nothing written yet)')}</h3>
          {plan.length === 0 && <p>{L('這個檔案沒有任何記錄。', 'This file has no records.')}</p>}
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
                    {L('另存成副本（不勾選就略過；既有記錄不會被覆寫）', 'Save as a copy (unticked ones are skipped; the existing record is never overwritten)')}
                  </label>
                )}
              </li>
            ))}
          </ol>
          <div className="dialog-actions">
            <button type="button" className="primary" disabled={working || toAdd.length + toArchive.length === 0} onClick={() => void confirm()}>
              {L(`確認匯入 ${toAdd.length} 筆`, `Import ${toAdd.length}`)}{toArchive.length > 0 && L(`、封存 ${toArchive.length} 筆`, `, archive ${toArchive.length}`)}
            </button>
            <button type="button" onClick={() => setPlan(null)}>{L('取消', 'Cancel')}</button>
          </div>
        </div>
      )}
    </div>
  );
}

function KeepRecords() {
  const { L } = useApp();
  const [state, setState] = useState<PersistState | null>(null);
  const [usage, setUsage] = useState<number | null>(null);
  const [asked, setAsked] = useState(false);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([persistState(), storageUsage()]).then(([p, u]) => { if (alive) { setState(p); setUsage(u); } });
    return () => { alive = false; };
  }, []);

  const ask = async () => {
    setWorking(true);
    const next = await requestPersist();
    setState(next);
    setAsked(true);
    setWorking(false);
  };

  if (state === null) return null;
  return (
    <div className="keep-records">
      <h3>{L('請瀏覽器保留記錄', 'Ask the browser to keep records')}</h3>
      {state === 'persisted' && <p className="notice is-ok" role={asked ? 'status' : undefined}>
        {L('瀏覽器已同意保留：裝置空間不足時，不會自動清掉這裡的記錄。自己清除網站資料時記錄仍會消失，請照常匯出備份。', 'The browser has agreed to keep them: records here will not be cleared automatically when the device runs low on space. Clearing site data yourself still removes them, so keep exporting backups.')}</p>}
      {state === 'not-persisted' && <>
        <p>{L('目前沒有保留保證：裝置空間不足時，瀏覽器可能自動清掉這裡的記錄。', 'There is no guarantee yet: when the device runs low on space, the browser may clear records here on its own.')}</p>
        <button type="button" disabled={working} onClick={() => void ask()}>{L('請瀏覽器保留記錄', 'Ask the browser to keep records')}</button>
        {asked && <p className="notice" role="status">{L('瀏覽器這次沒有同意。Chrome 通常要先把 App 加入主畫面或常用這個網站才會同意；Safari 依使用情況自行決定。請定期匯出備份。', 'The browser did not agree this time. Chrome usually agrees only after the App is added to the home screen or the site is used often; Safari decides by its own measure of use. Export backups regularly.')}</p>}
      </>}
      {state === 'unsupported' && <p className="muted">{L('這個瀏覽器無法要求保留記錄，請定期匯出備份。', 'This browser cannot be asked to keep records. Export backups regularly.')}</p>}
      {usage !== null && <p className="muted">{L('這個網站目前使用約 ', 'This site currently uses about ')}{usage < 1024 * 1024 ? `${Math.max(1, Math.round(usage / 1024))} KB` : `${(usage / 1024 / 1024).toFixed(1)} MB`}{L('（含離線檔案）。', ' (including offline files).')}</p>}
    </div>
  );
}

function AiSettings() {
  const { settings, updateSetting, L, T } = useApp();
  const [draft, setDraft] = useState('');
  const [show, setShow] = useState(false);
  const [message, setMessage] = useState<Message>(null);
  const save = async (value: string) => {
    try {
      await updateSetting('aiKey', value);
      setDraft('');
      setMessage({ kind: 'ok', text: value ? L('金鑰已存在這個瀏覽器。', 'The key is saved in this browser.') : L('已刪除金鑰，AI 轉述關閉。', 'Key deleted; AI retelling is off.') });
    } catch (reason) {
      setMessage({ kind: 'error', text: T.error(toAppError(reason).code) });
    }
  };
  const trimmed = draft.trim();
  return (
    <section className="card">
      <h2>{L('AI 轉述（選用）', 'AI retelling (optional)')}</h2>
      <p>{L('開啟後，結果頁可以請 AI 把這張盤的計算結果串成一段說明。AI 不會改動盤面，回覆會標出引用的盤位並由 App 核對。',
        "Once set up, the result page can ask AI to weave this chart's computed results into one explanation. AI cannot change the chart; its reply names the positions it relies on, and the App checks them.")}</p>
      <ul className="muted">
        <li>{L('需要你自己的 Anthropic API 金鑰（在 console.anthropic.com 建立），費用由你的帳戶支付，一次約 US$0.02–0.10。建議在 Console 設定每月用量上限。',
          'You need your own Anthropic API key (create one at console.anthropic.com). Your account pays, about US$0.02–0.10 per retelling. Setting a monthly spend limit in the Console is recommended.')}</li>
        <li>{L('金鑰只存在這個瀏覽器，不會匯出、不會上傳到本 App 以外的地方；但它沒有加密，能使用這台裝置的人也能看到。共用裝置請不要存。',
          'The key stays in this browser: it is never exported and goes nowhere except the Claude API itself. It is not encrypted, so anyone using this device can see it. Do not save it on a shared device.')}</li>
        <li>{L('每次送出前都會讓你確認要送的內容。筆記、回顧與預計行動永遠不會送出；問題文字預設不送。',
          'Before each request you confirm exactly what is sent. Notes, follow-ups and plans are never sent; the question text is not sent unless you tick it.')}</li>
      </ul>
      {settings.aiKey
        ? <p>{L('目前已存金鑰：', 'Saved key: ')}<span className="mono">{settings.aiKey.slice(0, 10)}…{settings.aiKey.slice(-4)}</span>
            <button type="button" className="danger" onClick={() => void save('')}>{L('刪除金鑰', 'Delete key')}</button></p>
        : <>
            <label htmlFor="ai-key">{L('API 金鑰', 'API key')}</label>
            <div className="row-inline">
              <input id="ai-key" type={show ? 'text' : 'password'} autoComplete="off" spellCheck={false} value={draft}
                onChange={event => setDraft(event.target.value)} placeholder="sk-ant-…" />
              <button type="button" onClick={() => setShow(!show)}>{show ? L('隱藏', 'Hide') : L('顯示', 'Show')}</button>
            </div>
            {trimmed && !trimmed.startsWith('sk-ant-') && <p className="notice">{L('這看起來不像 Anthropic 的 API 金鑰（通常以 sk-ant- 開頭）。', 'This does not look like an Anthropic API key (they usually start with sk-ant-).')}</p>}
            <button type="button" className="primary" disabled={!trimmed || trimmed.length > 512} onClick={() => void save(trimmed)}>{L('存到這個瀏覽器', 'Save in this browser')}</button>
          </>}
      <fieldset>
        <legend>{L('模型', 'Model')}</legend>
        {AI_MODELS.map((model: AiModel) => (
          <label key={model} className="choice">
            <input type="radio" name="ai-model" checked={settings.aiModel === model} onChange={() => { updateSetting('aiModel', model).catch(() => undefined); }} />
            <span>{L(AI_MODEL_LABEL[model], AI_MODEL_LABEL_EN[model])}</span>
          </label>
        ))}
      </fieldset>
      {message && <p className={`notice ${message.kind === 'ok' ? 'is-ok' : 'is-error'}`} role={message.kind === 'ok' ? 'status' : 'alert'}>{message.text}</p>}
    </section>
  );
}

export function SettingsPage() {
  const { repo, settings, updateSetting, L, T } = useApp();
  const pwa = usePwa();
  const [message, setMessage] = useState<Message>(null);
  const [archives, setArchives] = useState<ArchiveEntry[]>([]);
  const [counts, setCounts] = useState({ readings: 0, feedback: 0 });
  const [clearOpen, setClearOpen] = useState(false);
  const [clearWord, setClearWord] = useState('');
  const [exportOpen, setExportOpen] = useState(false);

  const fail = (reason: unknown) => setMessage({ kind: 'error', text: T.error(toAppError(reason).code) });
  const refresh = useCallback(() => {
    Promise.all([repo.listArchives(), repo.listReadings(), repo.listFeedback()]).then(([a, r, f]) => {
      setArchives(a);
      setCounts({ readings: r.length, feedback: f.length });
    }, (reason: unknown) => setMessage({ kind: 'error', text: T.error(toAppError(reason).code) }));
  }, [repo, T]);
  useEffect(refresh, [refresh]);

  const change = <K extends keyof typeof settings>(key: K, value: (typeof settings)[K]) => {
    updateSetting(key, value).catch(fail);
  };
  const exportAll = async () => {
    setExportOpen(false);
    try {
      const files = buildExportFiles(await repo.listReadings(), new Date().toISOString());
      for (const file of files) downloadText(file.filename, file.text);
      setMessage({ kind: 'ok', text: files.length > 1 ? L(`記錄較多，已分成 ${files.length} 個檔案下載。`, `There are many records, so they were downloaded as ${files.length} files.`) : L('已下載備份檔。', 'Backup downloaded.') });
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
      setMessage({ kind: 'ok', text: L('已清除這個瀏覽器裡的草稿、日誌、封存檔與回饋。', 'Drafts, journal, archives and feedback in this browser have been cleared.') });
      refresh();
    } catch (reason) { setClearOpen(false); fail(reason); }
  };

  const clearConfirm = L('清除', 'delete');
  return (
    <div className="settings">
      <h1>{L('設定', 'Settings')}</h1>
      {message && <p className={`notice ${message.kind === 'ok' ? 'is-ok' : 'is-error'}`} role={message.kind === 'ok' ? 'status' : 'alert'}>{message.text}</p>}

      <section className="card">
        <h2>{L('顯示與聲音', 'Display and sound')}</h2>
        <fieldset>
          <legend>{L('外觀主題', 'Theme')}</legend>
          <ThemePicker />
          <p className="muted">{L('主題只改變外觀，不影響盤面、解讀與記錄。', 'A theme only changes how things look, not the chart, reading or records.')}</p>
        </fieldset>
        <fieldset>
          <legend>{L('動態效果', 'Motion')}</legend>
          {(Object.keys(MOTION_LABEL) as MotionSetting[]).map(option => (
            <label key={option} className="choice">
              <input type="radio" name="motion" checked={settings.motion === option} onChange={() => change('motion', option)} />
              <span>{L(...MOTION_LABEL[option])}</span>
            </label>
          ))}
          <p className="muted">{L('減少動態效果只改變顯示方式，不影響盤面與解讀。較慢的裝置會自動改用簡化沙盤：不顯示沙粒飛散，點痕與收點動畫照常。', 'Reducing motion only changes the display, not the chart or reading. Slower devices switch to a simpler sand tray on their own: no scattering grains, while marks and the row animation stay.')}</p>
        </fieldset>
        <label className="check">
          <input type="checkbox" checked={settings.sound} onChange={event => change('sound', event.target.checked)} />
          {L('點沙時播放音效（預設關閉）', 'Play a sound when tapping the sand (off by default)')}
        </label>
        <label className="check">
          <input type="checkbox" checked={settings.haptics} onChange={event => change('haptics', event.target.checked)} />
          {L('點沙與完成一列時輕微震動（預設關閉）', 'Vibrate lightly when tapping and finishing a row (off by default)')}
        </label>
        {!hapticsSupported() && <p className="muted">{L('這個瀏覽器不支援震動（例如 iPhone 的 Safari），開啟也不會有作用。', 'This browser does not support vibration (Safari on iPhone, for example), so turning it on has no effect.')}</p>}
      </section>

      <section className="card">
        <h2>{L('宮位配置', 'House rule')}</h2>
        <fieldset>
          <legend>{L('新的占問用哪一種方式把盾盤放進十二宮', 'How new questions place the shield into the twelve houses')}</legend>
          {RULE_VERSIONS.map((rule: RuleVersion) => (
            <label key={rule} className="choice">
              <input type="radio" name="house-rule" checked={settings.houseRule === rule} onChange={() => change('houseRule', rule)} />
              <span><strong>{T.HOUSE_RULE_LABEL[rule]}</strong><br /><span className="muted">{T.HOUSE_RULE_HELP[rule]}</span></span>
            </label>
          ))}
        </fieldset>
        <p className="muted">{L('盾盤本身完全相同，只有「哪個象落在哪一宮」不同，所以第 1 宮、問題宮、成事關係與相位會跟著改變。已經存下的記錄維持當時的配置。兩種做法的來源與差異見',
          'The shield itself is identical; only which figure lands in which house differs, so the 1st house, the question house, perfection and aspects change with it. Saved records keep the rule they were made with. Sources and differences: ')}<Link to="/learn/houses">{L('十二宮與盤位', 'Houses and positions')}</Link>{L('。', '.')}</p>
      </section>

      <AiSettings />

      <section className="card">
        <h2>{L('資料管理', 'Your data')}</h2>
        <p>{L(`這個瀏覽器裡有 ${counts.readings} 筆記錄。`, `This browser holds ${counts.readings} records. `)}{repo.mode === 'memory' && L('目前是暫存模式：關閉分頁後記錄就會消失，請先匯出。', 'This is temporary mode: records disappear when the tab closes, so export first.')}</p>
        <p className="muted">{L('記錄只存在這個瀏覽器，不會上傳。換裝置或清除網站資料前，請先匯出備份，再到另一邊匯入。', 'Records stay in this browser and are never uploaded. Before switching devices or clearing site data, export a backup and import it on the other side.')}</p>
        <div className="dialog-actions">
          <button type="button" disabled={counts.readings === 0} onClick={() => setExportOpen(true)}>{L('全部匯出', 'Export all')}</button>
        </div>
        <ImportSection onDone={refresh} />
        {repo.mode !== 'memory' && <KeepRecords />}

        <h3>{L('封存檔', 'Archives')}</h3>
        {archives.length === 0
          ? <p className="muted">{L('沒有封存檔。匯入時遇到這一版不支援的規則或內容版本，會放在這裡，只能檢視原始文字。', 'No archives. Imported data in a rule or content version this App does not support goes here, where only its raw text can be viewed.')}</p>
          : (
            <ul className="archive-list">
              {archives.map(archive => (
                <li key={archive.archiveId}>
                  <p className="question-text">{archive.preview.questionText || L('（無問題文字）', '(no question text)')}</p>
                  <p className="muted">{L(`版本 ${archive.preview.ruleVersion}／${archive.preview.contentVersion}`, `Version ${archive.preview.ruleVersion} / ${archive.preview.contentVersion}`)}
                    {archive.preview.createdAt && L(`・建立於 ${T.formatDate(archive.preview.createdAt)}`, ` · created ${T.formatDate(archive.preview.createdAt)}`)}{L(`・匯入於 ${T.formatDate(archive.importedAt)}。不會用目前的規則重新解讀。`, ` · imported ${T.formatDate(archive.importedAt)}. It is not re-read with the current rules.`)}</p>
                  <details><summary>{L('純文字預覽', 'Plain-text preview')}</summary><pre className="raw">{archive.raw}</pre></details>
                  <div className="dialog-actions">
                    <button type="button" onClick={() => downloadText(`geomancy-archive-${archive.archiveId}.json`, archive.raw)}>{L('下載原檔', 'Download the original')}</button>
                    <button type="button" className="danger" onClick={() => { repo.deleteArchive(archive.archiveId).then(refresh, fail); }}>{L('刪除封存', 'Delete archive')}</button>
                  </div>
                </li>
              ))}
            </ul>
          )}

        <h3>{L('清除全部', 'Clear everything')}</h3>
        <button type="button" className="danger" onClick={() => setClearOpen(true)}>{L('清除這個瀏覽器裡的所有記錄…', 'Clear all records in this browser…')}</button>
      </section>

      <section className="card">
        <h2>{L('試用回饋', 'Pilot feedback')}</h2>
        <label className="check">
          <input type="checkbox" checked={settings.pilotLogging} onChange={event => change('pilotLogging', event.target.checked)} />
          {L('記錄本機試用流程（預設關閉）', 'Log pilot steps on this device (off by default)')}
        </label>
        <p className="muted">{L('開啟後只記錄操作步驟與耗時（例如完成第幾列、是否打開依據），不記錄問題、筆記、點數或盤面。資料只存在這個瀏覽器，不會自動送出；需要你手動匯出交給測試主持人。',
          'When on, only steps and timings are logged (such as which row was finished, or whether the evidence was opened), never questions, notes, dots or charts. The log stays in this browser and is never sent; you export it by hand for the test host.')}</p>
        <p>{L(`目前有 ${counts.feedback} 筆回饋與事件。匯出檔會包含你在「最想改善的一件事」填寫的文字。`, `There are ${counts.feedback} feedback entries and events. The export includes what you wrote under "The one thing to improve".`)}</p>
        <div className="dialog-actions">
          <button type="button" disabled={counts.feedback === 0} onClick={() => void exportFeedback()}>{L('匯出回饋', 'Export feedback')}</button>
          <button type="button" className="danger" disabled={counts.feedback === 0}
            onClick={() => { repo.clearFeedback().then(refresh, fail); }}>{L('清除回饋', 'Clear feedback')}</button>
        </div>
      </section>

      <section className="card">
        <h2>{L('離線與安裝', 'Offline and install')}</h2>
        <p role="status">
          {pwa.offline === 'ready' && L('已可離線使用：App 與所有解讀內容都已存在這台裝置。', 'Ready offline: the App and all reading content are stored on this device.')}
          {pwa.offline === 'pending' && L('正在準備離線內容…完成前請保持連線。', 'Preparing offline content… stay online until it finishes.')}
          {pwa.offline === 'failed' && L('離線內容準備失敗。請確認網路後重新整理頁面再試一次。', 'Preparing offline content failed. Check your connection and reload the page to try again.')}
          {pwa.offline === 'unsupported' && L('這個瀏覽器或這個網址不支援離線使用（需要 HTTPS 或 localhost）。', 'This browser or address does not support offline use (HTTPS or localhost is needed).')}
        </p>
        {pwa.canInstall && <button type="button" onClick={() => void promptInstall()}>{L('安裝到這台裝置', 'Install on this device')}</button>}
        {isIos() && <p>{L('iPhone／iPad：在 Safari 按「分享」，再選「加入主畫面」。', 'iPhone / iPad: in Safari, tap Share, then Add to Home Screen.')}</p>}
        <p className="muted">{L('不安裝也可以直接在瀏覽器使用全部功能。', 'Everything also works in the browser without installing.')}</p>
      </section>

      <section className="card">
        <h2>{L('版本與來源', 'Versions and sources')}</h2>
        <p>{L(`App ${APP_VERSION}（測試版）・規則 ${RULE_VERSIONS.join('、')}・內容 ${CONTENT_VERSION}、進階 ${ADVANCED_VERSION}（編輯草稿，未經專家審校）`,
          `App ${APP_VERSION} (beta) · rules ${RULE_VERSIONS.join(', ')} · content ${CONTENT_VERSION}, advanced ${ADVANCED_VERSION} (editorial drafts, not expert-reviewed)`)}</p>
        <p>{L(`儲存方式：${repo.mode === 'persistent' ? '這個瀏覽器的本機資料庫' : '暫存模式（僅限這個分頁）'}。沒有帳號、後端或第三方追蹤；只有在你按下 AI 轉述的「送出」時，才會連到 Anthropic。`,
          `Storage: ${repo.mode === 'persistent' ? "this browser's local database" : 'temporary mode (this tab only)'}. No accounts, backend or third-party tracking; Anthropic is contacted only when you press Send for an AI retelling.`)}</p>
        <p><Link to="/learn">{L('規則與來源', 'Rules and sources')}</Link></p>
      </section>

      <Dialog open={exportOpen} title={L('全部匯出', 'Export all')} onClose={() => setExportOpen(false)}>
        <p>{L('匯出的檔案包含所有問題文字、盤面、解讀與筆記，請自行妥善保管。不含未完成的草稿與設定。', 'The exported file contains all question text, charts, readings and notes; keep it somewhere safe. Unfinished drafts and settings are not included.')}</p>
        <div className="dialog-actions">
          <button type="button" className="primary" onClick={() => void exportAll()}>{L('下載 JSON', 'Download JSON')}</button>
          <button type="button" onClick={() => setExportOpen(false)}>{L('取消', 'Cancel')}</button>
        </div>
      </Dialog>
      <Dialog open={clearOpen} title={L('清除所有記錄', 'Clear all records')} onClose={() => { setClearOpen(false); setClearWord(''); }}>
        <p>{L('會刪除這個瀏覽器裡的草稿、全部日誌、封存檔與回饋，無法復原。設定與離線檔案不受影響。建議先匯出備份。', 'This deletes the drafts, the whole journal, archives and feedback in this browser, and cannot be undone. Settings and offline files are not affected. Export a backup first.')}</p>
        <label htmlFor="clear-word">{L('請輸入「清除」兩個字以確認', 'Type "delete" to confirm')}</label>
        <input id="clear-word" type="text" value={clearWord} onChange={event => setClearWord(event.target.value)} autoComplete="off" />
        <div className="dialog-actions">
          <button type="button" className="danger" disabled={clearWord.trim() !== clearConfirm} onClick={() => void clearAll()}>{L('清除全部', 'Clear everything')}</button>
          <button type="button" className="primary" onClick={() => { setClearOpen(false); setClearWord(''); }}>{L('取消', 'Cancel')}</button>
        </div>
      </Dialog>
    </div>
  );
}
