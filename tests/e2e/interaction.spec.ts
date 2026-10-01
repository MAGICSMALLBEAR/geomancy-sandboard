import { expect, test, type Page } from '@playwright/test';
import { castRows, fillManual, idbAll, noHorizontalOverflow, startCast, tapTray } from './helpers.ts';

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

type PointerInit = { type: string; id?: number; x?: number; y?: number; primary?: boolean; button?: number };
/** Synthetic pointer sequences for cases a mouse cannot produce (cancel, second finger, side button). */
async function pointers(page: Page, events: PointerInit[]) {
  await page.evaluate(list => {
    const tray = document.querySelector('.sand-tray')!;
    const rect = tray.getBoundingClientRect();
    for (const e of list) {
      tray.dispatchEvent(new PointerEvent(e.type, {
        bubbles: true, cancelable: true, pointerId: e.id ?? 7, pointerType: 'touch',
        isPrimary: e.primary ?? true, button: e.button ?? 0,
        clientX: rect.left + (e.x ?? 60), clientY: rect.top + (e.y ?? 60),
      }));
    }
  }, events);
}
const confirmedCounts = async (page: Page) => (await idbAll<{ confirmedCounts: number[] }>(page, 'drafts'))[0].confirmedCounts;
const confirmRow = (page: Page) => page.getByRole('button', { name: '完成這列' }).click();

test('C01–C06 點沙手勢：只有合法的放開才算一點', async ({ page }) => {
  await startCast(page, { method: '十六列點沙', work: false });
  const confirm = page.getByRole('button', { name: '完成這列' });
  await expect(confirm).toBeDisabled();

  // C01: one real mouse click = pointerdown + pointerup + the browser's click → exactly one dot.
  await tapTray(page, 1);
  await confirmRow(page);
  await expect(page.getByText('全部第 2／16 列')).toBeVisible();
  expect(await confirmedCounts(page)).toEqual([1]);

  // C02/C03: none of these may add a dot.
  await pointers(page, [{ type: 'pointerdown' }, { type: 'pointercancel' }]);
  await pointers(page, [{ type: 'pointerdown' }, { type: 'lostpointercapture' }, { type: 'pointerup' }]);
  await pointers(page, [{ type: 'pointerdown', x: 60 }, { type: 'pointermove', x: 73 }, { type: 'pointerup', x: 73 }]);
  await pointers(page, [{ type: 'pointerdown', x: 60 }, { type: 'pointermove', x: 120 }, { type: 'pointerup', x: 60 }]);
  await pointers(page, [{ type: 'pointerdown', y: 60 }, { type: 'pointerup', y: -40 }]);
  await pointers(page, [{ type: 'pointerdown', id: 8, primary: false }, { type: 'pointerup', id: 8, primary: false }]);
  await pointers(page, [{ type: 'pointerdown', button: 2 }, { type: 'pointerup', button: 2 }]);
  await pointers(page, [{ type: 'pointerdown', button: 5 }, { type: 'pointerup', button: 5 }]);
  await pointers(page, [{ type: 'click' }, { type: 'click' }]);
  await pointers(page, [{ type: 'pointerdown' }]);
  await page.waitForTimeout(1600);
  await pointers(page, [{ type: 'pointerup' }]);
  await expect(page.getByText('輕點即可：這次沒有算進去。')).toBeVisible();
  await expect(confirm).toBeDisabled();

  // A second finger landing and lifting during a valid tap adds nothing extra.
  await pointers(page, [{ type: 'pointerdown', id: 7 }, { type: 'pointerdown', id: 8, primary: false },
    { type: 'pointerup', id: 8, primary: false }, { type: 'pointerup', id: 7 }]);
  // C04: exactly 12 px still counts.
  await pointers(page, [{ type: 'pointerdown', x: 60 }, { type: 'pointermove', x: 72 }, { type: 'pointerup', x: 72 }]);
  await confirmRow(page);
  await expect(page.getByText('全部第 3／16 列')).toBeVisible();
  expect(await confirmedCounts(page)).toEqual([1, 2]);

  // C05: keyboard alternative; a held key does not auto-repeat dots.
  const add = page.getByRole('button', { name: '加入一點' });
  await add.focus();
  await page.keyboard.down('Enter');
  await page.keyboard.down('Enter');
  await page.keyboard.down('Enter');
  await page.keyboard.up('Enter');
  await page.keyboard.press('Space');
  await page.keyboard.press('Enter');
  await confirmRow(page);
  await expect(page.getByText('全部第 4／16 列')).toBeVisible();
  expect(await confirmedCounts(page)).toEqual([1, 2, 3]);

  // 清空本列 only affects the unconfirmed row.
  await tapTray(page, 4);
  await page.getByRole('button', { name: '清空本列' }).click();
  await expect(confirm).toBeDisabled();
  expect(await confirmedCounts(page)).toEqual([1, 2, 3]);
});

