import { createHash, createHmac, timingSafeEqual } from "node:crypto";

const MAX_EVIDENCE = 32000;
const MAX_AGE = 24 * 60 * 60 * 1000;

/** Bind retrieved passages to the exact question, not a model's later prose. */
export function bindEvidenceQuestion(reference: string, question: string) {
  return JSON.stringify({ ...JSON.parse(reference), questionHash: createHash("sha256").update(question).digest("hex") });
}

/** Reuse inspected passages for a source follow-up on that same answered question.
 * This establishes provenance, not entailment; the answering model must still
 * correct claims unsupported by the passages. Explicit fresh searches bypass it.
 */
export function canUseRetainedEvidence(reference: string, targetQuestion: string | undefined, request: string) {
  if (!reference || !targetQuestion || /\b(search|browse|look up|find online|latest|current|today)\b/i.test(request)) return false;
  try {
    const value = JSON.parse(reference);
    return value.questionHash === createHash("sha256").update(targetQuestion).digest("hex")
      && Array.isArray(value.excerpts) && value.excerpts.some((e: { text?: string; sourceUrl?: string }) => e.text && e.sourceUrl);
  } catch { return false; }
}

/** Signed transport prevents browser-supplied text masquerading as retrieved evidence. */
export function sealEvidence(text: string, secret: string, now = Date.now()) {
  if (text.length > MAX_EVIDENCE) throw new Error("Source results exceeded the evidence limit. Narrow the source question.");
  const data = Buffer.from(JSON.stringify({ text, expires: now + MAX_AGE })).toString("base64url");
  const signature = createHmac("sha256", secret).update("gandhi-evidence:" + data).digest("base64url");
  return data + "." + signature;
}

export function openEvidence(token: unknown, secret: string, now = Date.now()): string {
  if (token === undefined || token === "") return "";
  if (typeof token !== "string" || token.length > 180000) throw new Error("Invalid source context.");
  const [data, signature, extra] = token.split(".");
  const expected = createHmac("sha256", secret).update("gandhi-evidence:" + data).digest();
  const supplied = Buffer.from(signature || "", "base64url");
  if (extra || supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    throw new Error("Invalid source context. Start a new inquiry.");
  }
  const parsed = JSON.parse(Buffer.from(data, "base64url").toString("utf8"));
  if (typeof parsed.text !== "string" || parsed.text.length > MAX_EVIDENCE
    || typeof parsed.expires !== "number" || parsed.expires < now) {
    throw new Error("Source context expired. Start a new inquiry.");
  }
  return parsed.text;
}
