// 0.9.0: original question text, halted-chart note and customs page, vibration setting, planetary rulers.
import { expect, test } from '@playwright/test';
import { FIXTURE_MOTHER_NAMES, fillManual, idbAll, startCast } from './helpers.ts';

test('原句與整理後的問題：多問句提示、帶入、兩者都保存，結果頁可展開原句', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./#/new');
  await page.getByText('先把心裡的話寫下來（選填）').click();
  const original = '最近工作很累，要不要換工作？還是先撐到年底？';
  await page.getByLabel('心裡的話（選填）').fill(original);
  await expect(page.getByText('看起來不只一個問題')).toBeVisible();
  await page.getByRole('button', { name: '帶入下方再修改' }).click();
  await expect(page.getByLabel('你想問什麼？')).toHaveValue(original);
  await page.getByLabel('你想問什麼？').fill('未來三個月，我留在目前的工作會面對哪些條件？');
  await page.getByRole('radio', { name: /手動輸入四母象/ }).check();
  await page.getByRole('button', { name: '開始起卦' }).click();
  await fillManual(page);
  await page.getByRole('button', { name: '依這四母象排盤' }).click();
  await expect(page).toHaveURL(/#\/result\//);

  await page.getByText('最初寫下的話').click();
  await expect(page.locator('.original-text')).toHaveText(original);
  const [record] = await idbAll<{ question: { text: string; originalText?: string } }>(page, 'readings');
  expect(record.question).toMatchObject({ text: '未來三個月，我留在目前的工作會面對哪些條件？', originalText: original });

  await page.goto('./#/journal');
  await page.getByLabel('搜尋問題文字').fill('撐到年底');
  await expect(page.locator('.journal-item')).toHaveCount(1);
});

test('停止盤：第一母象為紅時顯示傳統禁例說明（不要求重起），可前往古典禁例頁', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await startCast(page, { method: '手動輸入四母象' });
  await fillManual(page, ['紅／Rubeus', ...FIXTURE_MOTHER_NAMES.slice(1)]);
  await page.getByRole('button', { name: '依這四母象排盤' }).click();
  await expect(page).toHaveURL(/#\/result\//);
  const note = page.locator('.halted-note');
  await expect(note.getByRole('heading', { name: '傳統禁例：停止盤' })).toBeVisible();
  await expect(note).toContainText('不要求重起');
  await note.getByRole('link', { name: '了解古典禁例與起卦習慣' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('古典禁例與起卦習慣');
});

test('教學區：古典禁例頁可從目錄進入；十六象頁列出行星對應', async ({ page }) => {
  await page.goto('./#/learn');
  await page.getByRole('link', { name: /古典禁例與起卦習慣/ }).click();
  await expect(page.getByRole('heading', { name: '同一件事要不要重問？' })).toBeVisible();
  await page.goto('./#/learn/fortuna-major');
  await expect(page.getByRole('heading', { name: '行星對應' })).toBeVisible();
  await expect(page.getByText('太陽')).toBeVisible();
});

test('設定：震動回饋可開關並保留（預設關閉）', async ({ page }) => {
  await page.goto('./#/settings');
  const box = page.getByRole('checkbox', { name: /輕微震動/ });
  await expect(box).not.toBeChecked();
  await box.check();
  await expect.poll(async () => (await idbAll<{ key: string; value: unknown }>(page, 'settings')).find(s => s.key === 'haptics')?.value).toBe(true);
  await page.reload();
  await expect(page.getByRole('checkbox', { name: /輕微震動/ })).toBeChecked();
});
