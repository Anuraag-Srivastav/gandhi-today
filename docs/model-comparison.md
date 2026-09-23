# Controlled answer-model comparison

The public model remains `openai/gpt-oss-120b`. Opt-in candidates are restricted to `llama-3.3-70b-versatile`, `qwen/qwen3.8-27b` and `openai/gpt-oss-20b`; no arbitrary model ID is accepted and there is no UI selector. Supply the candidate as the fourth CLI argument (default Qwen). Llama returned HTTP 404 in the first live capability check. Qwen is a preview model and cannot be promoted to the public default by this experiment.

Run `bun scripts/compare-models.ts https://www.gandhisays.com 1,2` to compare input-only evaluation sequences. Each baseline request returns a signed comparison receipt. Replay must supply the unchanged messages, signed evidence and receipt against the same prompt hash. Routing and retrieval are skipped on replay; instruction text, temperature and length limits remain identical. Llama uses its system role and omits GPT-OSS-only reasoning parameters. This capability difference is part of the comparison, not a claim of identical inference settings.

The runner records answers and metadata, never signed receipts. Candidate answers advance the shared history, so paired follow-up results are conditional on that history, not independent baseline conversations. Compare evidence hashes before scoring. Failed routing/research is an application failure, not a candidate-model result. Review all five evaluation dimensions manually; passing transport tests is not a quality score.

Promotion requires improved overall quality without severe factual, safety, scope or challenge regressions. Candidate access may depend on the provider account; failure is reported, not silently substituted.

## Observed decision

23 September 2026: retain GPT-OSS 120B. Qwen completed 33/34 paired main-run turns but retained unsupported attributions and invented defensive-force conditions. Three shared research failures prevented further pairs. Four supplemental pairs included an explicit boundary pass, a baseline 429, a truncated candidate answer and another empty candidate failure. GPT-OSS 20B failed an eight-turn qualitative screen; Llama's capability request returned 404. These are constrained application trials, not intrinsic model rankings. Qwen's provisional quality score is 5.5/10 versus the retained 5/10 production assessment, not sufficient for promotion.

The trial exposed a completion-gate bug: provider-truncated prose could pass the word count. Runtime `v24-model2` now requires provider finish status `stop`; incomplete output gets at most one rewrite, whose completion status is also checked. Candidate failure metadata retains the candidate identity. This changes validation, not historical truth or prompt content.
