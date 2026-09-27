/* RunCostBadge — compact LLM spend for one run (or every settled run of a PR).
   variant "cost" → "$0.014" (PR list); "costTokens" → "$0.014 · 8.2k→1.3k"
   (run timeline). No usage data renders "—", never a fabricated "$0.00". */
import React from "react";
import { formatCost } from "@/lib/cost-format";
import { formatTokensCompact } from "./helpers";

export function RunCostBadge({
  costUsd,
  tokensIn,
  tokensOut,
  variant = "cost",
}: {
  costUsd: number | null | undefined;
  tokensIn?: number | null;
  tokensOut?: number | null;
  variant?: "cost" | "costTokens";
}) {
  const hasTokens = (tokensIn ?? 0) + (tokensOut ?? 0) > 0;
  return (
    <span
      className="mono tnum"
      style={{
        fontSize: 12,
        color: costUsd == null ? "var(--text-muted)" : "var(--text-secondary)",
        whiteSpace: "nowrap",
      }}
    >
      {formatCost(costUsd)}
      {variant === "costTokens" && hasTokens
        ? ` · ${formatTokensCompact(tokensIn ?? 0, tokensOut ?? 0)}`
        : ""}
    </span>
  );
}
