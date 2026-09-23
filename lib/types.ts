export type ChatRole = "user" | "assistant";

/** Optional backend metadata; the UI never derives these values from prose. */
export type AnswerMetadata = {
  answer_type?: "historical" | "interpretive";
  safety_flag?: boolean;
  related_concepts?: string[];
  is_refusal?: boolean;
};

export type ChatMessage = AnswerMetadata & {
  role: ChatRole;
  content: string;
  completed?: boolean;
};

export const SUGGESTED_INQUIRIES = [
  "What did Gandhi believe about wealth and possessions?",
  "Why did Gandhi spin his own cloth?",
  "Should I leave a well-paid job for work that matters more?",
  "Is it wrong to want to be rich?",
  "What are the strongest criticisms of Gandhi?",
  "How might his ideas apply to AI or social media?",
] as const;
