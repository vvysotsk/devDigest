/** Skills error codes → `skills.errors.*` messages (shared by /skills, /skills/:id and /conventions). */
import { SkillErrorCode } from "@devdigest/shared";
import { ApiError } from "@/lib/api";

/** i18n key (`skills` namespace) for a skills-route error code; null for any other error. */
export function skillErrorKey(err: unknown): string | null {
  if (!(err instanceof ApiError) || !err.code) return null;
  const code = SkillErrorCode.safeParse(err.code);
  return code.success ? `errors.${code.data}` : null;
}

/** Translated message for a mutation error: the SkillErrorCode text, else the API message. */
export function skillErrorMessage(t: (key: string) => string, err: unknown): string {
  const key = skillErrorKey(err);
  if (key) return t(key);
  return err instanceof Error ? err.message : String(err);
}
