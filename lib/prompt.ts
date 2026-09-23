import { readFileSync } from "node:fs";
import { join } from "node:path";

export function getSystemPrompt() {
  const raw = readFileSync(join(process.cwd(), "prompt.json"), "utf8").trim();

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed === "string") return parsed;
    if (parsed && typeof parsed === "object") {
      const record = parsed as Record<string, unknown>;
      for (const key of ["system", "prompt", "content", "text"]) {
        if (typeof record[key] === "string") return record[key];
      }
    }
  } catch {
    // prompt.json is stored as plain text in this project
  }

  return raw;
}

/** Keep untrusted inputs in a user message, never interpolate them into system rules. */
export function getPromptRules() {
  return getSystemPrompt().split("## Inputs")[0].trim();
}

export function formatQuestion(question: string, reference: string) {
  // JSON encoding prevents source text from closing a structural XML delimiter.
  return JSON.stringify({ Question: question, Reference: reference });
}
