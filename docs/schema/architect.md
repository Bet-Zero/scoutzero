# architect (canonical)

- Canonical source: `src/schemas/architect.ts`
- Generated JSON Schemas (when available): `schemas/json/architect.*.schema.json`

## Structure
- `/architect/baseTeams/{teamCode}` — BaseTeamDoc
- `/architect/basePlayers/{playerId}` — BasePlayerDoc
- `/architect/worlds/{worldId}/snapshot/teams/{teamCode}` — WorldTeamSnapshot

## Notes
- This reconciles `docs/architect-teams-plan/` targets with final scraper contract outputs.
- Use types imported from `src/schemas/architect.ts` in code; do not redeclare interfaces elsewhere.
