# Optional answer UI metadata

The existing NDJSON response can carry these optional top-level fields on its
`metadata`, `text`, or `done` events. They apply only to that response, not future
answers. No frontend text classification is performed.

- `answer_type`: `historical` or `interpretive`; other values show no type label.
- `safety_flag`: boolean; only `true` displays the safety note.
- `related_concepts`: string array; at most three nonempty strings become chips.
- `is_refusal`: boolean; `true` suppresses the documented-parts follow-up chip.

The backend does not currently emit these fields. Supplying them is a separate
backend dependency, not part of this copy change. Answers without metadata retain
the default source heading and completed sourced answers show the follow-up chip.
Refusals without sources never show that chip; a sourced refusal must supply
`is_refusal: true` to suppress it without guessing from prose.

Completion comes from the existing `done` event. Errors discard partial answers.
UI metadata is excluded from the role/content history sent to the API.

Run `scripts/copy-browser-check.cjs` with `PLAYWRIGHT_MODULE` pointing to an
installed Playwright package and `CHAT_TEST_URL` pointing to the running app.
It mocks API replies and checks desktop/mobile copy, metadata, related chips,
source follow-ups, refusals, errors, and invalid/absent classification fields.
