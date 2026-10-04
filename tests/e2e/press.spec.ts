// Four long presses (DECISIONS D28): a byte is drawn only when a full press is released, and saved at once.
import { expect, test, type Page } from '@playwright/test';
import { expectFixtureChart, idbAll, startCast } from './helpers.ts';

/** The teaching fixture's four mothers as press bytes (top four bits). */
const FIXTURE_BYTES = [0b1101_0110, 0b0111_0000, 0b0001_1111, 0b0010_1001];

/** Feeds the given bytes to single-byte draws and counts them; record IDs (16 bytes) pass through untouched. */
async function scriptedBytes(page: Page, bytes: number[]) {
  await page.addInitScript((queue: number[]) => {
    const w = window as unknown as { draws: number; failDraftPutOnce: boolean };
    w.draws = 0;
    w.failDraftPutOnce = false;
    const real = crypto.getRandomValues.bind(crypto);
    crypto.getRandomValues = ((array: Uint8Array<ArrayBuffer>) => {
      if (array instanceof Uint8Array && array.length === 1) {
        array[0] = queue[w.draws % queue.length];
        w.draws += 1;
        return array;
      }
      return real(array);
    }) as typeof crypto.getRandomValues;
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (this: IDBObjectStore, ...args: Parameters<IDBObjectStore['put']>) {
      if (this.name === 'drafts' && w.failDraftPutOnce) {
        w.failDraftPutOnce = false;
        throw new DOMException('injected failure', 'UnknownError');
      }
      return put.apply(this, args);
    };
  }, bytes);
}
const draws = (page: Page) => page.evaluate(() => (window as unknown as { draws: number }).draws);

async function hold(page: Page, ms: number) {
  const box = (await page.locator('.press-pad').boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(ms);
  await page.mouse.up();
}
async function fullPress(page: Page, nth: number) {
  await hold(page, 1200);
  if (nth < 4) {
    await expect(page.getByRole('heading', { name: /母象完成/ })).toBeVisible();
    await page.getByRole('button', { name: /^繼續第.次長按$/ }).click();
  }
}

test('四次長按：短按不算也不取數；四次完整長按得到固定例題，每次只取一個位元組', async ({ page }) => {
  await scriptedBytes(page, FIXTURE_BYTES);
  await startCast(page, { method: '四次長按（裝置亂數）' });
  await expect(page.locator('.press-pad')).toBeVisible();

  await hold(page, 250);
  await expect(page.getByText('再按久一點')).toBeVisible();
  expect(await draws(page)).toBe(0);

  await fullPress(page, 1);
  expect(await draws(page)).toBe(1);
  const [draft] = await idbAll<{ confirmedPresses: number[] }>(page, 'drafts');
  expect(draft.confirmedPresses).toEqual([FIXTURE_BYTES[0]]);
  await expect(page.locator('.mothers-strip figure')).toHaveCount(1);

  for (let n = 2; n <= 4; n++) await fullPress(page, n);
  await expect(page).toHaveURL(/#\/result\//);
  expect(await draws(page)).toBe(4);
  const [record] = await idbAll<{ source: { kind: string; bytes: number[] } }>(page, 'readings');
  expect(record.source).toEqual({ kind: 'press', algorithm: 'webcrypto-press-v1', bytes: FIXTURE_BYTES });
  await expectFixtureChart(page);
  await page.locator('.node-list .node-row').first().click();
  await expect(page.locator('.node-list > li').first()).toContainText('第一次長按放開時，由裝置亂數取一個位元組（214）');
});

test('四次長按：兩次後重新整理，保留前兩次；保存失敗用同一個結果重試，不再取數', async ({ page }) => {
  await scriptedBytes(page, FIXTURE_BYTES);
  await startCast(page, { method: '四次長按（裝置亂數）' });
  await fullPress(page, 1);
  await fullPress(page, 2);
  await page.reload();
  await expect(page.getByText('已保留前 2 次長按，從第 3 次繼續。')).toBeVisible();
  await expect(page.locator('.mothers-strip figure')).toHaveCount(2);

  await page.evaluate(() => { (window as unknown as { failDraftPutOnce: boolean }).failDraftPutOnce = true; });
  const before = await draws(page);
  await hold(page, 1200);
  await expect(page.getByText('這一次長按的結果已固定但尚未保存')).toBeVisible();
  expect(await draws(page)).toBe(before + 1);
  await page.getByRole('button', { name: '用同一個結果重試保存' }).click();
  await expect(page.getByRole('heading', { name: '第三母象完成' })).toBeVisible();
  expect(await draws(page)).toBe(before + 1);

  await page.getByRole('button', { name: '繼續第四次長按' }).click();
  await hold(page, 1200);
  await expect(page).toHaveURL(/#\/result\//);
  expect(await idbAll(page, 'readings')).toHaveLength(1);
});

test('四次長按：鍵盤按住空白鍵也能完成，按住時的自動重複不會多算', async ({ page }) => {
  await scriptedBytes(page, FIXTURE_BYTES);
  await startCast(page, { method: '四次長按（裝置亂數）' });
  const pad = page.locator('.press-pad');
  await pad.focus();
  await page.keyboard.down(' ');
  await page.waitForTimeout(600);
  await page.keyboard.down(' '); // auto-repeat while held
  await page.waitForTimeout(600);
  await page.keyboard.up(' ');
  await expect(page.getByRole('heading', { name: '第一母象完成' })).toBeVisible();
  expect(await draws(page)).toBe(1);
});
