"use client";

/** One composer and one visible structured result. Verification replaces its target, not the conversation. */
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import Link from "next/link";
import type { ChatMessage } from "@/lib/types";
import { resultContext, type InquiryResult as Result } from "@/lib/inquiry-result";
import { SiteFrame } from "./SiteFrame";
import { InquiryResult } from "./InquiryResult";

type Entry = { id: string; question: string; result: Result; messages: ChatMessage[]; evidenceToken: string; checked: boolean };
type Pending = { messages: ChatMessage[]; question: string; targetId?: string; contextId?: string; verifySources?: boolean; evidenceToken: string; retryToken?: string };
const examples = [
  ["A historical view", "What did Gandhi think about money?"],
  ["A personal dilemma", "How might Gandhi think about forgiving someone who betrayed my trust?"],
  ["A difficult conflict", "How might Gandhi judge protecting my family during an attack?"],
  ["A modern issue", "What would Gandhi say about artificial intelligence?"],
  ["A critical question", "Why are Gandhi’s views on caste criticised?"],
];

export function Chat() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [activeId, setActiveId] = useState("");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState<"answer" | "sources" | null>(null);
  const [error, setError] = useState("");
  const [sourceError, setSourceError] = useState("");
  const [status, setStatus] = useState("");
  const [failed, setFailed] = useState<Pending | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const active = entries.find(entry => entry.id === activeId);
  useEffect(() => () => abortRef.current?.abort(), []);

  function populate(question: string) {
    setInput(question); setError(""); inputRef.current?.focus();
    inputRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }
  async function run(pending: Pending) {
    if (abortRef.current) return;
    const controller = new AbortController(); abortRef.current = controller;
    setBusy(pending.targetId ? "sources" : "answer"); setError(""); setSourceError(""); setFailed(null);
    setStatus(pending.targetId ? "Checking sources…" : "Preparing your answer…");
    let evidenceToken = pending.evidenceToken;
    let retryToken = pending.retryToken;
    let targetId = pending.targetId;
    try {
      const response = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal,
        body: JSON.stringify({ messages: pending.messages, evidenceToken, verifySources: pending.verifySources === true,
          verificationTargetIndex: pending.verifySources ? entries.find(item => item.id === pending.targetId)!.messages.length - 1 : undefined, retryToken }) });
      if (!response.ok || !response.body) throw new Error("The request could not be started. Please try again.");
      const reader = response.body.getReader(); const decoder = new TextDecoder();
      let buffer = ""; let result: Result | undefined; let completed = false;
      const consume = (line: string) => {
        if (!line.trim() || controller.signal.aborted) return;
        const event = JSON.parse(line);
        if (event.type === "source-check") {
          const target = entries.find(item => item.messages.length === event.targetIndex + 1
            && item.messages.every((message, index) => message.role === pending.messages[index]?.role && message.content === pending.messages[index]?.content));
          if (!target) throw new Error("The answer selected for checking is no longer available. Select that inquiry and try again.");
          targetId = target.id; setActiveId(target.id); setBusy("sources");
        }
        if (event.type === "metadata") {
          if (typeof event.evidenceToken === "string") evidenceToken = event.evidenceToken;
          if (typeof event.retryToken === "string") retryToken = event.retryToken;
        }
        if (event.type === "status") setStatus(pending.targetId ? "Checking relevant source passages…" : "Preparing your answer…");
        if (event.type === "result") result = event.result;
        if (event.type === "done") completed = true;
        if (event.type === "error") throw new Error(event.text);
      };
      while (true) {
        const { value, done } = await reader.read(); buffer += decoder.decode(value, { stream: !done });
        let newline;
        while ((newline = buffer.indexOf("\n")) >= 0) { consume(buffer.slice(0, newline)); buffer = buffer.slice(newline + 1); }
        if (done) break;
      }
      consume(buffer);
      if (controller.signal.aborted) return;
      if (!completed || !result) throw new Error("The answer was interrupted. Please retry; your previous result has not changed.");
      const id = targetId || crypto.randomUUID();
      // Replace the old answer and exclude the private source-check instruction from conversational history.
      const target = entries.find(item => item.id === targetId);
      const history = target ? target.messages.slice(0, -1) : pending.messages;
      const entry: Entry = { id, question: targetId ? entries.find(item => item.id === targetId)!.question : pending.question, result, evidenceToken, checked: !!targetId,
        messages: [...history, { role: "assistant", content: resultContext(result) }] };
      setEntries(previous => target ? previous.map(item => {
        if (item.id === id) return entry;
        // Existing branches retain the corrected answer, without losing intervening questions.
        const samePrefix = target.messages.every((message, index) => message.role === item.messages[index]?.role && message.content === item.messages[index]?.content);
        if (!samePrefix) return item;
        const updated = [...item.messages]; updated[target.messages.length - 1] = entry.messages.at(-1)!;
        return { ...item, messages: updated };
      }) : [...previous, entry]);
      setActiveId(id); if (!pending.targetId) setInput("");
      setStatus(targetId ? "Source check completed; the result has been updated." : "Your answer is ready.");
      if (!targetId) requestAnimationFrame(() => { resultRef.current?.focus(); resultRef.current?.scrollIntoView({ block: "start", behavior: "smooth" }); });
    } catch (cause) {
      if (!controller.signal.aborted) {
        const message = cause instanceof Error ? cause.message : "The request could not be completed. Please retry.";
        if (targetId) setSourceError(message); else setError(message);
        setFailed({ ...pending, targetId, evidenceToken, retryToken }); setStatus("");
      }
    } finally { if (abortRef.current === controller) { abortRef.current = null; setBusy(null); } }
  }
  function ask(event?: FormEvent) {
    event?.preventDefault(); if (busy) return;
    const question = input.trim();
    if (!question) { setError("Enter a question in the box, then select Ask."); inputRef.current?.focus(); return; }
    void run({ question, contextId: active?.id, messages: [...(active?.messages || []), { role: "user", content: question }], evidenceToken: active?.evidenceToken || "" });
  }
  function verify() {
    if (!active || busy) return;
    if (failed?.targetId === active.id) { void run(failed); return; }
    void run({ targetId: active.id, verifySources: true, question: active.question, evidenceToken: active.evidenceToken,
      messages: [...active.messages, { role: "user", content: "Verify the sources and correct unsupported claims in this answer." }] });
  }
  function stop() { abortRef.current?.abort(); setStatus("Request stopped. Your existing result is unchanged."); }
  function reset() { if (busy) return; setEntries([]); setActiveId(""); setInput(""); setError(""); setSourceError(""); setFailed(null); setStatus(""); inputRef.current?.focus(); }
  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); ask(); } }

  return <SiteFrame>
    <section className="site-hero"><span className="eyebrow">History, in conversation with today</span><h1>Old questions.<br /><em>New ways to see them.</em></h1><p>Explore Gandhi’s recorded ideas and their careful application to present-day questions—clearly separating history from interpretation.</p></section>
    <section className="inquiry-shell paper-card" aria-labelledby="inquiry-heading">
      <div className="section-heading"><h2 id="inquiry-heading">Begin with an inquiry</h2>{entries.length > 0 && <button type="button" className="text-button" onClick={reset} disabled={!!busy}>New inquiry</button>}</div>
      <form onSubmit={ask} className="question-form"><label htmlFor="question">Your question</label>
        <textarea ref={inputRef} id="question" value={input} onChange={event => { setInput(event.target.value); setError(""); }} onKeyDown={onKeyDown} rows={2} maxLength={8000} placeholder="Ask about Gandhi, a personal dilemma, or the world today…" aria-describedby="composer-trust composer-error" />
        <div className="composer-bottom"><p id="composer-trust">Every answer distinguishes Gandhi’s recorded views from present-day interpretation.</p><div className="composer-actions">{busy && <button type="button" className="text-button" onClick={stop}>Stop</button>}<button type="submit" className="primary-button" disabled={!!busy}>{busy ? "Working…" : "Ask →"}</button></div></div>
        <div id="composer-error">{error && <p role="alert" className="error-note">{error}</p>}</div>{failed && !failed.targetId && <button type="button" className="secondary-button" disabled={!!busy} onClick={() => void run(failed)}>Retry request</button>}
      </form>
      <details className="example-prompts" open={!entries.length || undefined}><summary>Or begin with a question</summary><div className="example-grid">{examples.map(([label, question]) => <button type="button" key={label} onClick={() => populate(question)}><span>{label}</span>{question}</button>)}</div></details>
    </section>
    <p role="status" aria-live="polite" className={busy === "answer" ? "progress-note request-progress" : "sr-only"}>{status}</p>
    {entries.length > 1 && <details className="previous-inquiries"><summary>Earlier inquiries ({entries.length - 1})</summary><nav aria-label="Earlier inquiries">{entries.filter(entry => entry.id !== activeId).map(entry => <button type="button" key={entry.id} disabled={!!busy} onClick={() => { setActiveId(entry.id); setSourceError(""); setFailed(null); }}>{entry.question}</button>)}</nav></details>}
    <div ref={resultRef} tabIndex={-1} className="result-focus">{active && <InquiryResult question={active.question} result={active.result} checked={active.checked} checking={busy === "sources"} busy={!!busy} error={sourceError} onVerify={verify} onFollowUp={populate} />}</div>
    <aside className="quiz-promo"><div><span className="eyebrow">A different way to explore</span><h2>पाँच सवाल। थोड़ा आत्मचिंतन।</h2><p>Explore five Gandhian ideas in a short Hindi quiz, with explanations and sources.</p></div><Link href="/quiz" className="quiz-link">Try the quiz →</Link></aside>
  </SiteFrame>;
}
