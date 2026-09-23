/** Controlled UI contract checks; no model requests or API key required. */
/* eslint-disable @typescript-eslint/no-require-imports */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const questions = [
  'What did Gandhi believe about wealth and possessions?',
  'Why did Gandhi spin his own cloth?',
  'Should I leave a well-paid job for work that matters more?',
  'Is it wrong to want to be rich?',
  'What are the strongest criticisms of Gandhi?',
  'How might his ideas apply to AI or social media?',
];
(async () => {
  const browser = await chromium.launch();
  try {
    for (const width of [375, 1280]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      let metadata = {};
      let linked = true;
      let failure = false;
      const requests = [];
      await page.route('**/api/chat', route => {
        requests.push(route.request().postDataJSON());
        const events = failure ? [{ type: 'error', text: 'Test failure' }] : [
          { type: 'metadata', ...metadata },
          { type: 'text', text: 'A test answer.' + (linked ? ' [Source](https://example.org/passage)' : '') },
          { type: 'done' },
        ];
        return route.fulfill({ contentType: 'application/x-ndjson', body: events.map(event => JSON.stringify(event)).join('\n') + '\n' });
      });
      await page.goto(process.env.CHAT_TEST_URL || 'http://localhost:3107');
      assert.deepEqual(await page.locator('.grid button').allTextContents(), questions);
      assert.equal(await page.getByText('Modern applications are interpretations, not his recorded words.', { exact: true }).count(), 1);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      for (const selector of ['meta[name="description"]', 'meta[property="og:description"]', 'meta[name="twitter:description"]']) {
        assert.equal(await page.locator(selector).getAttribute('content'), "What Gandhi actually wrote, where he's been criticised, and how his principles might apply today, with sources.");
      }
      await page.screenshot({ path: `/tmp/gandhi-copy-home-${width}.png`, fullPage: true });
      const ask = async () => {
        await page.getByRole('textbox').fill('A question');
        await page.getByRole('button', { name: 'Ask', exact: true }).click();
        await page.getByRole('button', { name: 'Verify sources', exact: true }).waitFor();
      };
      await ask();
      let answer = page.locator('article').last();
      assert.equal(await answer.getByText('Read the passage', { exact: true }).count(), 1);
      assert.equal(await answer.getByText(/From the historical record|An interpretation of his principles|Related:|danger now/).count(), 0);
      await answer.getByRole('button', { name: 'Which parts of this are documented?' }).click();
      await page.getByRole('button', { name: 'Verify sources', exact: true }).waitFor();
      assert.equal(requests.at(-1).messages.at(-1).content, 'Which parts of this are documented?');
      assert.equal(requests.at(-1).messages.length, 3);
      metadata = { answer_type: 'interpretive', safety_flag: true, related_concepts: ['Truth', 'Service', 'Freedom', 'Wealth'] };
      await ask();
      answer = page.locator('article').last();
      assert.equal(await answer.getByText('An interpretation of his principles', { exact: true }).count(), 1);
      assert.equal(await answer.getByText('Principle drawn from', { exact: true }).count(), 1);
      assert.equal(await answer.getByText(/contact local emergency services/).count(), 1);
      assert.equal(await answer.getByRole('button').count(), 4);
      await answer.getByRole('button', { name: 'Truth', exact: true }).click();
      await page.getByRole('button', { name: 'Verify sources', exact: true }).waitFor();
      assert.equal(requests.at(-1).messages.at(-1).content, 'Tell me more about Truth.');
      assert(requests.at(-1).messages.every(message => Object.keys(message).length === 2), 'UI metadata never changes model history');
      metadata = { answer_type: 'historical', safety_flag: false, related_concepts: [], is_refusal: true };
      await ask();
      answer = page.locator('article').last();
      assert.equal(await answer.getByText('From the historical record', { exact: true }).count(), 1);
      assert.equal(await answer.getByText('Read the passage', { exact: true }).count(), 1);
      assert.equal(await answer.getByRole('button').count(), 0);
      metadata = { answer_type: 'other', safety_flag: 'true', related_concepts: ['', null, 4] };
      linked = false;
      await ask();
      answer = page.locator('article').last();
      assert.equal(await answer.getByRole('navigation').count(), 0);
      assert.equal(await answer.getByRole('button').count(), 0);
      assert.equal(await answer.getByText(/From the historical record|An interpretation of his principles|Related:|danger now/).count(), 0);
      failure = true;
      await page.getByRole('textbox').fill('Fail');
      await page.getByRole('button', { name: 'Ask', exact: true }).click();
      await page.getByRole('alert').filter({ hasText: 'Test failure' }).waitFor();
      assert.equal(await page.locator('article').last().getByRole('button').count(), 0);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      console.log(`PASS ${width}px: exact chips, metadata, absent/present/invalid fields, refusal, error, follow-up history, no overflow`);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
