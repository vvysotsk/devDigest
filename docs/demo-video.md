# Demo videos

How a lesson's demo video is produced in this repository. The engine is the
`screencast-demo-maker` Claude Code plugin; the project rules are the
`devdigest-demo` skill (`.claude/skills/devdigest-demo/SKILL.md`), which the
plugin's skills read first.

## Layers

| Layer | Where | Knows about |
|---|---|---|
| Engine | plugin `screencast-demo-maker` (fork: `vvysotsk/screencast-demo-maker`, Windows support; upstream: `artemmmon/screencast-demo-maker`) | ffmpeg, Playwright, voices, contact sheets — nothing about DevDigest |
| Project | `.claude/skills/devdigest-demo/SKILL.md`, this file | URLs, the data PR, what never to click — nothing about ffmpeg |
| One video | `demo/LNN/{config.json,scenario.md,cues.json,scenes.mjs}` + `demo/LNN/devdigest-lNN.mp4` | that lesson's criteria |
| Cache | `~/.cache/demo-video/<slug>/` | narration wavs, scene clips, frames, staged Chrome profile — rebuildable, never committed |

## Files per video

- `config.json` — slug, surfaces (`browser` only on Windows), health URLs, voice
  provider and language, `web.repoId` / `web.prNumber`, `neverClick`, playback `order`.
- `scenario.md` — scenes with Show / Do / Say, a Coverage table criterion → scene → cue,
  Unverified claims, product notes from the reality check. Written by `demo-scenario`,
  reviewed by a person before filming.
- `cues.json` — the narration, one object per cue `{ id, scene, text }`.
- `scenes.mjs` — pointer moves, clicks and scrolls per cue against the plugin's stage
  API. Written by `demo-film` in phase 2.

## Pipeline

1. Plugin installed (`claude plugin marketplace add … && claude plugin install …`).
2. App up: `./scripts/dev.sh`; the data PR is `burnjohn/quick-blog` #12 (stale filter).
3. Branch pushed: file scenes are filmed on GitHub because the editor surface is not
   staged on Windows.
4. `demo-scenario` writes `scenario.md` + `cues.json`, every number read from the
   rendered UI with Playwright, not from the API.
5. The user runs `/screencast-demo-maker:demo-film`: doctor → preflight → voice audition
   → narration → `scenes.mjs` dry run → "go" → filming → assembly → contact sheets →
   `frame-checker` → re-shoots → mp4 copied to `demo/LNN/`.

## Windows specifics

One laptop display at 125% scale: `video.zoom` is 1, the OS scale already enlarges the
page. Chrome runs fullscreen over the desktop; do not touch the machine while a scene
records. No OS permissions are needed. Voices come from the free `edge` provider
(`uk-UA-PolinaNeural` / `uk-UA-OstapNeural`); an ElevenLabs key, if any, goes into
Windows Credential Manager through the plugin's `cred.ps1`, never into a file.
