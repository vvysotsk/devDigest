"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Button, Checkbox, Modal } from "@devdigest/ui";
import { skillErrorMessage } from "@/features/skills/lib/skill-errors";
import { s } from "./styles";

/**
 * First enable of an imported skill (D4): the user must state they have read
 * the text before it can be injected into an agent's prompt as instructions.
 */
export function EnableImportedConfirm({
  name,
  pending,
  error,
  onCancel,
  onConfirm,
}: {
  name: string;
  pending: boolean;
  error: unknown;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const t = useTranslations("skills");
  const [read, setRead] = React.useState(false);
  return (
    <Modal
      width={520}
      title={t("ack.title")}
      onClose={onCancel}
      footer={
        <div style={s.footer}>
          <Button kind="ghost" onClick={onCancel}>
            {t("ack.cancel")}
          </Button>
          <Button kind="primary" icon="Check" onClick={onConfirm} disabled={!read || pending}>
            {t("ack.confirm")}
          </Button>
        </div>
      }
    >
      <div style={s.body}>
        <p style={s.text}>{t("ack.body", { name })}</p>
        <Checkbox checked={read} onChange={setRead} label={t("ack.statement")} />
        {error != null && (
          <p role="alert" style={s.error}>
            {skillErrorMessage(t, error)}
          </p>
        )}
      </div>
    </Modal>
  );
}
