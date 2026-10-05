// 0.8.0: trial tray, aspects and recurring figures, the "what happened afterwards" follow-up, home theme picker.
import { expect, test } from '@playwright/test';
import { fillManual, idbAll, noHorizontalOverflow, startCast } from './helpers.ts';

test('試畫區：點沙、完成四列得到一個象，不建立草稿也不寫入記錄', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./#/learn/try');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('試畫區：先練習點沙');
  const counts = [3, 2, 1, 4]; // odd, even, odd, even → 1-2-1-2 = Amissio
  for (const n of counts) {
    const box = (await page.locator('.sand-tray').boundingBox())!;
    for (let i = 0; i < n; i++) await page.mouse.click(box.x + 30 + i * 35, box.y + 40);
    await expect(page.getByText(`目前 ${n} 點`)).toBeVisible();
    await page.getByRole('button', { name: '完成這列' }).click();
  }
  await expect(page.getByRole('heading', { name: '你點出了一個象' })).toBeVisible();
  await expect(page.getByText('失去／Amissio')).toBeVisible();
  expect(await idbAll(page, 'drafts')).toEqual([]);
  expect(await idbAll(page, 'readings')).toEqual([]);
  await page.getByRole('button', { name: '再練習一次' }).click();
  await expect(page.getByText('練習第 1 列')).toBeVisible();
});

test('結果頁：相位、象的重現與十二宮圓盤；寫回顧後日誌可依回顧篩選', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await startCast(page, { method: '手動輸入四母象' });
  await fillManual(page);
  await page.getByRole('button', { name: '依這四母象排盤' }).click();
  await expect(page).toHaveURL(/#\/result\//);

  // Verdict panel and the new advanced cards (teaching chart: house 1 and 10 square, no recurring figures).
  await expect(page.getByRole('heading', { name: /裁判：交會/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: '相位', exact: true })).toBeVisible();
  await expect(page.getByText(/第 1 宮與第 10 宮相隔形成四分相/)).toBeVisible();
  await expect(page.getByRole('heading', { name: '象的重現' })).toBeVisible();
  await page.getByRole('button', { name: '十二宮', exact: true }).click();
  await expect(page.getByRole('img', { name: /十二宮圓盤。第 1 宮與第 10 宮為四分相/ })).toBeVisible();
  await expect(page.locator('.hw-aspect.is-base')).toHaveCount(1);

  // Follow-up.
  await page.getByRole('radio', { name: /部分相符/ }).check();
  await page.getByLabel('實際發生了什麼？（選填）').fill('<b>面試</b>有進展');
  await page.getByRole('button', { name: '保存回顧' }).click();
  await expect(page.getByText('回顧已保存。')).toBeVisible();
  await expect(page.getByText('<b>面試</b>有進展')).toBeVisible();
  const [record] = await idbAll<{ outcome?: { status: string; text: string } }>(page, 'readings');
  expect(record.outcome).toMatchObject({ status: 'partly', text: '<b>面試</b>有進展' });

  await page.reload();
  await expect(page.locator('.outcome .outcome-badge')).toHaveText('部分相符');

  await page.goto('./#/journal');
  await expect(page.locator('.journal-item .outcome-badge')).toHaveText('部分相符');
  await page.getByLabel('後來怎樣了').selectOption({ label: '尚未寫回顧' });
  await expect(page.locator('.journal-item')).toHaveCount(0);
  await page.getByLabel('後來怎樣了').selectOption({ label: '部分相符' });
  await expect(page.locator('.journal-item')).toHaveCount(1);

  // Remove it again.
  await page.locator('.journal-item').getByRole('link').click();
  await page.getByRole('button', { name: '刪除回顧' }).click();
  await expect(page.getByRole('button', { name: '保存回顧' })).toBeVisible();
  const [after] = await idbAll<{ outcome?: unknown }>(page, 'readings');
  expect(after.outcome).toBeUndefined();
});

test('首頁：可直接切換三種主題，360 px 不橫向溢出', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto('./#/');
  for (const [name, id] of [['古典手稿', 'manuscript'], ['現代儀式', 'ritual'], ['安靜沙盤', 'sand']]) {
    await page.getByRole('radio', { name: new RegExp(name) }).check();
    await expect(page.locator('html')).toHaveAttribute('data-theme', id);
    await noHorizontalOverflow(page);
  }
  await page.getByRole('link', { name: '先到試畫區練習' }).click();
  await expect(page).toHaveURL(/#\/learn\/try/);
});
