import { expect, test } from '@playwright/test';
import { idbAll, startCast } from './helpers.ts';

// Touch emulation in desktop Chromium. This is not a real phone and does not replace device testing.
test.use({ hasTouch: true, isMobile: true, viewport: { width: 360, height: 740 } });

test('觸控模擬：手指輕點各算一點；沙盤以外的頁面仍可捲動', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await startCast(page, { method: '十六列點沙', work: false });
  const tray = page.locator('.sand-tray');
  await tray.scrollIntoViewIfNeeded();
  const box = (await tray.boundingBox())!;
  for (let i = 0; i < 5; i++) await page.touchscreen.tap(box.x + 40 + i * 50, box.y + 60 + i * 20);
  await page.getByRole('button', { name: '完成這列' }).tap();
  await expect(page.getByText('全部第 2／16 列')).toBeVisible();
  expect((await idbAll<{ confirmedCounts: number[] }>(page, 'drafts'))[0].confirmedCounts).toEqual([5]);

  expect(await tray.evaluate(element => getComputedStyle(element).touchAction)).toBe('none');
  expect(await page.evaluate(() => getComputedStyle(document.body).touchAction)).toBe('auto');
});