test('C07/C09 連按「完成這列」只存一列；第十六列連按只產生一筆記錄', async ({ page }) => {
  const id = await startCast(page, { method: '十六列點沙', work: false });
  await tapTray(page, 3);
  await page.getByRole('button', { name: '完成這列' }).dblclick();
  await expect(page.getByText('全部第 2／16 列')).toBeVisible();
  const [draft] = await idbAll<{ confirmedCounts: number[]; revision: number }>(page, 'drafts');
  expect(draft).toMatchObject({ confirmedCounts: [3], revision: 1 });

  await castRows(page, Array(14).fill(1), 1);
  await tapTray(page, 2);
  await page.getByRole('button', { name: '完成這列' }).dblclick();
  await expect(page).toHaveURL(new RegExp(`#/result/${id}$`));
  const readings = await idbAll<{ id: string; source: { counts: number[] } }>(page, 'readings');
  expect(readings).toHaveLength(1);
  expect(readings[0].source.counts).toEqual([3, ...Array(14).fill(1), 2]);
  expect(await idbAll(page, 'drafts')).toHaveLength(0);
});

test('完整動態效果：列化約可略過，成盤動畫可略過，結果不變', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await startCast(page, { method: '十六列點沙', work: false });
  await tapTray(page, 5);
  await confirmRow(page);
  await expect(page.locator('.tray-overlay')).toContainText('第 1 列：5 點，奇數 → 一點');
  await page.getByRole('button', { name: '略過' }).click();
  await expect(page.getByText('上一列（第 1 列）：5 點 → 一點')).toBeVisible();
  await tapTray(page, 4);
  await confirmRow(page);
  // Without skipping, the reveal ends by itself.
  await expect(page.getByText('上一列（第 2 列）：4 點 → 兩點')).toBeVisible();
  expect(await confirmedCounts(page)).toEqual([5, 4]);

  // Leaving with unconfirmed dots asks first; confirmed rows survive either way.
  await tapTray(page, 2);
  await page.getByRole('link', { name: '暫停，回首頁' }).click();
  await expect(page.getByRole('dialog')).toContainText('這一列還沒確認');
  await page.getByRole('button', { name: '放棄本列並離開' }).click();
  await expect(page.getByRole('heading', { name: '未完成的占問' })).toBeVisible();
  await expect(page.getByText('已確認 2／16 列')).toBeVisible();
  await page.getByRole('link', { name: '繼續起卦' }).click();
  await castRows(page, Array(14).fill(2), 2);

  await expect(page.locator('.shield.is-animating')).toBeVisible();
  const before = await idbAll(page, 'readings');
  await page.getByRole('button', { name: '略過成盤動畫' }).click();
  await expect(page.locator('.shield.is-animating')).toHaveCount(0);
  expect(await idbAll(page, 'readings')).toEqual(before);
});

