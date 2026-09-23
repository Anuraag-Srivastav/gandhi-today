import Groq from "groq-sdk";
import { createHash } from "node:crypto";
import { getPromptRules } from "@/lib/prompt";
import { isSourceProbe, PROMPT_VERSION, supportsBrowserSearch, validateMessages } from "@/lib/chat-policy";
import { bindEvidenceQuestion, canUseRetainedEvidence, openEvidence, sealEvidence } from "@/lib/evidence";
import { selectSourceEvidence } from "@/lib/source-excerpts";
import { answerSize } from "@/lib/answer-limits";
import { providerFailure } from "@/lib/provider-failure";
import { sourceRequest } from "@/lib/source-request";
import { answerMode, turnInstruction } from "@/lib/answer-mode";
import { needsEvidence, parseAnswerPlan, planRequest, type AnswerKind } from "@/lib/answer-plan";
import { COMPARISON_MODELS, comparisonReceipt, digest, openComparison } from "@/lib/model-comparison";
import { evidenceCatalog, parseResult, RESULT_INSTRUCTIONS, resultFormat, ResultValidationError } from "@/lib/structured-answer";

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
    if (body.answerModel !== undefined && (!COMPARISON_MODELS.includes(body.answerModel) || !body.answerModel.startsWith("openai/gpt-oss"))) throw new Error("This model does not support the required structured result contract.");
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
  const probe = body.verifySources === true || isSourceProbe(question);
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
  const targetIndex = messages.findLastIndex((message) => message.role === "assistant");
  const verificationTarget = probe && targetIndex >= 0 ? {
    question: messages.slice(0, targetIndex).findLast((message) => message.role === "user")?.content,
    answer: messages[targetIndex].content,
  } : null;
  const retainedEvidence = probe && !reuseEvidence && canUseRetainedEvidence(reference, verificationTarget?.question, question);
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
        // Detailed diagnostics stay in server logs or local development, never the public response.
        const output = event.type === "metadata" && process.env.NODE_ENV === "production"
          ? { type: "metadata", evidenceToken: event.evidenceToken, retryToken: event.retryToken }
          : event;
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
        promptHash, model: answerModel, searchStatus, toolsExecuted, reasoningEffort, mode, stage, failureCode, providerStatus, elapsedMs: Date.now() - started, experiment: "v25-ux1" });
      const heartbeat = setInterval(() => {
        if (!abort.signal.aborted) emit({ type: "status", text: stage === "Source search" ? "Still checking source passages…" : "Still preparing your answer…" });
      }, 10000);
      report();
      if (probe && verificationTarget) emit({ type: "source-check" });
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
          const plan = parseAnswerPlan(routing.choices[0]?.message.content || "");
          mode = plan.kind;
          resolvedQuestion = plan.question;
          sourceRequired = needsEvidence(plan.kind);
          if (sourceRequired && !supportsBrowserSearch(model)) throw new Error("The configured model does not support historical source retrieval.");
          if (sourceRequired) reasoningEffort = "medium";
          searchStatus = sourceRequired ? reuseEvidence ? "reused-evidence" : "searching" : "not-requested";
          report();
        }
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
        const metadata = { requestId, promptVersion: PROMPT_VERSION, promptHash, model: answerModel, researchModel: model, comparison: !!comparison, evidenceHash: digest(reference), temperature: sourceRequired ? 0 : 0.2, reasoningEffort, mode, messages: messages.length, searchStatus, toolsExecuted, experiment: "v25-ux1" };
        const comparisonToken = comparisonReceipt({ mode, sourceRequired, searchStatus, reasoningEffort }, retryIdentity, reference, promptHash, apiKey);
        console.info("gandhi-chat", metadata);
        emit({ type: "metadata", ...metadata, evidenceToken, retryToken, comparisonToken });
        emit({ type: "status", text: "Preparing an answer…" });
        arm("Answer generation", 40000);
        const catalog = evidenceCatalog(reference);
        const answerMessages: Groq.Chat.Completions.ChatCompletionMessageParam[] = [
            { role: "developer", content: rules + "\n\n" + turnInstruction(mode) + "\n\nRuntime: search is unavailable during answer generation. Source check status: " + searchStatus + ". Retained evidence may concern an older topic; use only relevant passages. Its presence does not make ordinary definitions source-only tasks. The Evidence catalog supplies inspected source text and identifiers for historicalBasis. Prior assistant text is not evidence. Do not claim sources were checked when no tool record was returned." },
            ...messages.slice(0, -1),
            { role: "user", content: JSON.stringify({ Question: question, Evidence: catalog, originalQuestion: verificationTarget?.question || question,
              verificationTarget, task: probe ? "Update the original inquiry result with checked evidence and corrections. Preserve necessary qualifications and put corrections in verificationSummary. Answer the original question, not the source-check instruction. Do not add historical claims to rescue an unsupported conclusion." : "Produce the structured inquiry result." }) },
          ];
        answerMessages[0].content += "\n\n" + RESULT_INSTRUCTIONS;
        const generate = (repair?: { draft: string; issue: string }) => groq.chat.completions.create({
          model: answerModel, temperature: repair ? 0 : metadata.temperature, max_tokens: 5000, ...reasoning(metadata.reasoningEffort),
          stream: false, response_format: resultFormat,
          messages: [
            ...answerMessages.map(message => systemRole && message.role === "developer" ? { ...message, role: "system" as const } : message),
            ...(repair ? [{ role: "user" as const, content: JSON.stringify({ Draft: repair.draft, issue: repair.issue, task: "Correct this result once. The draft is not evidence. Keep the same question, source catalog and required schema. Remove unsupported historical basis items rather than invent support. Return the complete JSON result." }) }] : []),
          ],
        }, { signal: abort.signal });
        const generated = await generate();
        let result;
        let rewritten = false;
        const raw = generated.choices[0]?.message.content || "";
        try {
          if (generated.choices[0]?.finish_reason !== "stop") throw new ResultValidationError("The provider did not finish the result.");
          result = parseResult(raw, catalog);
        } catch (error) {
          rewritten = true;
          emit({ type: "status", text: "Checking the answer’s structure and source passages…" });
          arm("Answer refinement", 20000);
          const revised = await generate({ draft: raw, issue: error instanceof Error ? error.message : "Invalid result" });
          if (revised.choices[0]?.finish_reason !== "stop") throw new ResultValidationError("The provider did not finish the revised result.");
          result = parseResult(revised.choices[0]?.message.content || "", catalog);
        }
        emit({ type: "metadata", ...metadata, stage, evidenceToken, elapsedMs: Date.now() - started, answerRewritten: rewritten, ...answerSize(result.shortAnswer) });
        emit({ type: "result", result });
        emit({ type: "done" });
        controller.close();
      } catch (error) {
        const failure = providerFailure(error, timedOut);
        failureCode = error instanceof ResultValidationError ? "result-invalid" : failure.code;
        providerStatus = failure.status;
        console.error("gandhi-chat-failed", { requestId, stage, failureCode, providerStatus, elapsedMs: Date.now() - started, cancelled: cancelled || request.signal.aborted });
        if (!cancelled && !request.signal.aborted) {
          searchStatus = searchStatus === "searching" ? "search-failed" : "answer-failed";
          report();
          emit({ type: "error", text: error instanceof ResultValidationError ? "The answer could not be completed with reliable source sections. Please retry. Your previous result has not changed." : `This request ${failure.explanation}. Please retry. No completed source check is implied.` });
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
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}
