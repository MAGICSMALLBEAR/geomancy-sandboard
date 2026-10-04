import { expect, test, type Browser, type BrowserContext, type TestInfo } from '@playwright/test';
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { castRows, expectFixtureChart, fillManual, fixture, idbAll, startCast, tapTray } from './helpers.ts';

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

test('P01 新手點沙：fixture 的十六列得到完整正確的盤、依據、筆記與日誌', async ({ page }) => {
  const id = await startCast(page, { method: '十六列點沙' });
  await expect(page.getByRole('button', { name: '完成這列' })).toBeDisabled();
  await castRows(page, fixture.counts);

  await expect(page).toHaveURL(new RegExp(`#/result/${id}$`));
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(fixture.question.text);
  await expect(page.getByText('基礎象徵解讀・內容草稿')).toBeVisible();
  await expectFixtureChart(page);

  // Judge and the chosen tenth house, with their evidence.
  const overall = page.locator('.claim', { hasText: '整體觀察主題' });
  await expect(overall).toContainText('交會／Conjunctio');
  await overall.getByRole('button', { name: '查看依據' }).click();
  await expect(overall.locator('.evidence')).toContainText('裁判');
  await expect(overall.locator('.evidence')).toContainText('圖式 2112');
  const topic = page.locator('.claim', { hasText: '問題所屬範圍' });
  await topic.getByRole('button', { name: '查看依據' }).click();
  await expect(topic.locator('.evidence')).toContainText('第二姪象（第 10 宮：職位與公共角色）：大幸運／Fortuna Major，圖式 2211');
  await expect(page.locator('.claim')).toHaveCount(5);

  // Mothers expose the real tapped counts.
  await page.locator('.node-list > li').first().getByRole('button').click();
  await expect(page.locator('.node-list > li').first()).toContainText('點了 13 下，奇數 → 一點');

  await page.getByRole('button', { name: '十二宮', exact: true }).click();
  const tenth = page.locator('.house-card', { hasText: '第 10 宮' });
  await expect(tenth).toContainText('大幸運／Fortuna Major');
  await expect(tenth).toContainText('第二姪象（N2）');
  await expect(tenth).toContainText('你選的問題宮');
  await expect(page.locator('.house-card')).toHaveCount(12);

  await page.getByLabel('寫下回顧').fill('三個月後回來看這一盤。');
  await page.getByRole('button', { name: '保存筆記' }).click();
  await expect(page.getByText('筆記已保存。')).toBeVisible();

  await page.getByRole('navigation', { name: '主要導覽' }).getByRole('link', { name: '日誌' }).click();
  await expect(page.locator('.journal-item')).toHaveCount(1);
  await page.locator('.journal-item').getByRole('link').click();
  await expect(page).toHaveURL(new RegExp(`#/result/${id}$`));
  await expect(page.getByLabel('寫下回顧')).toHaveValue('三個月後回來看這一盤。');

  const [record] = await idbAll<{ id: string; source: { counts: number[] }; revision: number }>(page, 'readings');
  expect(record.id).toBe(id);
  expect(record.source.counts).toEqual(fixture.counts);
  expect(record.revision).toBe(1);
  expect(await idbAll(page, 'drafts')).toHaveLength(0);
});

