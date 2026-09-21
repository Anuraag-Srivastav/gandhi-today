import Groq from "groq-sdk";
import { getSystemPrompt } from "@/lib/prompt";
import type { ChatMessage } from "@/lib/types";

const MODEL = process.env.GROQ_MODEL ?? "openai/gpt-oss-120b";
const MAX_MESSAGES = 24;
const MAX_CONTENT_LENGTH = 8000;

function isChatMessage(value: unknown): value is ChatMessage {
  if (!value || typeof value !== "object") return false;
  const message = value as Record<string, unknown>;
  return (
    (message.role === "user" || message.role === "assistant") &&
    typeof message.content === "string"
  );
}

export async function POST(request: Request) {
  if (!process.env.GROQ_API_KEY) {
    return Response.json(
      { error: "GROQ_API_KEY is missing from the environment." },
      { status: 500 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const incoming =
    body && typeof body === "object"
      ? (body as { messages?: unknown }).messages
      : undefined;

  if (!Array.isArray(incoming) || incoming.length === 0) {
    return Response.json({ error: "messages is required." }, { status: 400 });
  }

  const messages = incoming.filter(isChatMessage).slice(-MAX_MESSAGES);

  if (messages.length === 0 || messages.at(-1)?.role !== "user") {
    return Response.json(
      { error: "The last message must be from the user." },
      { status: 400 },
    );
  }

  if (messages.some((message) => message.content.length > MAX_CONTENT_LENGTH)) {
    return Response.json({ error: "A message is too long." }, { status: 400 });
  }

  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

  try {
    const stream = await groq.chat.completions.create({
      model: MODEL,
      temperature: 0.4,
      max_tokens: 1200,
      reasoning_effort: "low",
      include_reasoning: false,
      stream: true,
      messages: [
        { role: "system", content: getSystemPrompt() },
        ...messages,
      ],
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const text = chunk.choices[0]?.delta?.content;
            if (text) controller.enqueue(encoder.encode(text));
          }
        } catch (error) {
          controller.error(error);
          return;
        }
        controller.close();
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "The model could not reply.";
    return Response.json({ error: message }, { status: 502 });
  }
}
