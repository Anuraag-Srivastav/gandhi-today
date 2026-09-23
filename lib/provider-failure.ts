/** Safe provider diagnostics: never expose provider bodies, prompts or credentials. */
export function providerFailure(error: unknown, timedOut = false) {
  const item = error as { name?: string; status?: number } | null;
  const status = typeof item?.status === "number" ? item.status : undefined;
  const name = item?.name || "";
  const code = timedOut || /Timeout/i.test(name) ? "timeout"
    : status === 429 ? "rate-limit"
    : status === 401 || status === 403 ? "provider-auth"
    : status && status >= 500 ? "provider-unavailable"
    : status && status >= 400 ? "provider-rejected"
    : /Connection/i.test(name) ? "connection" : "unknown";
  const explanation = {
    timeout: "reached its time limit. Please retry, or ask to verify one specific claim",
    "rate-limit": "was rate-limited by the provider. Please wait before retrying",
    "provider-auth": "was blocked by provider authentication. The site operator needs to check configuration",
    "provider-unavailable": "failed because the provider is unavailable. Please retry later",
    "provider-rejected": "was rejected by the provider. Please share Test details with the site operator",
    connection: "lost its connection to the provider. Please retry",
    unknown: "failed for an unclassified reason. Please share Test details with the site operator",
  }[code];
  return { code, status, explanation };
}