test('P02 中斷恢復：只保留已確認的列，完成後只有一筆日誌', async ({ page }) => {
  page.on('dialog', dialog => void dialog.accept());
  const id = await startCast(page, { method: '十六列點沙', work: false });
  await castRows(page, [3, 2, 5, 4, 1]);
  await tapTray(page, 3);
  await page.reload();

  await expect(page.getByText('已保留前 5 列；未確認的一列請重新點沙。')).toBeVisible();
  await expect(page.getByText('全部第 6／16 列')).toBeVisible();
  await expect(page.getByRole('button', { name: '完成這列' })).toBeDisabled();
  expect((await idbAll<{ confirmedCounts: number[] }>(page, 'drafts'))[0].confirmedCounts).toEqual([3, 2, 5, 4, 1]);

  // Leaving at a finished mother shows the review again on return.
  await castRows(page, [2, 2, 2], 5);
  await page.reload();
  await expect(page.getByRole('heading', { name: '第二母象完成' })).toBeVisible();
  await page.getByRole('button', { name: /^繼續第/ }).click();

  await castRows(page, [1, 1, 1, 1, 2, 2, 2, 2], 8);
  await expect(page).toHaveURL(new RegExp(`#/result/${id}$`));
  const readings = await idbAll<{ source: { counts: number[] } }>(page, 'readings');
  expect(readings).toHaveLength(1);
  expect(readings[0].source.counts).toEqual([3, 2, 5, 4, 1, 2, 2, 2, 1, 1, 1, 1, 2, 2, 2, 2]);
  await page.goto('./#/journal');
  await expect(page.locator('.journal-item')).toHaveCount(1);
});

/** Test-only injection from outside the app: fixed bytes and N failing draft writes. The UI has no such control. */
async function injectQuick(page: import('@playwright/test').Page, failingPuts: number) {
  await page.addInitScript(fails => {
    const real = crypto.getRandomValues.bind(crypto);
    (window as unknown as { rngCalls: number }).rngCalls = 0;
    crypto.getRandomValues = ((array: Uint8Array<ArrayBuffer>) => {
      if (array instanceof Uint8Array && array.length === 2) {
        (window as unknown as { rngCalls: number }).rngCalls += 1;
        array.set([0xAC, 0xF0]);
        return array;
      }
      return real(array);
    }) as typeof crypto.getRandomValues;
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (this: IDBObjectStore, ...args: Parameters<IDBObjectStore['put']>) {
      const failed = Number(sessionStorage.getItem('failedPuts') ?? 0);
      if (this.name === 'drafts' && failed < fails) {
        sessionStorage.setItem('failedPuts', String(failed + 1));
        throw new DOMException('injected failure', 'UnknownError');
      }
      return put.apply(this, args);
    };
  }, failingPuts);
}
const rngCalls = (page: import('@playwright/test').Page) => page.evaluate(() => (window as unknown as { rngCalls: number }).rngCalls);
const QUICK_MOTHERS = ['1212', '1122', '1111', '2222'];

test('P03 快速與保存失敗：連按只取樣一次，重試保存同一組位元，重新整理不換盤', async ({ page }) => {
  await injectQuick(page, 1);
  const id = await startCast(page, { method: '快速起卦（裝置亂數）', work: false });
  await page.getByRole('button', { name: '由裝置亂數起卦' }).dblclick();

  await expect(page.getByRole('heading', { name: '尚未保存' })).toBeVisible();
  expect(await rngCalls(page)).toBe(1);
  expect(await idbAll(page, 'readings')).toHaveLength(0);
  await expect(page.getByText('已保存')).toHaveCount(0);

  await page.getByRole('button', { name: '重試保存' }).click();
  await expect(page).toHaveURL(new RegExp(`#/result/${id}$`));
  expect(await rngCalls(page)).toBe(1);
  const rows = page.locator('.node-list > li');
  for (let i = 0; i < 4; i++) await expect(rows.nth(i)).toContainText(`圖式 ${QUICK_MOTHERS[i]}`);
  await rows.first().getByRole('button').click();
  await expect(rows.first()).toContainText('數位亂數來源');

  const before = await idbAll(page, 'readings');
  expect(before).toHaveLength(1);
  expect(before[0]).toMatchObject({ id, source: { kind: 'quick', algorithm: 'webcrypto-16bits-v1', bytes: [0xAC, 0xF0] } });

  // E05: reloading, re-rendering and switching pages never sample again or change the record.
  await page.reload();
  for (let i = 0; i < 4; i++) await expect(rows.nth(i)).toContainText(`圖式 ${QUICK_MOTHERS[i]}`);
  await page.goto('./#/journal');
  await page.locator('.journal-item').getByRole('link').click();
  await page.getByRole('button', { name: '十二宮', exact: true }).click();
  await page.getByRole('button', { name: '盾盤', exact: true }).click();
  await page.getByLabel(/顯示調和者/).check();
  expect(await rngCalls(page)).toBe(0);
  expect(await idbAll(page, 'readings')).toEqual(before);
});

