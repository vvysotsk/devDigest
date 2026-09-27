"use client";

import React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Badge, Button, EmptyState, ErrorState, Icon, Skeleton } from "@devdigest/ui";
import type { Agent } from "@devdigest/shared";
import { useAgentSkills, useSetAgentSkills, useSkills } from "@/lib/hooks/skills";
import { useToast } from "@/lib/toast";
import { SkillRow } from "./_components/SkillRow";
import {
  buildRows,
  countEnabled,
  detach,
  linksToDraft,
  moveTo,
  neighbour,
  sameDraft,
  setChecked,
  type SkillLinkDraft,
} from "./helpers";
import { s } from "./styles";

/**
 * Agents › Skills (D2, D12, D17): every workspace skill — linked ones first in
 * prompt order, then unlinked. Ticks, ↑/↓, drag and Detach edit a LOCAL draft
 * owned by AgentEditor (null = no unsaved change); "Save skills" sends ONE
 * `PUT /agents/:id/skills` with the ordered list; "Discard" drops the draft.
 */
export function SkillsTab({
  agent,
  draft,
  onDraft,
}: {
  agent: Agent;
  draft: SkillLinkDraft[] | null;
  onDraft: (next: SkillLinkDraft[] | null) => void;
}) {
  const t = useTranslations("agents");
  const toast = useToast();
  const skills = useSkills();
  const links = useAgentSkills(agent.id);
  const save = useSetAgentSkills();
  const [filter, setFilter] = React.useState("");
  const dragged = React.useRef<string | null>(null);

  if (skills.isLoading || links.isLoading) return <Skeleton height={200} />;
  if (skills.isError || links.isError) {
    const retry = () => {
      void skills.refetch();
      void links.refetch();
    };
    return <ErrorState body={t("skills.loadError")} onRetry={retry} />;
  }

  const all = skills.data ?? [];
  const saved = linksToDraft(links.data ?? []);
  const items = draft ?? saved;
  const edit = (next: SkillLinkDraft[]) => onDraft(sameDraft(next, saved) ? null : next);
  const rows = buildRows(items, all, filter);

  if (all.length === 0) {
    return (
      <EmptyState
        icon="Sparkles"
        title={t("skills.emptyTitle")}
        body={
          <Link href="/skills" style={s.link}>
            {t("skills.emptyLink")}
          </Link>
        }
      />
    );
  }

  const submit = () =>
    save.mutate(
      { agentId: agent.id, body: { skills: items } },
      {
        onSuccess: (res) => {
          onDraft(null);
          toast.success(t("skills.savedToast", { version: res.version }));
        },
      },
    );

  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <h2 style={s.h2}>{t("skills.title")}</h2>
        <Badge color="var(--accent-text)">
          {t("skills.enabledCount", { linked: countEnabled(items, all), total: items.length })}
        </Badge>
        <div style={s.filter}>
          <Icon.Search size={13} style={s.filterIcon} />
          <input
            aria-label={t("skills.filterPlaceholder")}
            placeholder={t("skills.filterPlaceholder")}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={s.filterInput}
          />
        </div>
      </div>
      <p style={s.hint}>{t("skills.orderHint")}</p>
      <ul style={s.list} aria-label={t("skills.title")}>
        {rows.map((row) => {
          const id = row.skill.id;
          const up = neighbour(items, id, -1);
          const down = neighbour(items, id, 1);
          return (
            <SkillRow
              key={id}
              row={row}
              canUp={up !== null}
              canDown={down !== null}
              on={{
                check: (checked) => edit(setChecked(items, id, checked)),
                up: () => up && edit(moveTo(items, id, up)),
                down: () => down && edit(moveTo(items, id, down)),
                detach: () => edit(detach(items, id)),
                dragStart: () => {
                  dragged.current = id;
                },
                drop: () => {
                  if (dragged.current && row.link) edit(moveTo(items, dragged.current, id));
                  dragged.current = null;
                },
              }}
            />
          );
        })}
      </ul>
      <div style={s.actions}>
        <Button kind="primary" icon="Check" onClick={submit} disabled={draft === null || save.isPending}>
          {save.isPending ? t("skills.saving") : t("skills.save")}
        </Button>
        <Button kind="ghost" onClick={() => onDraft(null)} disabled={draft === null || save.isPending}>
          {t("skills.discard")}
        </Button>
        {draft !== null && <span style={s.unsaved}>{t("skills.unsaved")}</span>}
      </div>
    </div>
  );
}
