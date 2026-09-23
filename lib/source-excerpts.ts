/** Select verbatim windows, never generated summaries, within the transport budget. */
export function selectSourceEvidence(records: unknown[], query: string) {
  const terms = [...new Set(query.toLowerCase().match(/[a-z]{4,}/g) || [])];
  const candidates: { path: string; text: string; score: number; partial: boolean; sourceUrl?: string; sourceTitle?: string }[] = [];
  const metadata: { path: string; value: string }[] = [];
  function visit(value: unknown, path: string, depth = 0, sourceUrl?: string, sourceTitle?: string) {
    if (depth > 12) return;
    if (typeof value === "string") {
      if (!value) return;
      if (path.endsWith(".output") && /^[\[{]/.test(value.trim())) {
        try {
          const parsed: unknown = JSON.parse(value);
          if (parsed && typeof parsed === "object") {
            visit(parsed, path, depth + 1, sourceUrl, sourceTitle);
            return;
          }
        } catch { /* Plain-text browser output is retained verbatim below. */ }
      }
      // Only explicit document headers establish a URL for unstructured output.
      const headers = [...value.matchAll(/^(?:([^\n]+) \((https?:\/\/[^\s)]+)\)|URL:\s*(https?:\/\/\S+))\s*$/gm)];
      if (/(?:url|title|link|date|type)$/i.test(path)) {
        if (metadata.length < 60) metadata.push({ path, value: value.slice(0, 1000) });
        return;
      }
      for (let offset = 0; offset < value.length; offset += 1400) {
        const text = value.slice(Math.max(0, offset - 200), offset + 1600);
        const lower = text.toLowerCase();
        const begin = Math.max(0, offset - 200);
        const header = headers.findLast((item) => item.index! <= begin);
        const crossesHeader = headers.some((item) => item.index! > begin && item.index! < offset + 1600);
        const headerUrl = !crossesHeader && header ? header[2] || header[3] : undefined;
        candidates.push({ path: path + ":" + Math.max(0, offset - 200), text,
          score: terms.filter((term) => lower.includes(term)).length,
          partial: value.length > text.length, sourceUrl: sourceUrl || headerUrl, sourceTitle: sourceTitle || header?.[1] });
      }
    } else if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, path + "[" + index + "]", depth + 1, sourceUrl, sourceTitle));
    } else if (value && typeof value === "object") {
      const object = value as Record<string, unknown>;
      const url = typeof object.url === "string" && /^https?:\/\//i.test(object.url) ? object.url : sourceUrl;
      const title = typeof object.title === "string" ? object.title : sourceTitle;
      Object.entries(value).forEach(([key, item]) => visit(item, path + "." + key, depth + 1, url, title));
    }
  }
  records.forEach((record, index) => visit(record, "record[" + index + "]"));
  candidates.sort((a, b) => b.score - a.score);
  const excerpts: typeof candidates = [];
  const bundle = { retrievedAt: new Date().toISOString(), partial: true,
    note: "Selected verbatim excerpts. Missing text is not evidence of absence. Paths associate metadata with its original record. Search snippets are leads, not inspected full documents.",
    metadata, excerpts };
  // Bound serialized size, including JSON escaping and metadata.
  while (JSON.stringify(bundle).length > 12000 && metadata.length) metadata.pop();
  for (const candidate of candidates) {
    if (excerpts.some((e) => e.text === candidate.text)) continue;
    excerpts.push(candidate);
    if (JSON.stringify(bundle).length > 30000) excerpts.pop();
    if (excerpts.length >= 16) break;
  }
  return JSON.stringify(bundle);
}