test('暫存結果：保存失敗時可先看同一盤，明確標示未保存，重試後成為同 ID 的記錄', async ({ page }) => {
  await injectQuick(page, 2);
  const id = await startCast(page, { method: '快速起卦（裝置亂數）', work: false });
  await page.getByRole('button', { name: '由裝置亂數起卦' }).click();
  await page.getByRole('button', { name: '重試保存' }).click();
  await expect(page.getByRole('heading', { name: '尚未保存' })).toBeVisible();

  await page.getByRole('button', { name: '先看暫存結果（未保存）' }).click();
  await expect(page.getByRole('heading', { name: '暫存結果：尚未存入日誌' })).toBeVisible();
  const rows = page.locator('.node-list > li');
  for (let i = 0; i < 4; i++) await expect(rows.nth(i)).toContainText(`圖式 ${QUICK_MOTHERS[i]}`);
  await expect(page.getByLabel('寫下回顧')).toHaveCount(0);
  expect(await idbAll(page, 'readings')).toHaveLength(0);

  await page.getByRole('button', { name: '重試保存' }).click();
  await expect(page.getByRole('heading', { name: '暫存結果：尚未存入日誌' })).toHaveCount(0);
  await expect(page.getByLabel('寫下回顧')).toBeVisible();
  expect(await rngCalls(page)).toBe(1);
  const readings = await idbAll(page, 'readings');
  expect(readings).toHaveLength(1);
  expect(readings[0]).toMatchObject({ id, source: { bytes: [0xAC, 0xF0] } });
});

