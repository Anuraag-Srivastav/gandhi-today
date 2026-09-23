import { expect, test } from "bun:test";
import { quizQuestions, scoreQuiz } from "./quiz";
test("all quiz items have unique IDs, valid answers and source links", () => {
  expect(quizQuestions).toHaveLength(5);
  expect(new Set(quizQuestions.map(q => q.id)).size).toBe(5);
  for (const q of quizQuestions) { expect(q.options[q.correct]).toBeTruthy(); expect(q.explanation).toBeTruthy(); expect(q.source.url.startsWith("https://")).toBe(true); }
});
test("scoring includes skips, unanswered slots and every question exactly once", () => {
  expect(scoreQuiz([])).toEqual({ correct: 0, incorrect: 0, skipped: 5, total: 5 });
  expect(scoreQuiz(quizQuestions.map(q => q.correct))).toEqual({ correct: 5, incorrect: 0, skipped: 0, total: 5 });
  expect(scoreQuiz([1, null, 1, 1, null])).toEqual({ correct: 2, incorrect: 1, skipped: 2, total: 5 });
});
