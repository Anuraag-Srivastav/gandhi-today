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

The prompt is v21. Source inspection does not guarantee historical accuracy; verify that cited passages actually support each claim. Search-trigger detection is explicit English matching, not a semantic classifier. Use **Verify sources** for wording it misses. No search is performed automatically for an ordinary current-fact question.

Search receives a focused evidence-only request containing the current question and target answer, rather than the full conversation. Final generation retains the conversation. Search remains capped at 45 seconds; generation at 40 seconds; one optional length rewrite at 20 seconds, within 105 seconds overall. There are no automatic retries. Run `bun scripts/check-source.ts 'your source question'` with GROQ_API_KEY configured to measure search independently of answer generation. It outputs only elapsed time, tool count, finish reason or safe failure category, never credentials or source text. A timeout without returned tool records does not prove no tools started.

Groq documentation: https://console.groq.com/docs/tool-use/built-in-tools/browser-search

## Checks before evaluation

Source excerpts retain document URLs when supplied as structured metadata or explicit document headers. Internal excerpt markers are resolved to their own source links before display; missing associations display a source-link limitation, never an unrelated URL. All answers are buffered and checked for length before display, with progress updates while waiting. Home order is: Begin with an inquiry, question-entry box, suggested questions; conversation input remains at the bottom.

Run focused tests with: bun test lib/chat-policy.test.js app/api/chat/route.test.js
These mock Groq and do not prove live tool availability.

After deployment:

1. Start a new inquiry and ask an ordinary Gandhi question. Test details should show not-requested, tools 0.
2. Ask for a source or press **Verify sources**. Expect results-returned and a positive tool count; inspect linked passages independently.
3. Ask a follow-up explanation. Search should remain off while retained source evidence is available.
4. Check a historical date and its source, then challenge the source. Do not award citation points merely for author-year formatting.
5. If status is no-tool-record, tool execution is not demonstrated. Preserve the request ID for diagnosis rather than treating generated research language as verification.

Vercel must permit the route's requested 120-second duration. The deployed Groq account must allow browser search. Do not compare these results to earlier no-tool runs as a prompt-only improvement.
