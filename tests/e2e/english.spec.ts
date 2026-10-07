// 0.12.0: English interface (DECISIONS D43). An English browser gets English on its first visit; every page,
// dialog and casting screen is checked for leftover Chinese text, including labels that are only read aloud.
import { expect, test, type Page } from '@playwright/test';
import { fixture } from './helpers.ts';

test.use({ locale: 'en-US' });
// AI calls are intercepted; see ai.spec.ts for why the worker is blocked.
test.use({ serviceWorkers: 'block' });

const QUESTION = 'Over the next three months, what helps and what limits me as I apply for this position?';
const MOTHERS = ['M1', 'M2', 'M3', 'M4'].map(node => fixture.expectedDots[node]);

/** Fails with the offending text if any Chinese character is on the page, in text or in accessible names. */
async function expectNoChinese(page: Page, where: string) {
  const found = await page.evaluate(() => {
    // CJK ideographs and full-width punctuation. The ideographic space (U+3000) is a plain separator, so it is allowed.
    const cjk = /[一-鿿、-〿！-～]/;
    const hits: string[] = [];
    const root = document.getElementById('root') ?? document.body;
    const dialogs = [...document.querySelectorAll('dialog[open]')];
    for (const scope of [root, ...dialogs]) {
      for (const el of [scope, ...scope.querySelectorAll('*')]) {
        // The language switch names the other language in itself, by design.
        if (el.closest('.lang-switch')) continue;
        for (const node of el.childNodes) {
          if (node.nodeType === Node.TEXT_NODE && cjk.test(node.textContent ?? '')) hits.push((node.textContent ?? '').trim().slice(0, 80));
        }
        for (const attr of ['aria-label', 'title', 'alt', 'placeholder']) {
          const value = el.getAttribute(attr);
          if (value && cjk.test(value)) hits.push(`[${attr}] ${value.slice(0, 80)}`);
        }
      }
    }
    if (cjk.test(document.title)) hits.push(`[title] ${document.title}`);
    return [...new Set(hits)];
  });
  expect(found, `Chinese text on ${where}`).toEqual([]);
}

async function startEnglishCast(page: Page, method: RegExp) {
  await page.goto('./#/new');
  await page.getByLabel('What do you want to ask?').fill(QUESTION);
  await page.getByRole('radio', { name: 'Work' }).check();
  await page.getByRole('radio', { name: /Position \/ career/ }).check();
  await page.getByRole('radio', { name: method }).check();
  await expectNoChinese(page, 'new question');
  await page.getByRole('button', { name: 'Start casting' }).click();
  await expect(page).toHaveURL(/#\/cast\//);
}

async function discardDraft(page: Page) {
  await page.getByRole('button', { name: 'Discard this draft' }).click();
  await expectNoChinese(page, 'discard dialog');
  await page.getByRole('button', { name: 'Discard the draft' }).click();
  await expect(page).toHaveURL(/#\/new$/);
}

test('English browser: casting, result, dialogs, journal and settings have no Chinese left', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./');
  await expect(page.getByRole('button', { name: '中文' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expectNoChinese(page, 'home');

  // Every casting screen that comes before a chart.
  for (const method of [/^Sixteen rows of dots/, /^Four long presses/, /^Automatic dots/, /^Quick cast/]) {
    await startEnglishCast(page, method);
    await expectNoChinese(page, `casting: ${method}`);
    await discardDraft(page);
  }
  await startEnglishCast(page, /^Sixteen rows of dots/);
  await page.locator('.sand-tray').click();
  await page.getByRole('button', { name: 'Finish this row' }).click();
  await expect(page.getByText('row 2 of 16')).toBeVisible();
  await expectNoChinese(page, 'dots casting after a row');
  await discardDraft(page);

  // Manual cast through to the result.
  await startEnglishCast(page, /^Four Mothers entered by hand/);
  for (let i = 0; i < 4; i++) await page.getByLabel('Or choose a figure').nth(i).selectOption(MOTHERS[i]);
  await expectNoChinese(page, 'manual casting');
  await page.getByRole('button', { name: 'Build the chart from these Mothers' }).click();
  await expect(page).toHaveURL(/#\/result\//);
  await expect(page.getByText(QUESTION).first()).toBeVisible();
  await expectNoChinese(page, 'result');

  for (const [button, close] of [['Save as image', 'Cancel'], ['Share link', 'Close'], ['Export this record', 'Cancel']] as const) {
    await page.getByRole('button', { name: button, exact: true }).click();
    await expectNoChinese(page, `${button} dialog`);
    await page.locator('dialog[open]').getByRole('button', { name: close }).click();
  }

  await page.goto('./#/journal');
  await expect(page.getByText(QUESTION)).toBeVisible();
  await expectNoChinese(page, 'journal');

  await page.goto('./#/settings');
  await expectNoChinese(page, 'settings without a key');
  await page.getByLabel('API key').fill('sk-ant-test-key-1234');
  await page.getByRole('button', { name: 'Save in this browser' }).click();
  await expect(page.getByText('Saved key:')).toBeVisible();
  await page.getByRole('button', { name: 'Clear all records in this browser…' }).click();
  await expectNoChinese(page, 'settings with a key and the clear dialog');
  // The confirmation word is English in English.
  await page.getByLabel('Type "delete" to confirm').fill('delete');
  await expect(page.getByRole('button', { name: 'Clear everything' })).toBeEnabled();
  await page.locator('dialog[open]').getByRole('button', { name: 'Cancel' }).click();

  // The AI preview: the payload itself is English.
  await page.goto('./#/journal');
  await page.getByText(QUESTION).click();
  await page.getByRole('button', { name: 'Ask AI to retell this chart…' }).click();
  await page.getByText('See the full data to be sent').click();
  await expectNoChinese(page, 'AI preview');
  await expect(page.locator('.ai-preview')).toContainText('"shield"');
});

test('English browser: every learning page and shared links have no Chinese left', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const path of ['learn', 'learn/houses', 'learn/correspondences', 'learn/customs', 'learn/try', 'learn/example',
    'learn/puer', 'learn/rubeus', 'learn/caput-draconis', 'no-such-page']) {
    await page.goto(`./#/${path}`);
    await expect(page.locator('h1').first()).toBeVisible();
    await expectNoChinese(page, path);
  }

  await page.goto('./#/learn/practice');
  await page.getByRole('checkbox', { name: /Work it out first/ }).check();
  for (let step = 0; step < 6; step++) {
    await expectNoChinese(page, `practice step ${step + 1}`);
    const check = page.getByRole('button', { name: 'Check' });
    for (let n = await check.count(); n > 0; n--) {
      const node = page.locator('.practice-node').filter({ has: page.getByRole('button', { name: 'Check' }) }).first();
      for (const group of await node.getByRole('radiogroup').all()) await group.getByRole('radio', { name: /One dot/ }).click();
      await node.getByRole('button', { name: 'Check' }).click();
    }
    await expectNoChinese(page, `practice step ${step + 1} checked`);
    const next = page.getByRole('button', { name: /^Next:/ });
    if (await next.count()) await next.click();
  }

  await page.goto(`./#/shared?v=1&m=${MOTHERS.join('')}&t=work&h=10`);
  await expect(page.getByText('A chart someone shared')).toBeVisible();
  await expectNoChinese(page, 'shared chart');
  await page.goto('./#/shared?v=1&m=123');
  await expectNoChinese(page, 'broken share link');
});
