import { afterEach, expect, mock, spyOn, test } from "bun:test";

const calls = [];
const routingCalls = [];
let planKind = "interpretation";
let invalidPlan = false;
let toolResults = true;
let searchFails = false;
let hangSearch = false;
let draft = "An interpretation.";
let revision = "A shorter interpretation.";
let finishReason = "stop";
let revisionFinishReason = "stop";
const create = mock(async (params, options) => {
  if (params.response_format) {
    routingCalls.push(params);
    const question = JSON.parse(params.messages.at(-1).content).conversation.at(-1).content;
    return { choices: [{ message: { content: invalidPlan ? "invalid" : JSON.stringify({ kind: planKind, question }) } }] };
  }
  calls.push(params);
  if (params.tools && hangSearch) return new Promise((_, reject) => {
    options.signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
  });
  if (!params.stream && !params.tools) return { choices: [{ message: { content: revision }, finish_reason: revisionFinishReason }] };
  if (!params.stream && searchFails) throw new Error("Provider unavailable");
  if (!params.stream) return {
    choices: [{ message: { content: "MODEL SUMMARY MUST NOT BECOME EVIDENCE",
      executed_tools: toolResults ? [{ type: "browser_search", arguments: "{}", index: 0,
        browser_results: [{ title: "Primary document", url: "https://example.org/document", content: "Source passage." }] }] : [] } }],
  };
  return (async function* () { yield { choices: [{ delta: { content: draft }, finish_reason: finishReason }] }; })();
});
mock.module("groq-sdk", () => ({ default: class { chat = { completions: { create } }; } }));
const { POST } = await import("./route");
const originalKey = process.env.GROQ_API_KEY;
const originalModel = process.env.GROQ_MODEL;
afterEach(() => {
  calls.length = 0;
  routingCalls.length = 0;
  planKind = "interpretation";
  invalidPlan = false;
  toolResults = true;
  searchFails = false;
  hangSearch = false;
  draft = "An interpretation.";
  revision = "A shorter interpretation.";
  finishReason = revisionFinishReason = "stop";
  if (originalKey === undefined) delete process.env.GROQ_API_KEY; else process.env.GROQ_API_KEY = originalKey;
  if (originalModel === undefined) delete process.env.GROQ_MODEL; else process.env.GROQ_MODEL = originalModel;
});

test("source deadline aborts provider work and emits timeout diagnostics", async () => {
  const nativeTimeout = globalThis.setTimeout;
  const timer = spyOn(globalThis, "setTimeout").mockImplementation((fn, ms, ...args) => nativeTimeout(fn, ms > 40000 ? 2 : ms, ...args));
  hangSearch = true;
  try {
    const events = await ask("source please");
    const metadata = events.findLast(e => e.type === "metadata");
    expect(metadata.failureCode).toBe("timeout");
    expect(metadata.stage).toBe("Source search");
    expect(metadata.searchStatus).toBe("search-failed");
    expect(events.at(-1).text).toContain("time limit");
    expect(calls).toHaveLength(1);
  } finally { timer.mockRestore(); }
});

test("overlong draft is withheld, rewritten with context, and emitted only after validation", async () => {
  draft = Array(141).fill("word").join(" ");
  const events = await ask("Explain a principle");
  expect(calls).toHaveLength(2);
  expect(calls[1].tools).toBeUndefined();
  expect(JSON.parse(calls[1].messages.at(-1).content).Draft).toBe(draft);
  expect(events.filter(e => e.type === "text").map(e => e.text)).toEqual([revision]);
  expect(events.findLast(e => e.type === "metadata").answerRewritten).toBe(true);
});

test("failed rewrite emits no partial answer and makes no further attempts", async () => {
  draft = revision = Array(141).fill("word").join(" ");
  const events = await ask("Explain a principle");
  expect(calls).toHaveLength(2);
  expect(events.some(e => e.type === "text")).toBe(false);
  expect(events.at(-1).text).toContain("response limit");
});
test("short provider-truncated answers are rewritten, not accepted by word count", async () => {
  draft = "An unfinished sentence about";
  finishReason = "length";
  const events = await ask("Explain a principle");
  expect(calls).toHaveLength(2);
  expect(events.find(e => e.type === "text").text).toBe(revision);
});
test("incomplete rewrite is withheld even below the word limit", async () => {
  draft = revision = "An unfinished sentence about";
  finishReason = revisionFinishReason = "length";
  const events = await ask("Explain a principle");
  expect(calls).toHaveLength(2);
  expect(events.some(e => e.type === "text")).toBe(false);
  expect(events.findLast(e => e.type === "metadata").validation.reason).toBe("provider-incomplete");
});

