"use client";

import {
  FormEvent,
  KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { SUGGESTED_INQUIRIES, type ChatMessage } from "@/lib/types";

function renderLinks(text: string) {
  const pattern = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<>()]+)/g;
  const parts = [];
  let previous = 0;
  for (const match of text.matchAll(pattern)) {
    parts.push(text.slice(previous, match.index));
    const href = (match[2] || match[3]).replace(/[.,;]+$/, "");
    parts.push(<a key={match.index} href={href} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">{match[1] || href}</a>);
    previous = match.index! + match[0].length;
  }
  parts.push(text.slice(previous));
  return parts;
}

function renderContent(text: string) {
  const paragraphs = text.split(/\n{2,}/);

  return paragraphs.map((paragraph, index) => (
    <p key={index}>
      {paragraph.split("\n").map((line, lineIndex, lines) => (
        <span key={lineIndex}>
          {renderLinks(line)}
          {lineIndex < lines.length - 1 ? <br /> : null}
        </span>
      ))}
    </p>
  ));
}

function Charkha({ className = "", spinning = false }: { className?: string; spinning?: boolean }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={`${className} ${spinning ? "spin-slow" : ""}`}
      aria-hidden="true"
    >
      <circle cx="32" cy="32" r="22" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="32" cy="32" r="14" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.55" />
      <circle cx="32" cy="32" r="3.2" fill="currentColor" />
      <path
        d="M32 10v44M10 32h44M16.4 16.4l31.2 31.2M47.6 16.4 16.4 47.6"
        stroke="currentColor"
        strokeWidth="1.15"
      />
    </svg>
  );
}

