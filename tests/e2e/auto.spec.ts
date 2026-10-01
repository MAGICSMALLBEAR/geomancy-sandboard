// Automatic sand (DECISIONS D22): one device-RNG draw from the button, saved before the playback.
import { expect, test, type Page } from '@playwright/test';
import { idbAll, startCast } from './helpers.ts';

type Saved = { source: { kind: string; algorithm: string; counts: number[] }; mothers: number[][] };
const saved = async (page: Page) => idbAll<Saved>(page, 'readings');

/** Counts only the cast draw (16 bytes) made after `armed` is set, so record IDs do not interfere. */
async function countDraws(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { draws: number; armed: boolean };
    w.draws = 0;
    w.armed = false;
    const real = crypto.getRandomValues.bind(crypto);
    crypto.getRandomValues = ((array: Uint8Array<ArrayBuffer>) => {
      if (w.armed && array instanceof Uint8Array && array.length === 16) w.draws += 1;
      return real(array);
    }) as typeof crypto.getRandomValues;
  });
}

test('自動點沙：連按只取樣一次並先保存，動畫播完顯示四母象，盤面與保存的粒數一致', async ({ page }) => {
  await countDraws(page);
  await startCast(page, { method: '自動點沙（裝置亂數）' });
  await expect(page.getByRole('heading', { name: '自動點沙' })).toBeVisible();
  await page.evaluate(() => { (window as unknown as { armed: boolean }).armed = true; });
  await page.getByRole('button', { name: '開始自動點沙' }).dblclick();

  // Saved before anything is shown.
  await expect(page.locator('.auto-show')).toBeVisible();
  const [record] = await saved(page);
  expect(await page.evaluate(() => (window as unknown as { draws: number }).draws)).toBe(1);
  expect(record.source.kind).toBe('auto');
  expect(record.source.algorithm).toBe('webcrypto-counts-v1');
  expect(record.source.counts).toHaveLength(16);
  expect(record.source.counts.every(n => n >= 5 && n <= 20)).toBe(true);
  expect(record.mothers.flat()).toEqual(record.source.counts.map(n => n % 2));
  await expect(page.getByText('放棄這筆草稿')).toHaveCount(0);

  // The playback runs to the end on its own.
  await expect(page.locator('.sand-tray')).toBeVisible();
  await expect(page.getByText('十六列都落定了')).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('.row-progress > li.is-done')).toHaveCount(16);
  await expect(page.locator('.mothers-strip figure')).toHaveCount(4);
  await page.getByRole('button', { name: '看盤面與解讀' }).click();
  await expect(page).toHaveURL(/#\/result\//);
  expect(await saved(page)).toHaveLength(1);
  // The first mother's derivation names the device draw and the saved counts.
  await page.locator('.node-list .node-row').first().click();
  const first = page.locator('.node-list > li').first();
  await expect(first).toContainText('自動點沙：每列落下幾粒沙由裝置亂數一次決定');
  const c = record.source.counts[0];
  await expect(first).toContainText(`裝置亂數落下 ${c} 粒，${c % 2 === 1 ? '奇數 → 一點' : '偶數 → 兩點'}`);
});

test('自動點沙：播放中重新整理或略過，都打開同一盤', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await startCast(page, { method: '自動點沙（裝置亂數）' });
  await page.getByRole('button', { name: '開始自動點沙' }).click();
  await expect(page.locator('.auto-show')).toBeVisible();
  const [before] = await saved(page);
  await page.reload();
  await expect(page).toHaveURL(/#\/result\//);
  const after = await saved(page);
  expect(after).toHaveLength(1);
  expect(after[0].source).toEqual(before.source);

  // Skipping also opens the result without touching the data.
  await startCast(page, { method: '自動點沙（裝置亂數）', text: '第二次自動點沙' });
  await page.getByRole('button', { name: '開始自動點沙' }).click();
  await page.getByRole('button', { name: '略過動畫，看結果' }).click();
  await expect(page).toHaveURL(/#\/result\//);
  expect(await saved(page)).toHaveLength(2);
});

test('自動點沙：減少動態效果時不播放沙盤，直接顯示十六列與四母象', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await startCast(page, { method: '自動點沙（裝置亂數）' });
  await page.getByRole('button', { name: '開始自動點沙' }).click();
  await expect(page.getByText('十六列都落定了')).toBeVisible();
  await expect(page.locator('.sand-tray')).toHaveCount(0);
  await expect(page.locator('.mothers-strip figure')).toHaveCount(4);
  await page.getByRole('button', { name: '看盤面與解讀' }).click();
  await expect(page).toHaveURL(/#\/result\//);
});
