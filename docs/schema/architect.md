# architect (canonical)

| Field                                                   | Notes             |
| ------------------------------------------------------- | ----------------- |
| `/architect/baseTeams/{teamCode}`                       | BaseTeamDoc       |
| `/architect/basePlayers/{playerId}`                     | BasePlayerDoc     |
| `/architect/worlds/{worldId}/snapshot/teams/{teamCode}` | WorldTeamSnapshot |

- Canonical source: `src/schemas/architect.ts`

## Notes

- Schemas defined by Zod in `src/schemas/architect.ts`.
- Use types imported from `src/schemas/architect.ts` in code; do not redeclare interfaces elsewhere.
- `/architect/basePlayers/{playerId}` documents may omit the `source` block; the field is optional to match staging outputs.
- Draft pick `stepienImpact` fields are informational hints from the scrape; Architect recomputes Stepien eligibility after each move, so those values must not be treated as authoritative during trade validation.
