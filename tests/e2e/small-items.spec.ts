// 0.11.0: planned next step and review date, persistent storage request, sharing the image, low-power sand tray.
import { expect, test, type Page } from '@playwright/test';
import { fillManual, idbAll, noHorizontalOverflow, startCast } from './helpers.ts';

const localDay = (page: Page, addDays: number) => page.evaluate(days => {
  const n = new Date();
  const d = new Date(n.getFullYear(), n.getMonth(), n.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}, addDays);

async function manualResult(page: Page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await startCast(page, { method: '手動輸入四母象' });
  await fillManual(page);
  await page.getByRole('button', { name: '依這四母象排盤' }).click();
  await expect(page).toHaveURL(/#\/result\//);
}

test('預計行動與回顧日期：保存、重開仍在；到了回顧日首頁提醒、日誌可篩選；寫了回顧就不再提醒', async ({ page }) => {
  await manualResult(page);
  const plan = page.locator('.plan');
  await plan.getByLabel('打算做什麼？').fill('<i>先</i>寫信問職位細節');
  await plan.getByRole('button', { name: '一週後' }).click();
  const inAWeek = await localDay(page, 7);
  await expect(plan.getByLabel('預計哪天回顧？')).toHaveValue(inAWeek);
  await plan.getByRole('button', { name: '保存' }).click();
  await expect(plan.getByText('已保存。')).toBeVisible();
  await expect(plan.getByText('<i>先</i>寫信問職位細節')).toBeVisible();
  const [record] = await idbAll<{ plan?: { action: string; reviewOn?: string } }>(page, 'readings');
  expect(record.plan).toMatchObject({ action: '<i>先</i>寫信問職位細節', reviewOn: inAWeek });

  // Not due yet.
  await page.goto('./#/');
  await expect(page.getByText(/到了回顧的時候/)).toHaveCount(0);
  await page.goto('./#/journal');
  await expect(page.locator('.journal-item').getByText(/^預計 .* 回顧$/)).toBeVisible();
  await expect(page.locator('.journal-item').getByText('打算：<i>先</i>寫信問職位細節')).toBeVisible();

  // Move the review date to today.
  await page.locator('.journal-item').getByRole('link').click();
  await plan.getByRole('button', { name: '修改' }).click();
  await plan.getByLabel('預計哪天回顧？').fill(await localDay(page, 0));
  await plan.getByRole('button', { name: '保存' }).click();
  await expect(plan.getByText('已經到了預定的回顧日。')).toBeVisible();

  await page.goto('./#/');
  await expect(page.getByText(/有 1 筆占問到了回顧的時候/)).toBeVisible();
  await page.getByRole('link', { name: '去補寫回顧' }).click();
  await expect(page).toHaveURL(/review=due/);
  await expect(page.getByLabel('後來怎樣了')).toHaveValue('due');
  await expect(page.locator('.journal-item')).toHaveCount(1);
  await expect(page.locator('.journal-item .outcome-badge')).toHaveText('該回顧了');
  await noHorizontalOverflow(page);

  // Writing the follow-up ends the reminder; the plan stays.
  await page.locator('.journal-item').getByRole('link').click();
  await page.getByRole('radio', { name: /還看不出來/ }).check();
  await page.getByRole('button', { name: '保存回顧' }).click();
  await expect(page.getByText('回顧已保存。')).toBeVisible();
  await expect(plan.getByText('已經到了預定的回顧日。')).toHaveCount(0);
  await page.goto('./#/journal?review=due');
  await expect(page.locator('.journal-item')).toHaveCount(0);

  // Delete the plan.
  await page.getByLabel('後來怎樣了').selectOption({ label: '全部' });
  await page.locator('.journal-item').getByRole('link').click();
  await plan.getByRole('button', { name: '刪除' }).click();
  await expect(plan.getByRole('button', { name: '保存' })).toBeVisible();
  const [after] = await idbAll<{ plan?: unknown; outcome?: unknown }>(page, 'readings');
  expect(after.plan).toBeUndefined();
  expect(after.outcome).toBeDefined();
});

test('請瀏覽器保留記錄：顯示目前狀態，按下後依瀏覽器回答更新', async ({ page }) => {
  await page.addInitScript(() => {
    let granted = false;
    const storage = navigator.storage;
    Object.defineProperty(navigator, 'storage', { configurable: true, value: {
      persisted: async () => granted,
      persist: async () => { granted = true; return true; },
      estimate: async () => ({ usage: 3 * 1024 * 1024, quota: 1e9 }),
      getDirectory: storage?.getDirectory?.bind(storage),
    } });
  });
  await page.goto('./#/settings');
  const section = page.locator('.keep-records');
  await expect(section.getByText('目前沒有保留保證')).toBeVisible();
  await expect(section.getByText('這個網站目前使用約 3.0 MB（含離線檔案）。')).toBeVisible();
  await section.getByRole('button', { name: '請瀏覽器保留記錄' }).click();
  await expect(section.getByText(/瀏覽器已同意保留/)).toBeVisible();
  await expect(section.getByRole('button', { name: '請瀏覽器保留記錄' })).toHaveCount(0);
});

test('請瀏覽器保留記錄：瀏覽器拒絕時說明原因，不顯示成功', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'storage', { configurable: true, value: {
      persisted: async () => false, persist: async () => false, estimate: async () => ({ usage: 4096 }),
    } });
  });
  await page.goto('./#/settings');
  const section = page.locator('.keep-records');
  await section.getByRole('button', { name: '請瀏覽器保留記錄' }).click();
  await expect(section.getByText(/瀏覽器這次沒有同意/)).toBeVisible();
  await expect(section.getByText(/瀏覽器已同意保留/)).toHaveCount(0);
});

