/** Controlled UI regression suite. Model quality is evaluated separately with scripts/evaluate.ts.
 * PLAYWRIGHT_MODULE=/path/to/playwright CHAT_TEST_URL=http://localhost:3107 node scripts/browser-check.cjs
 */
/* eslint-disable @typescript-eslint/no-require-imports */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const base = process.env.CHAT_TEST_URL || 'http://localhost:3107';
const sample = {
  answerType: 'interpretation', shortAnswer: 'His principles suggest asking who benefits and who bears the cost. This is a tentative application, not a recorded statement about current technology.',
  historicalBasis: [], sources: [], interpretationBoundary: 'Applying this principle to today’s technology is an interpretation, not Gandhi’s recorded position.',
  contestedReadings: ['A principle alone does not settle every practical choice.'], missingEvidence: '', suggestedFollowUps: ['What does this principle mean?'], verificationSummary: '',
};
const sourced = { ...sample, historicalBasis: [{ claim: 'A documented point with its qualification.', sourceId: 'source-1' }], sources: [{ id: 'source-1', title: 'A primary source document', url: 'https://example.org/document', claimSupported: 'A documented point with its qualification.', passage: 'The supporting words, including the qualification.' }], verificationSummary: 'The historical basis is now attached. Its modern application remains an interpretation.' };

