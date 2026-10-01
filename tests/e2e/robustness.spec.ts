// Paths that had code but no browser test: update prompt, schema change from another tab, full storage,
// a stored record this build must not interpret, and rollback of a failing import batch.
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import { appendFileSync, cpSync, readFileSync } from 'node:fs';
import { fillManual, idbAll, startCast, tapTray } from './helpers.ts';

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

type Injection = { quotaStores: string[]; failAddAfter: number; adds: number };
/** Test-only, injected from outside the app: storage calls that throw the way a real browser would. */
async function injectStorageFaults(page: Page) {
  await page.addInitScript(() => {
    const state: Injection = { quotaStores: [], failAddAfter: -1, adds: 0 };
    (window as unknown as { storageFaults: Injection }).storageFaults = state;
    const quota = (store: IDBObjectStore) => {
      if (state.quotaStores.includes(store.name)) throw new DOMException('injected quota', 'QuotaExceededError');
    };
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (this: IDBObjectStore, ...args: Parameters<IDBObjectStore['put']>) {
      quota(this);
      return put.apply(this, args);
    };
    const add = IDBObjectStore.prototype.add;
    IDBObjectStore.prototype.add = function (this: IDBObjectStore, ...args: Parameters<IDBObjectStore['add']>) {
      quota(this);
      if (this.name === 'readings' && state.failAddAfter >= 0 && ++state.adds > state.failAddAfter) {
        throw new DOMException('injected failure', 'UnknownError');
      }
      return add.apply(this, args);
    };
  });
}
const setFaults = (page: Page, patch: Partial<Injection>) =>
  page.evaluate(p => Object.assign((window as unknown as { storageFaults: Injection }).storageFaults, p), patch);

const backupRecord = () => JSON.parse(readFileSync(new URL('../../fixtures/teaching-backup.json', import.meta.url), 'utf8')).records[0];

/** Writes a record straight into the app's database, bypassing every check the app makes. */
const putRaw = (page: Page, record: unknown) => page.evaluate(value => new Promise<void>((resolve, reject) => {
  const open = indexedDB.open('geomancy-local');
  open.onsuccess = () => {
    const tx = open.result.transaction('readings', 'readwrite');
    tx.objectStore('readings').put(value);
    tx.oncomplete = () => { open.result.close(); resolve(); };
    tx.onerror = () => reject(tx.error);
  };
  open.onerror = () => reject(open.error);
}), record);

/** A preview server of its own, serving a copy of dist/ that the test may change. */
async function privateServer(testInfo: TestInfo): Promise<{ url: string; dir: string; server: ChildProcess }> {
  const dir = testInfo.outputPath('dist');
  cpSync('dist', dir, { recursive: true });
  const port = 4210 + testInfo.parallelIndex;
  const server = spawn(process.execPath,
    ['node_modules/vite/bin/vite.js', 'preview', '--outDir', dir, '--port', String(port), '--strictPort'], { stdio: 'pipe' });
  await new Promise<void>((resolve, reject) => {
    server.stdout!.on('data', (chunk: Buffer) => { if (String(chunk).includes(String(port))) resolve(); });
    server.once('exit', code => reject(new Error(`vite preview exited (${code})`)));
  });
  return { url: `http://localhost:${port}/`, dir, server };
}

