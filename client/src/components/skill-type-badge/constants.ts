import type { SkillType } from "@devdigest/shared";
import type { IconName } from "@devdigest/ui";

/** Badge colour + icon per skill type (labels are i18n'd: `skills.listItem.type.*`). */
export const SKILL_TYPE_META: Record<SkillType, { color: string; icon: IconName }> = {
  rubric: { color: "var(--accent-text)", icon: "ListChecks" },
  convention: { color: "var(--ok)", icon: "Code" },
  security: { color: "var(--crit)", icon: "Shield" },
  custom: { color: "var(--text-secondary)", icon: "Sparkles" },
};
