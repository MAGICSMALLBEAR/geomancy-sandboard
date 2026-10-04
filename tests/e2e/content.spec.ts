// R05 (DECISIONS D27/D29): a record keeps the reading text of the content version it was saved with.
import { expect, test } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { fillManual, startCast } from './helpers.ts';

const V1_BACKUP = fileURLToPath(new URL('../../fixtures/teaching-backup.json', import.meta.url));

test('R05：匯入的 v1 舊記錄照原樣顯示舊文字；新起的一盤用 v2 文字', async ({ page }) => {
  await page.goto('./#/settings');
  await page.getByLabel('選擇備份檔').setInputFiles(V1_BACKUP);
  const preview = page.getByRole('region', { name: '匯入預覽' });
  await expect(preview).toContainText('可匯入');
  await preview.getByRole('button', { name: /確認匯入 1 筆/ }).click();
  await expect(page.getByText('已匯入 1 筆記錄。')).toBeVisible();

  await page.goto('./#/journal');
  await page.locator('.journal-item').getByRole('link').click();
  await expect(page.getByText('本版尚未計算它與第 1 宮之間的成就關係。')).toBeVisible();
  await page.getByText('基礎象徵解讀・內容草稿').click();
  await expect(page.getByText('內容版本 zh-TW-basic-draft-v1')).toBeVisible();

  await startCast(page, { method: '手動輸入四母象' });
  await fillManual(page);
  await page.getByRole('button', { name: '排盤' }).click();
  await expect(page).toHaveURL(/#\/result\//);
  await expect(page.getByText('請看下方進階解讀的「成事關係」')).toBeVisible();
  await expect(page.getByText('本版尚未計算')).toHaveCount(0);
  await page.getByText('基礎象徵解讀・內容草稿').click();
  await expect(page.getByText('內容版本 zh-TW-basic-draft-v2')).toBeVisible();
});