test('存成圖片：支援分享檔案的瀏覽器出現「分享」，交出的是 PNG；關掉分享選單不算錯誤', async ({ page }) => {
  await page.addInitScript(() => {
    const calls: { name: string; type: string; size: number }[] = [];
    (window as unknown as { shareCalls: typeof calls }).shareCalls = calls;
    let cancel = false;
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: (data: ShareData) => !!data.files?.length });
    Object.defineProperty(navigator, 'share', { configurable: true, value: async (data: ShareData) => {
      for (const f of data.files ?? []) calls.push({ name: f.name, type: f.type, size: f.size });
      if (cancel) throw new DOMException('closed', 'AbortError');
      cancel = true;
    } });
  });
  await manualResult(page);
  await page.getByRole('button', { name: '存成圖片' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('img', { name: /圖片預覽/ })).toBeVisible();
  await dialog.getByRole('button', { name: '分享…' }).click();
  await dialog.getByRole('button', { name: '分享…' }).click();
  const calls = await page.evaluate(() => (window as unknown as { shareCalls: { name: string; type: string; size: number }[] }).shareCalls);
  expect(calls).toHaveLength(2);
  expect(calls[0]).toMatchObject({ type: 'image/png', name: expect.stringMatching(/^geomancy-\d{4}-\d{2}-\d{2}\.png$/) });
  expect(calls[0].size).toBeGreaterThan(1000);
  await expect(dialog.getByText('無法開啟分享選單')).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: '下載 PNG' })).toBeEnabled();
});

test('存成圖片：不支援分享檔案時只有下載', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: undefined });
  });
  await manualResult(page);
  await page.getByRole('button', { name: '存成圖片' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('button', { name: '下載 PNG' })).toBeEnabled();
  await expect(dialog.getByRole('button', { name: '分享…' })).toHaveCount(0);
});

test('低效能裝置：沙盤以簡化模式繪製，點沙計數照常', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'hardwareConcurrency', { configurable: true, value: 2 });
  });
  await startCast(page, { method: '十六列點沙' });
  await expect(page.locator('canvas.sand-canvas')).toHaveAttribute('data-lite', 'true');
  const box = (await page.locator('.sand-tray').boundingBox())!;
  for (let i = 0; i < 3; i++) await page.mouse.click(box.x + 40 + i * 40, box.y + 40);
  await page.getByRole('button', { name: '完成這列' }).click();
  await expect(page.getByText('全部第 2／16 列')).toBeVisible();
  const [draft] = await idbAll<{ confirmedCounts: number[] }>(page, 'drafts');
  expect(draft.confirmedCounts).toEqual([3]);
});
