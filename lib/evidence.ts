import { createHmac, timingSafeEqual } from "node:crypto";

const MAX_EVIDENCE = 32000;
const MAX_AGE = 24 * 60 * 60 * 1000;

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
