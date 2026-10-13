"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge } from "@devdigest/ui";
import type { SkillType } from "@devdigest/shared";
import { SKILL_TYPE_META } from "./constants";

/** Skill type badge (rubric / convention / security / custom) — used by /skills and the agent Skills tab. */
export function SkillTypeBadge({ type }: { type: SkillType }) {
  const t = useTranslations("skills");
  const meta = SKILL_TYPE_META[type];
  return (
    <Badge color={meta.color} icon={meta.icon}>
      {t(`listItem.type.${type}`)}
    </Badge>
  );
}
