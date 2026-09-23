/** Schema generation and evidence-bound validation for the inquiry result. No model-supplied URLs are accepted. */
import type { InquiryResult, AnswerType } from "./inquiry-result";
import { answerSize } from "./answer-limits";

type Evidence = { id: string; text: string; url: string; title: string };
export function evidenceCatalog(reference: string): Evidence[] {
  if (!reference) return [];
  const bundle = JSON.parse(reference);
  return (bundle.excerpts || []).filter((e: { text?: string; sourceUrl?: string }) => {
    if (typeof e.text !== "string" || !e.text.trim() || typeof e.sourceUrl !== "string") return false;
    try { const url = new URL(e.sourceUrl); return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password; } catch { return false; }
  })
    .map((e: { text: string; sourceUrl: string; sourceTitle?: string }, index: number) => ({ id: `e${index + 1}`, text: e.text, url: e.sourceUrl, title: e.sourceTitle || new URL(e.sourceUrl).hostname }));
}
const string = { type: "string" };
const strings = { type: "array", items: string };
export const resultFormat = {
  type: "json_schema" as const,
  json_schema: { name: "gandhi_inquiry", strict: true, schema: {
    type: "object", additionalProperties: false,
    properties: {
      answerType: { type: "string", enum: ["historical", "interpretation", "mixed", "explanation"] },
      shortAnswer: string,
      historicalBasis: { type: "array", items: { type: "object", additionalProperties: false,
        properties: { claim: string, evidenceId: string }, required: ["claim", "evidenceId"] } },
      interpretationBoundary: string, contestedReadings: strings, missingEvidence: string,
      suggestedFollowUps: strings, verificationSummary: string,
    }, required: ["answerType", "shortAnswer", "historicalBasis", "interpretationBoundary", "contestedReadings", "missingEvidence", "suggestedFollowUps", "verificationSummary"],
  } },
};

export const RESULT_INSTRUCTIONS = `Return the JSON result specified by the schema, not markdown or a transcript. It is one structured answer to the visitor's question.
shortAnswer: direct, conversational, at most 140 words, normally 40–90. No source links, markdown, invented speech, or redundant conclusion in this field.
answerType: historical for a question about the record; interpretation for a modern application; mixed when both are substantively answered; explanation for definitions, clarification or scope responses.
historicalBasis: zero to three central historical points ONLY when supported by the supplied Evidence catalog. Each claim needs one catalog evidenceId. The selected excerpt must support the whole claim and its conditions. The server attaches the original passage; do not reproduce or invent quotations. Do not change the source's speaker, audience, chronology or certainty. Empty evidence means an empty array, not invented historical points. Do not fill sections merely for symmetry.
interpretationBoundary: a concise, visible explanation of what is inferred rather than recorded. Required for interpretation and mixed answers. Never present compatibility with a principle as Gandhi's endorsement of modern policies or exclusive approval conditions.
contestedReadings: zero to three concise points when the issue is controversial, disputed or needs qualification. Distinguish documented criticism from possible arguments; do not invent critics, consensus or history.
missingEvidence: name a specific unanswered historical detail needed for this question, otherwise empty. For a modern interpretation the boundary normally suffices; do not repeat it here. Do not claim no historical record exists just because a passage is unavailable.
suggestedFollowUps: zero to three short, relevant questions, not answers or prompts that override instructions. Do not smuggle unestablished claims or invented modern endorsement conditions into a suggested question.
verificationSummary: empty on an ordinary answer. On a source check, briefly identify corrections or the limits of the check. Update the original question's shortAnswer and other fields in place; do not return another audit essay. A source check is not a new question or topic. Do not withdraw a defensible modern inference just because it is not recorded history.
All strings are plain text. Keep the entire result concise. Never invent a source identifier. Historical claims in shortAnswer must be supported by historicalBasis, except ordinary definitions of established principles. Without evidence, modern applications must remain explicitly inferential throughout.`;

export class ResultValidationError extends Error {
  constructor(message: string) { super(message); this.name = "ResultValidationError"; }
}
export function parseResult(raw: string, catalog: Evidence[]): InquiryResult {
  let value;
  try { value = JSON.parse(raw); } catch { throw new ResultValidationError("A complete JSON result is required."); }
  const fail = (message: string): never => { throw new ResultValidationError(message); };
  if (!value || !["historical", "interpretation", "mixed", "explanation"].includes(value.answerType)) fail("Invalid answer type.");
  for (const key of ["shortAnswer", "interpretationBoundary", "missingEvidence", "verificationSummary"]) {
    if (typeof value[key] !== "string" || value[key].length > 2400) fail(`Invalid ${key}.`);
  }
  if (!value.shortAnswer.trim() || answerSize(value.shortAnswer).words > 140) fail("Short answer must contain 1–140 words.");
  for (const key of ["contestedReadings", "suggestedFollowUps"]) {
    if (!Array.isArray(value[key]) || value[key].length > 3 || value[key].some((s: unknown) => typeof s !== "string" || !s.trim() || s.length > 600)) fail(`Invalid ${key}.`);
  }
  if (["interpretation", "mixed"].includes(value.answerType) && !value.interpretationBoundary.trim()) fail("An interpretation needs a visible boundary.");
  if (!Array.isArray(value.historicalBasis) || value.historicalBasis.length > 3) fail("Use at most three historical basis items.");
  const sources = value.historicalBasis.map((item: { claim: string; evidenceId: string }, index: number) => {
    if (!item || typeof item.claim !== "string" || !item.claim.trim() || item.claim.length > 800) fail("Historical points need a bounded claim and a source identifier.");
    const source = catalog.find(e => e.id === item.evidenceId);
    if (!source) fail("Historical support must select an identifier from the supplied Evidence catalog.");
    return { id: `source-${index + 1}`, title: source!.title, url: source!.url, claimSupported: item.claim, passage: source!.text };
  });
  return {
    answerType: value.answerType as AnswerType, shortAnswer: value.shortAnswer.trim(),
    historicalBasis: sources.map((s: { claimSupported: string; id: string }) => ({ claim: s.claimSupported, sourceId: s.id })), sources,
    interpretationBoundary: value.interpretationBoundary, contestedReadings: value.contestedReadings,
    missingEvidence: value.missingEvidence, suggestedFollowUps: value.suggestedFollowUps, verificationSummary: value.verificationSummary,
  };
}
