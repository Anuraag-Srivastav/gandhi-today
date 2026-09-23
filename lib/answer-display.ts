/** Remove paired model emphasis markers in displayed prose, not answer history or URLs. */
export function plainAnswerText(text: string) {
  return text.replace(/\\\*/g, "*").replace(/(^|[^\p{L}\p{N}])(\*{1,3})(?=\S)([^*\n]*?\S)\2(?=$|[^\p{L}\p{N}])/gu, "$1$3");
}
