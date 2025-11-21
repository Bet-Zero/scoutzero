## Application Integration – Smoke Test Checklist

_Updated: 2025-11-10_

### Data Sources
- `players_v2` root docs + subcollections (`contracts`, `seasons`, `evaluations`) for HoopZero-facing views.
- `/architect/basePlayers/{playerId}` (primary player source for Architect).
- `/architect/baseTeams/{teamCode}` → hydrated via `loadTeamCapSheet` (players, cap holds, exceptions, totals).

### Local Smoke Tests (staged data)
1. **Player Profile (`/player/:id`)**
   - Confirm bio, contract view, and stats load for staged sample (`austin_reaves`).
   - Verify evaluations render (falls back gracefully if missing).
2. **League View (`/gm/league`)**
   - Ensure all teams list without runtime errors.
   - Totals derived from `contract_clean.salaries_by_year` should display (sample `LAL` shows ~$210M).
3. **GM Dashboard (`/gm/:teamSlug`)**
   - Baseline plan loads using hydrated base team (`capSheet.players`, `activeContracts`, `capHolds`, `draftPicks`).
   - Exception tracker shows TPE/MLE values from architect data.
   - Trade machine initializes with payroll totals; adding/removing players updates totals.
4. **Roster Visual / Planner**
   - Roster sections populate from `teamCapSheet.players`; headshots/positions present.
   - Saving a plan persists to `teamPlans` with the new normalized shape.

### Regression Notes
- Legacy diagnostic components (`FirestoreDataDiagnostic`, `useSeasonPlayerData`) still reference deprecated collections; safe to leave for now but should be migrated or removed.
- Architect features now depend on `TeamListFull` → `code` mapping; ensure new teams respect uppercase codes.
- Trade machine still seeds placeholder TPEs when architect data lacks them; revisit once full scrape includes all exceptions.

### Post Push Checklist
- Re-run the smoke tests after the full data push (once `/architect/basePlayers` and `/architect/baseTeams` are fully populated).
- Validate a second sample team (e.g., `BOS`, `DEN`) to ensure hydration logic handles deeper rosters.
- Capture screenshots / acceptance notes for Player Profile, League View, GM Dashboard, Trade Machine.

