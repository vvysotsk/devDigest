/** Live token estimate for an unsaved body (D7): ≈ chars / 4. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
