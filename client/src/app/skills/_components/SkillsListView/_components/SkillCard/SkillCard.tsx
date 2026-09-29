"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Icon, IconBtn } from "@devdigest/ui";
import type { Skill } from "@devdigest/shared";
import { SkillTypeBadge } from "@/features/skills/components/skill-type-badge";
import { SkillSourceChip } from "@/features/skills/components/skill-source-chip";
import { SkillEnabledToggle } from "../../../SkillEnabledToggle";
import { DeleteSkillConfirm } from "../../../DeleteSkillConfirm";
import { s } from "./styles";

/**
 * One skill in the /skills list: name, enabled toggle, delete, description,
 * type, source, current version and "N agents". The delete confirm renders
 * outside the clickable card, so clicks inside the (portalled) modal never
 * bubble to the card's navigation.
 */
export function SkillCard({
  skill,
  active,
  onClick,
  onDeleted,
}: {
  skill: Skill;
  active: boolean;
  onClick: () => void;
  onDeleted?: () => void;
}) {
  const t = useTranslations("skills");
  const [deleting, setDeleting] = React.useState(false);
  return (
    <>
      <div
        role="button"
        tabIndex={0}
        aria-current={active || undefined}
        aria-label={skill.name}
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" && e.target === e.currentTarget) onClick();
        }}
        style={s.card(active)}
      >
        <div style={s.headerRow}>
          <div style={{ ...s.iconBox, ...s.dim(skill.enabled) }}>
            <Icon.Sparkles size={14} />
          </div>
          <span className="mono" style={{ ...s.name, ...s.dim(skill.enabled) }}>
            {skill.name}
          </span>
          <SkillEnabledToggle skill={skill} />
          <span style={s.action} onClick={(e) => e.stopPropagation()}>
            <IconBtn
              icon="Trash"
              size={26}
              danger
              label={t("list.delete", { name: skill.name })}
              onClick={() => setDeleting(true)}
            />
          </span>
        </div>
        <div style={{ ...s.description, ...s.dim(skill.enabled) }}>{skill.description}</div>
        <div style={{ ...s.metaRow, ...s.dim(skill.enabled) }}>
          <SkillTypeBadge type={skill.type} />
          <SkillSourceChip source={skill.source} />
          <span className="mono" style={s.version}>
            {t("editor.version", { version: skill.version })}
          </span>
          <span style={s.agents}>{t("list.agentCount", { count: skill.agent_count })}</span>
        </div>
      </div>
      {deleting && <DeleteSkillConfirm skill={skill} onClose={() => setDeleting(false)} onDeleted={onDeleted} />}
    </>
  );
}
