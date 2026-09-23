/** Resolve only exact excerpt identities; never attach an unrelated retrieved URL. */
export function resolveCitations(answer: string, reference: string) {
  let excerpts: { path: string; sourceUrl?: string }[] = [];
  try { excerpts = JSON.parse(reference).excerpts || []; } catch { /* No source bundle. */ }
  const linked = answer.replace(/【(record\[\d+\][^】]*)】|\[\[(record\[\d+\][^\]]*)\]\]/g, (_marker, first, second) => {
    const id = first || second;
    const source = excerpts.find((excerpt) => excerpt.path === id);
    if (!source?.sourceUrl || !/^https?:\/\//i.test(source.sourceUrl)) {
      return " (source link unavailable)";
    }
    return " [Source](" + source.sourceUrl.replaceAll("(", "%28").replaceAll(")", "%29") + ")";
  });
  const urls = new Set(excerpts.map(e => e.sourceUrl).filter(Boolean));
  // Browser-style URL brackets are not part of a URL. Resolve only against
  // source-associated evidence; never convert an invented URL into proof.
  return linked.replace(/【\[(https?:\/\/[^\s】\]]+)】\]\((https?:\/\/[^\s)]+)\)|【(https?:\/\/[^\s】]+)】|\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g,
    (_match, malformed, destination, bracketed, label, markdownUrl) => {
      const url = (destination || bracketed || markdownUrl || malformed).replace(/】+$/, "");
      if (!urls.has(url) && !urls.has(url.replaceAll("%28", "(").replaceAll("%29", ")"))) return "(source link unavailable)";
      const title = malformed || bracketed ? "Source" : label;
      return `[${title}](${url.replaceAll("(", "%28").replaceAll(")", "%29")})`;
    });
}
