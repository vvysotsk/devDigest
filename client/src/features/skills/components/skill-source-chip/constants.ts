import type { SkillSource } from "@devdigest/shared";
import type { IconName } from "@devdigest/ui";

/** Icon per skill source (labels are i18n'd: `skills.listItem.source.*`). */
export const SKILL_SOURCE_ICON: Record<SkillSource, IconName> = {
  manual: "Edit",
  imported_url: "Upload",
  imported_file: "Upload",
  extracted: "Brain",
  community: "Users",
};

/** Sources shown with the warning colour: imported text stays marked for good (D4). */
export const IMPORTED_SOURCES: readonly SkillSource[] = ["imported_file", "imported_url"];
