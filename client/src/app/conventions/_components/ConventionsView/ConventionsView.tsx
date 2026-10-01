/* /conventions — the Conventions Extractor on the active repo (HW02 D19):
   Run Scan / ReScan (polled while running), one card per non-rejected
   candidate with Accept / Reject / Edit, and "Create skill" once at least one
   candidate is accepted. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Button, EmptyState, ErrorState, Skeleton } from "@devdigest/ui";
import type { ConventionPatch } from "@devdigest/shared";
import { AppShell } from "@/components/app-shell";
import { useActiveRepo } from "@/lib/repo-context";
import { relativeTime } from "@/lib/date-format";
import { useConventions, useExtractConventions, usePatchConvention } from "@/lib/hooks/conventions";
import { acceptedCount, conventionErrorMessage } from "../../helpers";
import { CandidateCard } from "./_components/CandidateCard";
import { CreateConventionSkillModal } from "./_components/CreateConventionSkillModal";
import { SKELETON_HEIGHT, SKELETON_ROWS } from "./constants";
import { s } from "./styles";

export function ConventionsView() {
  const t = useTranslations("conventions");
  const { repoId, activeRepo, reposLoaded } = useActiveRepo();
  const { data, isLoading, isError, refetch } = useConventions(repoId);
  const extract = useExtractConventions();
  const patch = usePatchConvention();
  const [modal, setModal] = React.useState(false);

  const scan = data?.scan ?? null;
  const running = scan?.status === "running";
  // The server already omits rejected candidates; filter again so a stale cache never shows one.
  const candidates = (data?.candidates ?? []).filter((c) => c.status !== "rejected");
  const accepted = acceptedCount(candidates);
  const noRepo = reposLoaded && !repoId;
  const repoName = activeRepo?.name ?? t("page.repoFallback");
  const crumb = [{ label: t("page.crumbLab") }, { label: t("page.crumbConventions") }];

  const runScan = () => {
    if (repoId) extract.mutate(repoId);
  };
  const onPatch = (id: string, body: ConventionPatch) => {
    if (repoId) patch.mutate({ repoId, id, patch: body });
  };

  const ago = relativeTime(scan?.finished_at ?? scan?.started_at);
  const subtitle = running
    ? t("page.scanning")
    : scan?.status === "done"
      ? t("page.detected", {
          count: scan.sample_count,
          ago: ago === "now" ? t("page.lastScanNow") : t("page.lastScanAgo", { ago }),
        })
      : t("page.subtitle");

  const showList = !!scan && !running && candidates.length > 0;

  return (
    <AppShell crumb={crumb}>
      {modal && repoId && (
        <CreateConventionSkillModal
          repoId={repoId}
          repoFullName={activeRepo?.full_name ?? repoName}
          acceptedIds={candidates.filter((c) => c.status === "accepted").map((c) => c.id)}
          onClose={() => setModal(false)}
        />
      )}
      <div style={s.page}>
        <div style={s.header}>
          <div style={s.headerText}>
            <h1 style={s.h1}>
              <span>{t("page.headingPrefix")}</span>
              <span className="mono" style={s.repoName}>
                {repoName}
              </span>
            </h1>
            <p style={s.subtitle}>{subtitle}</p>
          </div>
          {!noRepo &&
            (scan ? (
              <Button
                kind="secondary"
                size="sm"
                icon="RefreshCw"
                loading={extract.isPending}
                disabled={running}
                onClick={runScan}
              >
                {running ? t("page.scanning") : t("page.rescan")}
              </Button>
            ) : (
              <Button kind="primary" size="sm" icon="Play" loading={extract.isPending} onClick={runScan}>
                {t("page.runScan")}
              </Button>
            ))}
        </div>

        {extract.isError && (
          <div role="alert" style={s.alert}>
            {conventionErrorMessage(t, extract.error)}
          </div>
        )}
        {scan?.status === "failed" && (
          <div role="alert" style={s.alert}>
            {t("page.extractionFailed", { error: scan.error ?? "" })}
          </div>
        )}

        {noRepo && <EmptyState icon="ListChecks" title={t("page.noRepo.title")} body={t("page.noRepo.body")} />}
        {!noRepo && (isLoading || running) && (
          <div style={s.list}>
            {SKELETON_ROWS.map((i) => (
              <Skeleton key={i} height={SKELETON_HEIGHT} />
            ))}
          </div>
        )}
        {!noRepo && isError && <ErrorState body={t("page.loadError")} onRetry={() => refetch()} />}
        {!noRepo && !isLoading && !isError && !scan && (
          <EmptyState
            icon="ListChecks"
            title={t("page.empty.title")}
            body={t("page.empty.body")}
            cta={t("page.empty.cta")}
            onCta={runScan}
            ctaLoading={extract.isPending}
          />
        )}
        {scan && !running && candidates.length === 0 && (
          <EmptyState
            icon="ListChecks"
            title={t("page.emptyScan.title")}
            body={t("page.emptyScan.body")}
            cta={t("page.emptyScan.cta")}
            onCta={runScan}
            ctaLoading={extract.isPending}
          />
        )}
        {showList && (
          <>
            <div style={s.toolbar}>
              <span style={s.counter}>{t("toolbar.accepted", { accepted, total: candidates.length })}</span>
              {accepted > 0 && (
                <Button kind="primary" size="sm" icon="Sparkles" onClick={() => setModal(true)}>
                  {t("toolbar.createSkill")}
                </Button>
              )}
            </div>
            <div role="list" style={s.list}>
              {candidates.map((c) => (
                <CandidateCard
                  key={c.id}
                  candidate={c}
                  repoFullName={activeRepo?.full_name ?? null}
                  headSha={scan.head_sha}
                  pending={patch.isPending}
                  onPatch={onPatch}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
