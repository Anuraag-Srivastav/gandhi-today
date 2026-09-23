import type { ChatMessage } from "./types";

export const PROMPT_VERSION = "v26";
export const MAX_MESSAGES = 80;
export const MAX_CONTENT_LENGTH = 8000;
export const MAX_TOTAL_LENGTH = 100000;

/** Reject oversized or malformed conversations instead of silently discarding context. */
export function validateMessages(value: unknown): ChatMessage[] {
  if (!Array.isArray(value) || !value.length || value.length > MAX_MESSAGES) {
    throw new Error("Send 1–80 messages. Start a new inquiry when the conversation is full.");
  }
  let total = 0;
  const messages = value.map((item) => {
    if (!item || !["user", "assistant"].includes(item.role)
      || typeof item.content !== "string" || !item.content.trim()
      || item.content.length > MAX_CONTENT_LENGTH) {
      throw new Error("Each message must contain a user or assistant role and 1–8000 characters.");
    }
    total += item.content.length;
    return { role: item.role, content: item.content } as ChatMessage;
  });
  if (total > MAX_TOTAL_LENGTH) throw new Error("This conversation is too long. Start a new inquiry.");
  if (messages[0].role !== "user" || messages.at(-1)?.role !== "user") {
    throw new Error("The conversation must begin and end with a user message.");
  }
  return messages;
}

export function supportsBrowserSearch(model: string) {
  return ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "openai/gpt-oss-safeguard-20b"].includes(model);
}
