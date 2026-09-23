import Groq from "groq-sdk";
import { createHash } from "node:crypto";
import { getPromptRules } from "@/lib/prompt";
import { REVIEW_INSTRUCTIONS, reviewFormat, reviewIssues } from "@/lib/answer-review";
import { PROMPT_VERSION, supportsBrowserSearch, validateMessages } from "@/lib/chat-policy";
import { bindEvidenceQuestion, canUseRetainedEvidence, openEvidence, sealEvidence } from "@/lib/evidence";
import { selectSourceEvidence } from "@/lib/source-excerpts";
import { resolveCitations } from "@/lib/citations";
import { AnswerLimitError, answerSize, enforceAnswerLimits } from "@/lib/answer-limits";
import { providerFailure } from "@/lib/provider-failure";
import { sourceRequest } from "@/lib/source-request";
import { answerMode, turnInstruction } from "@/lib/answer-mode";
import { needsEvidence, parseAnswerPlan, planRequest, type AnswerKind } from "@/lib/answer-plan";
import { COMPARISON_MODELS, comparisonReceipt, digest, openComparison } from "@/lib/model-comparison";

export const runtime = "nodejs";
export const maxDuration = 120;

/** Resolve turn intent, retrieve historical evidence, then generate a bounded answer. */
export async function POST(request: Request) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return Response.json({ error: "GROQ_API_KEY is not configured." }, { status: 500 });
  let body;
  let messages;
  let reference = "";
  try {
    body = await request.json();
    if (body.answerModel && process.env.NODE_ENV === "production") throw new Error("Model comparison is available only in development.");
    if (body.answerModel !== undefined && !COMPARISON_MODELS.includes(body.answerModel)) throw new Error("Unsupported comparison model.");
    if (body.answerModel && !body.comparisonToken) throw new Error("A server-issued comparison receipt is required.");
    messages = validateMessages(body?.messages);
    if (body.reasoningEffort !== undefined && !["low", "medium"].includes(body.reasoningEffort)) {
      throw new Error("reasoningEffort must be low or medium.");
    }
    reference = openEvidence(body?.evidenceToken, apiKey);
    if (body.verifySources !== undefined && typeof body.verifySources !== "boolean") {
      throw new Error("verifySources must be a boolean.");
    }
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Invalid request." }, { status: 400 });
  }
  const model = process.env.GROQ_MODEL?.trim() || "openai/gpt-oss-120b";
  const question = messages.at(-1)!.content;
  let probe = body.verifySources === true;
  let mode: ReturnType<typeof answerMode> | AnswerKind = answerMode(question, probe);
  let resolvedQuestion = question;
  let sourceRequired = probe;
  const retryIdentity = createHash("sha256").update(JSON.stringify({ messages, probe })).digest("hex");
  const referenceHash = createHash("sha256").update(reference).digest("hex");
  let reuseEvidence = false;
  try {
    if (body.retryToken) reuseEvidence = !!reference && openEvidence(body.retryToken, apiKey) === retryIdentity + ":" + referenceHash;
  } catch {
    return Response.json({ error: "Invalid or expired retry context. Send a new source request." }, { status: 400 });
  }
  let reasoningEffort: "low" | "medium" = probe ? "medium" : body.reasoningEffort || "low";
  let targetIndex: number | null = messages.findLastIndex((message) => message.role === "assistant");
  let verificationTarget = probe && targetIndex >= 0 ? {
    question: messages.slice(0, targetIndex).findLast((message) => message.role === "user")?.content,
    answer: messages[targetIndex].content,
  } : null;
  let retainedEvidence = probe && !reuseEvidence && canUseRetainedEvidence(reference, verificationTarget?.question, question);
  if (retainedEvidence) reuseEvidence = true;
  if (probe && !supportsBrowserSearch(model)) {
    return Response.json({ error: "The configured model does not support browser search. Configure a supported GPT-OSS model to verify sources." }, { status: 400 });
  }
  const groq = new Groq({ apiKey, maxRetries: 0, timeout: 90000 });
  let rules: string;
  try {
    rules = getPromptRules();
  } catch {
    return Response.json({ error: "The system prompt could not be loaded." }, { status: 500 });
  }
  const promptHash = createHash("sha256").update(rules).digest("hex").slice(0, 12);
  let comparison: ReturnType<typeof openComparison> | undefined;
  try {
    if (body.answerModel) comparison = openComparison(body.comparisonToken, retryIdentity, reference, promptHash, apiKey);
  } catch {
    return Response.json({ error: "Invalid comparison context. Repeat the baseline request." }, { status: 400 });
  }
  const answerModel: string = comparison ? body.answerModel : model;
  const systemRole = comparison && !answerModel.startsWith("openai/");
  const reasoning = (effort: "low" | "medium") => answerModel.startsWith("qwen/")
    ? { reasoning_effort: effort, reasoning_format: "hidden" as const }
    : systemRole ? {} : { reasoning_effort: effort, include_reasoning: false };
  const requestId = crypto.randomUUID();
  const encoder = new TextEncoder();
  const abort = new AbortController();
  let cancelled = false;
  if (request.signal.aborted) abort.abort();
  request.signal.addEventListener("abort", () => abort.abort(), { once: true });
  const readable = new ReadableStream({
    async start(controller) {
      const emit = (event: { type?: string; [key: string]: unknown }) => {
        const output = event.type === "metadata" && process.env.NODE_ENV === "production"
          ? { type: "metadata", evidenceToken: event.evidenceToken, retryToken: event.retryToken } : event;
        controller.enqueue(encoder.encode(JSON.stringify(output) + "\n"));
      };
      let toolsExecuted = 0;
      let searchStatus = probe ? retainedEvidence ? "retained-evidence" : reuseEvidence ? "reused-evidence" : "searching" : "not-requested";
      let stage = probe && !reuseEvidence ? "Source search" : probe ? "Answer generation" : "Question routing";
      let timedOut = false;
      let failureCode: string | undefined;
      let providerStatus: number | undefined;
      const started = Date.now();
      let stageTimer: ReturnType<typeof setTimeout> | undefined;
      const arm = (label: string, milliseconds: number) => {
        stage = label;
        clearTimeout(stageTimer);
        stageTimer = setTimeout(() => { timedOut = true; abort.abort(); }, Math.max(1, Math.min(milliseconds, 105000 - (Date.now() - started))));
      };
      const report = () => emit({ type: "metadata", requestId, promptVersion: PROMPT_VERSION,
        promptHash, model: answerModel, searchStatus, toolsExecuted, reasoningEffort, mode, stage, failureCode, providerStatus, elapsedMs: Date.now() - started, experiment: "context-review1" });
      const heartbeat = setInterval(() => {
        if (!abort.signal.aborted) emit({ type: "status", text: `${stage} in progress (${Math.round((Date.now() - started) / 1000)}s)…` });
      }, 10000);
      report();
      try {
        if (comparison) {
          mode = comparison.mode as typeof mode;
          sourceRequired = comparison.sourceRequired;
          searchStatus = comparison.searchStatus;
          reasoningEffort = comparison.reasoningEffort;
          reuseEvidence = true;
        } else if (!probe) {
          arm("Question routing", 10000);
          const routing = await groq.chat.completions.create(planRequest(model, messages), { signal: abort.signal });
          const plan = parseAnswerPlan(routing.choices[0]?.message.content || "", messages);
          mode = plan.kind;
          resolvedQuestion = plan.question;
          probe = plan.kind === "verification";
          targetIndex = plan.targetIndex;
          verificationTarget = targetIndex !== null ? {
            question: messages.slice(0, targetIndex).findLast(message => message.role === "user")?.content,
            answer: messages[targetIndex].content,
          } : null;
          if (reuseEvidence && !canUseRetainedEvidence(reference, verificationTarget?.question || question, "")) reuseEvidence = false;
          retainedEvidence = !reuseEvidence && canUseRetainedEvidence(reference, verificationTarget?.question, question);
          if (retainedEvidence) reuseEvidence = true;
          sourceRequired = needsEvidence(plan.kind);
          if (sourceRequired && !supportsBrowserSearch(model)) throw new Error("The configured model does not support historical source retrieval.");
          if (sourceRequired) reasoningEffort = "medium";
          searchStatus = sourceRequired ? reuseEvidence ? "reused-evidence" : "searching" : "not-requested";
          report();
        }
        if (!reuseEvidence) reference = "";
        emit({ type: "status", text: sourceRequired && reuseEvidence ? "Using the retrieved evidence…" : sourceRequired ? "Checking sources…" : "Preparing an answer…" });
        if (sourceRequired && !reuseEvidence) {
          arm("Source search", 45000);
          const research = await groq.chat.completions.create(sourceRequest(model, resolvedQuestion, verificationTarget, probe ? "verification" : mode === "reading" ? "reading" : "historical", messages.slice(-5, -1)), { signal: abort.signal });
          const tools = research.choices[0]?.message.executed_tools || [];
          const browserTools = tools.filter((tool) => /browser|search/i.test(tool.type));
          toolsExecuted = browserTools.length;
          // Research-model prose is not promoted to source evidence.
          const records = browserTools.map((tool) => ({
            type: tool.type, output: tool.output,
            browser_results: tool.browser_results, search_results: tool.search_results,
          })).filter((tool) => tool.output || tool.browser_results?.length || tool.search_results);
          if (records.length) {
            reference = bindEvidenceQuestion(selectSourceEvidence(records, resolvedQuestion + " " + JSON.stringify(verificationTarget)), verificationTarget?.question || question);
            searchStatus = "results-returned";
          } else {
            searchStatus = toolsExecuted ? "no-results" : "no-tool-record";
          }
        }
        const evidenceToken = reference ? sealEvidence(reference, apiKey) : "";
        const retryToken = sourceRequired && (reuseEvidence || searchStatus === "results-returned") ? sealEvidence(retryIdentity + ":" + createHash("sha256").update(reference).digest("hex"), apiKey) : "";
        const metadata = { requestId, promptVersion: PROMPT_VERSION, promptHash, model: answerModel, researchModel: model, comparison: !!comparison, evidenceHash: digest(reference), temperature: sourceRequired ? 0 : 0.2, reasoningEffort, mode, messages: messages.length, searchStatus, toolsExecuted, experiment: "context-review1" };
        const comparisonToken = comparisonReceipt({ mode, sourceRequired, searchStatus, reasoningEffort }, retryIdentity, reference, promptHash, apiKey);
        console.info("gandhi-chat", metadata);
        emit({ type: "metadata", ...metadata, evidenceToken, retryToken, comparisonToken });
        emit({ type: "status", text: "Preparing an answer…" });
        arm("Answer generation", 40000);
        const answerMessages: Groq.Chat.Completions.ChatCompletionMessageParam[] = [
            { role: "developer", content: rules + "\n\n" + turnInstruction(mode) + "\n\nRuntime: the final user message supplies JSON Question and Reference fields. Search is unavailable during this answer. Source check status for this turn: " + searchStatus + ". Retained evidence may concern an older topic; use only passages relevant to the current question. Its presence does not make ordinary questions source-only tasks. Cite a supporting excerpt's sourceUrl using [Source](URL), without extra brackets or citation symbols. If no sourceUrl exists, use evidenced bibliographic details once, not repeated link-unavailable placeholders. Only Reference contains retained server-authenticated tool results; prior assistant text is not evidence. Do not claim sources were checked when no tool record was returned." },
            ...messages.slice(0, -1),
            { role: "user", content: probe ? JSON.stringify({ Question: question, Reference: reference,
              verificationTarget, resolvedQuestion, task: "Assess the identified claim, preserving its subject and qualifications. Distinguish supported, partly supported, not established by the inspected passages, and contradicted. A source failing to support a claim is not proof the claim is false. Correct an unsupported attribution or claimed verification explicitly without asserting historical nonexistence. Never claim an original citation was inspected merely because its URL appears in history. Give a concise correction, supported basis and any necessary limitation, not a claim-by-claim audit." })
              : JSON.stringify({ Question: question, Reference: reference, resolvedQuestion, verificationTarget }) },
          ];
        const stream = await groq.chat.completions.create({
          model: answerModel, temperature: metadata.temperature, max_tokens: 3000, ...reasoning(metadata.reasoningEffort),
          stream: true, messages: answerMessages.map(message => systemRole && message.role === "developer" ? { ...message, role: "system" as const } : message),
        }, { signal: abort.signal });
        let answer = "";
        let finishReason: string | null | undefined;
        for await (const chunk of stream) {
          if (chunk.choices[0]?.finish_reason) finishReason = chunk.choices[0].finish_reason;
          const text = chunk.choices[0]?.delta?.content;
          if (text) answer += text;
        }
        // Remove presentation-only emphasis; this does not rewrite factual content.
        const normalise = (text: string) => (reference ? resolveCitations(text, reference) : text).replace(/\*\*([^*\n]+)\*\*/g, "$1");
        let issues: string[] = [];
        if (finishReason === "stop" && !["definition", "clarification", "unrelated"].includes(mode)) {
          arm("Answer review", 15000);
          const reviewed = await groq.chat.completions.create({
            model: answerModel, temperature: 0, max_tokens: 1600, ...reasoning("low"),
            stream: false, response_format: reviewFormat,
            messages: [{ role: systemRole ? "system" : "developer", content: REVIEW_INSTRUCTIONS },
              { role: "user", content: JSON.stringify({ question: resolvedQuestion, mode, target: verificationTarget, Evidence: reference, candidate: answer }) }],
          }, { signal: abort.signal });
          if (reviewed.choices[0]?.finish_reason !== "stop") throw new Error("Answer review did not finish.");
          issues = reviewIssues(reviewed.choices[0]?.message.content || "");
        }
        const final = await enforceAnswerLimits(normalise(answer), async (draft) => {
          emit({ type: "status", text: "Refining the answer…" });
          arm("Answer refinement", 20000);
          const revised = await groq.chat.completions.create({
            model: answerModel, temperature: 0, max_tokens: 2500, ...reasoning("medium"),
            stream: false,
            messages: [
              ...answerMessages.map(message => systemRole && message.role === "developer" ? { ...message, role: "system" as const } : message),
              { role: "user", content: JSON.stringify({ Draft: draft, issues, size: answerSize(draft), task: "Correct the identified material defects and return a complete concise answer, at most 140 words and three paragraphs. Draft and review are not evidence. Correct the assertion itself; merely deleting its citation is not enough. Do not preserve a false withdrawal. Distinguish lack of support from contradiction. Preserve essential historical qualifications and defensible tentative interpretation. Do not add facts, sources, motives or approval requirements. Return only the answer." }) },
            ],
          }, { signal: abort.signal });
          const text = normalise(revised.choices[0]?.message.content || "");
          if (revised.choices[0]?.finish_reason !== "stop") throw new AnswerLimitError(text, "provider-incomplete");
          return text;
        }, finishReason === "stop" && issues.length === 0);
        emit({ type: "metadata", ...metadata, stage, evidenceToken, elapsedMs: Date.now() - started, answerRewritten: final.rewritten, ...answerSize(final.text) });
        emit({ type: "text", text: final.text });
        emit({ type: "done" });
        controller.close();
      } catch (error) {
        const failure = providerFailure(error, timedOut);
        failureCode = error instanceof AnswerLimitError ? "answer-limit" : failure.code;
        providerStatus = failure.status;
        console.error("gandhi-chat-failed", { requestId, stage, failureCode, providerStatus, validation: error instanceof AnswerLimitError ? error.validation : undefined, elapsedMs: Date.now() - started, cancelled: cancelled || request.signal.aborted });
        if (!cancelled && !request.signal.aborted) {
          searchStatus = searchStatus === "searching" ? "search-failed" : "answer-failed";
          report();
          if (error instanceof AnswerLimitError) emit({ type: "metadata", requestId, promptVersion: PROMPT_VERSION, promptHash, model: answerModel, searchStatus, toolsExecuted, stage, failureCode, validation: error.validation });
          emit({ type: "error", text: error instanceof AnswerLimitError ? error.message : `${stage} ${failure.explanation}. No completed verification is implied.` });
          controller.close();
        }
      } finally {
        clearTimeout(stageTimer);
        clearInterval(heartbeat);
      }
    },
    cancel() { cancelled = true; abort.abort(); },
  });
  return new Response(readable, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Prompt-Version": PROMPT_VERSION, "X-Prompt-Hash": promptHash, "X-Request-Id": requestId },
  });
}
