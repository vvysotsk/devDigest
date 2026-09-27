"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Icon } from "@devdigest/ui";
import type { Skill } from "@devdigest/shared";
import { SkillTypeBadge } from "@/components/skill-type-badge";
import { SkillSourceChip } from "@/components/skill-source-chip";
import { SkillEnabledToggle } from "../../../SkillEnabledToggle";
import { s } from "./styles";

/** One skill in the /skills list: name, enabled toggle, description, type, source, "N agents". */
export function SkillCard({ skill, active, onClick }: { skill: Skill; active: boolean; onClick: () => void }) {
  const t = useTranslations("skills");
  return (
    <div
      role="button"
      tabIndex={0}
      aria-current={active || undefined}
      aria-label={skill.name}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" && e.target === e.currentTarget) onClick();
      }}
      style={s.card(active, skill.enabled)}
    >
      <div style={s.headerRow}>
        <div style={s.iconBox}>
          <Icon.Sparkles size={14} />
        </div>
        <span className="mono" style={s.name}>
          {skill.name}
        </span>
        <SkillEnabledToggle skill={skill} />
      </div>
      <div style={s.description}>{skill.description}</div>
      <div style={s.metaRow}>
        <SkillTypeBadge type={skill.type} />
        <SkillSourceChip source={skill.source} />
        <span style={s.agents}>{t("list.agentCount", { count: skill.agent_count })}</span>
      </div>
    </div>
  );
}
