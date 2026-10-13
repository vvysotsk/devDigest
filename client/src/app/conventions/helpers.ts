/** Pure helpers of the /conventions route (page, cards, create-skill modal). */
import { ConventionErrorCode, type ConventionCandidate } from "@devdigest/shared";
import { ApiError } from "@/lib/api";

/** i18n key (`conventions` namespace) for a conventions-route error code; null for any other error. */
export function conventionErrorKey(err: unknown): string | null {
  if (!(err instanceof ApiError) || !err.code) return null;
  if (err.code === "not_found") return "errors.not_found";
  const code = ConventionErrorCode.safeParse(err.code);
  return code.success ? `errors.${code.data}` : null;
}

/** Translated message for a mutation error: the ConventionErrorCode text, else the API message. */
export function conventionErrorMessage(t: (key: string) => string, err: unknown): string {
  const key = conventionErrorKey(err);
  if (key) return t(key);
  return err instanceof Error ? err.message : String(err);
}

/** `0.91` → `"91%"`. */
export function formatConfidence(confidence: number): string {
  return `${Math.round(confidence * 100)}%`;
}

export function acceptedCount(candidates: ConventionCandidate[]): number {
  return candidates.filter((c) => c.status === "accepted").length;
}

/** The evidence as `path:line` (the link text; the href is the GitHub blob URL at the scan's sha). */
export function evidenceLabel(c: Pick<ConventionCandidate, "evidence_path" | "evidence_line">): string {
  return `${c.evidence_path}:${c.evidence_line}`;
}
