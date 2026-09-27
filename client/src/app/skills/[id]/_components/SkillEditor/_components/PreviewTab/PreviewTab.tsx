"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Chip, EmptyState, Markdown } from "@devdigest/ui";
import { s } from "./styles";

/** Preview tab: the saved body as rendered Markdown, with a toggle to the raw text. */
export function PreviewTab({ body }: { body: string }) {
  const t = useTranslations("skills");
  const [raw, setRaw] = React.useState(false);
  if (body.trim() === "") return <EmptyState icon="FileText" title={t("previewTab.empty")} />;
  return (
    <div style={s.wrap}>
      <div style={s.toggle}>
        <Chip pressed={!raw} active={!raw} onClick={() => setRaw(false)}>
          {t("previewTab.rendered")}
        </Chip>
        <Chip pressed={raw} active={raw} onClick={() => setRaw(true)}>
          {t("previewTab.raw")}
        </Chip>
      </div>
      {raw ? (
        <pre className="mono" style={s.raw}>
          {body}
        </pre>
      ) : (
        <div style={s.rendered}>
          <Markdown>{body}</Markdown>
        </div>
      )}
    </div>
  );
}
