import { expect, test } from "bun:test";
import { answerRecords, getPublishedAnswer, publishedAnswers } from "./answers";

test("only reviewed, sourced records are published", () => {
  expect(publishedAnswers.length).toBeGreaterThan(0);
  for (const answer of publishedAnswers) {
    expect(answer.status).toBe("published");
    expect(answer.shortAnswer?.length).toBeGreaterThan(0);
    expect(answer.sections.length).toBeGreaterThan(0);
    expect(answer.sources.length).toBeGreaterThan(0);
  }
});

test("requested draft topics remain inaccessible through the public lookup", () => {
  const drafts = answerRecords.filter(({ status }) => status === "draft");
  expect(drafts.map(({ slug }) => slug)).toEqual([
    "gandhi-on-wealth-and-possessions",
    "gandhi-on-non-violence",
    "gandhi-on-meaningful-work",
    "gandhi-on-ambition",
    "gandhi-and-social-media",
  ]);
  for (const draft of drafts) expect(getPublishedAnswer(draft.slug)).toBeUndefined();
});

test("published summaries preserve the evidenced sequence and source captions do not repeat their label", () => {
  const khadi = getPublishedAnswer("why-gandhi-spun-his-own-cloth");
  expect(khadi.summary.indexOf("hand-woven cloth")).toBeLessThan(khadi.summary.indexOf("then pursued spinning"));
  for (const source of khadi.sources) expect(source.claimSupported).not.toMatch(/^supports\b/i);
});
