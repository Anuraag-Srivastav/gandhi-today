# What would Gandhi say today?

A Next.js chatbot wrapper around Groq that answers present-day questions as historically grounded reconstructions of Gandhi’s thought. The system prompt is loaded from `prompt.json`.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Keep `GROQ_API_KEY` in `.env`.

## Host on Vercel

Set **`GROQ_API_KEY`** in the Vercel project: Settings → Environment Variables (Production and Preview). Do not commit `.env`.

`GROQ_MODEL` is optional; blank values use `openai/gpt-oss-120b`.

## v21 request flow and source checks

- Ordinary questions make one streaming completion request without tools.
- Explicit English source/verification/online-search probes, or the **Verify sources** button, run Groq's built-in browser_search first. Background reading alone does not trigger search. This uses the existing Groq key and may incur additional usage.
- Search requires a supported GPT-OSS model. An unsupported configured model produces an explicit error; the app does not silently change models.
- Only returned tool records enter the Reference input. The research model's generated summary is discarded. No tool record means no claimed successful verification.
- The final user message contains JSON Question and Reference values. The unused template footer is removed from the system message; user text is never interpolated into system instructions.
- The latest retrieved evidence is retained in a signed, 24-hour token in browser memory and supplied on following turns. Signing uses the server's existing Groq key with a purpose-specific prefix. It prevents tampering, not reading: the token contains public source text, not secrets. A new search replaces the previous evidence bundle; a search without results retains the earlier bundle.
- Large tool results are reduced to bounded, query-relevant verbatim windows with source metadata and explicit partial-evidence markers. Generated research summaries are not evidence. Missing excerpts do not prove absence.
- Verification carries the exact latest assistant answer and its question in both research and answer requests. Request metadata is emitted before search and updated on failure, avoiding stale diagnostics from a preceding turn.
- Up to 80 messages / 100,000 total characters are retained. Excess context is rejected explicitly; no silent 24-message trimming. New inquiry clears both conversation and evidence.
- The response is newline-delimited JSON containing status, metadata, text, done or error events. The UI renders HTTP(S) links and removes interrupted replies from later model history.
- **Test details** shows prompt version/hash, model, search status, executed-tool count and request ID. Server logs contain this metadata, not question text, source passages or API keys.

The prompt is v24. A bounded semantic routing call resolves the current question from history without supplying an answer. Historical questions and reading recommendations retrieve evidence before generation. Modern interpretations, definitions and inference challenges remain search-free; explicit verification still triggers retrieval. Source inspection does not guarantee historical accuracy: evaluate whether passages support the entire claim and its qualifications.

Search receives a focused evidence-only request containing the current question and target answer, rather than the full conversation. Final generation retains the conversation. Search remains capped at 45 seconds; generation at 40 seconds; one optional length rewrite at 20 seconds, within 105 seconds overall. There are no automatic retries. Run `bun scripts/check-source.ts 'your source question'` with GROQ_API_KEY configured to measure search independently of answer generation. It outputs only elapsed time, tool count, finish reason or safe failure category, never credentials or source text. A timeout without returned tool records does not prove no tools started.

Groq documentation: https://console.groq.com/docs/tool-use/built-in-tools/browser-search

## Checks before evaluation

### Repeatable live regression suite

`bun scripts/evaluate.ts https://www.gandhisays.com` runs the ten core evaluation sequences plus two diagnostic sequences, sequentially. Optional third argument selects comma-separated sequence numbers. Output is JSONL with questions, answers, version/hash, timing, failures and mechanical format checks; signed context tokens are omitted. A failed sequence stops rather than asking follow-ups against missing answers. This invokes the live provider and uses its quota. It does not automatically award a historical accuracy score. Evaluation inputs never enter production prompt construction.

V24 routing uses typed JSON (`historical`, `interpretation`, `definition`, `reading`, `reassessment`, `unrelated`) and fails explicitly on invalid output. It receives full conversational context as data, not answer examples. Routing has a ten-second deadline within the same 105-second overall limit. Source-bearing turns use Medium/temperature zero; search-free turns retain the selected effort with temperature 0.2. The per-turn policy follows history. Evidence retry receipts also cover historical generation failures. Unit tests establish request construction, not model compliance; live transcripts remain required.

Runtime `v22-verification2` targets concise verification corrections within the unchanged 140-word/three-paragraph gate. Failed refinement reports the exact size violation. The Retry button can reuse retrieved evidence using a signed, expiring receipt bound to the full request and evidence hash; changed questions cannot reuse that permission. `reused-evidence` means no new search occurred. Raw rejected drafts are neither displayed nor logged.

Source excerpts retain document URLs when supplied as structured metadata or explicit document headers. Internal excerpt markers are resolved to their own source links before display; missing associations display a source-link limitation, never an unrelated URL. All answers are buffered and checked for length before display, with progress updates while waiting. Home order is: Begin with an inquiry, question-entry box, suggested questions; conversation input remains at the bottom.

Run focused tests with: bun test lib/chat-policy.test.js app/api/chat/route.test.js
These mock Groq and do not prove live tool availability.

After deployment:

1. Start a new inquiry and ask for a modern interpretation. Test details should show interpretation, not-requested, tools 0. A historical question should instead show historical with actual search status.
2. Ask for a source or press **Verify sources**. Expect results-returned and a positive tool count; inspect linked passages independently.
3. Ask a follow-up explanation. Search should remain off while retained source evidence is available.
4. Check a historical date and its source, then challenge the source. Do not award citation points merely for author-year formatting.
5. If status is no-tool-record, tool execution is not demonstrated. Preserve the request ID for diagnosis rather than treating generated research language as verification.

Vercel must permit the route's requested 120-second duration. The deployed Groq account must allow browser search. Do not compare these results to earlier no-tool runs as a prompt-only improvement.
