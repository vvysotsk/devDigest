---
name: devdigest-demo
description: DevDigest-specific conventions for recording demo videos — where the scenario, cue and config files live, which URLs and PRs to film, how to start the app and which controls must never be clicked. Read this before using the screencast-demo-maker plugin's demo-scenario or demo-film skills in this repository.
---

# DevDigest demo videos

Project conventions only. The engine is the `screencast-demo-maker` Claude Code plugin
(fork with Windows support: https://github.com/vvysotsk/screencast-demo-maker, upstream
https://github.com/artemmmon/screencast-demo-maker): skills `demo-setup`, `demo-scenario`
(writes the shooting script), `demo-film` (records it) and the `frame-checker` subagent.

## Prerequisite

If `/screencast-demo-maker:demo-film` is not an available skill, the plugin is not
installed. Stop and give the user the two install commands from the plugin README; do not
improvise filming without it.

## Order

1. If `demo/LNN/` already holds `scenario.md` and `cues.json`, read them. Otherwise write
   them with `screencast-demo-maker:demo-scenario`, and let the user review them.
2. Ask the user to run `/screencast-demo-maker:demo-film` — it is user-invoked, an agent
   cannot start it. Never record before the user says "go".
3. Hand contact sheets to the `screencast-demo-maker:frame-checker` subagent; never read
   them in the main conversation.
4. Report what the frames and probes showed. The user judges the voice and the result.

## Layout

| What | Where |
|---|---|
| One video's inputs | `demo/LNN/{scenario.md,cues.json,scenes.mjs,config.json}` — one folder per lesson |
| Source of truth the video must cover | the lesson's grading criteria (pasted by the user) + `specs/LNN-*.md` |
| Finished video | `demo/LNN/devdigest-lNN.mp4` (`config.output`) |
| Worked example | `demo/L01/` — browser-only, Ukrainian narration, 8 scenes |

Working files (clips, narration, frames, staged Chrome profile) never enter the repo; they
live in `~/.cache/demo-video/<slug>/`.

## Filming this app

- Start it with `./scripts/dev.sh` (Git Bash on Windows; Postgres in Docker); it serves
  the studio at http://localhost:3000 and the API at http://localhost:3001.
  `config.healthUrls` checks both during preflight.
- On screen: browser only. The editor and terminal surfaces are not staged on Windows,
  so files (CLAUDE.md, skills, INSIGHTS.md, docs/specs) are shown **rendered on GitHub**
  — the repo is public: `https://github.com/vvysotsk/devDigest/blob/<branch>/<path>`.
  Push the branch before filming; the staged Chrome profile is not logged in anywhere.
- Narration: Ukrainian (`uk-UA`, provider `edge`), for a course reviewer who knows the
  product. Filenames, code and this skill stay English.
- Data to film: repo `burnjohn/quick-blog` (id `8dad2132-da16-409b-9eeb-a17d8917c763`),
  PR #12 — three settled runs, 22 findings, cost on every surface. It is **stale**, so the
  PR list must be opened with `?status=stale` (the default filter hides it).
- The PR page's run tab is `?tab=findings` (labelled "Agent runs" in the UI); the trace
  drawer opens with `&trace=<runId>`.
- Display: one laptop screen at 125% scale — `video.zoom` stays 1.
- The Performance Reviewer card is the first, expanded accordion: 15 findings, 14 of
  them under the 0.65 confidence threshold, so "Hide low confidence" leaves exactly one
  card — that is the shot that proves pills equal cards.

## Never click

Run Review · Run all enabled agents · Accept · Reject · Delete (run / review) · Cancel ·
Refresh · Configure agents · anything in Settings.

They cost money (OpenRouter) or destroy data, and a demo must be reproducible. Hover to
show that a control exists — that is enough to prove it is there. Client-side toggles
(severity chips, "Hide low confidence", tabs, the trace drawer) are fine.

## Numbers that have bitten us

- The VerdictBanner inside an expanded review card says "15 findings · 1 blockers"
  while the accordion header says "1 blocker" (2026-09-24, PR #12): do not narrate the
  blocker count from the banner.
- Stored `0.021100427` renders as `$0.021` in the list and per run as `$0.0034`,
  `$0.013`, `$0.005` — say what the screen shows, not the sum of the printed values.