test("failed verification retains bound evidence for retry without another search", async () => {
  draft = revision = Array(141).fill("word").join(" ");
  const events = await ask("Please verify the source");
  const saved = events.find(e => e.retryToken);
  expect(saved.evidenceToken).toBeTruthy();
  expect(events.find(e => e.validation).validation).toEqual({ reason: "words", words: 141, paragraphs: 1 });
  calls.length = 0;
  draft = "A corrected answer.";
  const response = await POST(new Request("http://localhost/api/chat", { method: "POST", body: JSON.stringify({
    messages: [{ role: "user", content: "Please verify the source" }], evidenceToken: saved.evidenceToken, retryToken: saved.retryToken,
  }) }));
  const output = await response.text();
  expect(calls).toHaveLength(1);
  expect(calls[0].tools).toBeUndefined();
  expect(output).toContain("reused-evidence");
  calls.length = 0;
  const changed = await POST(new Request("http://localhost/api/chat", { method: "POST", body: JSON.stringify({
    messages: [{ role: "user", content: "Verify a different claim" }], evidenceToken: saved.evidenceToken, retryToken: saved.retryToken,
  }) }));
  await changed.text();
  expect(calls[0].tools).toBeDefined();
});

test("probe rewrite retains target and evidence without a second search", async () => {
  draft = Array(141).fill("word").join(" ");
  revision = "A qualified interpretation. [Source](https://example.org/document)";
  const events = await ask("Please verify the source");
  expect(calls).toHaveLength(3);
  expect(calls.filter(call => call.tools)).toHaveLength(1);
  const originalInput = JSON.parse(calls[2].messages.at(-2).content);
  expect(originalInput.Reference).toContain("Source passage.");
  expect(originalInput.Question).toBe("Please verify the source");
  expect(events.find(e => e.type === "text").text).toBe(revision);
  expect(events.findLast(e => e.type === "metadata").evidenceToken).toBeTruthy();
});
async function ask(content, evidenceToken = "") {
  process.env.GROQ_API_KEY = "test-only-key";
  process.env.GROQ_MODEL = "openai/gpt-oss-120b";
  const response = await POST(new Request("http://localhost/api/chat", { method: "POST",
    body: JSON.stringify({ messages: [{ role: "user", content }], evidenceToken }) }));
  return (await response.text()).trim().split("\n").map((line) => JSON.parse(line));
}
test("candidate replay uses identical evidence and instructions without routing or search", async () => {
  planKind = "historical";
  const events = await ask("A historical question");
  const receipt = events.find(e => e.comparisonToken);
  const original = calls.find(c => c.stream);
  calls.length = routingCalls.length = 0;
  const response = await POST(new Request("http://localhost/api/chat", { method: "POST", body: JSON.stringify({
    messages: [{ role: "user", content: "A historical question" }], evidenceToken: receipt.evidenceToken,
    comparisonToken: receipt.comparisonToken, answerModel: "llama-3.3-70b-versatile",
  }) }));
  expect((await response.text())).toContain('"type":"done"');
  expect(routingCalls).toHaveLength(0);
  expect(calls).toHaveLength(1);
  expect(calls[0].model).toBe("llama-3.3-70b-versatile");
  expect(calls[0].reasoning_effort).toBeUndefined();
  expect(calls[0].include_reasoning).toBeUndefined();
  expect(calls[0].messages[0].role).toBe("system");
  expect(calls[0].messages.map(m => m.content)).toEqual(original.messages.map(m => m.content));
  const changed = await POST(new Request("http://localhost/api/chat", { method: "POST", body: JSON.stringify({
    messages: [{ role: "user", content: "Different question" }], evidenceToken: receipt.evidenceToken,
    comparisonToken: receipt.comparisonToken, answerModel: "llama-3.3-70b-versatile",
  }) }));
  expect(changed.status).toBe(400);
  draft = revision = "";
  const failed = await POST(new Request("http://localhost/api/chat", { method: "POST", body: JSON.stringify({
    messages: [{ role: "user", content: "A historical question" }], evidenceToken: receipt.evidenceToken,
    comparisonToken: receipt.comparisonToken, answerModel: "llama-3.3-70b-versatile",
  }) }));
  const failedEvents = (await failed.text()).trim().split("\n").map(JSON.parse);
  expect(failedEvents.findLast(e => e.type === "metadata").model).toBe("llama-3.3-70b-versatile");
});
test("background reading retrieves bibliographic evidence before recommendation", async () => {
  planKind = "reading";
  const events = await ask("What can I read on this?");
  expect(calls).toHaveLength(2);
  expect(calls[0].tools).toBeDefined();
  expect(JSON.parse(calls[0].messages.at(-1).content).purpose).toBe("reading");
  expect(events.at(-1).type).toBe("done");
});

