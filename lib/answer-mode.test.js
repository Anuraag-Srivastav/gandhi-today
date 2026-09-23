import { expect, test } from "bun:test";
import { answerMode, turnInstruction } from "./answer-mode";
test("turn modes distinguish reading, inference challenge, ordinary history and verification", () => {
  expect(answerMode("What can I read?", false)).toBe("reading");
  expect(answerMode("Which part is inference?", false)).toBe("reassessment");
  expect(answerMode("When was an organisation founded?", false)).toBe("ordinary");
  expect(answerMode("What can I read?", true)).toBe("verification");
  expect(turnInstruction("ordinary")).toContain("not a continuation of a source audit");
  expect(turnInstruction("verification")).toContain("without claiming it never occurred");
});