(async () => {
  const browser = await chromium.launch();
  try {
    for (const width of [390, 1280, 320]) {
      const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
      const errors = [], requests = [];
      page.on('pageerror', error => errors.push(error.message));
      let failure = false, interrupted = false, delayed = false;
      await page.route('**/api/chat', async route => {
        const request = route.request().postDataJSON(); requests.push(request);
        const probe = request.verifySources || /verify/i.test(request.messages.at(-1).content);
        if (delayed) await new Promise(resolve => setTimeout(resolve, 500));
        const events = [
          { type: 'metadata', model: 'PRIVATE_MODEL', promptVersion: 'PRIVATE_VERSION', toolsExecuted: 999, evidenceToken: 'evidence', retryToken: 'retry' },
          ...(probe ? [{ type: 'source-check' }] : []),
          ...(failure ? [{ type: 'error', text: 'Source service unavailable. Please retry.' }] : [{ type: 'result', result: probe ? sourced : sample }, ...(interrupted ? [] : [{ type: 'done' }])]),
        ];
        await route.fulfill({ contentType: 'application/x-ndjson', body: events.map(e => JSON.stringify(e)).join('\n') + '\n' });
      });
      await page.goto(base);
      const input = page.getByRole('textbox', { name: 'Your question', exact: true });
      await input.waitFor();
      assert.equal(await input.count(), 1);
      const composer = await input.boundingBox();
      assert(composer.y + composer.height < 900, 'composer above fold');
      assert((await page.getByRole('heading', { name: 'Begin with an inquiry' }).boundingBox()).y < composer.y);
      assert((await page.getByRole('button', { name: /A historical view/ }).boundingBox()).y > composer.y);
      await page.getByRole('button', { name: 'Ask →', exact: true }).click();
      await page.getByRole('alert').filter({ hasText: 'Enter a question' }).waitFor(); assert.equal(requests.length, 0);
      assert(await input.evaluate(e => e === document.activeElement));
      await page.getByRole('button', { name: /A modern issue/ }).click();
      assert((await input.inputValue()).includes('artificial intelligence'));
      assert.equal(requests.length, 0, 'examples populate without sending');
      await page.screenshot({ path: `/tmp/gandhi-home-${width}.png`, fullPage: true });
      await input.press('Enter');
      const article = page.getByRole('article', { name: 'Inquiry result' });
      await article.waitFor();
      assert.equal(await article.count(), 1);
      await page.getByRole('heading', { name: 'Where interpretation begins' }).waitFor();
      assert(!(await page.locator('body').innerText()).match(/Test details|PRIVATE_MODEL|PRIVATE_VERSION|Answer reasoning/));
      delayed = true;
      await page.getByRole('button', { name: 'Check sources', exact: true }).click();
      await page.getByRole('button', { name: 'Checking sources…' }).waitFor();
      assert.equal(await article.count(), 1, 'loading preserves existing result');
      await page.getByRole('button', { name: 'Check again' }).waitFor();
      assert.equal(requests.at(-1).verifySources, true);
      assert.equal(await article.count(), 1, 'source check replaces rather than appends');
      assert(!(await article.innerText()).includes('Verify the sources and correct'));
      assert.equal(await page.getByRole('link', { name: /A primary source document/ }).getAttribute('href'), 'https://example.org/document');
      await page.getByText('Read the supporting passage', { exact: true }).click();
      await page.getByText('The supporting words, including the qualification.', { exact: true }).waitFor();
      await page.screenshot({ path: `/tmp/gandhi-result-${width}.png`, fullPage: true });
      delayed = false; failure = true;
      await page.getByRole('button', { name: 'Check again' }).click();
      await page.getByRole('alert').filter({ hasText: 'Source service unavailable' }).waitFor();
      assert.equal(await article.count(), 1);
      assert((await article.innerText()).includes(sample.shortAnswer));
      const failedMessages = requests.at(-1).messages;
      failure = false;
      await page.getByRole('button', { name: 'Retry source check' }).click();
      await page.getByRole('button', { name: 'Check again' }).waitFor();
      assert.deepEqual(requests.at(-1).messages, failedMessages);
      assert.equal(requests.at(-1).retryToken, 'retry');
      await input.fill('Please verify that answer'); await input.press('Enter');
      await page.waitForFunction(() => document.querySelector('.question-form textarea').value === '');
      assert.equal(await article.count(), 1, 'typed verification is also in-place');
      assert.equal(await page.locator('.previous-inquiries').count(), 0);
      interrupted = true;
      await input.fill('A follow-up'); await input.press('Enter');
      await page.getByRole('alert').filter({ hasText: 'interrupted' }).waitFor();
      assert.equal(await article.count(), 1); assert((await article.innerText()).includes('artificial intelligence'));
      interrupted = false;
      await page.getByRole('button', { name: 'Retry request' }).click();
      await page.locator('.previous-inquiries').waitFor();
      assert.equal(await article.count(), 1, 'only active inquiry displayed');
      assert(!requests.at(-1).messages.slice(0, -1).some(m => m.role === 'user' && /verify/i.test(m.content)), 'private check instructions excluded from history');
      await page.getByRole('button', { name: 'What does this principle mean?' }).click();
      assert.equal(await input.inputValue(), 'What does this principle mean?');
      await page.getByRole('button', { name: 'New inquiry', exact: true }).click();
      assert.equal(await article.count(), 0);
      assert.equal(await input.inputValue(), '');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'no horizontal overflow');

      const beforeQuiz = requests.length;
      await page.getByRole('link', { name: 'Try the quiz →', exact: true }).first().click();
      await page.getByRole('button', { name: 'शुरू करें →' }).click();
      await page.getByRole('button', { name: 'जवाब देखें' }).click();
      await page.getByRole('alert').filter({ hasText: 'एक विकल्प चुनें' }).waitFor();
      await page.getByRole('radio').nth(1).check();
      await page.getByRole('button', { name: 'जवाब देखें' }).click();
      await page.getByText('सही समझा।', { exact: true }).waitFor();
      await page.screenshot({ path: `/tmp/gandhi-quiz-${width}.png`, fullPage: true });
      await page.getByRole('button', { name: 'अगला सवाल →' }).click();
      await page.getByRole('radio').first().check();
      await page.getByRole('button', { name: 'जवाब देखें' }).click();
      await page.getByText('इसे इस तरह समझें।', { exact: true }).waitFor();
      await page.getByRole('button', { name: 'अगला सवाल →' }).click();
      for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'यह सवाल छोड़ें' }).click();
      await page.getByText('सही: 1 · गलत: 1 · छोड़े: 3', { exact: true }).waitFor();
      await page.getByRole('button', { name: 'फिर से शुरू करें' }).click();
      for (let i = 0; i < 5; i++) await page.getByRole('button', { name: 'यह सवाल छोड़ें' }).click();
      await page.getByText('सही: 0 · गलत: 0 · छोड़े: 5', { exact: true }).waitFor();
      assert.equal(requests.length, beforeQuiz, 'quiz makes no model requests');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'quiz has no horizontal overflow');
      assert.deepEqual(errors, []);
      console.log(JSON.stringify({ width, checks: 'PASS', requests: requests.length, quizModelCalls: 0 }));
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