test('S04 同一草稿開兩個分頁：較舊的分頁得到明確衝突，可重新載入', async ({ page, context }) => {
  const id = await startCast(page, { method: '十六列點沙', work: false });
  const second = await context.newPage();
  await second.emulateMedia({ reducedMotion: 'reduce' });
  await second.goto(`./#/cast/${id}`);
  await expect(second.getByText('全部第 1／16 列')).toBeVisible();

  await tapTray(page, 3);
  await confirmRow(page);
  await expect(page.getByText('全部第 2／16 列')).toBeVisible();

  await tapTray(second, 4);
  await confirmRow(second);
  await expect(second.getByText('另一個分頁已更新這筆草稿。這一列尚未保存。')).toBeVisible();
  expect(await confirmedCounts(second)).toEqual([3]);
  await second.getByRole('button', { name: '重新載入最新草稿' }).click();
  await expect(second.getByText('全部第 2／16 列')).toBeVisible();
  await tapTray(second, 2);
  await confirmRow(second);
  await expect(second.getByText('全部第 3／16 列')).toBeVisible();
  expect(await confirmedCounts(second)).toEqual([3, 2]);
});

test('S05 筆記在兩個分頁衝突時保留本地文字，由使用者決定', async ({ page, context }) => {
  await startCast(page, { method: '手動輸入四母象', work: false });
  await fillManual(page);
  await page.getByRole('button', { name: '依這四母象排盤' }).click();
  await expect(page).toHaveURL(/#\/result\//);
  const second = await context.newPage();
  await second.goto(page.url());

  await page.getByLabel('寫下回顧').fill('第一個分頁的筆記');
  await page.getByRole('button', { name: '保存筆記' }).click();
  await expect(page.getByText('筆記已保存。')).toBeVisible();

  await second.getByLabel('寫下回顧').fill('第二個分頁的筆記');
  await second.getByRole('button', { name: '保存筆記' }).click();
  await expect(second.getByText('另一個分頁已經修改過這筆筆記')).toBeVisible();
  await expect(second.getByLabel('寫下回顧')).toHaveValue('第二個分頁的筆記');
  expect((await idbAll<{ notes: string }>(second, 'readings'))[0].notes).toBe('第一個分頁的筆記');
  await second.getByRole('button', { name: '用我這裡的文字保存' }).click();
  await expect(second.getByText('筆記已保存。')).toBeVisible();
  expect((await idbAll<{ notes: string; revision: number }>(second, 'readings'))[0]).toMatchObject({ notes: '第二個分頁的筆記', revision: 2 });
});

test('S06 IndexedDB 無法開啟：明確的暫存模式，不宣稱已保存', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'indexedDB', { value: { open() { throw new DOMException('denied', 'SecurityError'); } } });
  });
  await page.goto('./');
  await expect(page.getByText('這個瀏覽器目前無法使用本機儲存')).toBeVisible();
  await page.getByRole('button', { name: '以暫存模式繼續' }).click();
  await expect(page.getByText(/^暫存模式：/)).toBeVisible();

  await page.getByRole('link', { name: '開始新的占問' }).click();
  await page.getByLabel('你想問什麼？').fill('暫存模式的問題');
  await page.getByRole('radio', { name: /手動輸入四母象/ }).check();
  await page.getByRole('button', { name: '開始起卦' }).click();
  await fillManual(page);
  await page.getByRole('button', { name: '依這四母象排盤' }).click();
  await expect(page.locator('.claim')).toHaveCount(4);
  await page.getByRole('navigation', { name: '主要導覽' }).getByRole('link', { name: '設定' }).click();
  await expect(page.getByText('目前是暫存模式：關閉分頁後記錄就會消失')).toBeVisible();
  await expect(page.getByText('儲存方式：暫存模式（僅限這個分頁）')).toBeVisible();
});

