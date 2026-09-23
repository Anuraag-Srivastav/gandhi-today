/** Remove paired model emphasis markers in displayed prose, not answer history or URLs. */
export function plainAnswerText(text: string) {
  return text.replace(/\\\*/g, "*").replace(/(^|[^\p{L}\p{N}])(\*{1,3})(?=\S)([^*\n]*?\S)\2(?=$|[^\p{L}\p{N}])/gu, "$1$3");
}

/** Separate existing web citations for display only; do not invent source titles or destinations. */
export function answerWithSources(text: string) {
  const sources: { url: string; label: string }[] = [];
  const body = text.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<>()]+)/g, (_match, label: string | undefined, linked: string | undefined, bare: string | undefined) => {
    const raw = linked || bare!;
    const url = raw.replace(/[.,;]+$/, "");
    try {
      const parsed = new URL(url);
      if (parsed.username || parsed.password) return _match;
      if (!sources.some(source => source.url === url)) sources.push({ url, label: label && !/^source\s*\d*$/i.test(label.trim()) ? plainAnswerText(label) : parsed.hostname });
    } catch { return _match; }
    // A linked work's title can be part of the sentence; move its link, not its meaning.
    return bare ? raw.slice(url.length) : label && !/^(?:(?:source|reference|citation)s?\s*\d*|reading|read more|\d+)$/i.test(label.trim()) ? plainAnswerText(label) : "";
  }).replace(/[ \t\u00a0\u202f]+([.,;:!?])/g, "$1").replace(/\(\s*\)|\[\s*\]/g, "").replace(/[ \t]{2,}/g, " ").trim();
  return { body, sources };
}
