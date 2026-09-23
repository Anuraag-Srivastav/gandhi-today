import { expect, test } from "bun:test";
import { selectSourceEvidence } from "./source-excerpts";
import { resolveCitations } from "./citations";

test("excerpt markers resolve to their own source, not another source", () => {
  const bundle = selectSourceEvidence([{ browser_results: [
    { title: "A", url: "https://example.org/a", content: "money as a trust" },
    { title: "B", url: "https://example.org/b", content: "another passage" },
  ] }], "money");
  const source = JSON.parse(bundle).excerpts.find(e => e.sourceUrl.endsWith("/a"));
  expect(resolveCitations("Claim【" + source.path + "】", bundle)).toBe("Claim [Source](https://example.org/a)");
  expect(resolveCitations("Claim【record[99].output:0】", bundle)).toBe("Claim (source link unavailable)");
});

test("JSON-encoded browser output preserves title and URL association", () => {
  const bundle = JSON.parse(selectSourceEvidence([{ output: JSON.stringify({
    results: [{ title: "Document", url: "https://example.org/doc", content: "Money passage" }]
  }) }], "money"));
  expect(bundle.excerpts.some(e => e.sourceUrl === "https://example.org/doc")).toBe(true);
});

test("no URL is invented for an unattributed raw passage", () => {
  const bundle = selectSourceEvidence([{ output: "Money passage" }], "money");
  expect(resolveCitations("Claim【record[0].output:0】", bundle)).not.toContain("record[");
  expect(resolveCitations("Claim【record[0].output:0】", bundle)).not.toContain("https://");
});

test("adjacent Source markers become separated validated links", () => {
  const bundle = selectSourceEvidence([{ browser_results: [
    { url: "https://example.org/a", content: "a" }, { url: "https://example.org/b", content: "b" }
  ] }], "source");
  const result = resolveCitations("Claim【Source】https://example.org/a【Source】https://example.org/b", bundle);
  expect(result).toContain("[Source](https://example.org/a) ");
  expect(result).toContain("[Source](https://example.org/b)");
  expect(result).not.toContain("【");
});

test("malformed URL citation from the reported transcript is repaired only for a known source", () => {
  const url = "https://www.mkgandhi.org/mynonviolence/chap01.php";
  const bundle = selectSourceEvidence([{ browser_results: [{ url, content: "Passage" }] }], "Passage");
  expect(resolveCitations(`Claim【[${url}】](${url}】).`, bundle)).toBe(`Claim[Source](${url}).`);
  expect(resolveCitations(`Claim【${url}】`, bundle)).toBe(`Claim[Source](${url})`);
  expect(resolveCitations("[Source](https://example.org/invented)", bundle)).not.toContain("https://");
});
