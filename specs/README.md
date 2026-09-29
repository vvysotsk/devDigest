# specs/ — feature specs (cross-package)

What we are BUILDING, as opposed to `docs/` (how it IS). One file per feature,
named `NN-slug.md`, with a status line at the top:

```
Status: draft | in-progress | done
```

Specs that live entirely inside one package go to that package's `specs/`
folder instead (`server/specs`, `client/specs`, `reviewer-core/specs`).
Note: `e2e/specs/` is taken by browser test flows — e2e feature specs live here.

## Course lessons as future specs

| Lesson | Feature |
|--------|---------|
| L01 | Run cost badge · severity filter on findings |
| L02 | Skills in the product ([L02-skills.md](L02-skills.md), implemented) · Conventions extractor |
| L03 | Intent layer · Smart Diff |
| L04 | `devdigest-mcp` server · Blast Radius (reads `repo-intel`) |
| L05 | Project Context Folder · Onboarding generator · PR Brief card |
| L06 | Eval pipeline · Secret/Phantom gates · Plan Verifier · Export to CI |
| L07 | Multi-agent review · Run Trace / Live Log · Persistent memory · per-agent stats |
| L08 | Plugin export/import · Agent performance dashboard · weekly digest |
