# Inquiry result and quiz

The homepage has one composer and one active result, not a visible chat transcript. Earlier inquiries remain selectable. A new inquiry resets local conversation state. History is held only for this page session.

## Result contract

`lib/inquiry-result.ts` defines the public result: answer type, short answer, historical basis, claim-linked sources, interpretation boundary, contested readings, missing evidence, follow-ups and source-check summary. `lib/structured-answer.ts` defines the provider's strict JSON schema and server validation. The frontend renders those fields; it never splits generated prose into sections.

Historical basis items must select an actual evidence ID and copy a short supporting passage. The server checks the passage against its selected excerpt and resolves the URL/title itself. This prevents invented source destinations and quotes; it is **not** a deterministic test of historical entailment. Model interpretation still requires evaluation. Empty historical basis is shown honestly, not filled with canned content. The 140-word limit applies to the short answer, not all evidence fields combined.

The final structured generation is non-streaming because the provider's strict structured output cannot be combined with browser tools or streaming. Research remains a separate request. The endpoint transports status, evidence receipts, one validated result and completion as NDJSON. One bounded repair is allowed; invalid or interrupted output is never shown as a completed result.

## Source checks

The Check sources button sends a private verification request with the selected answer's history and evidence receipt. A typed source probe also signals an in-place update. The existing result stays visible during loading or failure. Completion replaces that result, adds evidence and notes corrections. Neither the private verification instruction nor a duplicate audit essay is added to the public page. Retry reuses signed evidence only for its matching request.

Each inquiry retains its own existing signed receipt in local component state. This does not add a database or retrieval store; vector-database integration is deferred.

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
