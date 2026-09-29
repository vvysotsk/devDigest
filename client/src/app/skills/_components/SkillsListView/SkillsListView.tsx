/* /skills and /skills/:id — master column (search, "Add Skill ▾", skill cards)
   plus the detail pane: the route's children, or a "select a skill" hint.
   A card click opens the skill in the side pane on the current tab; from
   /skills that is Preview (HW02 #10). */
"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, Dropdown, EmptyState, ErrorState, Icon, Skeleton } from "@devdigest/ui";
import { AppShell } from "@/components/app-shell";
import { useSkills } from "@/features/skills/hooks";
import { filterSkills } from "../../helpers";
import { SkillCard } from "./_components/SkillCard";
import { CreateSkillModal } from "./_components/CreateSkillModal";
import { ImportSkillModal } from "./_components/ImportSkillModal";
import { s } from "./styles";

type OpenModal = "create" | "import" | null;

export function SkillsListView({
  activeId,
  tab = "preview",
  children,
}: {
  activeId?: string;
  tab?: string;
  children?: React.ReactNode;
}) {
  const t = useTranslations("skills");
  const router = useRouter();
  const { data: skills, isLoading, isError, refetch } = useSkills();
  const [modal, setModal] = React.useState<OpenModal>(null);
  const [search, setSearch] = React.useState("");

  const list = filterSkills(skills ?? [], search);
  const activeName = skills?.find((sk) => sk.id === activeId)?.name;
  const crumb = [
    { label: t("page.crumbLab") },
    activeId ? { label: t("page.crumbSkills"), href: "/skills" } : { label: t("page.crumbSkills") },
    ...(activeId ? [{ label: activeName ?? t("detail.crumbSkill") }] : []),
  ];
  const isEmpty = !isLoading && !isError && (skills ?? []).length === 0;

  return (
    <AppShell crumb={crumb}>
      {modal === "create" && <CreateSkillModal onClose={() => setModal(null)} />}
      {modal === "import" && <ImportSkillModal onClose={() => setModal(null)} />}
      <div style={s.layout}>
        <aside style={s.column}>
          <div style={s.columnHead}>
            <h1 style={s.h1}>{t("page.heading")}</h1>
            <Dropdown
              width={210}
              align="right"
              trigger={
                <Button kind="primary" size="sm" icon="Plus" iconRight="ChevronDown">
                  {t("page.addSkill")}
                </Button>
              }
              items={[
                { label: t("list.create"), icon: "Edit", onClick: () => setModal("create") },
                { label: t("page.menu.fromFile"), icon: "Upload", onClick: () => setModal("import") },
              ]}
            />
          </div>
          <div style={s.search}>
            <Icon.Search size={13} style={s.searchIcon} />
            <input
              aria-label={t("page.searchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("page.searchPlaceholder")}
              style={s.searchInput}
            />
          </div>
          <div style={s.cards}>
            {isLoading && [0, 1, 2].map((i) => <Skeleton key={i} height={96} />)}
            {isError && <ErrorState body={t("page.loadError")} onRetry={() => refetch()} />}
            {isEmpty && (
              <div style={s.empty}>
                <EmptyState
                  icon="Sparkles"
                  title={t("page.empty.title")}
                  body={t("list.emptyBody")}
                  cta={t("list.create")}
                  onCta={() => setModal("create")}
                />
                <Button kind="ghost" icon="Upload" onClick={() => setModal("import")}>
                  {t("page.menu.fromFile")}
                </Button>
              </div>
            )}
            {!isEmpty && skills && list.length === 0 && <p style={s.noMatch}>{t("list.noMatch", { q: search })}</p>}
            {list.map((sk) => (
              <SkillCard
                key={sk.id}
                skill={sk}
                active={sk.id === activeId}
                onClick={() => router.push(`/skills/${sk.id}?tab=${tab}`)}
                onDeleted={sk.id === activeId ? () => router.push("/skills") : undefined}
              />
            ))}
          </div>
        </aside>
        <section style={s.pane}>
          {children ?? (
            <EmptyState icon="Sparkles" title={t("page.selectPrompt.title")} body={t("page.selectPrompt.body")} />
          )}
        </section>
      </div>
    </AppShell>
  );
}
