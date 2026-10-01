# Publishing reviewed answers

Permanent answer pages are generated from `content/answers.ts`. Routes, homepage links, the answer index, metadata, and sitemap entries all use the same records.

## Add or finish an answer

1. Add or edit one record in `answerRecords`.
2. Keep `status: "draft"` while researching and reviewing it. Draft slugs return 404 and are excluded from navigation and the sitemap.
3. Fill `shortAnswer`, `sections`, and `sources`. Each source can include its title, author, date, page or section locator, URL, and the exact claim it supports.
4. Inspect every linked passage. Keep historical claims separate from sections marked `interpretation`; do not add remembered quotations or citation details.
5. Add `publishedAt` and change `status` to `"published"` only after approval. The build rejects published records missing answer prose, sections, sources, or a publication date.
6. Run `bun test`, `bunx tsc --noEmit`, `bun run lint`, and `bun run build` before deployment.

No route or sitemap file needs to be edited when a record is published.
