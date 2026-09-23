import { expect, test } from "bun:test";
import { answerSize, enforceAnswerLimits } from "./answer-limits";

test("word and paragraph boundaries include unicode whitespace and citations", () => {
  expect(answerSize("one\u202ftwo\r\n\r\n[Source](https://example.org)")).toEqual({ words: 3, paragraphs: 2 });
});
test("valid response is unchanged and makes no rewrite call", async () => {
  const text = Array(140).fill("word").join(" ");
  expect(await enforceAnswerLimits(text, () => { throw new Error("unexpected rewrite"); })).toEqual({ text, rewritten: false });
});
test("overlength response is rewritten once rather than truncated", async () => {
  const draft = Array(141).fill("word").join(" ");
  let calls = 0;
  const result = await enforceAnswerLimits(draft, async input => {
    calls++;
    expect(input).toBe(draft);
    return "A qualified answer. [Source](https://example.org)";
  });
  expect(result.rewritten).toBe(true);
  expect(result.text).toContain("[Source]");
  expect(calls).toBe(1);
});
test("four paragraphs need revision even under the word cap", async () => {
  expect((await enforceAnswerLimits("One\n\nTwo\n\nThree\n\nFour", async () => "One. Two. Three. Four.")).rewritten).toBe(true);
});
test("failed or empty revision is not delivered", async () => {
  const draft = Array(141).fill("word").join(" ");
  await expect(enforceAnswerLimits(draft, async () => draft)).rejects.toThrow("response limit");
  await expect(enforceAnswerLimits(draft, async () => "")).rejects.toThrow("response limit");
});

test("validation distinguishes empty output and excess paragraphs", async () => {
  for (const [text, reason] of [["", "empty"], ["A\n\nB\n\nC\n\nD", "paragraphs"]]) {
    try { await enforceAnswerLimits(text, async () => text); throw new Error("expected failure"); }
    catch (error) { expect(error.validation.reason).toBe(reason); }
  }
});