// First visit: the tab was not controlled when it registered, so workbox reports the next version as
// "external" — the case where the page used to stay put with the prompt still showing.
for (const visit of ['第一次造訪', '再次造訪'] as const) test(`更新提示（${visit}）：新版等待中時，未保存筆記與起卦期間不打斷，空閒時才提示，按下後重新載入且資料不變`, async ({ browser }, testInfo) => {
  const { url, dir, server } = await privateServer(testInfo);
  const context = await browser.newContext({ baseURL: url });
  try {
    const page = await context.newPage();
    const banner = page.getByText('有新版本可以使用');
    await page.goto('./#/settings');
    await expect(page.getByText('已可離線使用')).toBeVisible({ timeout: 30_000 });
    await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
    if (visit === '再次造訪') {
      await page.reload();
      await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
    }

    // A finished reading with notes typed but not saved.
    await startCast(page, { method: '手動輸入四母象' });
    await fillManual(page);
    await page.getByRole('button', { name: '依這四母象排盤' }).click();
    await page.getByLabel('寫下回顧').fill('還沒保存的筆記');

    // Deploy a "new version": any byte change in sw.js makes the browser install a waiting worker.
    appendFileSync(`${dir}/sw.js`, '\n// next version\n');
    await page.evaluate(async () => { await (await navigator.serviceWorker.getRegistration())!.update(); });
    await expect.poll(() => page.evaluate(async () => Boolean((await navigator.serviceWorker.getRegistration())?.waiting)),
      { timeout: 30_000 }).toBe(true);
    await page.waitForTimeout(500);
    await expect(banner).toBeHidden();

    await page.getByRole('button', { name: '保存筆記' }).click();
    await expect(page.getByText('筆記已保存。')).toBeVisible();
    await expect(banner).toBeVisible();

    // Casting is busy too: the prompt goes away and comes back once the user leaves the sand tray.
    await startCast(page, { method: '十六列點沙' });
    await expect(page.getByRole('button', { name: '完成這列' })).toBeVisible();
    await expect(banner).toBeHidden();
    await page.getByRole('link', { name: '日誌' }).click();
    await expect(banner).toBeVisible();

    await page.evaluate(() => { (window as unknown as { beforeUpdate: boolean }).beforeUpdate = true; });
    await page.getByRole('button', { name: '更新並重新載入' }).click();
    // A fresh document: the marker set before the click is gone.
    await expect.poll(() => page.evaluate(() => (window as unknown as { beforeUpdate?: boolean }).beforeUpdate ?? false)
      .catch(() => true), { timeout: 30_000 }).toBe(false);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect.poll(() => page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      return Boolean(registration?.active && !registration.waiting && navigator.serviceWorker.controller);
    }), { timeout: 30_000 }).toBe(true);
    await expect(banner).toBeHidden();
    // The update did not touch stored data: the reading, its notes and the unfinished draft are all there.
    expect((await idbAll<{ notes: string }>(page, 'readings')).map(r => r.notes)).toEqual(['還沒保存的筆記']);
    expect(await idbAll(page, 'drafts')).toHaveLength(1);
  } finally {
    await context.close();
    server.kill();
  }
});

test('另一個分頁升級資料庫：本分頁關閉連線並提示重新整理，之後的保存明確失敗', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: '地占沙盤', level: 1 })).toBeVisible();

  // Stands in for a future build (schema v2) opened in another tab of the same browser.
  const other = await page.context().newPage();
  await other.goto('./#/learn');
  await expect(other.getByRole('heading', { level: 1 })).toBeVisible();
  const upgraded = await other.evaluate(() => new Promise<number>((resolve, reject) => {
    const open = indexedDB.open('geomancy-local', 2);
    open.onsuccess = () => { const v = open.result.version; open.result.close(); resolve(v); };
    open.onerror = () => reject(open.error);
    open.onblocked = () => reject(new Error('blocked: the app did not close its connection'));
  }));
  expect(upgraded).toBe(2);

  for (const tab of [page, other]) {
    await expect(tab.getByRole('alert').filter({ hasText: '另一個分頁已更新地占沙盤的資料格式' })).toBeVisible();
  }
  // A closed connection must surface as "not saved", never as a silent success or a blank screen.
  await page.goto('./#/new');
  await page.getByLabel('你想問什麼？').fill('升級後還能保存嗎？');
  await page.getByRole('radio', { name: /手動輸入四母象/ }).check();
  await page.getByRole('button', { name: '開始起卦' }).click();
  await expect(page.getByRole('alert').filter({ hasText: '尚未保存' })).toBeVisible();
  await expect(page).toHaveURL(/#\/new/);

  // This build cannot open a newer schema: after reloading it offers temporary mode instead of crashing.
  await page.reload();
  await expect(page.getByText('這個瀏覽器目前無法使用本機儲存')).toBeVisible();
  await expect(page.getByRole('button', { name: '以暫存模式繼續' })).toBeVisible();
});

