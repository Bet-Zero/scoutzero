# players_v2 (canonical)

- Canonical source: `src/schemas/players_v2.ts`
- Generated JSON Schemas (when available): `schemas/json/players_v2.*.schema.json`

## Structure
- `bio.*` — Player bio and display fields
- `contracts/*` — Contract documents (see `ContractDoc`)
- `seasons/*` — Season documents (see `SeasonDoc`)
- `evaluations/*` — Evaluation documents (see `EvaluationDoc`)

## Notes
- Contract fields reconcile scraper outputs (`player-scrape`) with Firestore subcollection shape.
- Use types imported from `src/schemas/players_v2.ts` in code; do not redeclare interfaces elsewhere.