test('R01/R03 一般反思沒有問題宮；切換顯示不改資料；S07 刪除後找不到', async ({ page }) => {
  await startCast(page, { method: '手動輸入四母象', work: false });
  await fillManual(page, ['群眾／Populus', '群眾／Populus', '群眾／Populus', '群眾／Populus']);
  await page.getByRole('button', { name: '依這四母象排盤' }).click();
  await expect(page.locator('.claim')).toHaveCount(4);
  await expect(page.locator('.claim', { hasText: '問題所屬範圍' })).toHaveCount(0);
  await expect(page.locator('.claim', { hasText: '可以記下的下一步' })).toContainText('反思提示');
  // E04: four identical mothers are a legal chart.
  await expect(page.locator('.node-list > li')).toHaveCount(15);
  await expect(page.locator('.node-list > li').nth(14)).toContainText('圖式 2222');

  const before = await idbAll(page, 'readings');
  await page.getByLabel(/顯示調和者/).check();
  await expect(page.locator('.node-list > li')).toHaveCount(16);
  await page.getByRole('button', { name: '十二宮' }).click();
  await page.getByRole('button', { name: '盾盤' }).click();
  await page.locator('.shield-node').nth(14).click();
  await expect(page.locator('.node-list > li.is-open')).toContainText('右證人（RW）＋左證人（LW）逐行合成');
  await page.goto('./#/settings');
  await page.getByRole('radio', { name: '完整動態效果' }).check();
  await page.getByRole('radio', { name: '減少動態效果' }).check();
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduce');
  expect(await idbAll(page, 'readings')).toEqual(before);

  const id = (before[0] as { id: string }).id;
  await page.goto('./#/journal');
  await page.getByRole('button', { name: '刪除' }).click();
  await page.getByRole('dialog').getByRole('button', { name: '刪除' }).click();
  await expect(page.getByText('還沒有記錄。')).toBeVisible();
  await page.goto(`./#/result/${id}`);
  await expect(page.getByRole('heading', { name: '這個瀏覽器找不到這筆記錄' })).toBeVisible();
  await page.goto('./#/no-such-page');
  await expect(page.getByRole('heading', { name: '找不到頁面' })).toBeVisible();
});

