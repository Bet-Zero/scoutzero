# players_v2 (canonical)

| Field | Notes |
|---|---|
| `bio.*` | Player bio and display fields |
| `currentContractView` | Denormalized contract view for fast filtering (optional) |
| `currentEvaluationView` | Denormalized evaluation view for fast filtering (optional) |
| `currentSeasonStats` | Denormalized latest season stats for fast filtering (optional) |
| `contracts/*` | Contract documents (see ContractDoc) |
| `seasons/*` | Season documents (see SeasonDoc) |
| `evaluations/*` | Evaluation documents (see EvaluationDoc) |

- Canonical source: `src/schemas/players_v2.ts`

## Notes

- Contract fields reconcile scraper outputs (`player-scrape`) with Firestore subcollection shape.
- Use types imported from `src/schemas/players_v2.ts` in code; do not redeclare interfaces elsewhere.

## Denormalized Views

The main document includes three optional denormalized view fields for fast filtering and table views:

### `currentContractView`

- Contains current contract information: `freeAgentYear`, `freeAgentType`, `contractType`, `options`, `birdRights`, `salaryByYear`, `currentSalary`, `yearsRemaining`, `averageAnnualValue`, `maxType`
- Built from the contracts subcollection during staging
- Updated automatically when contracts change

### `currentEvaluationView`

- Contains current evaluation data: `roles`, `subRoles`, `shootingProfile`, `badges`, `traits`, `overallGrade`
- Built from the evaluations subcollection
- Updated automatically when evaluations are saved via `useAutoSavePlayer`

### `currentSeasonStats`

- Contains latest season stats: `PTS`, `REB`, `AST`, `FG%`, `3PT%`, `FT%`, `eFG%`, `MIN`, `GP`
- Built from the latest season document in the seasons subcollection
- Updated automatically when new season data is added

These views enable fast single-query loading for table views and filtering without needing to load subcollections. The application code (`enrichPlayerData`) prioritizes these denormalized views but falls back to subcollections for backward compatibility.
