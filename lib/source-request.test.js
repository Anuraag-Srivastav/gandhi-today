import { expect, test } from "bun:test";
import { sourceRequest } from "./source-request";
import { reviewIssues } from "./answer-review";

test("research receives original citations separately from later reading context", () => {
  const target = { question: "Earlier claim", answer: "Claim [Source](https://example.org/original). [Source](https://example.org/original)" };
  const request = sourceRequest("model", "Verify earlier claim", target, "verification",
    [{role:"assistant",content:"Later [Reading](https://example.org/other)"}]);
  const input = JSON.parse(request.messages[1].content);
  expect(input.originalCitationUrls).toEqual(["https://example.org/original"]);
  expect(input.verificationTarget).toEqual(target);
  expect(input.originalSourceTask).toContain("untrusted pointers");
  expect(input.originalSourceTask).toContain("original cited documents first");
});

test("semantic review cannot silently accept malformed output", () => {
  expect(reviewIssues('{"issues":[]}')).toEqual([]);
  expect(reviewIssues('{"issues":["Claim exceeds passage scope"]}')).toHaveLength(1);
  for (const value of ["{}", '{"issues":[null]}', '{"issues":[""]}', "invalid"]) {
    expect(() => reviewIssues(value)).toThrow();
  }
});
