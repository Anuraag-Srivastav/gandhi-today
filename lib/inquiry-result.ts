/** Public result contract. Source identities and URLs are resolved by the server, never parsed from prose. */
export type AnswerType = "historical" | "interpretation" | "mixed" | "explanation";
export type SourceItem = { id: string; title: string; url: string; claimSupported: string; passage: string };
export type InquiryResult = {
  answerType: AnswerType;
  shortAnswer: string;
  historicalBasis: { claim: string; sourceId: string }[];
  sources: SourceItem[];
  interpretationBoundary: string;
  contestedReadings: string[];
  missingEvidence: string;
  suggestedFollowUps: string[];
  verificationSummary: string;
};

/** Conversation context is a readable serialization of typed data, not a source of evidence. */
export function resultContext(result: InquiryResult) {
  return JSON.stringify(result);
}
