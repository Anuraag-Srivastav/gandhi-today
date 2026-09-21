export type ChatRole = "user" | "assistant";

export type ChatMessage = {
  role: ChatRole;
  content: string;
};

export const SUGGESTED_INQUIRIES = [
  "What would Gandhi say about climate change and mass consumption?",
  "What would Gandhi think of social media and the search for truth?",
  "How might Gandhi view economic inequality today?",
  "What would Gandhi say about artificial intelligence?",
  "How would Gandhi respond to war and violence in the present day?",
  "What would Gandhi say about nationalism now?",
] as const;
