"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Button, Modal } from "@devdigest/ui";
import type { Agent } from "@devdigest/shared";
import { useDeleteAgent } from "@/lib/hooks/agents";
import { s } from "./styles";

/** Agent delete confirm (HW02 #34): kit `Modal` with Delete / Cancel / X; `DELETE /agents/:id` only on Delete. */
export function DeleteAgentConfirm({ agent, onClose }: { agent: Agent; onClose: () => void }) {
  const t = useTranslations("agents");
  const del = useDeleteAgent();
  const confirm = () => del.mutate(agent.id, { onSuccess: onClose });
  return (
    <Modal
      width={480}
      title={t("delete.title", { name: agent.name })}
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
        <p style={s.muted}>{t("delete.irreversible")}</p>
        {del.isError && (
          <p role="alert" style={s.error}>
            {t("delete.error")}
          </p>
        )}
      </div>
    </Modal>
  );
}
