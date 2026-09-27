/* SkillEditor — the /skills/:id detail pane: header (name, type badge, version
   chip) and the Config / Preview / Versions tabs (D11, D15). */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge, EmptyState, ErrorState, Icon, Skeleton, Tabs } from "@devdigest/ui";
import { SkillTypeBadge } from "@/components/skill-type-badge";
import { SkillSourceChip } from "@/components/skill-source-chip";
import { useSkill } from "@/lib/hooks/skills";
import { ApiError } from "@/lib/api";
import { ConfigTab } from "./_components/ConfigTab";
import { PreviewTab } from "./_components/PreviewTab";
import { VersionsTab } from "./_components/VersionsTab";
import { TABS } from "./constants";
import { s } from "./styles";

export function SkillEditor({ skillId, tab, onTab }: { skillId: string; tab: string; onTab: (t: string) => void }) {
  const t = useTranslations("skills");
  const { data: skill, isLoading, isError, error, refetch } = useSkill(skillId);

  if (isLoading) {
    return (
      <div style={s.loading}>
        <Skeleton height={24} width={240} />
        <Skeleton height={200} />
      </div>
    );
  }
  if (isError && error instanceof ApiError && error.status === 404) {
    return <EmptyState icon="Sparkles" title={t("detail.notFound.title")} body={t("detail.notFound.body")} />;
  }
  if (isError || !skill) return <ErrorState body={t("detail.loadError")} onRetry={() => refetch()} />;

  const tabs = TABS.map((tb) => ({ key: tb.key, label: t(tb.labelKey), icon: tb.icon }));
  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <Icon.Sparkles size={18} style={s.icon} />
        <h1 className="mono" style={s.h1}>
          {skill.name}
        </h1>
        <SkillTypeBadge type={skill.type} />
        <SkillSourceChip source={skill.source} />
        <Badge mono>{t("editor.version", { version: skill.version })}</Badge>
        {!skill.enabled && <Badge color="var(--text-muted)">{t("editor.disabled")}</Badge>}
      </div>
      <div style={s.tabsBar}>
        <Tabs tabs={tabs} value={tab} onChange={onTab} pad="0 24px" />
      </div>
      <div style={s.body}>
        {tab === "config" && <ConfigTab key={skill.id} skill={skill} />}
        {tab === "preview" && <PreviewTab key={skill.id} body={skill.body} />}
        {tab === "versions" && <VersionsTab key={skill.id} skill={skill} />}
      </div>
    </div>
  );
}
