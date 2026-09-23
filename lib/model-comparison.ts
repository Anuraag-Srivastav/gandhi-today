/** Fixed, opt-in answer-model experiment. Routing, evidence and public defaults stay unchanged. */
import { createHash } from "node:crypto";
import { openEvidence, sealEvidence } from "./evidence";

export const COMPARISON_MODEL = "llama-3.3-70b-versatile";
export const digest = (text: string) => createHash("sha256").update(text).digest("hex");
type Snapshot = { mode: string; sourceRequired: boolean; searchStatus: string; reasoningEffort: "low" | "medium" };

/** The receipt binds replay to the exact conversation, evidence, and installed prompt. */
export function comparisonReceipt(snapshot: Snapshot, identity: string, reference: string, promptHash: string, secret: string) {
  return sealEvidence(JSON.stringify({ purpose: "answer-comparison", identity, evidenceHash: digest(reference), promptHash, ...snapshot }), secret);
}

export function openComparison(token: unknown, identity: string, reference: string, promptHash: string, secret: string): Snapshot {
  const value = JSON.parse(openEvidence(token, secret));
  if (value.purpose !== "answer-comparison" || value.identity !== identity || value.evidenceHash !== digest(reference) || value.promptHash !== promptHash) {
    throw new Error("Comparison requires the unchanged conversation, evidence and prompt.");
  }
  return value;
}
