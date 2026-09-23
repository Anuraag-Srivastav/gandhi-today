import { expect, test } from "bun:test";
import { reviewIssues, reviewFormat, REVIEW_INSTRUCTIONS } from "./answer-review";

test("review returns bounded actionable issues, not replacement answers", () => {
  expect(reviewIssues('{"issues":[]}')).toEqual([]);
  expect(reviewIssues('{"issues":["Unsupported factual attribution"]}')).toHaveLength(1);
  for (const value of ["invalid", "{}", '{"issues":[null]}', JSON.stringify({issues:Array(4).fill("Issue")})]) expect(() => reviewIssues(value)).toThrow();
  expect(reviewFormat.json_schema.strict).toBe(true);
  expect(REVIEW_INSTRUCTIONS).toContain("not an ordinary consideration");
});
