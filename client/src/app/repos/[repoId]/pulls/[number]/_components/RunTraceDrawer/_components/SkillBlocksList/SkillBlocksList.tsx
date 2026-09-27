"use client";

import React from "react";
import { useTranslations } from "next-intl";
import type { SkillBlock } from "@devdigest/shared";
import { SkillSourceChip } from "@/components/skill-source-chip";
import { s } from "./styles";

/** One row per injected skill (prompt order): name, version, source, ≈ tokens of its rendered block (D7). */
export function SkillBlocksList({ blocks }: { blocks: SkillBlock[] }) {
  const t = useTranslations("runs");
  return (
    <ul style={s.list} aria-label={t("trace.prompt.skills")}>
      {blocks.map((b) => (
        <li key={b.skill_id} style={s.row}>
          <span className="mono" style={s.name}>
            {b.name}
          </span>
          <span className="mono" style={s.muted}>
            {t("trace.skillBlock.version", { version: b.version })}
          </span>
          <SkillSourceChip source={b.source} />
          <span className="mono tnum" style={s.tokens}>
            {t("trace.skillBlock.tokens", { tokens: b.tokens })}
          </span>
        </li>
      ))}
    </ul>
  );
}
