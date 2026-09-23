import { expect, test } from "bun:test";
import { selectSourceEvidence } from "./source-excerpts";
import { sealEvidence, openEvidence } from "./evidence";

test("large results retain relevant verbatim evidence and identifying metadata", () => {
  const passage = "Harijan Sevak Sangh was founded on September 30, 1932.";
  const records = [{ browser_results: [{ url: "https://example.org/history", title: "History",
    content: "Unrelated navigation. ".repeat(10000) + passage + " More navigation.".repeat(10000) }] }];
  const result = selectSourceEvidence(records, "When was Harijan Sevak Sangh founded?");
  expect(result.length).toBeLessThan(32000);
  expect(result).toContain(passage);
  expect(result).toContain("https://example.org/history");
  expect(JSON.parse(result).partial).toBe(true);
  expect(openEvidence(sealEvidence(result, "test"), "test")).toBe(result);
});

test("escaping does not exceed the serialized budget", () => {
  const result = selectSourceEvidence([{ output: '"\\\n'.repeat(50000) }], "source");
  expect(result.length).toBeLessThan(32000);
  expect(() => JSON.parse(result)).not.toThrow();
});

test("short adjacent raw documents retain their own URLs without mixing passages", () => {
  const bundle = JSON.parse(selectSourceEvidence([{ output: "First (https://example.org/one)\nFirst passage.\n[Second](https://example.org/two)\nSecond passage." }], "passage"));
  const first = bundle.excerpts.find(e => e.text.includes("First passage"));
  const second = bundle.excerpts.find(e => e.text.includes("Second passage"));
  expect(first.sourceUrl).toBe("https://example.org/one");
  expect(second.sourceUrl).toBe("https://example.org/two");
  expect(first.text).not.toContain("Second passage");
});
