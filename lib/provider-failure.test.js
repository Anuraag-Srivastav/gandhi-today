import { expect, test } from "bun:test";
import { providerFailure } from "./provider-failure";

for (const [error, code] of [
  [{ status: 429 }, "rate-limit"], [{ status: 401 }, "provider-auth"],
  [{ status: 503 }, "provider-unavailable"], [{ status: 400 }, "provider-rejected"],
  [{ name: "APIConnectionTimeoutError" }, "timeout"], [{ name: "APIConnectionError" }, "connection"],
]) test(code, () => expect(providerFailure(error).code).toBe(code));
test("local deadline and safe unknown diagnostics", () => {
  expect(providerFailure(new Error("private provider payload"), true).code).toBe("timeout");
  expect(JSON.stringify(providerFailure(new Error("private provider payload")))).not.toContain("private");
});
