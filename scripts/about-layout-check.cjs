/** About layout checks at phone, tablet, desktop and zoomed-out equivalent widths. */
/* eslint-disable @typescript-eslint/no-require-imports */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch();
  try {
    for (const width of [375, 768, 1280, 3840]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      await page.goto((process.env.CHAT_TEST_URL || 'http://localhost:3107') + '/about');
      await page.evaluate(() => document.fonts.ready);
      const image = page.locator('figure img');
      await image.scrollIntoViewIfNeeded();
      await image.evaluate(el => el.decode());
      const box = await image.boundingBox();
      const heading = await page.getByRole('heading', { name: 'Transcription' }).boundingBox();
      assert(box.height <= 420.1, 'image height capped');
      assert(Math.abs(box.width / box.height - 1400 / 2194) < .01, 'original aspect ratio');
      if (width >= 768) assert(heading.x > box.x + box.width, 'desktop side-by-side');
      else assert(heading.y > box.y + box.height, 'phone stacked');
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no horizontal overflow');
      const link = page.getByRole('link', { name: 'Open full-size letter (new tab)', exact: true });
      assert.equal(await link.getAttribute('href'), '/assets/archive/gandhi-note-full.webp');
      assert.equal(await link.getAttribute('target'), '_blank');
      await page.screenshot({ path: `/tmp/gandhi-about-layout-${width}.png`, fullPage: true });
      console.log(`PASS ${width}px: image ${Math.round(box.width)} × ${Math.round(box.height)}, responsive layout, full-size link, no overflow`);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
