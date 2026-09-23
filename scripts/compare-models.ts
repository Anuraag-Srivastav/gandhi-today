/** Paired answer-model trial: identical conversation, routing, prompt and signed evidence.
 * Candidate answers advance history for both arms; neither arm sees the other's current answer.
 * Development only: bun scripts/compare-models.ts http://localhost:3107 1,2
 * Inputs only: no reference answers or topic-specific production instructions.
 */
import { sequences } from "./evaluation-cases";
import { COMPARISON_MODELS } from "../lib/model-comparison";
const candidateModel = process.argv[4] || "openai/gpt-oss-20b";
if (!COMPARISON_MODELS.includes(candidateModel) || !candidateModel.startsWith("openai/gpt-oss")) throw new Error("Candidate must support strict structured output");
const base = process.argv[2];
if (!base || !["localhost", "127.0.0.1"].includes(new URL(base).hostname)) throw new Error("Model comparison is development-only. Supply a local app URL.");
const selected = process.argv[3]?.split(",").map(Number) || sequences.map((_, i) => i + 1);
if (selected.some(n => !Number.isInteger(n) || n < 1 || n > sequences.length)) throw new Error("Invalid sequence");
async function ask(body: object) {
  const response = await fetch(new URL("/api/chat", base), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(115000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  const events = (await response.text()).trim().split("\n").map(line => JSON.parse(line));
  const metadata = Object.assign({}, ...events.filter(e => e.type === "metadata"));
  const { evidenceToken, comparisonToken, retryToken, ...safe } = metadata;
  void retryToken;
  const answer = events.find(e => e.type === "result")?.result;
  return { evidenceToken, comparisonToken, result: { answer, completed: !!answer && events.some(e => e.type === "done"), failure: events.find(e => e.type === "error")?.text, metadata: safe } };
}
for (const sequence of selected) {
  const messages: { role: string; content: string }[] = [];
  let evidenceToken = "";
  for (const question of sequences[sequence - 1]) {
    messages.push({ role: "user", content: question });
    try {
      const baseline = await ask({ messages, evidenceToken });
      if (!baseline.comparisonToken) {
        console.log(JSON.stringify({ sequence, question, baseline: baseline.result, paired: false }));
        break;
      }
      evidenceToken = baseline.evidenceToken || "";
      const candidate = await ask({ messages, evidenceToken, comparisonToken: baseline.comparisonToken, answerModel: candidateModel });
      const paired = baseline.result.metadata.evidenceHash === candidate.result.metadata.evidenceHash && baseline.result.metadata.promptHash === candidate.result.metadata.promptHash;
      console.log(JSON.stringify({ sequence, question, paired, baseline: baseline.result, candidate: candidate.result }));
      if (!candidate.result.completed) break;
      messages.push({ role: "assistant", content: JSON.stringify(candidate.result.answer) });
    } catch (error) { console.log(JSON.stringify({ sequence, question, paired: false, failure: String(error) })); break; }
    await new Promise(resolve => setTimeout(resolve, 1500));
  }
}