test('提問驗證、既有草稿、教學例題與十六象', async ({ page }) => {
  await page.goto('./#/new');
  await page.getByRole('button', { name: '開始起卦' }).click();
  await expect(page.getByText('請先寫下一個問題。')).toBeVisible();
  await expect(page.getByLabel('你想問什麼？')).toBeFocused();
  await page.getByLabel('你想問什麼？').fill('工作上的問題');
  await page.getByRole('radio', { name: '工作' }).check();
  await page.getByRole('button', { name: '開始起卦' }).click();
  await expect(page.getByText('請選擇這個問題要看的宮位。')).toBeVisible();
  // Changing the topic clears an incompatible house.
  await page.getByRole('radio', { name: /日常工作/ }).check();
  await page.getByRole('radio', { name: '關係' }).check();
  await expect(page.getByRole('radio', { name: /伴侶／互動/ })).not.toBeChecked();
  await page.getByRole('radio', { name: /戀愛／約會/ }).check();
  await page.getByRole('button', { name: '開始起卦' }).click();
  await expect(page).toHaveURL(/#\/cast\//);
  expect((await idbAll<{ question: unknown }>(page, 'drafts'))[0].question)
    .toEqual({ text: '工作上的問題', timeframe: '', topic: 'relationship', targetHouse: 5 });

  // One draft at a time: continue or discard explicitly.
  await page.goto('./#/new');
  await expect(page.getByRole('heading', { name: '你有一筆尚未完成的占問' })).toBeVisible();
  await page.getByRole('button', { name: '放棄並新增' }).click();
  await expect(page.getByLabel('你想問什麼？')).toBeVisible();
  expect(await idbAll(page, 'drafts')).toHaveLength(0);

  // E02: the teaching example is computed by the same engine and never enters the journal.
  await page.goto('./#/learn/example');
  await expect(page.getByText('教學例題')).toBeVisible();
  await page.getByLabel(/顯示調和者/).check();
  await expect(page.locator('.node-list > li').nth(9)).toContainText('圖式 2211');
  await expect(page.locator('.node-list > li').nth(14)).toContainText('交會／Conjunctio');
  expect(await idbAll(page, 'readings')).toHaveLength(0);
  await page.goto('./#/learn');
  await expect(page.locator('.figure-tile')).toHaveCount(16);
  await page.goto('./#/learn/puella');
  await expect(page.getByText('圖式（由上到下，1 是一點、2 是兩點）：1211')).toBeVisible();
  await page.goto('./#/learn/not-a-figure');
  await expect(page.getByRole('heading', { name: '找不到這個象' })).toBeVisible();
});

test('試用紀錄預設關閉；開啟後只有流程事件，沒有問題、點數或盤面', async ({ page }) => {
  await startCast(page, { method: '十六列點沙', work: false, text: '不應出現在事件裡的私人問題' });
  await tapTray(page, 3);
  await confirmRow(page);
  expect(await idbAll(page, 'feedback')).toHaveLength(0);

  await page.getByRole('link', { name: '暫停，回首頁' }).click();
  await page.goto('./#/settings');
  await page.getByLabel(/記錄本機試用流程/).check();
  await page.goto('./#/');
  await page.getByRole('link', { name: '繼續起卦' }).click();
  await tapTray(page, 7);
  await confirmRow(page);
  await expect(page.getByText('全部第 3／16 列')).toBeVisible();
  const events = await idbAll<{ kind: string; event: Record<string, unknown> }>(page, 'feedback');
  expect(events.map(e => e.event.name)).toEqual(['row_confirmed']);
  expect(Object.keys(events[0].event).sort()).toEqual(['elapsedMs', 'method', 'name', 'rowIndex', 'schemaVersion', 'sessionId']);
  expect(events[0].event).toMatchObject({ rowIndex: 2, method: 'dots' });
  expect(JSON.stringify(events)).not.toContain('私人問題');
});

for (const width of [360, 768, 1440]) {
  test(`版面 ${width}px：主要頁面不橫向溢出，手機用頁籤切換結果`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: width === 360 ? 740 : 900 });
    const shot = async (name: string) => {
      await page.screenshot({ path: `docs/evidence/${name}-${width}.png`, fullPage: true });
      await noHorizontalOverflow(page);
    };
    await page.goto('./');
    await shot('home');
    await startCast(page, { method: '十六列點沙', text: `${'很長的問題文字，'.repeat(30)}Supercalifragilisticexpialidocious-LongLatinWord` });
    await tapTray(page, 6);
    await shot('cast');
    // Buttons meet the 44 px target.
    for (const name of ['加入一點', '清空本列', '完成這列']) {
      const box = (await page.getByRole('button', { name }).boundingBox())!;
      expect(Math.min(box.width, box.height), name).toBeGreaterThanOrEqual(44);
    }
    await page.getByRole('button', { name: '放棄這筆草稿' }).click();
    await page.getByRole('dialog').getByRole('button', { name: '放棄草稿' }).click();
    await expect(page.getByLabel('你想問什麼？')).toBeVisible();
    await shot('new');

    await startCast(page, { method: '手動輸入四母象' });
    await fillManual(page);
    await shot('manual');
    await page.getByRole('button', { name: '依這四母象排盤' }).click();
    await expect(page).toHaveURL(/#\/result\//);
    if (width < 900) {
      await expect(page.locator('.pane-chart')).toBeHidden();
      await shot('result-reading');
      await page.getByRole('button', { name: '盤面', exact: true }).click();
      await expect(page.locator('.node-list > li')).toHaveCount(15);
      await shot('result-chart');
      await page.getByRole('button', { name: '筆記', exact: true }).click();
      await expect(page.getByLabel('寫下回顧')).toBeVisible();
    } else {
      await expect(page.locator('.pane-chart')).toBeVisible();
      await expect(page.locator('.pane-reading')).toBeVisible();
      await shot('result');
    }
    await page.goto('./#/journal');
    await shot('journal');
    await page.goto('./#/settings');
    await shot('settings');
    await page.goto('./#/learn');
    await shot('learn');
    testInfo.annotations.push({ type: 'screenshots', description: `docs/evidence/*-${width}.png` });
  });
}
