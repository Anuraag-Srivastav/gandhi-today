/** Deterministic size gate; a failed rewrite is never silently truncated. */
export function answerSize(text: string) {
  const trimmed = text.trim();
  return { words: trimmed ? trimmed.split(/\s+/u).length : 0,
    paragraphs: trimmed ? trimmed.split(/\r?\n\s*\r?\n/u).length : 0 };
}

export class AnswerLimitError extends Error {
  readonly validation;
  constructor(text: string) {
    super("The answer could not be completed within the response limit. Please retry; no partial answer was saved.");
    this.name = "AnswerLimitError";
    const size = answerSize(text);
    this.validation = { ...size, reason: !size.words ? "empty" : size.words > 140 ? "words" : "paragraphs" };
  }
}

/** Rewrite once with full context; callers must retain evidence and qualifications. */
export async function enforceAnswerLimits(text: string, rewrite: (draft: string) => Promise<string>) {
  const valid = (answer: string) => {
    const size = answerSize(answer);
    return size.words > 0 && size.words <= 140 && size.paragraphs <= 3;
  };
  if (valid(text)) return { text: text.trim(), rewritten: false };
  const revised = await rewrite(text);
  if (!valid(revised)) throw new AnswerLimitError(revised);
  return { text: revised.trim(), rewritten: true };
}