test("invalid routing fails explicitly without searching or answering", async () => {
  invalidPlan = true;
  const events = await ask("A question");
  expect(routingCalls).toHaveLength(1);
  expect(calls).toHaveLength(0);
  expect(events.some(e => e.type === "text")).toBe(false);
  expect(events.findLast(e => e.type === "metadata").stage).toBe("Question routing");
});

test("historical search failure never falls back to an unsourced historical answer", async () => {
  planKind = "historical";
  searchFails = true;
  const events = await ask("A historical question");
  expect(calls).toHaveLength(1);
  expect(calls[0].tools).toBeDefined();
  expect(events.some(e => e.type === "text")).toBe(false);
});

test("historical generation failure can reuse evidence on the identical retry", async () => {
  planKind = "historical";
  draft = revision = Array(141).fill("word").join(" ");
  const events = await ask("A historical question");
  const saved = events.find(e => e.retryToken);
  expect(saved).toBeTruthy();
  calls.length = 0;
  draft = "Supported answer.";
  const response = await POST(new Request("http://localhost/api/chat", {method:"POST",body:JSON.stringify({
    messages:[{role:"user",content:"A historical question"}], evidenceToken:saved.evidenceToken,retryToken:saved.retryToken,
  })}));
  expect(await response.text()).toContain("reused-evidence");
  expect(calls).toHaveLength(1);
  expect(calls[0].tools).toBeUndefined();
});

test("source follow-up reuses question-bound evidence, not research-model prose", async () => {
  planKind = "historical";
  const first = await ask("A historical question");
  const token = first.find(e => e.evidenceToken).evidenceToken;
  calls.length = 0;
  const response = await POST(new Request("http://localhost/api/chat", {method:"POST",body:JSON.stringify({
    messages:[{role:"user",content:"A historical question"},{role:"assistant",content:"A potentially overconfident answer"},{role:"user",content:"Source please"}], evidenceToken:token,
  })}));
  expect(await response.text()).toContain("retained-evidence");
  expect(calls).toHaveLength(1);
  expect(calls[0].tools).toBeUndefined();
  expect(calls[0].messages[0].content).toContain("Withdraw unsupported factual attribution");
});

test("a new historical topic after verification has an ordinary turn policy with retained evidence", async () => {
  const first = await ask("Please verify the source");
  const token = first.find(e => e.evidenceToken)?.evidenceToken;
  calls.length = 0;
  planKind = "historical";
  const response = await POST(new Request("http://localhost/api/chat", { method: "POST", body: JSON.stringify({
    messages: [{ role: "user", content: "Explain a technology" }, { role: "assistant", content: "A prior source audit limited to technology." }, { role: "user", content: "When was a different organisation founded?" }], evidenceToken: token,
  }) }));
  const output = await response.text();
  expect(calls).toHaveLength(2);
  expect(calls[0].tools).toBeDefined();
  const policy = calls[1].messages[0];
  expect(policy.role).toBe("developer");
  expect(policy.content).toContain("Answer the historical question");
  expect(JSON.parse(calls[1].messages.at(-1).content).Reference).toContain("Source passage");
  expect(output).toContain('"mode":"historical"');
});

test("inference challenge receives reassessment policy without forced search", async () => {
  planKind = "reassessment";
  const events = await ask("Which part is inference?");
  expect(calls).toHaveLength(1);
  expect(calls[0].messages[0].content).toContain("Withdraw unsupported claims");
  expect(events.findLast(e => e.type === "metadata").mode).toBe("reassessment");
});

test("explicit online reading still searches with a focused evidence-only request", async () => {
  await ask("Search online for further reading");
  expect(calls[0].tools).toBeDefined();
  expect(calls[0].messages).toHaveLength(2);
  expect(calls[0].messages[0].content).toContain("Do not write a final user answer");
});
test("historical answers retrieve before generation and receive populated evidence", async () => {
  planKind = "historical";
  const events = await ask("What did Gandhi think about money?");
  expect(calls).toHaveLength(2);
  expect(calls[0].tools).toBeDefined();
  const messages = calls[1].messages;
  expect(JSON.parse(messages.at(-1).content).Reference).toContain("Source passage");
  expect(events.findLast((e) => e.type === "metadata").searchStatus).toBe("results-returned");
  expect(events.at(-1).type).toBe("done");
});

