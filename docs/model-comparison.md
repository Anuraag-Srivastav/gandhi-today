# Controlled answer-model comparison

The public model remains `openai/gpt-oss-120b`. The opt-in candidate is `llama-3.3-70b-versatile`; no arbitrary model ID is accepted and there is no UI selector.

Run `bun scripts/compare-models.ts https://www.gandhisays.com 1,2` to compare input-only evaluation sequences. Each baseline request returns a signed comparison receipt. Replay must supply the unchanged messages, signed evidence and receipt against the same prompt hash. Routing and retrieval are skipped on replay; instruction text, temperature and length limits remain identical. Llama uses its system role and omits GPT-OSS-only reasoning parameters. This capability difference is part of the comparison, not a claim of identical inference settings.

The runner records answers and metadata, never signed receipts. Candidate answers advance the shared history, so paired follow-up results are conditional on that history, not independent baseline conversations. Compare evidence hashes before scoring. Failed routing/research is an application failure, not a candidate-model result. Review all five evaluation dimensions manually; passing transport tests is not a quality score.

Promotion requires improved overall quality without severe factual, safety, scope or challenge regressions. Candidate access may depend on the provider account; failure is reported, not silently substituted.
