/** Run with bun: isolates provider search latency; never prints source text or credentials. */
import Groq from "groq-sdk";
import { sourceRequest } from "../lib/source-request";
import { providerFailure } from "../lib/provider-failure";

const question = process.argv[2];
if (!process.env.GROQ_API_KEY || !question) {
  console.error("Requires GROQ_API_KEY and a source question: bun scripts/check-source.ts 'question'");
  process.exit(1);
}
const started = Date.now();
const abort = new AbortController();
const timer = setTimeout(() => abort.abort(), 45000);
try {
  const client = new Groq({ apiKey: process.env.GROQ_API_KEY, maxRetries: 0 });
  const result = await client.chat.completions.create(sourceRequest(
    process.env.GROQ_MODEL || "openai/gpt-oss-120b", question, null,
  ), { signal: abort.signal });
  console.log({ elapsedMs: Date.now() - started, tools: result.choices[0]?.message.executed_tools?.length || 0, finishReason: result.choices[0]?.finish_reason });
} catch (error) {
  console.error({ elapsedMs: Date.now() - started, ...providerFailure(error, abort.signal.aborted) });
  process.exitCode = 1;
} finally {
  clearTimeout(timer);
}
