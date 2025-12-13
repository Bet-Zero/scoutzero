# architect (canonical)

## Collection Paths

| Path                                                             | Document Type     | Notes                                      |
| ---------------------------------------------------------------- | ----------------- | ------------------------------------------ |
| `architect_baseTeams/{teamCode}`                                 | BaseTeamDoc       | Base team data (unchanged across worlds)   |
| `architect_basePlayers/{playerId}`                               | BasePlayerDoc     | Base player data (unchanged across worlds) |
| `architect_worlds/{worldId}`                                     | WorldMetadata     | World metadata document                    |
| `architect_worlds/{worldId}/teams/{teamCode}`                    | WorldTeamSnapshot | Team snapshot within a world               |
| `architect_worlds/{worldId}/teams/{teamCode}/players/{playerId}` | PlayerOverride    | Player override within a world team        |

- Canonical source: `src/schemas/architect.ts`
- Path helpers: `src/features/architect/utils/architectFirestorePaths.ts`

## Notes

- Schemas defined by Zod in `src/schemas/architect.ts`.
- Use types imported from `src/schemas/architect.ts` in code; do not redeclare interfaces elsewhere.
- All architect collections use the `architect_*` prefix convention for top-level collections.
