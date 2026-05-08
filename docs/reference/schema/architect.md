# architect (canonical)

| Field | Notes |
|---|---|
| `/architect/baseTeams/{teamCode}` | BaseTeamDoc |
| `/architect/basePlayers/{playerId}` | BasePlayerDoc |
| `/architect_worlds/{worldId}/teams/{teamCode}` | WorldTeamSnapshot |

- Canonical source: `src/schemas/architect.ts`

## Notes

- Schemas defined by Zod in `src/schemas/architect.ts`.
- Use types imported from `src/schemas/architect.ts` in code; do not redeclare interfaces elsewhere.
