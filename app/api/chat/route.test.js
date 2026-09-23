import { afterEach, expect, mock, test } from "bun:test";

const calls = [];
let toolResults = true;
const create = mock(async (params) => {
  calls.push(params);
  if (!params.stream) return {
    choices: [{ message: { content: "MODEL SUMMARY MUST NOT BECOME EVIDENCE",
      executed_tools: toolResults ? [{ type: "browser_search", arguments: "{}", index: 0,
        browser_results: [{ title: "Primary document", url: "https://example.org/document", content: "Source passage." }] }] : [] } }],
  };
  return (async function* () { yield { choices: [{ delta: { content: "An interpretation." } }] }; })();
});
mock.module("groq-sdk", () => ({ default: class { chat = { completions: { create } }; } }));
const { POST } = await import("./route");
const originalKey = process.env.GROQ_API_KEY;
const originalModel = process.env.GROQ_MODEL;
afterEach(() => {
  calls.length = 0;
  toolResults = true;
  if (originalKey === undefined) delete process.env.GROQ_API_KEY; else process.env.GROQ_API_KEY = originalKey;
  if (originalModel === undefined) delete process.env.GROQ_MODEL; else process.env.GROQ_MODEL = originalModel;
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
  expect(events.find((e) => e.type === "metadata").searchStatus).toBe("not-requested");
  expect(events.at(-1).type).toBe("done");
});
test("probe executes search and retains actual evidence for later turns", async () => {
  const events = await ask("source please");
  expect(calls).toHaveLength(2);
  expect(calls[0].tools).toEqual([{ type: "browser_search" }]);
  const finalMessages = calls[1].messages;
  const reference = JSON.parse(finalMessages.at(-1).content).Reference;
  expect(reference).toContain("Source passage.");
  expect(reference).not.toContain("MODEL SUMMARY");
  const metadata = events.find((e) => e.type === "metadata");
  expect(metadata.toolsExecuted).toBe(1);
  calls.length = 0;
  await ask("Explain the idea simply", metadata.evidenceToken);
  expect(calls).toHaveLength(1);
  expect(JSON.parse((calls[0].messages).at(-1).content).Reference).toContain("Source passage.");
});
test("missing tool records are not described as successful search", async () => {
  toolResults = false;
  const events = await ask("citation please");
  expect(events.find((e) => e.type === "metadata").searchStatus).toBe("no-tool-record");
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
