"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Icon, IconBtn, Toggle } from "@devdigest/ui";
import { SkillTypeBadge } from "@/features/skills/components/skill-type-badge";
import { isMovable, type SkillRowModel } from "../../helpers";
import { s } from "./styles";

/** Row callbacks; the reorder / detach ones are used only for linked rows. */
export interface SkillRowActions {
  check: (checked: boolean) => void;
  up: () => void;
  down: () => void;
  detach: () => void;
  dragStart: () => void;
  drop: () => void;
  /** Every drag ends here (dropped anywhere or cancelled): forget the dragged row. */
  dragEnd: () => void;
}

/**
 * One skill in the agent Skills tab: drag handle, ↑/↓, the per-agent enable
 * toggle, name, type badge, Detach. Only an enabled skill (linked, enabled on
 * this agent and globally) can be dragged or dropped on (HW02 #31); ↑/↓ stay
 * available for every linked row as the keyboard way to reorder. A globally
 * disabled skill is greyed with a hint (D2).
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
  const movable = isMovable(row);
  return (
    <li
      aria-label={skill.name}
      draggable={movable}
      onDragStart={(e) => {
        if (!movable) return;
        e.dataTransfer.setData("text/plain", skill.id);
        e.dataTransfer.effectAllowed = "move";
        on.dragStart();
      }}
      onDragOver={(e) => {
        if (movable) e.preventDefault();
      }}
      onDrop={(e) => {
        e.preventDefault();
        if (movable) on.drop();
      }}
      onDragEnd={on.dragEnd}
      style={s.row(skill.enabled)}
    >
      <span
        style={s.handle(linked, movable)}
        aria-hidden
        title={linked ? (movable ? t("skills.dragHint") : t("skills.dragEnabledOnly")) : undefined}
      >
        <Icon.Menu size={14} />
      </span>
      <span style={s.arrows}>
        {linked && canUp && <IconBtn icon="ArrowUp" size={24} label={t("skills.moveUp", { name: skill.name })} onClick={on.up} />}
        {linked && canDown && (
          <IconBtn icon="ArrowDown" size={24} label={t("skills.moveDown", { name: skill.name })} onClick={on.down} />
        )}
      </span>
      <span style={s.toggle}>
        <Toggle
          on={link?.enabled ?? false}
          onChange={on.check}
          size={14}
          label={t("skills.enableLabel", { name: skill.name })}
        />
        <span className="mono" style={s.name}>
          {skill.name}
        </span>
      </span>
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