export function Chat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState("Preparing an answer…");
  const [diagnostic, setDiagnostic] = useState("");
  const evidenceRef = useRef("");
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const hasConversation = messages.length > 0;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isLoading]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [input]);

  const statusLabel = useMemo(() => {
    if (isLoading) return progress;
    if (hasConversation) return "Gandhi's views and interpretation";
    return "Ask a present-day question";
  }, [hasConversation, isLoading, progress]);

  async function send(content: string, verifySources = false) {
    const trimmed = content.trim();
    if (!trimmed || isLoading) return;

    const nextMessages: ChatMessage[] = [
      ...messages,
      { role: "user", content: trimmed },
    ];

    setMessages(nextMessages);
    setInput("");
    setError(null);
    setDiagnostic("New request starting…");
    setIsLoading(true);
    setProgress(verifySources ? "Checking sources…" : "Preparing an answer…");

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages, evidenceToken: evidenceRef.current, verifySources }),
        signal: controller.signal,
      });

      if (!response.ok) {
        let detail = "The reconstruction could not be completed.";
        try {
          const payload = (await response.json()) as { error?: string };
          if (payload.error) detail = payload.error;
        } catch {
          // keep the default message
        }
        throw new Error(detail);
      }

      if (!response.body) throw new Error("No reply was returned.");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistant = "";
      let pending = "";
      let completed = false;
      setMessages([...nextMessages, { role: "assistant", content: "" }]);

      function consume(line: string) {
        if (!line.trim() || controller.signal.aborted) return;
        const event = JSON.parse(line);
        if (event.type === "status") setProgress(event.text);
        if (event.type === "metadata") {
          if (typeof event.evidenceToken === "string") evidenceRef.current = event.evidenceToken;
          setDiagnostic([event.promptVersion, event.promptHash, event.model, "search: " + event.searchStatus, "tools: " + event.toolsExecuted, "request: " + event.requestId].join(" · "));
        }
        if (event.type === "error") throw new Error(event.text);
        if (event.type === "done") completed = true;
        if (event.type === "text") {
          assistant += event.text;
          setMessages([...nextMessages, { role: "assistant", content: assistant }]);
        }
      }
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        pending += decoder.decode(value, { stream: true });
        let newline;
        while ((newline = pending.indexOf("\n")) >= 0) {
          consume(pending.slice(0, newline));
          pending = pending.slice(newline + 1);
        }
      }
      consume(pending + decoder.decode());
      if (!completed && !controller.signal.aborted) throw new Error("The answer was interrupted. Please retry.");
    } catch (caught) {
      if (controller.signal.aborted) return;
      setMessages((current) => {
        const last = current.at(-1);
        if (last?.role === "assistant") {
          return current.slice(0, -1);
        }
        return current;
      });
      setError(
        caught instanceof Error
          ? caught.message
          : "Something went wrong while reconstructing the answer.",
      );
    } finally {
      if (abortRef.current === controller) {
        setIsLoading(false);
        abortRef.current = null;
      }
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void send(input);
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void send(input);
    }
  }

  function reset() {
    abortRef.current?.abort();
    abortRef.current = null;
    evidenceRef.current = "";
    setDiagnostic("");
    setMessages([]);
    setError(null);
    setIsLoading(false);
    setInput("");
  }

  const composer = (
          <form
            onSubmit={onSubmit}
            className={(hasConversation ? "border-t " : "border-b ") + "border-earth/10 bg-paper/80 px-4 py-4 sm:px-6"}
          >
            {error ? (
              <p className="mb-3 rounded-xl border border-saffron/30 bg-saffron/10 px-3 py-2 text-sm text-saffron-deep">
                {error}
              </p>
            ) : null}
            <div className="flex items-end gap-2 rounded-2xl border border-earth/15 bg-khadi/60 px-3 py-2 focus-within:border-saffron/50">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={onKeyDown}
                rows={1}
                placeholder="Ask what Gandhi might say about a present-day issue…"
                className="max-h-40 min-h-[44px] flex-1 resize-none bg-transparent px-2 py-2 text-[15px] text-ink outline-none placeholder:text-ink-soft/80"
              />
              {isLoading ? (
                <button
                  type="button"
                  onClick={() => {
                    abortRef.current?.abort();
                    abortRef.current = null;
                    setMessages((current) => current.at(-1)?.role === "assistant" ? current.slice(0, -1) : current);
                    setIsLoading(false);
                  }}
                  className="font-ui mb-1 rounded-full border border-earth/20 px-3 py-2 text-xs text-earth hover:text-saffron-deep"
                >
                  Stop
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!input.trim()}
                  className="mb-1 rounded-full bg-saffron px-4 py-2 text-sm text-paper transition hover:bg-saffron-deep disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Ask
                </button>
              )}
            </div>
            <p className="font-ui mt-2 text-center text-[11px] tracking-wide text-ink-soft">
              Interpretation is distinct from verified history.
            </p>
            {hasConversation && !isLoading && messages.at(-1)?.role === "assistant" ? (
              <button type="button" className="mt-2 text-sm underline" onClick={() => void send("Please verify the sources for your previous answer and correct any unsupported claims.", true)}>
                Verify sources
              </button>
            ) : null}
            {diagnostic ? <details className="mt-2 text-xs text-ink-soft"><summary>Test details</summary><p className="break-words">{diagnostic}</p></details> : null}
          </form>
  );

  return (
    <div className="khadi-grain flex min-h-dvh flex-col">
      <div className="flag-bar h-1.5 w-full" />

      <header className="mx-auto flex w-full max-w-3xl items-start justify-between gap-4 px-5 py-5 sm:px-8">
        <div className="flex items-start gap-3">
          <div className="mt-1 flex h-11 w-11 items-center justify-center rounded-full border border-saffron/30 bg-paper text-saffron">
            <Charkha className="h-7 w-7" spinning={isLoading} />
          </div>
          <div>
            <p className="font-ui text-[11px] tracking-[0.28em] text-earth uppercase">
              Contextual reconstruction
            </p>
            <h1 className="font-display text-[1.85rem] leading-none font-semibold text-ink italic sm:text-[2.15rem]">
              What would Gandhi say today?
            </h1>
            <p className="mt-1.5 max-w-md text-sm leading-relaxed text-ink-soft">
              Explore Gandhi&apos;s ideas and their possible application today.
              Ask to verify sources when you want supporting evidence.
            </p>
          </div>
        </div>
        {hasConversation ? (
          <button
            type="button"
            onClick={reset}
            className="font-ui mt-1 shrink-0 rounded-full border border-earth/20 bg-paper/70 px-3 py-1.5 text-xs tracking-wide text-earth transition hover:border-saffron/40 hover:text-saffron-deep"
          >
            New inquiry
          </button>
        ) : null}
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-5 pb-4 sm:px-8">
        <div className="paper-card relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[28px] border border-earth/10">
          {!hasConversation ? composer : null}
          <div className="flex items-center justify-between border-b border-earth/10 px-5 py-3">
            <p className="font-ui text-[11px] tracking-[0.18em] text-earth uppercase">
              {statusLabel}
            </p>
            <p className="font-ui hidden text-[11px] text-ink-soft sm:block">
              Not an authentic quotation
            </p>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-6 sm:px-8">
            {!hasConversation ? (
              <div className="flex h-full flex-col justify-between gap-8">
                <div className="mx-auto max-w-lg text-center">
                  <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-gold/50 text-saffron">
                    <Charkha className="h-9 w-9" />
                  </div>
                  <p className="font-display text-3xl leading-tight text-ink italic">
                    Satya, ahimsa, swaraj — applied to this century.
                  </p>
                  <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
                    Ask about a present-day issue. The reply reconstructs what
                    Gandhi might say from his writings, speeches, and principles.
                    Interpretations are not authentic quotations. Source checks are available on request.
                  </p>
                </div>
                <div>
                  <p className="font-ui mb-3 text-[11px] tracking-[0.22em] text-earth uppercase">
                    Begin with an inquiry
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {SUGGESTED_INQUIRIES.map((inquiry) => (
                      <button
                        key={inquiry}
                        type="button"
                        onClick={() => void send(inquiry)}
                        className="rounded-2xl border border-earth/15 bg-khadi/50 px-4 py-3 text-left text-sm leading-snug text-ink transition hover:border-saffron/40 hover:bg-paper"
                      >
                        {inquiry}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                {messages.map((message, index) => {
                  const isUser = message.role === "user";
                  const isEmptyAssistant =
                    !isUser && !message.content && isLoading && index === messages.length - 1;

                  return (
                    <article
                      key={`${message.role}-${index}`}
                      className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={
                          isUser
                            ? "max-w-[85%] rounded-2xl rounded-br-sm bg-saffron px-4 py-3 text-paper shadow-sm"
                            : "max-w-[92%] rounded-2xl rounded-bl-sm border-l-2 border-saffron bg-khadi/70 px-4 py-4"
                        }
                      >
                        {!isUser ? (
                          <p className="font-ui mb-2 text-[10px] tracking-[0.22em] text-saffron-deep uppercase">
                            Answer
                          </p>
                        ) : null}
                        {isEmptyAssistant ? (
                          <div className="flex items-center gap-1.5 text-ink-soft">
                            <span className="thinking-dot h-1.5 w-1.5 rounded-full bg-saffron" />
                            <span className="thinking-dot h-1.5 w-1.5 rounded-full bg-saffron" />
                            <span className="thinking-dot h-1.5 w-1.5 rounded-full bg-saffron" />
                            <span className="ml-2 text-sm italic">
                              {progress}
                            </span>
                          </div>
                        ) : (
                          <div
                            className={`prose-gandhi text-[15.5px] leading-7 ${
                              isUser ? "text-paper" : "text-ink"
                            }`}
                          >
                            {renderContent(message.content)}
                          </div>
                        )}
                      </div>
                    </article>
                  );
                })}
                <div ref={bottomRef} />
              </div>
            )}
          </div>

          {hasConversation ? composer : null}
        </div>
      </main>
    </div>
  );
}
