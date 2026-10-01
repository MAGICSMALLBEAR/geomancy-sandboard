// Advanced reading (DECISIONS D24): computed from the chart on display, never stored.
import { expect, test, type Page } from '@playwright/test';
import { FIXTURE_MOTHER_NAMES, fillManual, idbAll, startCast } from './helpers.ts';

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

const castManual = async (page: Page, names: string[], work = true) => {
  await startCast(page, { method: '手動輸入四母象', work });
  await fillManual(page, names);
  await page.getByRole('button', { name: '依這四母象排盤' }).click();
  await expect(page).toHaveURL(/#\/result\//);
  return page.getByRole('region', { name: /進階解讀/ });
};

test('教學例題：十二宮的象都不同，第 10 宮為不成事；點之道在裁判中斷；十二宮逐宮可展開', async ({ page }) => {
  const advanced = await castManual(page, FIXTURE_MOTHER_NAMES);
  await expect(advanced).toContainText('草稿');
  const perfection = advanced.locator('article').filter({ hasText: '成事關係' });
  await expect(perfection).toContainText('第 1 宮（你自己）是「少年」，第 10 宮（職位與公共角色）是「大幸運」');
  await expect(perfection).toContainText('不成事（Denial）');
  const way = advanced.locator('article').filter({ hasText: '點之道' });
  await expect(way).toContainText('裁判的火行是兩點');
  await expect(way).toContainText('中斷');

  await advanced.getByText('十二宮逐宮解讀').click();
  const houses = advanced.locator('.house-readings > li');
  await expect(houses).toHaveCount(12);
  await expect(houses.nth(0)).toContainText('你自己');
  await expect(houses.nth(9)).toContainText('問題宮');
  await expect(houses.nth(9)).toContainText('大幸運／Fortuna Major');

  // Nothing from the advanced layer is written into the saved record.
  const [record] = await idbAll<Record<string, unknown>>(page, 'readings');
  expect(JSON.stringify(record)).not.toMatch(/advanced|perfection|Denial|點之道/);
});

test('成事關係與點之道：列出接合與轉移，可跳到對應宮位，並在盾盤標出完整路徑', async ({ page }) => {
  const advanced = await castManual(page, ['喜悅／Laetitia', '道路／Via', '道路／Via', '道路／Via']);
  const perfection = advanced.locator('article').filter({ hasText: '成事關係' });
  await expect(perfection).toContainText('找到 3 個成事關係，最直接的是「接合（Conjunction）」');
  const hits = perfection.locator('.perfection-hits > li');
  await expect(hits).toHaveCount(3);
  await expect(hits.nth(0)).toContainText('也出現在第 11 宮，緊鄰所問的第 10 宮');
  await expect(hits.nth(1)).toContainText('也出現在第 12 宮，緊鄰第 1 宮');
  await expect(hits.nth(2)).toContainText('轉移（Mutation）');

  await hits.nth(0).getByRole('button', { name: '看第 11 宮' }).click();
  await expect(page.locator('.shield-node.is-selected')).toHaveCount(1);
  await expect(page.locator('.node-list > li.is-open')).toContainText('第三姪象');

  const way = advanced.locator('article').filter({ hasText: '點之道' });
  await expect(way).toContainText('裁判的火行是一點');
  await expect(way).toContainText('第 5 宮（戀愛與創作）的第一女象「道路」');
  await expect(way).toContainText('經過：裁判 → 左證人 → 第三姪象 → 第一女象');
  await way.getByRole('button', { name: '在盾盤上標出路徑' }).click();
  await expect(page.locator('.shield-node.is-path')).toHaveCount(4);
  await expect(page.locator('.shield-line.is-path')).toHaveCount(3);
  await expect(page.getByRole('button', { name: /第一女象：.*點之道經過/ })).toBeVisible();
  await way.getByRole('button', { name: '取消盾盤上的路徑' }).click();
  await expect(page.locator('.shield-node.is-path')).toHaveCount(0);
});

test('一般反思沒有問題宮：不判斷成事關係並說明原因', async ({ page }) => {
  const advanced = await castManual(page, FIXTURE_MOTHER_NAMES, false);
  await expect(advanced.locator('article').filter({ hasText: '成事關係' })).toContainText('沒有選定問題宮，所以不判斷');
  await advanced.getByText('十二宮逐宮解讀').click();
  await expect(advanced.locator('.house-readings > li .tag', { hasText: '問題宮' })).toHaveCount(0);
});
