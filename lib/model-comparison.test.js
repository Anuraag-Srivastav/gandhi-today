import { expect, test } from "bun:test";
import { comparisonReceipt, openComparison } from "./model-comparison";
test("comparison receipts cannot cross prompts, inputs, evidence or token purposes", () => {
  const snapshot = { mode: "interpretation", sourceRequired: false, searchStatus: "not-requested", reasoningEffort: "low" };
  const token = comparisonReceipt(snapshot, "request", "evidence", "prompt", "secret");
  expect(openComparison(token, "request", "evidence", "prompt", "secret")).toMatchObject(snapshot);
  for (const args of [["other", "evidence", "prompt"], ["request", "other", "prompt"], ["request", "evidence", "other"]]) {
    expect(() => openComparison(token, ...args, "secret")).toThrow();
  }
  expect(() => openComparison(token, "request", "evidence", "prompt", "wrong-secret")).toThrow();
});
