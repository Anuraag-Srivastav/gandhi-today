import { expect, test } from "bun:test";
import { parseAnswerPlan, planRequest, needsEvidence } from "./answer-plan";

test("routing accepts only bounded known kinds, not a generated answer", () => {
  expect(parseAnswerPlan('{"kind":"historical","question":"A question","targetIndex":null}', [])).toEqual({kind:"historical",question:"A question",targetIndex:null});
  for (const text of ["not json", '{"kind":"guess","question":"X"}', '{"kind":"historical","question":""}']) {
    expect(() => parseAnswerPlan(text, [])).toThrow();
  }
});
test("only factual and bibliographic kinds require proactive evidence", () => {
  expect(needsEvidence("historical")).toBe(true);
  expect(needsEvidence("reading")).toBe(true);
  expect(needsEvidence("verification")).toBe(true);
  for (const kind of ["interpretation", "definition", "reassessment", "unrelated"]) expect(needsEvidence(kind)).toBe(false);
});
test("targets must select actual assistant messages, never invented or user indices", () => {
  const messages = [{role:"user",content:"First topic"},{role:"assistant",content:"First answer"},{role:"user",content:"Second topic"},{role:"assistant",content:"Second answer"}];
  expect(parseAnswerPlan(JSON.stringify({kind:"verification",question:"Check first answer",targetIndex:1}), messages).targetIndex).toBe(1);
  for (const targetIndex of [-1, 0, 4, "1", undefined]) expect(() => parseAnswerPlan(JSON.stringify({kind:"verification",question:"Check",targetIndex}), messages)).toThrow();
  expect(() => parseAnswerPlan(JSON.stringify({kind:"definition",question:"Define",targetIndex:1}), messages)).toThrow();
});
test("planner receives full context as data, no source or answer exemplars", () => {
  const messages = [{role:"user",content:"An initial question"},{role:"assistant",content:"Unverified old answer"},{role:"user",content:"What about that?"}];
  const request = planRequest("openai/gpt-oss-120b", messages);
  expect(JSON.parse(request.messages[1].content).conversation).toEqual(messages);
  expect(request.response_format.type).toBe("json_object");
  expect(request.tools).toBeUndefined();
  expect(request.messages[0].content).toContain("Do not answer");
});
