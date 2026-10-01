import { expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

export const fixture = JSON.parse(readFileSync(new URL('../../fixtures/teaching.json', import.meta.url), 'utf8')) as {
  counts: number[];
  expectedDots: Record<string, string>;
  question: { text: string; timeframe: string; topic: string; targetHouse: number };
};
export const NODE_ORDER = ['M1', 'M2', 'M3', 'M4', 'D1', 'D2', 'D3', 'D4', 'N1', 'N2', 'N3', 'N4', 'RW', 'LW', 'J', 'R'];
/** The fixture's four mothers by catalogue name, for the manual method. */
export const FIXTURE_MOTHER_NAMES = ['少年／Puer', '龍首／Caput Draconis', '悲傷／Tristitia', '白／Albus'];

type Method = '十六列點沙' | '快速起卦（裝置亂數）' | '手動輸入四母象';
export async function startCast(page: Page, options: { text?: string; method: Method; work?: boolean }) {
  await page.goto('./#/new');
  await page.getByLabel('你想問什麼？').fill(options.text ?? fixture.question.text);
  if (options.work ?? true) {
    await page.getByLabel('時間範圍（選填）').fill(fixture.question.timeframe);
    await page.getByRole('radio', { name: '工作' }).check();
    await page.getByRole('radio', { name: /職位／發展/ }).check();
  }
  await page.getByRole('radio', { name: new RegExp(options.method.replace(/[（）]/g, '.')) }).check();
  await page.getByRole('button', { name: '開始起卦' }).click();
  await expect(page).toHaveURL(/#\/cast\//);
  return page.url().split('/cast/')[1];
}

/** Real mouse input: each click produces pointerdown, pointerup and the browser's own click event. */
export async function tapTray(page: Page, times: number) {
  const tray = page.locator('.sand-tray');
  await tray.scrollIntoViewIfNeeded();
  const box = (await tray.boundingBox())!;
  for (let i = 0; i < times; i++) {
    await page.mouse.click(box.x + 24 + ((i * 37) % (box.width - 48)), box.y + 24 + ((i * 53) % (box.height - 90)));
  }
}

export async function castRows(page: Page, counts: number[], fromRow = 0) {
  for (let i = 0; i < counts.length; i++) {
    const row = fromRow + i + 1;
    await tapTray(page, counts[i]);
    await page.getByRole('button', { name: '完成這列' }).click();
    if (row === 16) break;
    if (row % 4 === 0) await page.getByRole('button', { name: /^繼續第/ }).click();
    await expect(page.getByText(`全部第 ${row + 1}／16 列`)).toBeVisible();
    // With full motion the tray stays locked while the row's reduction is shown.
    await expect(page.locator('.sand-tray:not(.is-locked)')).toBeVisible();
  }
}

export async function fillManual(page: Page, names: string[] = FIXTURE_MOTHER_NAMES) {
  for (let i = 0; i < names.length; i++) await page.getByLabel('或選象名').nth(i).selectOption({ label: names[i] });
}

export function idbAll<T = Record<string, unknown>>(page: Page, store: string): Promise<T[]> {
  return page.evaluate(name => new Promise<unknown[]>((resolve, reject) => {
    const open = indexedDB.open('geomancy-local');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const request = open.result.transaction(name).objectStore(name).getAll();
      request.onsuccess = () => { open.result.close(); resolve(request.result); };
      request.onerror = () => reject(request.error);
    };
  }), store) as Promise<T[]>;
}

/** Every position against the fixture, read from the on-screen list (not only the judge). */
export async function expectFixtureChart(page: Page) {
  await page.getByLabel(/顯示調和者/).check();
  const rows = page.locator('.node-list > li');
  await expect(rows).toHaveCount(16);
  for (let i = 0; i < NODE_ORDER.length; i++) {
    await expect(rows.nth(i)).toContainText(`圖式 ${fixture.expectedDots[NODE_ORDER[i]]}`);
  }
}

export async function noHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}
