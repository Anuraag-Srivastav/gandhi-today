/** Bounded reinspection of cited archive HTML. No storage, arbitrary hosts or PDF parsing. */
import { answerWithSources } from "./answer-display";

const ARCHIVES = new Set(["www.mkgandhi.org", "mkgandhi.org", "www.gandhiheritageportal.org", "gandhiheritageportal.org"]);
const ENTITIES: Record<string, string> = {nbsp:" ",amp:"&",quot:'"',apos:"'",lt:"<",gt:">"};
function permitted(url: URL) {
  return url.protocol === "https:" && ARCHIVES.has(url.hostname) && !url.port && !url.username && !url.password;
}

/** Failed or unsupported documents remain explicitly uninspected; never become evidence. */
export async function inspectOriginalSources(answer: string, signal: AbortSignal, fetcher: typeof fetch = fetch) {
  const urls = answerWithSources(answer).sources.map(source => source.url).slice(0, 2);
  return Promise.all(urls.map(async originalUrl => {
    try {
      let url = new URL(originalUrl);
      if (!permitted(url)) return { originalUrl, status: "not-inspected" as const };
      const boundedSignal = AbortSignal.any([signal, AbortSignal.timeout(8000)]);
      let response: Response | undefined;
      for (let redirects = 0; redirects < 3; redirects++) {
        response = await fetcher(url, { signal: boundedSignal, redirect: "manual" });
        if (response.status < 300 || response.status >= 400) break;
        const location = response.headers.get("location");
        await response.body?.cancel();
        if (!location) throw new Error("Missing redirect");
        url = new URL(location, url);
        if (!permitted(url)) throw new Error("Unapproved redirect");
      }
      if (!response?.ok || !/text\/(html|plain)/i.test(response.headers.get("content-type") || "")) {
        await response?.body?.cancel();
        return { originalUrl, status: "not-inspected" as const };
      }
      const reader = response.body?.getReader();
      if (!reader) throw new Error("No body");
      const decoder = new TextDecoder();
      let html = "";
      let bytes = 0;
      try {
        while (true) {
          const chunk = await reader.read();
          if (chunk.done) break;
          bytes += chunk.value.length;
          if (bytes > 500000) throw new Error("Document too large");
          html += decoder.decode(chunk.value, {stream:true});
        }
        html += decoder.decode();
      } finally { await reader.cancel(); reader.releaseLock(); }
      const text = html.replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
        .replace(/<[^>]*>/g, " ").replace(/&#(x[0-9a-f]+|[0-9]+);/gi, (_, code) => {
          const point = code[0].toLowerCase() === "x" ? parseInt(code.slice(1),16) : Number(code);
          return point <= 0x10ffff ? String.fromCodePoint(point) : " ";
        }).replace(/&(nbsp|amp|quot|apos|lt|gt);/g, (_, name) =>
          (ENTITIES[name] || " "))
        .replace(/\s+/g, " ").trim();
      if (text.length < 100) throw new Error("No usable passage");
      return { originalUrl, status: "inspected" as const, url: url.href, content: text };
    } catch { return { originalUrl, status: "not-inspected" as const }; }
  }));
}
