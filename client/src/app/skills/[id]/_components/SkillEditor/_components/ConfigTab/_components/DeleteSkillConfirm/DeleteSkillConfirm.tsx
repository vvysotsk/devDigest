"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, Modal } from "@devdigest/ui";
import type { Skill } from "@devdigest/shared";
import { useDeleteSkill } from "@/lib/hooks/skills";
import { skillErrorMessage } from "@/app/skills/helpers";
import { s } from "./styles";

/** Delete confirm: "Used by N agents" from `Skill.agent_count` (links are removed by FK cascade). */
export function DeleteSkillConfirm({ skill, onClose }: { skill: Skill; onClose: () => void }) {
  const t = useTranslations("skills");
  const router = useRouter();
  const del = useDeleteSkill();
  const confirm = () =>
    del.mutate(skill.id, {
      onSuccess: () => {
        onClose();
        router.push("/skills");
      },
    });
  return (
    <Modal
      width={480}
      title={t("delete.title", { name: skill.name })}
      onClose={onClose}
      footer={
        <div style={s.footer}>
          <Button kind="ghost" onClick={onClose}>
            {t("delete.cancel")}
          </Button>
          <Button kind="danger" icon="Trash" onClick={confirm} disabled={del.isPending}>
            {del.isPending ? t("delete.deleting") : t("delete.confirm")}
          </Button>
        </div>
      }
    >
      <div style={s.body}>
        <p style={s.usedBy}>{t("delete.usedBy", { count: skill.agent_count })}</p>
        <p style={s.muted}>{t("delete.irreversible")}</p>
        {del.isError && (
          <p role="alert" style={s.error}>
            {skillErrorMessage(t, del.error)}
          </p>
        )}
      </div>
    </Modal>
  );
}
