# Contextual verification on the original UI

Runtime experiment: `context-review1`. The base prompt remains v24; this is not the structured v26 UI release.

All typed turns use the semantic planner. It returns a kind, resolved question and validated assistant target index for verification/reassessment. The explicit Verify button still checks the most recent answer. Definitions and missing-subject clarifications do not retrieve. A new topic discards unrelated retained evidence. Signed retry evidence remains bound to the selected question.

Research receives the selected answer's original citation URLs separately from recent conversation. It is instructed to inspect those first. These are untrusted pointers, not proof that a document was inspected; only returned source passages can support the answer. This does not add storage or fetch arbitrary URLs directly from the server.

Verification distinguishes lack of support from contradiction, and unsupported attribution from a false underlying proposition. A failed retrieval remains visibly incomplete rather than generating a generic replacement answer.

A bounded model review checks factual support, source scope, invented approval conditions and target relevance. Its issues share the existing one-rewrite budget with length correction. Model review is fallible, is not a historical accuracy guarantee, and adds a provider call. The corrected answer receives deterministic length validation; it is not subjected to an unbounded review loop.

Tests cover target validation, original-citation handoff after reading, missing-target/definition retrieval bypass, source failures, evidence-bound retries and semantic repair. Run `bun test`; run `bun scripts/evaluate.ts https://www.gandhisays.com` for real production regression. The 22 sequence inputs never enter production prompt construction. Public production testing uses Vercel's provider configuration, not a local key.
