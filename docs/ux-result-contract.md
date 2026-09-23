# Inquiry result and quiz

The homepage has one composer and one active result, not a visible chat transcript. Earlier inquiries remain selectable. A new inquiry resets local conversation state. History is held only for this page session.

## Result contract

`lib/inquiry-result.ts` defines the public result: answer type, short answer, historical basis, claim-linked sources, interpretation boundary, contested readings, missing evidence, follow-ups and source-check summary. `lib/structured-answer.ts` defines the provider's strict JSON schema and server validation. The frontend renders those fields; it never splits generated prose into sections.

Historical basis items must select an actual evidence ID. The server attaches that retrieved excerpt verbatim and resolves the URL/title itself; the model does not reproduce quotations. This prevents invented source destinations and displayed source passages; it is **not** a deterministic test of historical entailment. Model interpretation still requires evaluation. Empty historical basis is shown honestly, not filled with canned content. The 140-word limit applies to the short answer, not all evidence fields combined. Full source excerpts remain in signed receipts rather than being duplicated in every assistant history message.

The final structured generation is non-streaming because the provider's strict structured output cannot be combined with browser tools or streaming. Research remains a separate request. The endpoint transports status, evidence receipts, one validated result and completion as NDJSON. One bounded repair is allowed; invalid or interrupted output is never shown as a completed result.

## Source checks

The Check sources button sends a private verification request with the selected answer's history and evidence receipt. A typed source probe also signals an in-place update. The existing result stays visible during loading or failure. Completion replaces that result, adds evidence and notes corrections. Neither the private verification instruction nor a duplicate audit essay is added to the public page. Retry reuses signed evidence only for its matching request.

Each inquiry retains its own existing signed receipt in local component state. This does not add a database or retrieval store; vector-database integration is deferred.

## Context routing and quality gate (v26 candidate)

Every typed turn is semantically classified, including source requests. The router returns the resolved question and, for verification/reassessment, a validated assistant-message index. Source vocabulary alone does not initiate a search. Ambiguous targets request clarification; new explicit searches have no prior-answer target. The Check sources button pins the selected inquiry directly. Definitions and topic changes do not inherit source-only restrictions.

The source-check event identifies the target index. The client updates that inquiry and propagates the correction into existing descendant histories without deleting intervening turns. Reassessment answers remain separate answers to the challenge. Signed receipts are reused only when their original question binding matches; otherwise retrieval runs again. Irrelevant receipts are cleared before generation. No new evidence-storage system is introduced.

After schema validation, substantive candidates receive a bounded semantic review against the question and inspected passages. It checks unsupported attributions, invented approval conditions, misrepresented restrictions and topic drift. Material issues enter the existing one-repair budget. Definitions, clarifications and scope boundaries skip this extra call. This is a fallible model review, not proof of truth; it adds latency and must pass live regression testing before production promotion. A corrected draft still needs human evaluation in the regression batch.

The complete live suite includes 22 sequences, including unfamiliar questions and earlier-answer source targets. Controlled browser tests separately check older-answer correction, later-history preservation and existing responsive interactions. Candidate scores remain unassigned until actual model outputs have been reviewed; mocked passes are not semantic scores.

## Diagnostics

Public UI has no model selector, question-test dropdown, prompt hash, tool counts or Test details. Production metadata contains only signed transport receipts. Detailed diagnostics remain in server logs and development responses. Model comparison requests are rejected in production and the comparison script is restricted to localhost.

## Quiz

`/quiz` uses only `lib/quiz.ts` and local React state. Five Hindi questions have fixed options, explanations, interpretation caveats and source links. Null answers are explicit skips. Correct, incorrect and skipped counts always sum to five. Restart clears all answers. Quiz content is never inserted in Q&A prompts or sent to the model.

## Verification

- `bun test`: contract validation, deadlines, completion checks, evidence reuse, production diagnostics, quiz scoring and existing helper tests.
- Targeted TypeScript entrypoints and ESLint; no full-repository typecheck.
- `PLAYWRIGHT_MODULE=/path/to/playwright CHAT_TEST_URL=http://localhost:3107 node scripts/browser-check.cjs`: controlled UI flow at 320px, 390px and 1280px. Covers empty input, examples, structured sections, source checks, failures/retries, typed probes, interrupted requests, inquiry history and quiz scoring without API calls.
- `bun scripts/evaluate.ts https://www.gandhisays.com 1,2,...`: actual model results for semantic review, separate from mocked browser tests. Never treat UI test success as a historical-accuracy score.

Design follows the supplied prototype's paper/saffron/sage direction using the existing fonts and CSS tokens, not its example answers or inline quiz implementation.