test('P04 資料往返：手動四母→筆記→匯出→乾淨瀏覽器匯入→重複、竄改、衝突', async ({ page, browser }, testInfo) => {
  await startCast(page, { method: '手動輸入四母象' });
  const submit = page.getByRole('button', { name: '依這四母象排盤' });
  // C12: fifteen rows are not enough.
  await fillManual(page, ['少年／Puer', '龍首／Caput Draconis', '悲傷／Tristitia']);
  const fourth = page.locator('.manual-card').nth(3);
  for (const [row, choice] of [[0, '兩點'], [1, '兩點'], [2, '一點']] as const) {
    await fourth.locator('.manual-row').nth(row).getByRole('radio', { name: new RegExp(choice) }).click();
  }
  await expect(page.getByText('已填 15／16 行')).toBeVisible();
  await expect(submit).toBeDisabled();
  await fourth.locator('.manual-row').nth(3).getByRole('radio', { name: /兩點/ }).click();
  await expect(fourth).toContainText('白／Albus');
  await submit.click();

  await expect(page).toHaveURL(/#\/result\//);
  await expectFixtureChart(page);
  await page.locator('.node-list > li').first().getByRole('button').click();
  await expect(page.locator('.node-list > li').first()).toContainText('手動設定');
  const note = '繁體中文筆記：與合作對象確認時程。\n第二行。';
  await page.getByLabel('寫下回顧').fill(note);
  await page.getByRole('button', { name: '保存筆記' }).click();
  await expect(page.getByText('筆記已保存。')).toBeVisible();
  const [original] = await idbAll(page, 'readings');

  await page.getByRole('button', { name: '匯出此筆' }).click();
  await expect(page.getByRole('dialog')).toContainText('包含你的問題文字');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: '下載 JSON' }).click();
  const file = testInfo.outputPath('backup.json');
  await (await download).saveAs(file);
  const exported = JSON.parse(readFileSync(file, 'utf8'));
  expect(exported).toMatchObject({ format: 'geomancy-journal', schemaVersion: 1 });
  expect(exported.records).toEqual([original]);

  // A clean browser context: nothing shared with the first one.
  const context = await browser.newContext({ baseURL: testInfo.project.use.baseURL });
  const other = await context.newPage();
  await other.goto('./#/settings');
  const preview = other.getByRole('region', { name: '匯入預覽' });
  const importFile = async (path: string) => other.getByLabel('選擇備份檔').setInputFiles(path);

  await importFile(file);
  await expect(preview).toContainText('可匯入');
  expect(await idbAll(other, 'readings')).toHaveLength(0);
  await preview.getByRole('button', { name: /確認匯入 1 筆/ }).click();
  await expect(other.getByText('已匯入 1 筆記錄。')).toBeVisible();
  expect(await idbAll(other, 'readings')).toEqual([original]);
  await other.goto('./#/journal');
  await other.locator('.journal-item').getByRole('link').click();
  await expectFixtureChart(other);
  await expect(other.getByLabel('寫下回顧')).toHaveValue(note);

  // I02: importing again adds nothing.
  await other.goto('./#/settings');
  await importFile(file);
  await expect(preview).toContainText('重複（已有相同記錄，將略過）');
  await expect(preview.getByRole('button', { name: /確認匯入/ })).toBeDisabled();

  // I04: one daughter position altered by hand.
  const tampered = structuredClone(exported);
  tampered.records[0].chart.D2[1] ^= 1;
  const tamperedFile = testInfo.outputPath('tampered.json');
  writeFileSync(tamperedFile, JSON.stringify(tampered));
  await importFile(tamperedFile);
  await expect(preview).toContainText('無效：盤面與原始資料不一致。盤位 D2 與原始來源不一致');
  await expect(preview.getByRole('button', { name: /確認匯入/ })).toBeDisabled();

  // I03: same ID, different notes → conflict, kept only as an explicit copy.
  const conflict = structuredClone(exported);
  conflict.records[0].notes = '另一台裝置上改過的筆記';
  const conflictFile = testInfo.outputPath('conflict.json');
  writeFileSync(conflictFile, JSON.stringify(conflict));
  await importFile(conflictFile);
  await expect(preview).toContainText('衝突：相同 ID 但內容或筆記不同');
  await expect(preview.getByRole('button', { name: /確認匯入/ })).toBeDisabled();
  await preview.getByLabel(/另存成副本/).check();
  await preview.getByRole('button', { name: /確認匯入 1 筆/ }).click();
  const after = await idbAll<{ id: string; notes: string; importOrigin?: { originalId: string } }>(other, 'readings');
  expect(after).toHaveLength(2);
  expect(after.find(r => r.id === exported.records[0].id)?.notes).toBe(note);
  expect(after.find(r => r.id !== exported.records[0].id)).toMatchObject({ notes: '另一台裝置上改過的筆記', importOrigin: { originalId: exported.records[0].id } });

  // R04 + I08: unknown version is archived as inert text, never shown as a reading.
  const future = structuredClone(exported);
  future.records[0].ruleVersion = 'western-other-v9';
  future.records[0].question.text = '<img src=x onerror="window.xss=1">未來版本的問題';
  const futureFile = testInfo.outputPath('future.json');
  writeFileSync(futureFile, JSON.stringify(future));
  await importFile(futureFile);
  await expect(preview).toContainText('不支援的版本（western-other-v9／zh-TW-basic-draft-v2），只能存為只讀封存');
  await preview.getByRole('button', { name: /確認匯入 0 筆、封存 1 筆/ }).click();
  await expect(other.locator('.archive-list')).toContainText('<img src=x onerror="window.xss=1">未來版本的問題');
  expect(await other.evaluate(() => (window as unknown as { xss?: number }).xss)).toBeUndefined();
  expect(await idbAll(other, 'readings')).toHaveLength(2);
  expect(await idbAll(other, 'archives')).toHaveLength(1);

  // A file that is not ours.
  const junk = testInfo.outputPath('junk.json');
  writeFileSync(junk, '{"hello":"world"}');
  await importFile(junk);
  await expect(other.getByText('這不是地占沙盤的備份檔，或檔案內容已損壞。')).toBeVisible();
  await context.close();
});

