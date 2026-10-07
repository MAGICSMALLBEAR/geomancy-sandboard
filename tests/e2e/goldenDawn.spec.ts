// 0.12.0: Golden Dawn house rule chosen in settings (DECISIONS D41).
import { expect, test } from '@playwright/test';
import { fillManual, idbAll, noHorizontalOverflow, startCast } from './helpers.ts';

test('Golden Dawn：設定切換後新的占問用它入宮；舊記錄維持原配置；分享連結帶著配置', async ({ page, browser }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  // One record under the default rule first.
  await startCast(page, { method: '手動輸入四母象', text: '順序入宮的盤' });
  await fillManual(page);
  await page.getByRole('button', { name: '依這四母象排盤' }).click();
  await expect(page).toHaveURL(/#\/result\//);

  await page.goto('./#/settings');
  await page.getByRole('radio', { name: /Golden Dawn 入宮/ }).check();
  await page.goto('./#/new');
  await expect(page.getByText(/宮位配置：Golden Dawn 入宮/)).toBeVisible();
  await startCast(page, { method: '手動輸入四母象', text: 'Golden Dawn 的盤' });
  await fillManual(page);
  await page.getByRole('button', { name: '依這四母象排盤' }).click();
  await expect(page).toHaveURL(/#\/result\//);
  await expect(page.locator('.result-header, header').getByText(/Golden Dawn 入宮/).first()).toBeVisible();

  // House view: house 1 holds the second mother, house 10 (the chosen house) the first mother.
  await page.getByRole('button', { name: '十二宮', exact: true }).click();
  const cards = page.locator('.house-grid > li');
  await expect(cards.nth(0)).toContainText('來源盤位：第二母象（M2）');
  await expect(cards.nth(9)).toContainText('來源盤位：第一母象（M1）');
  await expect(cards.nth(9)).toContainText('你選的問題宮');
  await noHorizontalOverflow(page);

  const records = await idbAll<{ question: { text: string }; ruleVersion: string; reading: { ruleVersion: string } }>(page, 'readings');
  const byText = Object.fromEntries(records.map(r => [r.question.text, r]));
  expect(byText['順序入宮的盤']).toMatchObject({ ruleVersion: 'western-sequential-v1', reading: { ruleVersion: 'western-sequential-v1' } });
  expect(byText['Golden Dawn 的盤']).toMatchObject({ ruleVersion: 'western-golden-dawn-v1', reading: { ruleVersion: 'western-golden-dawn-v1' } });

  await page.getByRole('button', { name: '分享連結' }).click();
  const link = await page.getByRole('dialog').getByLabel('連結', { exact: true }).inputValue();
  expect(link).toContain('&r=gd');
  const other = await browser.newContext({ locale: 'zh-TW', reducedMotion: 'reduce' });
  const viewer = await other.newPage();
  await viewer.goto(link);
  await expect(viewer.getByText(/Golden Dawn 入宮/).first()).toBeVisible();
  await viewer.getByRole('button', { name: '十二宮', exact: true }).click();
  await expect(viewer.locator('.house-grid > li').nth(0)).toContainText('第二母象（M2）');
  await other.close();

  // The journal marks the Golden Dawn record only.
  await page.keyboard.press('Escape');
  await page.goto('./#/journal');
  await expect(page.locator('.journal-item', { hasText: 'Golden Dawn 的盤' })).toContainText('Golden Dawn 入宮');
  await expect(page.locator('.journal-item', { hasText: '順序入宮的盤' })).not.toContainText('Golden Dawn');
});

test('十二宮與盤位：並列兩種入宮方式', async ({ page }) => {
  await page.goto('./#/learn/houses');
  const table = page.getByRole('table', { name: '每一宮放的是哪個盤位' });
  await expect(table.getByRole('row', { name: /第 1 宮/ })).toContainText('第一母象');
  await expect(table.getByRole('row', { name: /第 1 宮/ })).toContainText('第二母象');
  await expect(table.getByRole('row', { name: /第 10 宮/ })).toContainText('第二姪象');
  await expect(table.getByRole('row', { name: /第 10 宮/ })).toContainText('第一母象');
  await noHorizontalOverflow(page);
});
