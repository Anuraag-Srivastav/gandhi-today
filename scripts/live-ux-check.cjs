/** Live end-to-end smoke: actual answer + in-place source check. Does not assign a semantic score. */
/* eslint-disable @typescript-eslint/no-require-imports */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    page.setDefaultTimeout(115000);
    await page.goto(process.env.CHAT_TEST_URL || 'https://www.gandhisays.com');
    await page.getByRole('textbox', { name: 'Your question', exact: true }).fill('How might Gandhi view a library replacing its help desk with software?');
    await page.getByRole('button', { name: 'Ask →', exact: true }).click();
    const article = page.getByRole('article', { name: 'Inquiry result' });
    await article.waitFor();
    const question = await article.getByRole('heading', { level: 2 }).innerText();
    await page.getByRole('button', { name: 'Check sources', exact: true }).click();
    await page.getByRole('button', { name: /Check again|Retry source check/ }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Retry source check' }).count(), 0, await article.innerText());
    assert.equal(await article.count(), 1);
    assert.equal(await article.getByRole('heading', { level: 2 }).innerText(), question);
    assert.equal(await page.locator('.previous-inquiries').count(), 0);
    assert.equal(await page.locator('.source-card > a').count() > 0, true, 'source passages attached');
    assert(!(await page.locator('body').innerText()).match(/Test details|openai\/|tools:|prompt hash/));
    await page.screenshot({ path: '/tmp/gandhi-live-desktop.png', fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: '/tmp/gandhi-live-mobile.png', fullPage: true });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    console.log(JSON.stringify({ completed: true, question, resultText: await article.innerText() }));
    await page.goto(new URL('/quiz', page.url()).href);
    await page.getByRole('button', { name: 'शुरू करें →' }).waitFor();
    await page.screenshot({ path: '/tmp/gandhi-live-quiz.png', fullPage: true });
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