/** Everything P05 checks once the network is gone; `goOffline` must leave `page` controlled by the worker. */
async function offlineFlow(baseURL: string, browser: Browser, testInfo: TestInfo, goOffline: (context: BrowserContext) => Promise<void>) {
  const context = await browser.newContext({ baseURL });
  let page = await context.newPage();
  await page.goto('./#/settings');
  await expect(page.getByText('已可離線使用')).toBeVisible({ timeout: 30_000 });
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);

  await goOffline(context);
  await page.close();
  page = await context.newPage();
  await page.goto('./');
  await expect(page.getByRole('heading', { name: '地占沙盤', level: 1 })).toBeVisible();

  await startCast(page, { method: '手動輸入四母象' });
  await fillManual(page);
  await page.getByRole('button', { name: '依這四母象排盤' }).click();
  await expect(page).toHaveURL(/#\/result\//);
  await expect(page.locator('.claim')).toHaveCount(5);
  await expectFixtureChart(page);

  await page.getByLabel('寫下回顧').fill('離線寫下的筆記');
  await page.getByRole('button', { name: '保存筆記' }).click();
  await expect(page.getByText('筆記已保存。')).toBeVisible();

  await page.goto('./#/learn');
  await expect(page.locator('.figure-tile')).toHaveCount(16);
  await page.getByRole('link', { name: /交會/ }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Conjunctio');

  await page.goto('./#/journal');
  await page.locator('.journal-item').getByRole('checkbox').check();
  await page.getByRole('button', { name: '匯出選取記錄' }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: '下載 JSON' }).click();
  const file = testInfo.outputPath('offline.json');
  await (await download).saveAs(file);
  expect(JSON.parse(readFileSync(file, 'utf8')).records[0].notes).toBe('離線寫下的筆記');

  await page.reload();
  await expect(page.locator('.journal-item')).toHaveCount(1);
  await context.close();
}

test('P05 離線：首次快取後斷網、關閉重開，仍可起卦、閱讀、寫筆記與匯出', async ({ browser, browserName }, testInfo) => {
  // Playwright's offline emulation makes WebKit fail every navigation, even ones the worker serves
  // (checked by hand: the same page opens once the server is really stopped). WebKit uses P05b.
  test.skip(browserName === 'webkit', 'WebKit 改由 P05b 以真正關閉伺服器驗證');
  await offlineFlow(testInfo.project.use.baseURL!, browser, testInfo, context => context.setOffline(true));
});

test('P05b 離線（伺服器真的關閉）：WebKit 的離線流程', async ({ browser, browserName }, testInfo) => {
  test.skip(browserName !== 'webkit', '其他引擎以 P05 的斷網模擬驗證');
  // A private preview server for this test only, so stopping it does not affect other workers.
  const port = 4190 + testInfo.workerIndex;
  const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', String(port), '--strictPort'], { stdio: 'pipe' });
  try {
    await new Promise<void>((resolve, reject) => {
      server.stdout!.on('data', (chunk: Buffer) => { if (String(chunk).includes(String(port))) resolve(); });
      server.once('exit', code => reject(new Error(`vite preview exited (${code})`)));
    });
    await offlineFlow(`http://localhost:${port}/`, browser, testInfo, async () => {
      const exited = new Promise(resolve => server.once('exit', resolve));
      server.kill();
      await exited;
    });
  } finally {
    server.kill();
  }
});