test('儲存空間不足（QUOTA）：點沙列與筆記都顯示未保存、保留輸入，空間恢復後可重試', async ({ page }) => {
  await injectStorageFaults(page);
  await startCast(page, { method: '十六列點沙' });
  await setFaults(page, { quotaStores: ['drafts'] });
  await tapTray(page, 3);
  await page.getByRole('button', { name: '完成這列' }).click();
  await expect(page.getByRole('alert')).toContainText('這一列尚未保存，點數仍保留。瀏覽器儲存空間不足');
  await expect(page.getByText('全部第 1／16 列')).toBeVisible();
  expect((await idbAll<{ confirmedCounts: number[] }>(page, 'drafts'))[0].confirmedCounts).toEqual([]);
  await setFaults(page, { quotaStores: [] });
  await page.getByRole('button', { name: '完成這列' }).click();
  await expect(page.getByText('全部第 2／16 列')).toBeVisible();
  expect((await idbAll<{ confirmedCounts: number[] }>(page, 'drafts'))[0].confirmedCounts).toEqual([3]);
  await page.getByRole('button', { name: '放棄這筆草稿' }).click();
  await page.getByRole('dialog').getByRole('button', { name: '放棄草稿' }).click();

  await startCast(page, { method: '手動輸入四母象' });
  await fillManual(page);
  await page.getByRole('button', { name: '依這四母象排盤' }).click();
  await expect(page).toHaveURL(/#\/result\//);
  await setFaults(page, { quotaStores: ['readings'] });
  await page.getByLabel('寫下回顧').fill('空間不足時寫的筆記');
  await page.getByRole('button', { name: '保存筆記' }).click();
  await expect(page.getByRole('alert')).toContainText('筆記尚未保存，文字仍保留在輸入框。瀏覽器儲存空間不足');
  await expect(page.getByLabel('寫下回顧')).toHaveValue('空間不足時寫的筆記');
  expect((await idbAll<{ notes: string }>(page, 'readings'))[0].notes).toBe('');
  await setFaults(page, { quotaStores: [] });
  await page.getByRole('button', { name: '保存筆記' }).click();
  await expect(page.getByText('筆記已保存。')).toBeVisible();
  expect((await idbAll<{ notes: string }>(page, 'readings'))[0].notes).toBe('空間不足時寫的筆記');
});

test('R04 本機記錄驗證失敗或版本不支援：以純文字檢視、不執行內容、不重算，可匯出原始資料', async ({ page }, testInfo) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: '地占沙盤', level: 1 })).toBeVisible();
  const hostile = '<img src=x onerror="window.pwned=1">盤面被改過';
  const tampered = { ...backupRecord(), id: 'a372a3e9-9b35-4135-b0e7-00000000e081',
    question: { ...backupRecord().question, text: hostile }, mothers: [[1, 1, 1, 1], ...backupRecord().mothers.slice(1)] };
  const future = { ...backupRecord(), id: 'a372a3e9-9b35-4135-b0e7-00000000e082', ruleVersion: 'western-sequential-v9' };
  await putRaw(page, tampered);
  await putRaw(page, future);

  await page.goto(`./#/result/${tampered.id}`);
  await expect(page.getByRole('heading', { name: '這筆記錄只能以純文字檢視' })).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('盤面與原始資料不一致。（第 1 母象與原始來源不一致）');
  await expect(page.getByText(`問題：${hostile}`)).toBeVisible();
  await expect(page.locator('img[src="x"]')).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { pwned?: number }).pwned)).toBeUndefined();
  // Nothing recomputed: no chart, no reading cards, no notes editor.
  await expect(page.locator('.node-list, .claim, #notes-text')).toHaveCount(0);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: '匯出原始資料' }).click();
  const file = testInfo.outputPath('raw.json');
  await (await download).saveAs(file);
  expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual(tampered);

  await page.goto(`./#/result/${future.id}`);
  await expect(page.getByRole('heading', { name: '這筆記錄只能以純文字檢視' })).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('此版本只能封存檢視。');
  // The journal still opens with both records in it.
  await page.goto('./#/journal');
  await expect(page.locator('.journal-item')).toHaveCount(2);
  // Stored records are left exactly as they were.
  expect(await idbAll(page, 'readings')).toEqual(expect.arrayContaining([tampered, future]));
});

test('I09 匯入中途失敗（真實瀏覽器）：整批回復，沒有半套記錄，再試一次可完成', async ({ page }) => {
  await injectStorageFaults(page);
  const first = backupRecord();
  const second = { ...first, id: 'b2c4e6f8-1111-4222-8333-944455556666', question: { ...first.question, text: '第二筆記錄' } };
  const backup = { ...JSON.parse(readFileSync(new URL('../../fixtures/teaching-backup.json', import.meta.url), 'utf8')), records: [first, second] };

  await page.goto('./#/settings');
  const preview = page.getByRole('region', { name: '匯入預覽' });
  await page.getByLabel('選擇備份檔').setInputFiles({ name: 'two.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) });
  await expect(preview.getByRole('button', { name: /確認匯入 2 筆/ })).toBeEnabled();

  // The first add succeeds inside the transaction, the second throws.
  await setFaults(page, { failAddAfter: 1, adds: 0 });
  await preview.getByRole('button', { name: /確認匯入 2 筆/ }).click();
  await expect(page.getByRole('alert').filter({ hasText: '匯入失敗，這批資料完全沒有寫入' })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { storageFaults: Injection }).storageFaults.adds)).toBe(2);
  expect(await idbAll(page, 'readings')).toHaveLength(0);

  await setFaults(page, { failAddAfter: -1 });
  await preview.getByRole('button', { name: /確認匯入 2 筆/ }).click();
  await expect(page.getByText('已匯入 2 筆記錄')).toBeVisible();
  expect((await idbAll<{ id: string }>(page, 'readings')).map(r => r.id).sort()).toEqual([first.id, second.id].sort());
});
