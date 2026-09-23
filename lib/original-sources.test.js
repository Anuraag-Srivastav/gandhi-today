import { expect, test } from "bun:test";
import { inspectOriginalSources } from "./original-sources";

test("only approved archive text is returned, with scripts removed", async () => {
  const result = await inspectOriginalSources("[Source](https://www.mkgandhi.org/page)", new AbortController().signal,
    async () => new Response("<script>untrusted executable</script><p>" + "A documented passage. ".repeat(12) + "&amp; more</p>", {headers:{"content-type":"text/html"}}));
  expect(result[0].status).toBe("inspected");
  expect(result[0].content).toContain("& more");
  expect(result[0].content).not.toContain("untrusted executable");
});

test("unapproved hosts, credentials, PDFs, failures and unsafe redirects are not evidence", async () => {
  let calls = 0;
  const denied = await inspectOriginalSources("[Source](https://127.0.0.1/private)", new AbortController().signal,
    async () => { calls++; throw new Error("should not fetch"); });
  expect(calls).toBe(0);
  expect(denied[0].status).toBe("not-inspected");
  for (const response of [
    new Response("pdf", {headers:{"content-type":"application/pdf"}}),
    new Response(null, {status:302,headers:{location:"https://127.0.0.1/private"}}),
    new Response("unavailable", {status:503}),
    new Response("x".repeat(500001), {headers:{"content-type":"text/plain"}}),
  ]) {
    const result = await inspectOriginalSources("[Source](https://www.mkgandhi.org/page)", new AbortController().signal, async () => response);
    expect(result[0].status).toBe("not-inspected");
    expect(result[0].content).toBeUndefined();
  }
});
