/** Browser regression checks using controlled API replies, not live model evaluations.
 * Run with PLAYWRIGHT_MODULE pointing to an installed playwright package and
 * CHAT_TEST_URL pointing to a running app (defaults to localhost:3107).
 */
// CommonJS permits reusing an existing Playwright install without an app dependency.
/* eslint-disable @typescript-eslint/no-require-imports */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch();
  try {
    for (const width of [390, 1280]) {
      const page = await browser.newPage({ viewport: { width, height: 844 } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      const requests = [];
      let failure = false;
      let interrupted = false;
      await page.route('**/api/chat', async route => {
        requests.push(route.request().postDataJSON());
        const events = [
          { type: 'metadata', promptVersion: 'v22', promptHash: 'test', model: 'mock', searchStatus: failure ? 'answer-failed' : 'results-returned', toolsExecuted: 1, requestId: 'browser-test', evidenceToken: 'signed-test-token', retryToken: 'signed-retry-token' },
          ...(failure ? [{ type: 'error', text: 'Source service unavailable. Please retry.' }] : [
            { type: 'text', text: 'A cautious interpretation of *ahimsa* [Source](https://example.org/gandhi) and **swaraj**. Further background [Reading](https://example.org/reading).' },
            ...(interrupted ? [] : [{ type: 'done' }]),
          ]),
        ];
        await route.fulfill({ contentType: 'application/x-ndjson', body: events.map(e => JSON.stringify(e)).join('\n') + '\n' });
      });
      await page.goto(process.env.CHAT_TEST_URL || 'http://localhost:3107');
      const input = page.getByRole('textbox', { name: 'Your question about Gandhi' });
      await input.waitFor();
      const heading = await page.getByText('Begin with an inquiry', { exact: true }).boundingBox();
      const box = await input.boundingBox();
      const suggestion = await page.getByRole('button', { name: /climate change/ }).boundingBox();
      assert(heading.y < box.y && box.y < suggestion.y, 'home order');
      assert(box.y + box.height < 844, 'input visible without scrolling');
      assert.equal(await input.count(), 1);
      assert.equal(await page.getByLabel('Answer reasoning', { exact: true }).count(), 0);
      assert.equal(await page.getByLabel('Load a question into the input').count(), 0);
      await input.fill('');
      await page.getByRole('button', { name: 'Ask', exact: true }).click();
      await page.getByRole('alert').filter({ hasText: 'Type your question' }).waitFor();
      assert.equal(requests.length, 0, 'blank submission does not call model');
      assert(await input.evaluate(e => e === document.activeElement), 'blank submission focuses input');
      await input.fill('What did Gandhi think about money?');
      await input.press('Enter');
      await page.getByRole('button', { name: 'Verify sources' }).waitFor();
      assert.equal(requests[0].reasoningEffort, undefined, 'server controls reasoning defaults');
      assert.equal(await page.getByRole('link', { name: 'Source 1 · example.org', exact: true }).getAttribute('href'), 'https://example.org/gandhi');
      const answer = page.locator('article').last();
      assert.equal(await answer.locator('.prose-gandhi > p a').count(), 0, 'sources never interrupt prose');
      assert((await answer.locator('.prose-gandhi > p').first().innerText()).endsWith('background.'), 'preserve punctuation');
      assert.equal(await answer.getByRole('navigation', { name: 'Sources for this answer' }).getByRole('link').count(), 2);
      assert(!(await page.locator('article').last().innerText()).includes('*'), 'emphasis markers are not displayed');
      await page.getByRole('button', { name: 'Verify sources' }).click();
      await page.getByRole('button', { name: 'Verify sources' }).waitFor();
      assert.equal(requests[1].verifySources, true);
      assert.equal(requests[1].evidenceToken, 'signed-test-token');
      failure = true;
      await input.fill('Verify again');
      await input.press('Enter');
      await page.getByRole('alert').filter({ hasText: 'Source service unavailable' }).waitFor();
      await page.getByText('Test details', { exact: true }).click();
      assert((await page.locator('details').filter({ has: page.getByText('Test details', { exact: true }) }).innerText()).includes('answer-failed'));
      failure = false;
      const failedMessages = requests.at(-1).messages;
      await page.getByRole('button', { name: 'Retry request' }).click();
      await page.getByRole('button', { name: 'Verify sources' }).waitFor();
      assert.deepEqual(requests.at(-1).messages, failedMessages, 'retry does not duplicate the user turn');
      assert.equal(requests.at(-1).retryToken, 'signed-retry-token', 'retry retains receipt after failure');
      interrupted = true;
      await input.fill('Try again');
      await input.press('Enter');
      await page.getByText('The answer was interrupted. Please retry.', { exact: true }).waitFor();
      await page.getByRole('button', { name: 'New inquiry' }).click();
      interrupted = false;
      await input.fill('Shall I use AI?');
      await input.press('Enter');
      await page.getByRole('button', { name: 'Verify sources' }).waitFor();
      assert.equal(requests.at(-1).messages.length, 1);
      assert.equal(requests.at(-1).evidenceToken, '');
      assert.equal(requests.at(-1).retryToken, undefined, 'new inquiry cannot reuse a receipt');
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no page overflow');
      assert.deepEqual(errors, []);
      await page.screenshot({ path: `/tmp/gandhi-chat-${width}.png`, fullPage: true });
      const requestCount = requests.length;
      await page.getByRole('link', { name: 'Quiz', exact: true }).click();
      await page.getByRole('button', { name: 'शुरू करें →' }).click();
      for (let i = 0; i < 5; i++) await page.getByRole('button', { name: 'यह सवाल छोड़ें' }).click();
      await page.getByText('सही: 0 · गलत: 0 · छोड़े: 5', { exact: true }).waitFor();
      assert.equal(requests.length, requestCount, 'quiz makes no model requests');
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'quiz has no page overflow');
      console.log(`PASS ${width}px: layout, accessibility label, submit, links, punctuation, verification, evidence retention, error diagnostics, interrupted stream, reset, overflow, browser errors`);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
