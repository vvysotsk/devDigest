"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge } from "@devdigest/ui";
import type { SkillSource } from "@devdigest/shared";
import { IMPORTED_SOURCES, SKILL_SOURCE_ICON } from "./constants";

const BORDERED = { border: "1px solid var(--border)" } as const;

/** Provenance chip: Manual / Imported / Extracted / Community — used by /skills and the agent Skills tab. */
export function SkillSourceChip({ source }: { source: SkillSource }) {
  const t = useTranslations("skills");
  const imported = IMPORTED_SOURCES.includes(source);
  return (
    <Badge
      color={imported ? "var(--warn)" : "var(--text-muted)"}
      bg={imported ? "var(--warn-bg)" : "transparent"}
      icon={SKILL_SOURCE_ICON[source]}
      style={BORDERED}
    >
      {t(`listItem.source.${source}`)}
    </Badge>
  );
}
