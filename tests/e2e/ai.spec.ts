// 0.12.0: AI retelling with the user's own key (DECISIONS D42). api.anthropic.com is intercepted: no real calls.
import { expect, test, type Page, type Request } from '@playwright/test';
import { fillManual, idbAll, startCast } from './helpers.ts';

// On WebKit, requests from a page controlled by the service worker skip page.route and reach the real API.
// The AI path does not depend on the worker, so block it here to keep every call intercepted.
test.use({ serviceWorkers: 'block' });

const QUESTION = '我在接下來三個月申請這個職位順利嗎？';
const reply = { paragraphs: [
  { heading: '整體', text: '裁判是「交會」，第 10 宮的「大幸運」顯示穩定的力量。<b>粗體</b>', cites: ['J', 'N2'] },
  { heading: '要小心的地方', text: '第 1 宮的「群眾」顯示你受環境左右。', cites: ['M1'] },
] };
const sse = (text: string) => [
  ['message_start', { type: 'message_start', message: { id: 'msg_1', type: 'message', role: 'assistant', model: 'claude-opus-5-5', content: [],
    stop_reason: null, stop_sequence: null, usage: { input_tokens: 3200, output_tokens: 1 } } }],
  ['content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } }],
  ['content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } }],
  ['content_block_stop', { type: 'content_block_stop', index: 0 }],
  ['message_delta', { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 900 } }],
  ['message_stop', { type: 'message_stop' }],
].map(([event, data]) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`).join('');

async function mockApi(page: Page, status = 200) {
  const requests: Request[] = [];
  await page.route('https://api.anthropic.com/**', async route => {
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, OPTIONS' };
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    requests.push(route.request());
    if (status !== 200) {
      return route.fulfill({ status, headers: { ...cors, 'content-type': 'application/json' },
        body: JSON.stringify({ type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } }) });
    }
    return route.fulfill({ status: 200, headers: { ...cors, 'content-type': 'text/event-stream' }, body: sse(JSON.stringify(reply)) });
  });
  return requests;
}

async function resultWithKey(page: Page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./#/settings');
  await page.getByLabel('API 金鑰').fill('sk-ant-test-key-1234');
  await page.getByRole('button', { name: '存到這個瀏覽器' }).click();
  await expect(page.getByText('目前已存金鑰：')).toBeVisible();
  await startCast(page, { method: '手動輸入四母象', text: QUESTION });
  await fillManual(page);
  await page.getByRole('button', { name: '依這四母象排盤' }).click();
  await expect(page).toHaveURL(/#\/result\//);
}

test('AI 轉述：送出前預覽、預設不送問題；回覆逐段標出引用並查核；保存後重開仍在；可刪除', async ({ page }) => {
  const requests = await mockApi(page);
  await resultWithKey(page);
  const panel = page.locator('.ai-panel');
  await panel.getByRole('button', { name: '請 AI 轉述這張盤…' }).click();
  const dialog = page.getByRole('dialog', { name: '送出前確認' });
  await expect(dialog.getByLabel(/一併送出問題文字/)).not.toBeChecked();
  await dialog.getByText('查看要送出的完整資料').click();
  await expect(dialog.locator('.ai-preview')).toContainText('"盤位": "J"');
  await expect(dialog.locator('.ai-preview')).not.toContainText(QUESTION);
  await dialog.getByRole('button', { name: '送出' }).click();

  await expect(panel.getByText(/以下由 AI（claude-opus-5-5）/)).toBeVisible();
  await expect(panel.locator('.ai-paragraph')).toHaveCount(2);
  // Model text is plain text, never HTML.
  await expect(panel.locator('.ai-paragraph').first()).toContainText('<b>粗體</b>');
  await expect(panel.locator('.ai-paragraph').first().locator('.is-error')).toHaveCount(0);
  await expect(panel.locator('.ai-paragraph').nth(1).locator('.is-error'))
    .toContainText('第 1 宮的象是「少年」，不是「群眾」。');
  await expect(panel.getByText(/輸入 3,200、輸出 900 tokens（約 US\$0\.031）/)).toBeVisible();

  expect(requests).toHaveLength(1);
  const headers = requests[0].headers();
  expect(headers['x-api-key']).toBe('sk-ant-test-key-1234');
  expect(headers['anthropic-dangerous-direct-browser-access']).toBe('true');
  expect(headers['anthropic-beta']).toContain('server-side-fallback-2026-07-01');
  const body = requests[0].postDataJSON();
  expect(body).toMatchObject({ model: 'claude-opus-5-5', fallbacks: 'default', stream: true });
  expect(JSON.stringify(body)).not.toContain(QUESTION);

  const [record] = await idbAll<{ ai?: { model: string; sentQuestion: boolean; paragraphs: unknown[] } }>(page, 'readings');
  expect(record.ai).toMatchObject({ model: 'claude-opus-5-5', sentQuestion: false });
  expect(record.ai?.paragraphs).toHaveLength(2);

  // Clicking a citation shows that position.
  await panel.getByRole('button', { name: '裁判「交會」' }).click();
  await expect(page.locator('.node-list > li.is-open')).toContainText('裁判');

  await page.reload();
  await expect(page.locator('.ai-paragraph')).toHaveCount(2);
  await page.getByRole('button', { name: '刪除 AI 轉述' }).click();
  await expect(page.locator('.ai-paragraph')).toHaveCount(0);
  expect((await idbAll<{ ai?: unknown }>(page, 'readings'))[0].ai).toBeUndefined();
});

test('AI 轉述：勾選後才送出問題文字', async ({ page }) => {
  const requests = await mockApi(page);
  await resultWithKey(page);
  await page.locator('.ai-panel').getByRole('button', { name: '請 AI 轉述這張盤…' }).click();
  const dialog = page.getByRole('dialog', { name: '送出前確認' });
  await dialog.getByLabel(/一併送出問題文字/).check();
  await dialog.getByRole('button', { name: '送出' }).click();
  await expect(page.locator('.ai-paragraph')).toHaveCount(2);
  expect(JSON.stringify(requests[0].postDataJSON())).toContain(QUESTION);
  await expect(page.getByText(/有附上問題文字/)).toBeVisible();
});

test('AI 轉述：金鑰無效時說明原因，不保存任何東西', async ({ page }) => {
  await mockApi(page, 401);
  await resultWithKey(page);
  await page.locator('.ai-panel').getByRole('button', { name: '請 AI 轉述這張盤…' }).click();
  await page.getByRole('dialog', { name: '送出前確認' }).getByRole('button', { name: '送出' }).click();
  await expect(page.getByText('API 金鑰無效或已撤銷。請到設定重新輸入。')).toBeVisible();
  expect((await idbAll<{ ai?: unknown }>(page, 'readings'))[0].ai).toBeUndefined();
});

test('AI 轉述：沒有金鑰時只顯示說明，不會送出任何請求', async ({ page }) => {
  const requests = await mockApi(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await startCast(page, { method: '手動輸入四母象' });
  await fillManual(page);
  await page.getByRole('button', { name: '依這四母象排盤' }).click();
  await expect(page.locator('.ai-panel')).toContainText('需要你自己的 Anthropic API 金鑰');
  await expect(page.locator('.ai-panel').getByRole('button')).toHaveCount(0);
  expect(requests).toHaveLength(0);
});
