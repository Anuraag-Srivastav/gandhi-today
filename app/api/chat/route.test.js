import { afterEach, expect, mock, spyOn, test } from "bun:test";

const calls = [];
let toolResults = true;
let searchFails = false;
let hangSearch = false;
let draft = "An interpretation.";
let revision = "A shorter interpretation.";
const create = mock(async (params, options) => {
  calls.push(params);
  if (params.tools && hangSearch) return new Promise((_, reject) => {
    options.signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
  });
  if (!params.stream && !params.tools) return { choices: [{ message: { content: revision } }] };
  if (!params.stream && searchFails) throw new Error("Provider unavailable");
  if (!params.stream) return {
    choices: [{ message: { content: "MODEL SUMMARY MUST NOT BECOME EVIDENCE",
      executed_tools: toolResults ? [{ type: "browser_search", arguments: "{}", index: 0,
        browser_results: [{ title: "Primary document", url: "https://example.org/document", content: "Source passage." }] }] : [] } }],
  };
  return (async function* () { yield { choices: [{ delta: { content: draft } }] }; })();
});
mock.module("groq-sdk", () => ({ default: class { chat = { completions: { create } }; } }));
const { POST } = await import("./route");
const originalKey = process.env.GROQ_API_KEY;
const originalModel = process.env.GROQ_MODEL;
afterEach(() => {
  calls.length = 0;
  toolResults = true;
  searchFails = false;
  hangSearch = false;
  draft = "An interpretation.";
  revision = "A shorter interpretation.";
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
test("ordinary answers have no tools and receive populated inputs", async () => {
  const events = await ask("What did Gandhi think about money?");
  expect(calls).toHaveLength(1);
  expect(calls[0].tools).toBeUndefined();
  const messages = calls[0].messages;
  expect(JSON.parse(messages.at(-1).content).Reference).toBe("");
  expect(events.findLast((e) => e.type === "metadata").searchStatus).toBe("not-requested");
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
  expect(calls[0].reasoning_effort).toBe("medium");
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