test("controlled comparison changes effort only, not prompt or token budget", async () => {
  const inputs = [];
  for (const reasoningEffort of ["low", "medium"]) {
    process.env.GROQ_API_KEY = "test-only-key";
    const response = await POST(new Request("http://localhost/api/chat", { method: "POST", body: JSON.stringify({ messages: [{ role: "user", content: "Explain self-rule" }], reasoningEffort }) }));
    await response.text();
    inputs.push(calls.at(-1));
  }
  expect(inputs[0].reasoning_effort).toBe("low");
  expect(inputs[1].reasoning_effort).toBe("medium");
  expect(inputs[0].messages).toEqual(inputs[1].messages);
  expect(inputs[0].max_tokens).toBe(inputs[1].max_tokens);
  expect(inputs[0].temperature).toBe(inputs[1].temperature);
});
test("probe executes search and retains actual evidence for later turns", async () => {
  const events = await ask("source please");
  expect(calls).toHaveLength(2);
  expect(calls[0].tools).toEqual([{ type: "browser_search" }]);
  expect(calls[0].reasoning_effort).toBe("low");
  expect(calls[1].reasoning_effort).toBe("medium");
  expect(calls[1].temperature).toBe(0);
  const finalMessages = calls[1].messages;
  const reference = JSON.parse(finalMessages.at(-1).content).Reference;
  expect(reference).toContain("Source passage.");
  expect(reference).not.toContain("MODEL SUMMARY");
  const metadata = events.findLast((e) => e.type === "metadata");
  expect(metadata.toolsExecuted).toBe(1);
  calls.length = 0;
  await ask("Explain the idea simply", metadata.evidenceToken);
  expect(calls).toHaveLength(1);
  expect(JSON.parse((calls[0].messages).at(-1).content).Reference).toContain("Source passage.");
});

test("ordinary definition after a probe stays answerable without another search", async () => {
  const events = await ask("source please");
  const token = events.findLast(e => e.type === "metadata").evidenceToken;
  calls.length = 0;
  await ask("What is AI?", token);
  expect(calls).toHaveLength(1);
  expect(calls[0].messages[0].content).toContain("Answer ordinary definitions from general knowledge");
  expect(calls[0].messages[0].content).toContain("Its presence does not make ordinary questions source-only tasks");
});
test("missing tool records are not described as successful search", async () => {
  toolResults = false;
  const events = await ask("citation please");
  expect(events.findLast((e) => e.type === "metadata").searchStatus).toBe("no-tool-record");
  expect(JSON.parse((calls[1].messages).at(-1).content).Reference).toBe("");
});

test("tampered evidence is rejected before any provider call", async () => {
  const events = await ask("Explain more", "tampered.token");
  expect(events[0].error).toContain("Invalid source context");
  expect(calls).toHaveLength(0);
});

test("unsupported search models fail explicitly", async () => {
  process.env.GROQ_API_KEY = "test-only-key";
  process.env.GROQ_MODEL = "unsupported";
  const response = await POST(new Request("http://localhost/api/chat", {
    method: "POST", body: JSON.stringify({ messages: [{ role: "user", content: "source please" }] }),
  }));
  expect(response.status).toBe(400);
  expect((await response.json()).error).toContain("does not support browser search");
  expect(calls).toHaveLength(0);
});

test("explicit UI verification does not depend on keyword matching", async () => {
  process.env.GROQ_API_KEY = "test-only-key";
  process.env.GROQ_MODEL = "openai/gpt-oss-120b";
  const response = await POST(new Request("http://localhost/api/chat", {
    method: "POST", body: JSON.stringify({ messages: [{ role: "user", content: "Check that last answer" }], verifySources: true }),
  }));
  await response.text();
  expect(calls[0].tools).toEqual([{ type: "browser_search" }]);
});

test("failed search reports this request rather than stale ordinary metadata", async () => {
  searchFails = true;
  const events = await ask("source please");
  expect(events[0].searchStatus).toBe("searching");
  expect(events.findLast((e) => e.type === "metadata").searchStatus).toBe("search-failed");
  expect(events.at(-1).type).toBe("error");
});

test("verification explicitly targets the latest definition, not the older Gandhi answer", async () => {
  process.env.GROQ_API_KEY = "test-only-key";
  process.env.GROQ_MODEL = "openai/gpt-oss-120b";
  const response = await POST(new Request("http://localhost/api/chat", { method: "POST",
    body: JSON.stringify({ messages: [
      { role: "user", content: "Would Gandhi oppose AI?" },
      { role: "assistant", content: "A tentative Gandhi interpretation." },
      { role: "user", content: "What is AI?" },
      { role: "assistant", content: "AI is a field of computer science." },
      { role: "user", content: "Please verify your previous answer." },
    ] }) }));
  await response.text();
  for (const call of calls) {
    const input = JSON.parse(call.messages.at(-1).content);
    expect(input.verificationTarget.question).toBe("What is AI?");
    expect(input.verificationTarget.answer).toBe("AI is a field of computer science.");
  }
});
