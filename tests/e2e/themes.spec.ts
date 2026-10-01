// Visual themes (DECISIONS D23): display only, remembered locally, never part of the data.
import { expect, test } from '@playwright/test';
import { fillManual, idbAll, noHorizontalOverflow, startCast, tapTray } from './helpers.ts';

const THEMES = [
  { id: 'sand', name: '安靜沙盤', bg: 'rgb(238, 230, 213)' },
  { id: 'manuscript', name: '古典手稿', bg: 'rgb(239, 227, 198)' },
  { id: 'ritual', name: '現代儀式', bg: 'rgb(19, 17, 25)' },
];

test('主題：預設安靜沙盤；切換後立即套用、重新整理仍保留，記錄內容不受影響', async ({ page }) => {
  await page.goto('./#/settings');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'sand');
  for (const theme of THEMES) {
    await page.getByRole('radio', { name: new RegExp(theme.name) }).check();
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme.id);
    await expect.poll(() => page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe(theme.bg);
  }
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'ritual');
  await expect(page.getByRole('radio', { name: /現代儀式/ })).toBeChecked();

  await startCast(page, { method: '手動輸入四母象' });
  await fillManual(page);
  await page.getByRole('button', { name: '依這四母象排盤' }).click();
  await expect(page).toHaveURL(/#\/result\//);
  const [record] = await idbAll<Record<string, unknown>>(page, 'readings');
  expect(JSON.stringify(record)).not.toContain('ritual');
});

for (const theme of THEMES) {
  test(`主題 ${theme.name}：點沙與結果在 360 px 不橫向溢出，沙盤用主題色`, async ({ page }, testInfo) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto('./#/settings');
    await page.getByRole('radio', { name: new RegExp(theme.name) }).check();
    const shot = async (name: string) => {
      await noHorizontalOverflow(page);
      if (testInfo.project.name === 'chromium') await page.screenshot({ path: `docs/evidence/theme-${theme.id}-${name}-360.png`, fullPage: true });
    };
    await startCast(page, { method: '十六列點沙' });
    await tapTray(page, 5);
    // The canvas paints its background from the theme's --sand-base token.
    const pixel = await page.locator('.sand-canvas').evaluate(canvas => {
      const c = canvas as HTMLCanvasElement;
      const [r, g, b] = c.getContext('2d')!.getImageData(2, 2, 1, 1).data;
      return [r, g, b];
    });
    const expected = await page.evaluate(() => getComputedStyle(document.querySelector('.sand-canvas')!).getPropertyValue('--sand-base').trim());
    expect('#' + pixel.map(n => n.toString(16).padStart(2, '0')).join('').toUpperCase()).toBe(expected.toUpperCase());
    await shot('cast');
    await page.getByRole('button', { name: '放棄這筆草稿' }).click();
    await page.getByRole('dialog').getByRole('button', { name: '放棄草稿' }).click();
    await startCast(page, { method: '手動輸入四母象' });
    await fillManual(page);
    await page.getByRole('button', { name: '依這四母象排盤' }).click();
    await expect(page).toHaveURL(/#\/result\//);
    await shot('result');
    await page.getByRole('button', { name: '盤面', exact: true }).click();
    await shot('chart');
  });
}
