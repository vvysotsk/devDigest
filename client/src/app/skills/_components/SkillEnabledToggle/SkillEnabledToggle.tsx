"use client";

import React from "react";
import { Toggle } from "@devdigest/ui";
import type { Skill } from "@devdigest/shared";
import { useUpdateSkill } from "@/features/skills/hooks";
import { needsInjectionAck } from "../../helpers";
import { EnableImportedConfirm } from "./_components/EnableImportedConfirm";

/**
 * A skill's global enabled switch — writes immediately (`PUT /skills/:id
 * {enabled}`, no version bump). Used by the skill card and the Config tab.
 * The first enable of an imported skill goes through EnableImportedConfirm and
 * sends `acknowledge_injection: true`.
 */
export function SkillEnabledToggle({ skill, size = 14 }: { skill: Skill; size?: number }) {
  const update = useUpdateSkill();
  const [confirming, setConfirming] = React.useState(false);

  const onChange = (enabled: boolean) => {
    if (enabled && needsInjectionAck(skill)) {
      update.reset();
      setConfirming(true);
      return;
    }
    update.mutate({ id: skill.id, patch: { enabled } });
  };

  const confirm = () =>
    update.mutate(
      { id: skill.id, patch: { enabled: true, acknowledge_injection: true } },
      { onSuccess: () => setConfirming(false) },
    );

  // The wrapper stops clicks (toggle and dialog) from reaching a clickable card.
  return (
    <span onClick={(e) => e.stopPropagation()} style={{ display: "inline-flex" }}>
      <Toggle on={skill.enabled} onChange={onChange} size={size} />
      {confirming && (
        <EnableImportedConfirm
          name={skill.name}
          pending={update.isPending}
          error={update.error}
          onCancel={() => setConfirming(false)}
          onConfirm={confirm}
        />
      )}
    </span>
  );
}
