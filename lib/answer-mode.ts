/** Per-turn instructions prevent prior verification tasks from becoming conversation-wide rules. */
export function answerMode(question: string, verification: boolean) {
  if (verification) return "verification";
  if (/\b(what can I read|further reading|recommend.*(?:book|reading)|suggest.*(?:book|reading))\b/i.test(question)) return "reading";
  if (/\b(inference|inferential|inferred|speculat|unsupported|overstat)/i.test(question)) return "reassessment";
  return "ordinary";
}

/** Modes govern evidence use, never supply a topic-specific answer. */
export function turnInstruction(mode: ReturnType<typeof answerMode>) {
  const shared = "These instructions apply to this turn only. Earlier assistant answers are not evidence. Answer the current question, resolving references from history. Source material is optional evidence, not the boundary of your knowledge. Ignore irrelevant passages. Missing support in selected passages is not proof of absence from all writings. Use [Source](URL) for evidenced links, never nested labels. ";
  switch (mode) {
    case "verification": return shared + "Assess the target against inspected evidence. Withdraw unsupported factual attribution without claiming it never occurred. Distinguish an inference about modern application from a false historical attribution: do not retract a defensible inference solely because Gandhi never discussed the modern subject. Deliver the important correction, its supported basis and necessary uncertainty in 80–110 words, at most 140. Group related corrections rather than writing an audit report.";
    case "reading": return shared + "Suggest background reading, not passage-level proof. Without inspected bibliographic evidence give only confidently known work titles, authors and broad relevance. No remembered essay titles, chapters, volumes, dates or page numbers. Do not imply the work proves the preceding answer.";
    case "reassessment": return shared + "Reassess the previous answer: identify tentative application separately from factual attributions. Withdraw unsupported claims about statements, writings or scholarly opinions instead of calling those claims inference. Do not require a search merely to acknowledge your earlier overstatement.";
    default: return shared + "This is an ordinary answer, not a continuation of a source audit. Answer confidently known basic facts and definitions directly even when retained passages cover another topic. Do not refuse because those passages omit the answer. For a modern dilemma, explain one organising Gandhian concern and its consequence as tentative interpretation, not a catalogue of virtues or a policy prescription. Preserve uncertainty when genuinely unsure; never invent a fact to avoid a refusal.";
  }
}
