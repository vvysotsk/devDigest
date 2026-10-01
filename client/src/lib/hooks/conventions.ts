/* hooks/conventions.ts — React Query hooks for the HW02 Conventions page
   (`/repos/:id/conventions*`, `/conventions/:id`). Payloads and responses are
   contract types from @devdigest/shared. The pure cache rules are exported
   so they can be unit-tested (view tests mock this module). */
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../api";
import type {
  ConventionCandidate,
  ConventionPatch,
  ConventionScan,
  ConventionSkillDraft,
  ConventionSkillSave,
  ConventionsState,
  Skill,
} from "@devdigest/shared";

/** The GET is re-fetched this often while a scan is `running` (D14). */
export const POLL_INTERVAL_MS = 4000;

/** `refetchInterval` rule: poll only while the latest scan is running. */
export function conventionsPollInterval(data: ConventionsState | undefined): number | false {
  return data?.scan?.status === "running" ? POLL_INTERVAL_MS : false;
}

/**
 * The cache after `PATCH /conventions/:id`: the candidate is replaced by id;
 * a rejected one leaves the list (#48). An unknown id or an empty cache
 * leaves the state untouched (same reference).
 */
export function applyCandidate(
  state: ConventionsState | undefined,
  candidate: ConventionCandidate,
): ConventionsState | undefined {
  if (!state) return state;
  if (!state.candidates.some((c) => c.id === candidate.id)) return state;
  const candidates =
    candidate.status === "rejected"
      ? state.candidates.filter((c) => c.id !== candidate.id)
      : state.candidates.map((c) => (c.id === candidate.id ? candidate : c));
  return { ...state, candidates };
}

export function useConventions(repoId: string | null | undefined) {
  return useQuery({
    queryKey: ["conventions", repoId],
    queryFn: () => api.get<ConventionsState>(`/repos/${repoId}/conventions`),
    enabled: !!repoId,
    refetchInterval: (query) => conventionsPollInterval(query.state.data),
  });
}

/**
 * `POST /repos/:id/conventions/extract` → the `running` scan goes straight
 * into the cache so polling starts at once. A 409 `scan_running` means a scan
 * started elsewhere (another tab, before a reload): re-fetch so the page
 * follows it; the component still shows the mapped message.
 */
export function useExtractConventions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (repoId: string) => api.post<ConventionScan>(`/repos/${repoId}/conventions/extract`),
    onSuccess: (scan, repoId) => {
      qc.setQueryData<ConventionsState>(["conventions", repoId], { scan, candidates: [] });
    },
    onError: (err, repoId) => {
      if (err instanceof ApiError && err.code === "scan_running") {
        qc.invalidateQueries({ queryKey: ["conventions", repoId] });
      }
    },
  });
}

export function usePatchConvention() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { repoId: string; id: string; patch: ConventionPatch }) =>
      api.patch<ConventionCandidate>(`/conventions/${id}`, patch),
    onSuccess: (candidate, { repoId }) => {
      qc.setQueryData<ConventionsState | undefined>(["conventions", repoId], (prev) => applyCandidate(prev, candidate));
    },
  });
}

/** The default `repo-conventions` draft; fetched fresh every time the modal opens. */
export function useConventionSkillDraft(repoId: string | null | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ["conventions-draft", repoId],
    queryFn: () => api.get<ConventionSkillDraft>(`/repos/${repoId}/conventions/skill-draft`),
    enabled: !!repoId && enabled,
    staleTime: 0,
    gcTime: 0,
  });
}

/** Save the skill (create, or the next version of the existing extracted one) and link it to the agent. */
export function useCreateConventionSkill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ repoId, body }: { repoId: string; body: ConventionSkillSave }) =>
      api.post<Skill>(`/repos/${repoId}/conventions/skill`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["skills"] });
      qc.invalidateQueries({ queryKey: ["agents"] });
      qc.invalidateQueries({ queryKey: ["agent"] });
      qc.invalidateQueries({ queryKey: ["agent-skills"] });
    },
  });
}
