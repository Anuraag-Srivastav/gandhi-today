/** Validate archive-only presentation without live model requests. */
/* eslint-disable @typescript-eslint/no-require-imports */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const sharp = require('sharp');
const enabled = process.env.ARCHIVE_TEST_ENABLED === 'true';
const base = process.env.CHAT_TEST_URL || 'http://localhost:3107';
const transcription = 'Sinhagadh\nnear Poona\n24. 4. 20\nDear Sir,\nwill you please\ncirculate the\nenclosed to the\nPress & oblige.\nYours truly,\nM. K. Gandhi\nThe Manager\nThe A. P.\nBombay';
(async () => {
  const browser = await chromium.launch();
  try {
    for (const width of [375, 1280]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      await page.goto(base);
      const texture = page.locator('img[src="/assets/archive/gandhi-note-texture.webp"]');
      assert.equal(await texture.count(), enabled ? 1 : 0);
      if (enabled) {
        assert.equal(await texture.locator('xpath=..').evaluate(el => el.tagName), 'HEADER');
        assert.equal(await texture.getAttribute('alt'), '');
        assert.equal(await texture.getAttribute('aria-hidden'), 'true');
        assert.equal(await texture.getAttribute('fetchpriority'), 'low');
        assert(Number(await texture.evaluate(el => getComputedStyle(el).opacity)) <= .08);
      } else assert(!(await page.content()).includes('gandhi-note-'));
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.screenshot({ path: `/tmp/gandhi-archive-home-${enabled}-${width}.png`, fullPage: true });
      if (enabled) {
        const labels = await page.locator('header p, header h1, header a').evaluateAll(elements => elements.map(el => {
          const box = el.getBoundingClientRect();
          return { x: box.x, y: box.y, width: box.width, height: box.height, color: getComputedStyle(el).color };
        }));
        const hideText = await page.addStyleTag({ content: 'header p,header h1,header a { color: transparent !important; }' });
        const { data, info } = await sharp(await page.screenshot()).removeAlpha().raw().toBuffer({ resolveWithObject: true });
        const luminance = rgb => rgb.map(value => value / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4).reduce((sum, value, i) => sum + value * [.2126, .7152, .0722][i], 0);
        let minimum = Infinity;
        for (const label of labels) {
          const foreground = luminance(label.color.match(/[\d.]+/g).slice(0, 3).map(Number));
          for (let y = Math.ceil(label.y); y < Math.floor(label.y + label.height); y++) {
            for (let x = Math.ceil(label.x); x < Math.floor(label.x + label.width); x++) {
              const offset = (y * info.width + x) * info.channels;
              const background = luminance([...data.subarray(offset, offset + 3)]);
              minimum = Math.min(minimum, (Math.max(background, foreground) + .05) / (Math.min(background, foreground) + .05));
            }
          }
        }
        await hideText.evaluate(el => el.remove());
        assert(minimum >= 4.5, `Header text contrast ${minimum}`);
        console.log(`Header minimum measured contrast: ${minimum.toFixed(2)}:1`);
      }
      await page.route('**/api/chat', route => route.fulfill({ contentType: 'application/x-ndjson', body: '{"type":"text","text":"Test answer"}\n{"type":"done"}\n' }));
      await page.getByRole('textbox').fill('Test');
      await page.getByRole('button', { name: 'Ask', exact: true }).click();
      await page.getByText('Test answer', { exact: true }).waitFor();
      assert.equal(await texture.count(), 0, 'no decorative image alongside generated text');
      await page.getByRole('link', { name: 'About', exact: true }).click();
      await page.getByRole('heading', { name: 'What a historical source looks like' }).waitFor();
      assert.equal(await page.locator('img').count(), enabled ? 1 : 0);
      assert.equal(await page.getByRole('heading', { name: 'Transcription' }).locator('xpath=following-sibling::p').textContent(), transcription);
      assert.equal(await page.getByText('Historical answers on this site point to documents like this one. Answers about present-day questions are interpretations of his principles, not his words.', { exact: true }).count(), 1);
      if (enabled) {
        assert.equal(await page.locator('img').getAttribute('alt'), 'Handwritten note signed M. K. Gandhi, dated 24 April 1920, requesting that an enclosure be circulated to the press.');
        assert.equal(await page.locator('figcaption > span').first().textContent(), 'Note from M. K. Gandhi, Sinhagad, near Poona, 24 April 1920, asking the manager of "the A. P." in Bombay to circulate an enclosed statement to the press.');
        assert.equal(await page.locator('figcaption > span').last().textContent(), 'Test credit · Test licence');
      } else assert(!(await page.content()).includes('gandhi-note-'));
      assert(!(await page.content()).includes('gandhi-note-1920.jpg'));
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.screenshot({ path: `/tmp/gandhi-archive-about-${enabled}-${width}.png`, fullPage: true });
      assert.equal((await page.request.get(base + '/assets/archive/source/gandhi-note-1920.jpg')).status(), 404);
      console.log(`PASS archive enabled=${enabled}, ${width}px`);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
