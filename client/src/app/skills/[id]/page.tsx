/* /skills/:id — the skills list on the left, SkillEditor on the right.
   Tab state lives in ?tab= (config | preview | versions). */
"use client";

import React from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { SkillsListView } from "../_components/SkillsListView";
import { SkillEditor } from "./_components/SkillEditor";

const VALID_TABS = ["config", "preview", "versions"];

export default function SkillEditorPage() {
  const { id } = useParams<{ id: string }>();
  const search = useSearchParams();
  const router = useRouter();

  const requested = search.get("tab") ?? "";
  const tab = VALID_TABS.includes(requested) ? requested : "preview";
  const setTab = (next: string) => {
    const sp = new URLSearchParams(search.toString());
    sp.set("tab", next);
    router.replace(`/skills/${id}?${sp.toString()}`);
  };

  return (
    <SkillsListView activeId={id} tab={tab}>
      <SkillEditor skillId={id} tab={tab} onTab={setTab} />
    </SkillsListView>
  );
}
