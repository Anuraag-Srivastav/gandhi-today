import { expect, test } from "bun:test";
import { parseAnswerPlan, planRequest, needsEvidence } from "./answer-plan";
const plan = fields => JSON.stringify({quotationCheck:false,quotationText:null,...fields});

test("routing accepts only bounded known kinds, not a generated answer", () => {
  expect(parseAnswerPlan(plan({kind:"historical",question:"A question",targetIndex:null}), [])).toEqual({kind:"historical",question:"A question",targetIndex:null});
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

test("context target must be an existing assistant, including historical follow-ups", () => {
  const history = [{role:"user",content:"Earlier topic"}, {role:"assistant",content:"Earlier answer"},
    {role:"user",content:"Reading"}, {role:"assistant",content:"Another work"}];
  expect(parseAnswerPlan(plan({kind:"verification",question:"Check the earlier claim",targetIndex:1}), history).targetIndex).toBe(1);
  for (const targetIndex of [-1, 0, 4, 1.5, undefined]) {
    expect(() => parseAnswerPlan(plan({kind:"verification",question:"Check",targetIndex}), history)).toThrow();
  }
  expect(parseAnswerPlan(plan({kind:"historical",question:"Which part was historical?",targetIndex:1}), history).targetIndex).toBe(1);
  expect(needsEvidence("clarification")).toBe(false);
});

test("quotation authentication cannot invent wording absent from conversation", () => {
  const messages = [{role:"user",content:"Can you authenticate that saying?"}];
  for (const quotationText of [null, "A remembered famous saying"]) {
    expect(parseAnswerPlan(plan({kind:"verification",question:"Invented subject",targetIndex:null,quotationCheck:true,quotationText}), messages).kind).toBe("clarification");
  }
  messages[0].content = 'Did he say "Some actual supplied wording"?';
  expect(parseAnswerPlan(plan({kind:"verification",question:messages[0].content,targetIndex:null,quotationCheck:true,quotationText:"Some actual supplied wording"}), messages).kind).toBe("verification");
});
test("planner receives full context as data, no source or answer exemplars", () => {
  const messages = [{role:"user",content:"An initial question"},{role:"assistant",content:"Unverified old answer"},{role:"user",content:"What about that?"}];
  const request = planRequest("openai/gpt-oss-120b", messages);
  expect(JSON.parse(request.messages[1].content).conversation).toEqual(messages.map((message,index) => ({index,...message})));
  expect(request.response_format.type).toBe("json_schema");
  expect(request.response_format.json_schema.schema.properties.targetIndex.enum).toEqual([null,1]);
  expect(request.tools).toBeUndefined();
  expect(request.messages[0].content).toContain("Do not answer");
});
