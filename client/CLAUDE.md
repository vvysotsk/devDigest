# client/ — Next.js studio (@devdigest/web)

## Commands

`pnpm dev` · `pnpm build` · `pnpm test` (vitest + jsdom + Testing Library) · `pnpm typecheck`

## Before answering

Always search this package's `docs/`, `specs/` and `INSIGHTS.md` for what the
user asks about first — these are curated and may already answer it — then
read code.

## Non-default conventions

- UI kit is OUR OWN: `src/vendor/ui` (`@devdigest/ui`). No MUI/shadcn/etc —
  extend the kit instead of adding a component library.
- All server calls go through `lib/api.ts` + TanStack Query hooks — no raw
  fetch in components.
- Strings go through next-intl — no hard-coded user-facing text.
- `src/vendor/shared` is a COPY of `server/src/vendor/shared` — never edit it
  directly; change the server master copy and mirror (see `server/CLAUDE.md`
  for the known drift).

## Gotchas

- `vendor/ui` ships components with no current usage (charts, command
  palette, log-stream) — pre-provisioned for course lessons; don't remove
  as "dead code".

## Read when

- Page/route structure → read `README.md` (UI route map)
- UI kit usage, tokens, theming → read `src/vendor/ui/README.md`
- Past lessons here → read `INSIGHTS.md`
