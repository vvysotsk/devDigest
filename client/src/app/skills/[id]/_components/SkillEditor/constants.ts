import type { IconName } from "@devdigest/ui";

/** Editor tab descriptor. `labelKey` resolves under the `skills` namespace. */
export interface SkillEditorTab {
  key: string;
  labelKey: string;
  icon: IconName;
}

/** Skill editor tabs (Evals / Stats are out of scope, D14). */
export const TABS: readonly SkillEditorTab[] = [
  { key: "config", labelKey: "editor.tabs.config", icon: "Settings" },
  { key: "preview", labelKey: "editor.tabs.preview", icon: "Eye" },
  { key: "versions", labelKey: "editor.tabs.versions", icon: "History" },
];
