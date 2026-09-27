"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Checkbox, Icon, IconBtn } from "@devdigest/ui";
import { SkillTypeBadge } from "@/features/skills/components/skill-type-badge";
import type { SkillRowModel } from "../../helpers";
import { s } from "./styles";

/** Row callbacks; the reorder / detach ones are used only for linked rows. */
export interface SkillRowActions {
  check: (checked: boolean) => void;
  up: () => void;
  down: () => void;
  detach: () => void;
  dragStart: () => void;
  drop: () => void;
}

/**
 * One skill in the agent Skills tab: drag handle, ↑/↓, checkbox, name, type
 * badge, Detach. A globally disabled skill is greyed with a hint (D2).
 */
export function SkillRow({
  row,
  canUp,
  canDown,
  on,
}: {
  row: SkillRowModel;
  canUp: boolean;
  canDown: boolean;
  on: SkillRowActions;
}) {
  const t = useTranslations("agents");
  const { skill, link } = row;
  const linked = link !== null;
  return (
    <li
      aria-label={skill.name}
      draggable={linked}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", skill.id);
        e.dataTransfer.effectAllowed = "move";
        on.dragStart();
      }}
      onDragOver={(e) => {
        if (linked) e.preventDefault();
      }}
      onDrop={(e) => {
        e.preventDefault();
        on.drop();
      }}
      style={s.row(skill.enabled)}
    >
      <span style={s.handle(linked)} aria-hidden title={linked ? t("skills.dragHint") : undefined}>
        <Icon.Menu size={14} />
      </span>
      <span style={s.arrows}>
        {linked && canUp && <IconBtn icon="ArrowUp" size={24} label={t("skills.moveUp", { name: skill.name })} onClick={on.up} />}
        {linked && canDown && (
          <IconBtn icon="ArrowDown" size={24} label={t("skills.moveDown", { name: skill.name })} onClick={on.down} />
        )}
      </span>
      <Checkbox checked={link?.enabled ?? false} onChange={on.check} label={<span className="mono" style={s.name}>{skill.name}</span>} />
      <SkillTypeBadge type={skill.type} />
      {!skill.enabled && <span style={s.disabledHint}>{t("skills.globallyDisabled")}</span>}
      {linked && (
        <button type="button" aria-label={t("skills.detachLabel", { name: skill.name })} onClick={on.detach} style={s.detach}>
          {t("skills.detach")}
        </button>
      )}
    </li>
  );
}
