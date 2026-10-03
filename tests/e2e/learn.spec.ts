// Learning pages: hub, figure structure, houses guide and the step-by-step practice.
import { expect, test } from '@playwright/test';
import { idbAll, noHorizontalOverflow } from './helpers.ts';

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

test('教學首頁連到三個學習頁；十六象頁顯示四行、點數、裁判可能性與相關的象', async ({ page }) => {
  await page.goto('./#/learn');
  for (const name of ['推盤練習', '十二宮與盤位', '固定教學例題']) {
    await expect(page.locator('.learn-link').filter({ hasText: name })).toBeVisible();
  }
  await expect(page.locator('.figure-tile')).toHaveCount(16);

  await page.goto('./#/learn/fortuna-major');
  await expect(page.locator('.element-rows li')).toHaveText([/火行兩點/, /風行兩點/, /水行一點/, /土行一點/]);
  await expect(page.getByText('共 6 點，是偶數。')).toBeVisible();
  await expect(page.getByText(/可能出現在裁判的位置/)).toBeVisible();
  const related = page.locator('.related-figures li');
  await expect(related.nth(0)).toContainText('小幸運');
  await related.nth(0).getByRole('link').click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Fortuna Minor');
  await expect(page.getByText(/不會出現在裁判的位置/)).toHaveCount(0);

  await page.goto('./#/learn/puella');
  await expect(page.getByText(/不會出現在裁判的位置/)).toBeVisible();

  await page.goto('./#/learn/via');
  await expect(page.locator('.related-figures li').nth(1)).toContainText('還是「道路」本身');
  await page.getByRole('navigation', { name: '切換象' }).getByRole('link', { name: /群眾/ }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Populus');
});

test('十二宮與盤位：十六個位置的來源與十二宮說明', async ({ page }) => {
  await page.goto('./#/learn/houses');
  await expect(page.getByRole('heading', { level: 1, name: '十二宮與盤位' })).toBeVisible();
  await expect(page.locator('.house-guide > li')).toHaveCount(12);
  await expect(page.locator('.house-guide > li').nth(9)).toContainText('第 10 宮');
  await expect(page.locator('.house-guide > li').nth(9)).toContainText('工作：職位／發展');
  await expect(page.locator('.role-nodes li')).toHaveCount(16);
  await expect(page.locator('.role-nodes li').nth(8)).toHaveText('第一姪象（N1）＝第一母象＋第二母象・第 9 宮');
  await expect(page.locator('.role-nodes li').nth(14)).toHaveText('裁判（J）＝右證人＋左證人・不入宮');
  await noHorizontalOverflow(page);
});

test('推盤練習：逐步推出教學例題、改母象後跟著變、對答案計分，且不寫入資料庫', async ({ page }) => {
  await page.goto('./#/learn/practice');
  await expect(page.locator('.manual-preview')).toHaveText([/少年/, /龍首/, /悲傷/, /白/]);

  await page.getByRole('button', { name: '下一步：四女象：轉置' }).click();
  await expect(page.getByRole('heading', { name: /第 2 步/ })).toBeFocused();
  await expect(page.locator('.practice-node h3')).toHaveText([/喜悅/, /小幸運/, /獲得/, /龍尾/]);
  await expect(page.locator('.practice-node').first()).toContainText('第一母象的第一行是一點 → 這裡的第一行');

  await page.getByRole('button', { name: '5. 裁判' }).click();
  await expect(page.locator('.practice-node h3')).toHaveText(['裁判（J）：交會／Conjunctio']);

  // Changing a mother changes everything after it: M1 fire row one dot → two dots (Puer 1121 → Acquisitio 2121).
  await page.getByRole('button', { name: '1. 四母象' }).click();
  await page.getByRole('radiogroup', { name: '第一母象第一行（火）' }).getByRole('radio', { name: /兩點/ }).click();
  await expect(page.locator('.manual-preview').first()).toContainText('獲得');
  await page.getByRole('button', { name: '2. 四女象：轉置' }).click();
  await expect(page.locator('.practice-node h3').first()).toContainText('群眾');

  // Quiz: judge of the teaching example is Conjunctio 2112; answer one row wrong.
  await page.getByRole('button', { name: '1. 四母象' }).click();
  await page.getByRole('button', { name: '回到教學例題' }).click();
  await page.getByLabel(/先自己算，再對答案/).check();
  await page.getByRole('button', { name: '5. 裁判' }).click();
  const judge = page.locator('.practice-node');
  await expect(judge.locator('h3')).toHaveText('裁判（J）');
  const check = judge.getByRole('button', { name: '對答案' });
  await expect(check).toBeDisabled();
  for (const [row, choice] of [['火', '兩點'], ['風', '一點'], ['水', '一點'], ['土', '一點']]) {
    await judge.getByRole('radiogroup', { name: new RegExp(`（${row}）你的答案`) }).getByRole('radio', { name: new RegExp(choice) }).click();
  }
  await check.click();
  await expect(judge.locator('h3')).toContainText('交會');
  await expect(judge.locator('.is-wrong')).toHaveText('✗ 土行：你選了一點，正確是兩點');
  await expect(page.getByText('目前答對 3／4 行。')).toBeVisible();

  // The full shield only appears once the reconciler is answered.
  await page.getByRole('button', { name: '6. 調和者與完整盾盤' }).click();
  await expect(page.getByText('對完調和者的答案後顯示整張盾盤。')).toBeVisible();
  await page.getByLabel(/先自己算，再對答案/).uncheck();
  await page.getByRole('button', { name: /^右證人：/ }).click();
  await expect(page.locator('.practice-detail')).toContainText('第一姪象（N1）＋第二姪象（N2）逐行合成');

  expect(await idbAll(page, 'readings')).toHaveLength(0);
  expect(await idbAll(page, 'drafts')).toHaveLength(0);
  await noHorizontalOverflow(page);
});
