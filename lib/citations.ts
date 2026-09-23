/** Resolve only exact excerpt identities; never attach an unrelated retrieved URL. */
export function resolveCitations(answer: string, reference: string) {
  let excerpts: { path: string; sourceUrl?: string }[] = [];
  try { excerpts = JSON.parse(reference).excerpts || []; } catch { /* No source bundle. */ }
  const evidencedUrls = [...new Set(excerpts.map(excerpt => excerpt.sourceUrl)
    .filter((url): url is string => typeof url === "string" && /^https?:\/\//i.test(url)))];
  const standard = answer
    .replace(/【Source\]\((https?:\/\/[^\s)]+)\)】?/g, "[Source]($1)")
    .replace(/【Source】\((https?:\/\/[^\s)]+)\)/g, "[Source]($1)");
  const flattened = standard.replace(/\[Source\s*\[https?:\/\/[^\s]+?\\?\]\]\((https?:\/\/[^\s)]+)\)/g,
    (_match, url) => `[Source](${url.replace(/\\_/g, "_")})`);
  const cleaned = flattened.replace(/【Source\]\\?\(\[(https?:\/\/[^\s]+?)\]\((https?:\/\/[^\s)]+)\)\)\]?/g,
    (_match, _label, url) => ` [Source](${url.replace(/\\_/g, "_")})`);
  const prepared = cleaned.replace(/【Source】(https?:\/\/[^\s【】]+)/g, (_match, raw) => {
    const url = raw.replace(/[.,;]+$/, "");
    return ` [Source](${url})${raw.slice(url.length)} `;
  });
  const linked = prepared.replace(/【(record\[\d+\][^】]*)】|\[\[(record\[\d+\][^\]]*)\]\]/g, (_marker, first, second) => {
    const id = first || second;
    const source = excerpts.find((excerpt) => excerpt.path === id);
    if (!source?.sourceUrl || !/^https?:\/\//i.test(source.sourceUrl)) {
      return " (source link unavailable)";
    }
    return " [Source](" + source.sourceUrl.replaceAll("(", "%28").replaceAll(")", "%29") + ")";
  });
  const urls = new Set(evidencedUrls);
  // Browser-style URL brackets are not part of a URL. Resolve only against
  // source-associated evidence; never convert an invented URL into proof.
  const validated = linked.replace(/【\[(https?:\/\/[^\s】\]]+)】\]\((https?:\/\/[^\s)]+)\)|【(https?:\/\/[^\s】]+)】|\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g,
    (_match, malformed, destination, bracketed, label, markdownUrl) => {
      const url = (destination || bracketed || markdownUrl || malformed).replace(/】+$/, "");
      if (!urls.has(url) && !urls.has(url.replaceAll("%28", "(").replaceAll("%29", ")"))) return "(source link unavailable)";
      const title = malformed || bracketed ? "Source" : label;
      return `[${title}](${url.replaceAll("(", "%28").replaceAll(")", "%29")})`;
    });
  // Some providers return a generic citation token without its destination.
  // It is safe to repair only when the evidence has one possible URL.
  const soleCitation = evidencedUrls.length === 1
    ? `[Source](${evidencedUrls[0].replaceAll("(", "%28").replaceAll(")", "%29")})`
    : "";
  return validated
    .replace(/【\s*Source\s*】|\[\s*Source\s*\](?!\()/gi, soleCitation)
    .replace(/[ \t]+([.,;:!?])/g, "$1")
    .replace(/(^|\s)[.,;](?=\s|$)/g, "$1")
    .replace(/[ \t]{2,}/g, " ");
}
