/** Browser checks for static public answers and draft exclusion. */
/* eslint-disable @typescript-eslint/no-require-imports */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");

(async () => {
  const launchOptions = process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {};
  const browser = await chromium.launch(launchOptions);
  const baseUrl = process.env.CHAT_TEST_URL || "http://localhost:3107";
  try {
    for (const width of [375, 1280]) {
      const page = await browser.newPage({ viewport: { width, height: 844 } });
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));

      await page.goto(`${baseUrl}/`);
      await page.getByRole("link", { name: "Why did Gandhi spin his own cloth?" }).waitFor();
      assert.equal(await page.getByRole("textbox", { name: "Your question about Gandhi" }).count(), 1, "chat composer retained");
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "homepage has no horizontal overflow");

      await page.goto(`${baseUrl}/answers`);
      assert.equal(await page.locator("article").count(), 1, "index includes only the published answer");
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "answer index has no horizontal overflow");

      await page.getByRole("link", { name: "Why did Gandhi spin his own cloth?" }).click();
      await page.getByRole("heading", { name: "The short answer" }).waitFor();
      await page.getByRole("heading", { name: "Where interpretation begins" }).waitFor();
      assert.equal(await page.getByRole("link", { name: /An Autobiography or The Story/ }).getAttribute("href"), "https://www.mkgandhi.in/autobio/chap163.htm");
      assert.equal(await page.locator('link[rel="canonical"]').getAttribute("href"), "https://www.gandhisays.in/answers/why-gandhi-spun-his-own-cloth");
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "answer page has no horizontal overflow");
      assert.deepEqual(errors, []);

      const draftResponse = await page.goto(`${baseUrl}/answers/gandhi-on-wealth-and-possessions`);
      assert.equal(draftResponse.status(), 404, "draft route is not public");
      console.log(`PASS ${width}px: homepage link, index, metadata, source, interpretation boundary, draft exclusion, overflow`);
      await page.close();
    }
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
