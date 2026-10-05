// Browser zoom and large text, emulated: a zoomed window is a narrower, shorter CSS viewport at a higher
// pixel ratio; "text only" scales the root font size. This checks layout, not what a person perceives.
import { expect, test, type Locator, type Page } from '@playwright/test';
import { fillManual, noHorizontalOverflow, startCast, tapTray } from './helpers.ts';

const SCENARIOS = [
  { name: '瀏覽器 200%（1280×680 視窗）', viewport: { width: 640, height: 340 }, deviceScaleFactor: 2, text: false },
  { name: '瀏覽器 400% 重排（320 px 寬）', viewport: { width: 320, height: 170 }, deviceScaleFactor: 4, text: false },
  { name: '只放大文字 200%', viewport: { width: 1280, height: 680 }, deviceScaleFactor: 1, text: true },
];

/** Text cut off by overflow, and pinned bars that cover too much of the screen. */
async function layoutProblems(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const problems: string[] = [];
    for (const el of Array.from(document.querySelectorAll<HTMLElement>('body *'))) {
      // Screen-reader-only text, the scrollable shield and the sand tray clip on purpose.
      if (el.closest('.sr-only, .shield-scroll, .sand-tray')) continue;
      const style = getComputedStyle(el);
      // Journal titles and the question above the sand tray are clamped to three lines by design (DECISIONS D18):
      // the full question is on the result page.
      const byDesign = el.classList.contains('record-link') || Boolean(el.closest('.cast-head'));
      const clamped = style.webkitLineClamp !== 'none' && style.webkitLineClamp !== '' && !byDesign;
      if (((style.overflowX === 'hidden' || style.overflowX === 'clip') && el.scrollWidth > el.clientWidth + 1 && el.textContent?.trim())
        || (clamped && el.scrollHeight > el.clientHeight + 1)) {
        problems.push(`被裁切：.${el.className}`);
      }
      const box = el.getBoundingClientRect();
      if ((style.position === 'sticky' || style.position === 'fixed') && box.height > 0 && el.tagName !== 'DIALOG'
        && box.height > innerHeight * 0.4) {
        problems.push(`固定區塊佔畫面 ${Math.round(box.height / innerHeight * 100)}%：.${el.className}`);
      }
    }
    return problems;
  });
}

/** Scrolled into view, the control is on screen and is what a tap at its centre would hit. */
async function reachable(control: Locator) {
  await control.scrollIntoViewIfNeeded();
  await expect(control).toBeInViewport();
  expect(await control.evaluate(el => {
    const box = el.getBoundingClientRect();
    const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
    return Boolean(hit && (hit === el || el.contains(hit)));
  })).toBe(true);
}

for (const scenario of SCENARIOS) {
  test(`縮放：${scenario.name}，主要頁面不橫向溢出、不裁切文字，主要按鈕可捲到並點得到`, async ({ browser }, testInfo) => {
    const context = await browser.newContext({
      baseURL: testInfo.project.use.baseURL, viewport: scenario.viewport,
      deviceScaleFactor: scenario.deviceScaleFactor, reducedMotion: 'reduce', locale: 'zh-TW',
    });
    const page = await context.newPage();
    if (scenario.text) {
      await page.addInitScript(() => document.addEventListener('DOMContentLoaded', () => { document.documentElement.style.fontSize = '200%'; }));
    }
    const check = async (where: string) => {
      await noHorizontalOverflow(page);
      expect(await layoutProblems(page), where).toEqual([]);
    };

    await page.goto('./');
    await check('首頁');
    await startCast(page, { method: '十六列點沙' });
    await tapTray(page, 3);
    await check('點沙');
    for (const name of ['加入一點', '清空本列', '完成這列']) await reachable(page.getByRole('button', { name }));
    await page.getByRole('button', { name: '完成這列' }).click();
    await expect(page.getByText('全部第 2／16 列')).toBeVisible();

    await page.getByRole('button', { name: '放棄這筆草稿' }).click();
    const dialog = page.getByRole('dialog');
    await reachable(dialog.getByRole('button', { name: '放棄草稿' }));
    await dialog.getByRole('button', { name: '放棄草稿' }).click();
    await check('新增占問');
    await reachable(page.getByRole('button', { name: '開始起卦' }));

    await startCast(page, { method: '手動輸入四母象' });
    await fillManual(page);
    await check('手動輸入');
    await reachable(page.getByRole('button', { name: '依這四母象排盤' }));
    await page.getByRole('button', { name: '依這四母象排盤' }).click();
    await expect(page).toHaveURL(/#\/result\//);
    await check('結果');
    // Below 900 CSS px the result is split into tabs (see the layout test in interaction.spec.ts).
    if (scenario.viewport.width < 900) await page.getByRole('button', { name: '筆記', exact: true }).click();
    await page.getByLabel('寫下回顧').fill('放大後寫的筆記');
    await reachable(page.getByRole('button', { name: '保存筆記' }));
    await page.getByRole('button', { name: '保存筆記' }).click();
    await expect(page.getByText('筆記已保存。')).toBeVisible();

    for (const [hash, label] of [['journal', '日誌'], ['settings', '設定'], ['learn', '教學'], ['learn/example', '教學例題'], ['learn/houses', '十二宮與盤位'], ['learn/practice', '推盤練習'], ['learn/try', '試畫區'], ['learn/customs', '古典禁例']]) {
      await page.goto(`./#/${hash}`);
      await expect(page.locator('h1').first()).toBeVisible();
      await check(label);
    }
    await reachable(page.getByRole('link', { name: '設定' }));
    await context.close();
  });
}
