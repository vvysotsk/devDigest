/* AgentEditor — agent editor tabs: Config (model + system prompt) and Skills
   (ordered skill links, L02). Tab state lives in ?tab=. The Skills tab's
   unsaved draft lives here, so it survives a tab switch and marks the tab. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Tabs } from "@devdigest/ui";
import type { Agent } from "@devdigest/shared";
import { ConfigTab } from "./_components/ConfigTab";
import { SkillsTab, type SkillLinkDraft } from "./_components/SkillsTab";
import { TABS } from "./constants";
import { s } from "./styles";

export function AgentEditor({ agent, tab, onTab }: { agent: Agent; tab: string; onTab: (t: string) => void }) {
  const t = useTranslations("agents");
  // Tagged with the agent id: switching agents drops the draft without an effect.
  const [skillsDraft, setSkillsDraft] = React.useState<{ agentId: string; items: SkillLinkDraft[] } | null>(null);
  const draft = skillsDraft?.agentId === agent.id ? skillsDraft.items : null;
  const onDraft = (items: SkillLinkDraft[] | null) => setSkillsDraft(items ? { agentId: agent.id, items } : null);

  const tabs = TABS.map((tb) => ({
    key: tb.key,
    label: tb.key === "skills" && draft ? t("editor.tabs.skillsDirty") : t(tb.labelKey),
    icon: tb.icon,
  }));
  return (
    <div style={s.wrap}>
      <div style={s.tabsBar}>
        <Tabs tabs={tabs} value={tab} onChange={onTab} pad="0 24px" />
      </div>
      <div style={s.body}>
        {tab === "skills" ? <SkillsTab agent={agent} draft={draft} onDraft={onDraft} /> : <ConfigTab agent={agent} />}
      </div>
    </div>
  );
}
