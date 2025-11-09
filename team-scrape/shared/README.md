# Team-Scrape Shared

This directory contains shared tooling and references that support the team pipeline.

## Structure

- `firestore_staging/`
  - `stage_team.ts` – CLI for producing Firestore-ready payloads.
  - `output/` – Authoritative staged JSON. Includes `baseTeams/`, `snapshots/`, and `merged/`.
  - `docs/` – Visual checkpoints (see `LAL_visuals.md` for the canonical sample).
- `review_and_merge/`
  - `scripts/merge_team_outputs.ts` – Combines SalarySwish team data with RealGM draft picks.
  - `scripts/create_clean_view.ts` – Generates human-readable clean views from staged outputs.
  - `docs/README_merge.md` & `docs/REPORT.md` – Merge usage and deep dive analysis.

## Key Outputs

- `team-scrape/shared/firestore_staging/output/baseTeams/{TEAM}.json`
  - Firestore-ready payloads emitted by `stage_team.ts`.
- `team-scrape/shared/firestore_staging/output/merged/{TEAM}_merged.json`
  - Team + draft pick payloads created by `merge_team_outputs.ts`.

## Helpful Commands

```bash
# Stage a team (writes to firestore_staging/output/)
npm run stage:team -- --team=LAL --validate

# Merge sample teams into Firestore staging output
npm run merge:samples

# Generate clean views using staged merged files
npm run clean-view
```

For a visual walkthrough of the staged Lakers sample, open `team-scrape/shared/firestore_staging/docs/LAL_visuals.md`.

