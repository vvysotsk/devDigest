/* AgentCard — model chip, skills count, enabled toggle, Delete with a confirm
   modal (HW02 #34). Stats are an A5 mount; we render the provider/model + skill
   count here. The modal renders next to the card, not inside it, so its
   (portalled) clicks never reach the card's onClick. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Icon, Badge, Toggle } from "@devdigest/ui";
import type { Agent } from "@devdigest/shared";
import { DeleteAgentConfirm } from "./_components/DeleteAgentConfirm";
import { modelColor } from "./helpers";
import { s } from "./styles";

export function AgentCard({
  ag,
  active,
  skillCount,
  onClick,
  onToggle,
}: {
  ag: Agent;
  active?: boolean;
  skillCount?: number;
  onClick?: () => void;
  onToggle?: (enabled: boolean) => void;
}) {
  const t = useTranslations("agents");
  const [deleting, setDeleting] = React.useState(false);
  const color = modelColor(ag.model);
  return (
    <>
      <div onClick={onClick} style={s.card(!!active, ag.enabled)}>
        <div style={s.headerRow}>
          <div style={s.iconBox}>
            <Icon.Cpu size={15} />
          </div>
          <span style={s.name}>{ag.name}</span>
          {onToggle && (
            <div onClick={(e) => e.stopPropagation()}>
              <Toggle on={ag.enabled} onChange={onToggle} size={14} />
            </div>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setDeleting(true);
            }}
            title={t("card.delete", { name: ag.name })}
            aria-label={t("card.delete", { name: ag.name })}
            style={s.deleteBtn}
          >
            <Icon.Trash size={14} />
          </button>
        </div>
        <div style={s.description}>{ag.description || t("card.noDescription")}</div>
        <div style={s.metaRow}>
          <span className="mono" style={s.modelChip(color)}>
            {ag.model}
          </span>
          {skillCount != null && skillCount > 0 && (
            <Badge color="var(--text-secondary)" icon="Sparkles">
              {t("card.skillCount", { count: skillCount })}
            </Badge>
          )}
        </div>
      </div>
      {deleting && <DeleteAgentConfirm agent={ag} onClose={() => setDeleting(false)} />}
    </>
  );
}
