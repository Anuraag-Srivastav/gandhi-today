import { expect, test } from "bun:test";
import { bindEvidenceQuestion, canUseRetainedEvidence } from "./evidence";
test("source follow-up reuses only question-bound passages with a source", () => {
  const reference = bindEvidenceQuestion(JSON.stringify({excerpts:[{text:"A passage",sourceUrl:"https://example.org/source"}]}), "A historical question");
  expect(canUseRetainedEvidence(reference,"A historical question","Can you identify a source?")).toBe(true);
  expect(canUseRetainedEvidence(reference,"Different question","Source please")).toBe(false);
  expect(canUseRetainedEvidence(reference,"A historical question","Search online again")).toBe(false);
  expect(canUseRetainedEvidence(reference,undefined,"Source please")).toBe(false);
  expect(canUseRetainedEvidence(bindEvidenceQuestion('{"excerpts":[]}',"A historical question"),"A historical question","Source please")).toBe(false);
});
