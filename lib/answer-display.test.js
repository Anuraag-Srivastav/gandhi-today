import { expect, test } from "bun:test";
import { answerWithSources, plainAnswerText } from "./answer-display";
test("paired emphasis becomes ordinary prose", () => {
  expect(plainAnswerText("through *sarvodaya*—and **ahimsa** or ***swaraj***.")).toBe("through sarvodaya—and ahimsa or swaraj.");
  expect(plainAnswerText(String.raw`Use \*ahimsa\*.`)).toBe("Use ahimsa.");
  expect(plainAnswerText("2*3*4; a lone *; 2 * 3")).toBe("2*3*4; a lone *; 2 * 3");
});
test("inline and trailing citations become one deduplicated source row", () => {
  const result = answerWithSources("First claim [Source](https://example.org/a). Next claim.[Source](https://example.org/a)\n\nLast claim https://example.org/b.");
  expect(result.body).toBe("First claim. Next claim.\n\nLast claim.");
  expect(result.sources).toEqual([{url:"https://example.org/a",label:"example.org"},{url:"https://example.org/b",label:"example.org"}]);
});
test("source display retains actual labels and does not accept invented or unsafe links", () => {
  expect(answerWithSources("Text [A book](https://example.org/book)").sources[0].label).toBe("A book");
  expect(answerWithSources("Read [A book](https://example.org/book).").body).toBe("Read A book.");
  expect(answerWithSources("No sources here")).toEqual({body:"No sources here",sources:[]});
  expect(answerWithSources("[link](javascript:alert(1))").sources).toEqual([]);
  expect(answerWithSources("https://user:secret@example.org/path").sources).toEqual([]);
});
test("unresolved source tokens never appear as visible citation content", () => {
  expect(answerWithSources("Claim 【Source】 . Another [Source].")).toEqual({
    body: "Claim. Another.", sources: [],
  });
});
