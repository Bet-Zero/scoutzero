# players_v2 (canonical)

| Field | Notes |
|---|---|
| `bio.*` | Player bio and display fields |
| `contracts/*` | Contract documents (see ContractDoc) |
| `seasons/*` | Season documents (see SeasonDoc) |
| `evaluations/*` | Evaluation documents (see EvaluationDoc) |

- Canonical source: `src/schemas/players_v2.ts`

## Notes
- Contract fields reconcile scraper outputs (`player-scrape`) with Firestore subcollection shape.
- `contracts/*` now store the normalized Architect contract payload plus a `metadata` block (`startSeason`, `endSeason`, `isCurrent`, `label`), matching the staged files in `player-scrape/firestore_staging/output/players_v2/`.
- Use types imported from `src/schemas/players_v2.ts` in code; do not redeclare interfaces elsewhere.
