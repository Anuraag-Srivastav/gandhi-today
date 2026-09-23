import { afterEach, expect, mock, spyOn, test } from "bun:test";

const initial = { answerType: "interpretation", shortAnswer: "A tentative application.", historicalBasis: [], interpretationBoundary: "This is an interpretation, not recorded speech.", contestedReadings: [], missingEvidence: "", suggestedFollowUps: [], verificationSummary: "" };
const calls = [];
let planKind = "interpretation", invalidPlan = false, toolResults = true, searchFails = false, hangSearch = false;
let draft = JSON.stringify(initial), revision = JSON.stringify(initial), finishReason = "stop", revisionFinishReason = "stop";
const create = mock(async (params, options) => {
  calls.push(params);
  if (params.response_format?.type === "json_object") {
    const question = JSON.parse(params.messages.at(-1).content).conversation.at(-1).content;
    return { choices: [{ message: { content: invalidPlan ? "invalid" : JSON.stringify({ kind: planKind, question }) } }] };
  }
  if (params.tools) {
    if (hangSearch) return new Promise((_, reject) => options.signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true }));
    if (searchFails) throw new Error("Provider unavailable");
    return { choices: [{ message: { content: "MODEL SUMMARY MUST NOT BECOME EVIDENCE", executed_tools: toolResults ? [{ type: "browser_search", arguments: "{}", index: 0, browser_results: [{ title: "Primary document", url: "https://example.org/document", content: "Source passage with an important qualification." }] }] : [] } }] };
  }
  const repair = JSON.parse(params.messages.at(-1).content).Draft !== undefined;
  return { choices: [{ message: { content: repair ? revision : draft }, finish_reason: repair ? revisionFinishReason : finishReason }] };
});
mock.module("groq-sdk", () => ({ default: class { chat = { completions: { create } }; } }));
const { POST } = await import("./route");
const original = { key: process.env.GROQ_API_KEY, model: process.env.GROQ_MODEL, node: process.env.NODE_ENV };
afterEach(() => {
  calls.length = 0; planKind = "interpretation"; invalidPlan = false; toolResults = true; searchFails = hangSearch = false;
  draft = revision = JSON.stringify(initial); finishReason = revisionFinishReason = "stop";
  for (const [key, value] of Object.entries({ GROQ_API_KEY: original.key, GROQ_MODEL: original.model, NODE_ENV: original.node })) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
});
async function request(body) {
  process.env.GROQ_API_KEY = "test-only-key"; process.env.GROQ_MODEL ||= "openai/gpt-oss-120b";
  return POST(new Request("http://localhost/api/chat", { method: "POST", body: JSON.stringify(body) }));
}
async function ask(question, extra = {}) {
  const response = await request({ messages: [{ role: "user", content: question }], ...extra });
  return (await response.text()).trim().split("\n").map(JSON.parse);
}
const answers = () => calls.filter(c => c.response_format?.type === "json_schema");
const searches = () => calls.filter(c => c.tools);
test("ordinary response is one validated structured result with no text transcript", async () => {
  const events = await ask("Explain a principle");
  expect(events.filter(e => e.type === "result")).toHaveLength(1);
  expect(events.some(e => e.type === "text")).toBe(false);
  expect(events.at(-1).type).toBe("done");
  expect(searches()).toHaveLength(0);
  expect(answers()[0].stream).toBe(false);
  expect(answers()[0].tools).toBeUndefined();
  expect(answers()[0].response_format.json_schema.strict).toBe(true);
});
test("overlong result is withheld and repaired once using the same evidence", async () => {
  draft = JSON.stringify({ ...initial, shortAnswer: Array(141).fill("word").join(" ") });
  const events = await ask("Explain a principle");
  expect(answers()).toHaveLength(2);
  expect(JSON.parse(answers()[1].messages.at(-1).content).Draft).toBe(draft);
  expect(events.find(e => e.type === "result").result.shortAnswer).toBe(initial.shortAnswer);
});
test("failed repair emits no partial result and makes no further attempts", async () => {
  draft = revision = "not json";
  const events = await ask("Explain a principle");
  expect(answers()).toHaveLength(2);
  expect(events.some(e => e.type === "result" || e.type === "done")).toBe(false);
  expect(events.at(-1).text).toContain("previous result has not changed");
});
test("provider-truncated JSON is not accepted even when it parses", async () => {
  finishReason = "length";
  await ask("Explain a principle");
  expect(answers()).toHaveLength(2);
});
test("provider-truncated repair also fails closed", async () => {
  finishReason = revisionFinishReason = "length";
  const events = await ask("Explain a principle");
  expect(events.some(e => e.type === "result")).toBe(false);
});
test("historical generation receives actual passages and produces catalog-bound source links", async () => {
  planKind = "historical";
  draft = JSON.stringify({ ...initial, answerType: "historical", interpretationBoundary: "", historicalBasis: [{ claim: "A sourced claim.", evidenceId: "e1", supportingQuote: "Source passage with an important qualification." }] });
  const events = await ask("A historical question");
  expect(searches()).toHaveLength(1);
  const catalog = JSON.parse(answers()[0].messages.at(-1).content).Evidence;
  expect(catalog[0].text).toContain("Source passage");
  expect(JSON.stringify(catalog)).not.toContain("MODEL SUMMARY");
  expect(events.find(e => e.type === "result").result.sources[0].url).toBe("https://example.org/document");
});
test("fabricated source identifier triggers repair, not a fabricated link", async () => {
  draft = JSON.stringify({ ...initial, historicalBasis: [{ claim: "Claim", evidenceId: "invented", supportingQuote: "Fabricated passage of a sufficient length." }] });
  const events = await ask("Explain a principle");
  expect(answers()).toHaveLength(2);
  expect(events.find(e => e.type === "result").result.sources).toEqual([]);
});
test("source deadline aborts work with no successful result", async () => {
  const native = globalThis.setTimeout;
  const timer = spyOn(globalThis, "setTimeout").mockImplementation((fn, ms, ...args) => native(fn, ms > 40000 ? 2 : ms, ...args));
  hangSearch = true;
  try { const events = await ask("Source please"); expect(events.at(-1).text).toContain("time limit"); expect(answers()).toHaveLength(0); } finally { timer.mockRestore(); }
});
test("failed source check retains signed evidence and retries without another search", async () => {
  draft = revision = "invalid";
  const events = await ask("Verify the source");
  const saved = events.find(e => e.retryToken);
  expect(saved.evidenceToken).toBeTruthy();
  calls.length = 0; draft = JSON.stringify(initial);
  const retry = await ask("Verify the source", { evidenceToken: saved.evidenceToken, retryToken: saved.retryToken });
  expect(searches()).toHaveLength(0);
  expect(retry.at(-1).type).toBe("done");
  calls.length = 0;
  await ask("Verify a different claim", { evidenceToken: saved.evidenceToken, retryToken: saved.retryToken });
  expect(searches()).toHaveLength(1);
});
test("historical generation retry also reuses its evidence", async () => {
  planKind = "historical"; draft = revision = "invalid";
  const events = await ask("A historical question"); const saved = events.find(e => e.retryToken);
  calls.length = 0; draft = JSON.stringify(initial);
  await ask("A historical question", { evidenceToken: saved.evidenceToken, retryToken: saved.retryToken });
  expect(searches()).toHaveLength(0);
});
test("source check targets latest question and signals in-place replacement", async () => {
  const messages = [{ role: "user", content: "A modern dilemma" }, { role: "assistant", content: "Tentative answer" }, { role: "user", content: "Define the term" }, { role: "assistant", content: "A definition" }, { role: "user", content: "Check that" }];
  const response = await request({ messages, verifySources: true });
  const events = (await response.text()).trim().split("\n").map(JSON.parse);
  expect(events.some(e => e.type === "source-check")).toBe(true);
  expect(JSON.parse(searches()[0].messages.at(-1).content).verificationTarget).toEqual({ question: "Define the term", answer: "A definition" });
  expect(JSON.parse(answers()[0].messages.at(-1).content).originalQuestion).toBe("Define the term");
});
test("source follow-up reuses the same question's evidence", async () => {
  planKind = "historical"; const first = await ask("A historical question"); const saved = first.find(e => e.evidenceToken);
  calls.length = 0;
  const response = await request({ messages: [{ role: "user", content: "A historical question" }, { role: "assistant", content: JSON.stringify(initial) }, { role: "user", content: "Source please" }], evidenceToken: saved.evidenceToken });
  await response.text(); expect(searches()).toHaveLength(0); expect(answers()).toHaveLength(1);
});
test("a new historical topic does not inherit verification restrictions", async () => {
  const first = await ask("Source please"); planKind = "historical"; calls.length = 0;
  await ask("A different historical question", { evidenceToken: first.find(e => e.evidenceToken).evidenceToken });
  expect(searches()).toHaveLength(1); expect(answers()[0].messages[0].content).toContain("Answer the historical question");
});
test("definition and reassessment do not require another search", async () => {
  for (const kind of ["definition", "reassessment"]) { planKind = kind; await ask("A contextual follow-up"); }
  expect(searches()).toHaveLength(0); expect(answers()).toHaveLength(2);
});
test("background reading retrieves bibliographic evidence", async () => {
  planKind = "reading"; await ask("What can I read?");
  expect(JSON.parse(searches()[0].messages.at(-1).content).purpose).toBe("reading");
});
test("malformed routing fails without silent guessing", async () => {
  invalidPlan = true; const events = await ask("A question"); expect(answers()).toHaveLength(0); expect(searches()).toHaveLength(0); expect(events.at(-1).type).toBe("error");
});
test("failed historical retrieval does not fall back to an unsupported answer", async () => {
  planKind = "historical"; searchFails = true; await ask("A historical question"); expect(answers()).toHaveLength(0);
});
test("no tool results means an empty catalog, not research-model prose", async () => {
  toolResults = false; await ask("Source please"); expect(JSON.parse(answers()[0].messages.at(-1).content).Evidence).toEqual([]);
});
test("tampered evidence rejected before any provider call", async () => {
  const response = await request({ messages: [{ role: "user", content: "A question" }], evidenceToken: "tampered.token" }); expect(response.status).toBe(400); expect(calls).toHaveLength(0);
});
test("production sends only evidence transport metadata, no model, prompt, tool counts or headers", async () => {
  process.env.NODE_ENV = "production";
  const response = await request({ messages: [{ role: "user", content: "A question" }] });
  expect(response.headers.get("X-Prompt-Version")).toBeNull();
  const events = (await response.text()).trim().split("\n").map(JSON.parse);
  for (const event of events.filter(e => e.type === "metadata")) expect(Object.keys(event).every(key => ["type", "evidenceToken", "retryToken"].includes(key))).toBe(true);
});
test("public clients cannot switch the model through development comparison tooling", async () => {
  process.env.NODE_ENV = "production";
  const response = await request({ messages: [{ role: "user", content: "A question" }], answerModel: "openai/gpt-oss-20b", comparisonToken: "test" });
  expect(response.status).toBe(400); expect(calls).toHaveLength(0);
});
