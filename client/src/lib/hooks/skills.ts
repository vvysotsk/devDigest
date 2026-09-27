/* hooks/skills.ts — React Query hooks for the L02 Skills page and the agent
   Skills tab. Payloads and responses are contract types from @devdigest/shared. */
"use client";

import { useQuery, useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { api } from "../api";
import type {
  AgentSkill,
  AgentSkillsPut,
  AgentSkillsResult,
  Skill,
  SkillImportPreview,
  SkillImportRequest,
  SkillImportSave,
  SkillInput,
  SkillPatch,
  SkillVersion,
} from "@devdigest/shared";

/** A skill's enabled flag or link count changes what agents report (`skill_count`). */
function invalidateAgentViews(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: ["agents"] });
  qc.invalidateQueries({ queryKey: ["agent"] });
  qc.invalidateQueries({ queryKey: ["agent-skills"] });
}

export function useSkills() {
  return useQuery({
    queryKey: ["skills"],
    queryFn: () => api.get<Skill[]>("/skills"),
  });
}

export function useSkill(id: string | null | undefined) {
  return useQuery({
    queryKey: ["skill", id],
    queryFn: () => api.get<Skill>(`/skills/${id}`),
    enabled: !!id,
  });
}

export function useCreateSkill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SkillInput) => api.post<Skill>("/skills", input),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["skills"] });
      qc.setQueryData(["skill", data.id], data);
    },
  });
}

export function useUpdateSkill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: SkillPatch }) => api.put<Skill>(`/skills/${id}`, patch),
    onSuccess: (data) => {
      qc.setQueryData(["skill", data.id], data);
      qc.invalidateQueries({ queryKey: ["skills"] });
      qc.invalidateQueries({ queryKey: ["skill-versions", data.id] });
      invalidateAgentViews(qc);
    },
  });
}

export function useDeleteSkill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del<void>(`/skills/${id}`),
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: ["skills"] });
      qc.removeQueries({ queryKey: ["skill", id] });
      qc.removeQueries({ queryKey: ["skill-versions", id] });
      invalidateAgentViews(qc);
    },
  });
}

export function useSkillVersions(id: string | null | undefined) {
  return useQuery({
    queryKey: ["skill-versions", id],
    queryFn: () => api.get<SkillVersion[]>(`/skills/${id}/versions`),
    enabled: !!id,
  });
}

/** Parse an uploaded .md / .zip into a preview. The server stores nothing. */
export function useImportPreview() {
  return useMutation({
    mutationFn: (input: SkillImportRequest) => api.post<SkillImportPreview>("/skills/import/preview", input),
  });
}

/** Save an import: the server re-parses the file and applies only the overrides. */
export function useImportSkill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SkillImportSave) => api.post<Skill>("/skills/import", input),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["skills"] });
      qc.setQueryData(["skill", data.id], data);
    },
  });
}

export function useAgentSkills(agentId: string | null | undefined) {
  return useQuery({
    queryKey: ["agent-skills", agentId],
    queryFn: () => api.get<AgentSkill[]>(`/agents/${agentId}/skills`),
    enabled: !!agentId,
  });
}

/** Replace an agent's ordered skill list in one PUT (one agent version bump at most). */
export function useSetAgentSkills() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ agentId, body }: { agentId: string; body: AgentSkillsPut }) =>
      api.put<AgentSkillsResult>(`/agents/${agentId}/skills`, body),
    onSuccess: (data, { agentId }) => {
      qc.setQueryData(["agent-skills", agentId], data.skills);
      qc.invalidateQueries({ queryKey: ["agents"] });
      qc.invalidateQueries({ queryKey: ["agent", agentId] });
      qc.invalidateQueries({ queryKey: ["skills"] });
    },
  });
}
