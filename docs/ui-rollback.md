# UI rollback — 23 September 2026

At the user's request, restore the interface from `6a53795`, before the structured-result redesign. Restore the matching text response transport, prompt formatting and evaluation/browser scripts so the earlier composer and answer display continue working together. Remove the redesign-only components, styles, structured-result modules and quiz page. These remain recoverable in Git history and on `codex/v26-context-regression`.

Keep production model-comparison restrictions, hidden public diagnostics and the later safe provider error wording. Other pre-redesign backend work remains intact. The candidate v26 branch is not promoted or deleted.

Validation: 75 automated tests, 215 assertions, targeted TypeScript and Chat/API lint pass. Responsive browser checks use controlled API replies, not live historical-accuracy evaluation. No new semantic score is assigned to this rollback.
