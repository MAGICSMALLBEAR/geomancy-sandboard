import { expect, test } from '@playwright/test';
import { fillManual, startCast } from './helpers.ts';

test('日誌回顧篩選隨網址、導覽與上一頁同步；重新整理保留選項', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await startCast(page, { method: '手動輸入四母象' });
  await fillManual(page);
  await page.getByRole('button', { name: '依這四母象排盤' }).click();
  await expect(page).toHaveURL(/#\/result\//);
  await page.getByRole('radio', { name: /部分相符/ }).check();
  await page.getByRole('button', { name: '保存回顧' }).click();
  await expect(page.getByText('回顧已保存。')).toBeVisible();

  await page.goto('./#/journal?review=due');
  const filter = page.getByLabel('後來怎樣了');
  const records = page.locator('.journal-item');
  await expect(filter).toHaveValue('due');
  await expect(records).toHaveCount(0);

  // Clicking the current page's navigation link must clear a reminder filter.
  await page.getByRole('navigation').getByRole('link', { name: '日誌' }).click();
  await expect(page).toHaveURL(/#\/journal$/);
  await expect(filter).toHaveValue('all');
  await expect(records).toHaveCount(1);
  await page.goBack();
  await expect(filter).toHaveValue('due');
  await expect(records).toHaveCount(0);
  await page.goForward();
  await expect(filter).toHaveValue('all');
  await expect(records).toHaveCount(1);

  await filter.selectOption('pending');
  await expect(page).toHaveURL(/review=pending/);
  await expect(records).toHaveCount(0);
  await filter.selectOption('partly');
  await expect(page).toHaveURL(/review=partly/);
  await expect(records).toHaveCount(1);
  await page.reload();
  await expect(filter).toHaveValue('partly');
  await expect(records).toHaveCount(1);

  // Every follow-up status is a valid deep link; unknown values show all records.
  for (const status of ['matched', 'not-matched', 'unclear']) {
    await page.goto(`./#/journal?review=${status}`);
    await expect(filter).toHaveValue(status);
    await expect(records).toHaveCount(0);
  }
  await page.goto('./#/journal?review=unknown');
  await expect(filter).toHaveValue('all');
  await expect(records).toHaveCount(1);
  await filter.selectOption('due');
  await filter.selectOption('all');
  await expect(page).toHaveURL(/#\/journal$/);
  await expect(records).toHaveCount(1);
});
