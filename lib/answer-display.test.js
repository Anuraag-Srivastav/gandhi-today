import { expect, test } from "bun:test";
import { plainAnswerText } from "./answer-display";
test("paired emphasis becomes ordinary prose", () => {
  expect(plainAnswerText("through *sarvodaya*—and **ahimsa** or ***swaraj***.")).toBe("through sarvodaya—and ahimsa or swaraj.");
  expect(plainAnswerText(String.raw`Use \*ahimsa\*.`)).toBe("Use ahimsa.");
  expect(plainAnswerText("2*3*4; a lone *; 2 * 3")).toBe("2*3*4; a lone *; 2 * 3");
});
