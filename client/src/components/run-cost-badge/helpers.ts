/** Token in→out summary (e.g. "8.2k→1.3k"); 1dp under 10k, 0dp above. */
export function formatTokensCompact(tokensIn: number, tokensOut: number): string {
  const k = (n: number) => `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}k`;
  return `${k(tokensIn)}→${k(tokensOut)}`;
}
