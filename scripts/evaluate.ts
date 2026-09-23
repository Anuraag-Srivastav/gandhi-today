/** Sequential live regression runner. Emits JSONL transcripts, not automatic historical truth scores.
 * bun scripts/evaluate.ts https://your-app 1,2,3
 * Stops each failed sequence rather than evaluating follow-ups against a missing answer.
 */
import { sequences } from "./evaluation-cases";
import { answerSize } from "../lib/answer-limits";
import { resultContext } from "../lib/inquiry-result";
const base = process.argv[2];
if (!base || !/^https?:\/\//.test(base)) throw new Error("Supply the app URL explicitly.");
const selected = process.argv[3]?.split(",").map(Number) || sequences.map((_, i) => i + 1);
if (selected.some(n => !Number.isInteger(n) || n < 1 || n > sequences.length)) throw new Error("Invalid sequence number");
for (const n of selected) {
  const messages: { role: string; content: string }[] = [];
  let evidenceToken = "";
  for (const question of sequences[n - 1]) {
    messages.push({ role: "user", content: question });
    const started = Date.now();
    try {
      const response = await fetch(new URL("/api/chat", base), { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages, evidenceToken }), signal: AbortSignal.timeout(115000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      if (!response.headers.get("content-type")?.includes("application/x-ndjson")) throw new Error("Wrong API version: expected application/x-ndjson. Check the deployed URL.");
      const events = (await response.text()).trim().split("\n").map(line => JSON.parse(line));
      let metadata = {};
      for (const event of events) if (event.type === "metadata") {
        const token = event.evidenceToken;
        const safe = { ...event };
        delete safe.evidenceToken;
        delete safe.retryToken;
        delete safe.comparisonToken;
        if (typeof token === "string") evidenceToken = token;
        metadata = { ...metadata, ...safe };
      }
      const result = events.find(e => e.type === "result")?.result;
      const answer = result?.shortAnswer || "";
      const failure = events.find(e => e.type === "error")?.text;
      const completed = events.some(e => e.type === "done") && !!answer;
      console.log(JSON.stringify({ sequence: n, question, answer, result, completed, failure, elapsedMs: Date.now() - started, metadata,
        size: answerSize(answer), malformedCitation: /【|\[Source\s*\[/.test(answer), semanticScore: "manual-review-required" }));
      if (!completed) break;
      const sourceCheck = events.find(e => e.type === "source-check");
      if (sourceCheck) {
        if (messages[sourceCheck.targetIndex]?.role !== "assistant") throw new Error("Invalid source target returned by API");
        messages.pop();
        messages[sourceCheck.targetIndex] = { role: "assistant", content: resultContext(result) };
      } else messages.push({ role: "assistant", content: resultContext(result) });
    } catch (error) {
      console.log(JSON.stringify({ sequence: n, question, completed: false, failure: error instanceof Error ? error.message : "Unknown failure", elapsedMs: Date.now() - started }));
      break;
    }
    await new Promise(resolve => setTimeout(resolve, 1500));
  }
}
