// 0.12.0: share a chart by link (DECISIONS D40).
import { expect, test } from '@playwright/test';
import { expectFixtureChart, fillManual, fixture, idbAll, noHorizontalOverflow, startCast } from './helpers.ts';

test('分享連結：預設不含問題；在全新的瀏覽器開啟得到同一張盤，不寫入日誌；勾選後才帶問題且以純文字顯示', async ({ page, browser }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await startCast(page, { method: '手動輸入四母象', text: '<img src=x onerror="window.pwned=1">面試順利嗎？' });
  await fillManual(page);
  await page.getByRole('button', { name: '依這四母象排盤' }).click();
  await expect(page).toHaveURL(/#\/result\//);

  await page.getByRole('button', { name: '分享連結' }).click();
  const dialog = page.getByRole('dialog');
  const field = dialog.getByLabel('連結', { exact: true });
  const plain = await field.inputValue();
  expect(plain).toMatch(/#\/shared\?v=1&m=[12]{16}&t=work&h=10$/);
  expect(plain).not.toContain('q=');
  await dialog.getByLabel('在連結中加入問題文字').check();
  await expect(dialog.getByText(/問題文字會直接寫在網址裡/)).toBeVisible();
  const withQuestion = await field.inputValue();
  expect(withQuestion).toContain('&q=');

  const other = await browser.newContext({ locale: 'zh-TW', reducedMotion: 'reduce' });
  const viewer = await other.newPage();
  await viewer.goto(plain);
  await expect(viewer.getByText('別人分享的盤面')).toBeVisible();
  await expect(viewer.getByRole('heading', { level: 1 })).toHaveText('（分享者沒有附上問題）');
  await expect(viewer.getByText('分享的盤面', { exact: true })).toBeVisible();
  await expect(viewer.getByRole('heading', { name: /裁判：交會/ })).toBeVisible();
  await expectFixtureChart(viewer);
  await viewer.locator('.node-list .node-row').first().click();
  await expect(viewer.locator('.node-list > li').first()).toContainText('分享的盤面：這個母象來自分享連結');
  expect(await idbAll(viewer, 'readings')).toEqual([]);
  expect(await idbAll(viewer, 'drafts')).toEqual([]);
  await noHorizontalOverflow(viewer);

  await viewer.goto(withQuestion);
  await expect(viewer.getByRole('heading', { level: 1 })).toHaveText('<img src=x onerror="window.pwned=1">面試順利嗎？');
  expect(await viewer.evaluate(() => (window as unknown as { pwned?: number }).pwned)).toBeUndefined();
  await other.close();
  expect(fixture.question.targetHouse).toBe(10);
});

test('分享連結：損壞的連結顯示說明，不顯示盤面', async ({ page }) => {
  await page.goto('./#/shared?v=1&m=11212212211211&t=work&h=10');
  await expect(page.getByRole('heading', { name: '無法開啟這個分享連結' })).toBeVisible();
  await page.goto('./#/shared?v=1&m=1121221221121122&t=general&h=10');
  await expect(page.getByRole('heading', { name: '無法開啟這個分享連結' })).toBeVisible();
  await expect(page.getByRole('heading', { name: /裁判/ })).toHaveCount(0);
});
