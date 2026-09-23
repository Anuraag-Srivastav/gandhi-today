/** Resolve only exact excerpt identities; never attach an unrelated retrieved URL. */
export function resolveCitations(answer: string, reference: string) {
  let excerpts: { path: string; sourceUrl?: string }[] = [];
  try { excerpts = JSON.parse(reference).excerpts || []; } catch { /* No source bundle. */ }
  return answer.replace(/【(record\[\d+\][^】]*)】|\[\[(record\[\d+\][^\]]*)\]\]/g, (_marker, first, second) => {
    const id = first || second;
    const source = excerpts.find((excerpt) => excerpt.path === id);
    if (!source?.sourceUrl || !/^https?:\/\//i.test(source.sourceUrl)) {
      return " (source link unavailable)";
    }
    return " [Source](" + source.sourceUrl.replaceAll("(", "%28").replaceAll(")", "%29") + ")";
  });
}
