# Team Firestore Staging

Transforms raw scrape outputs into Firestore-ready `/architect/baseTeams/{teamCode}` payloads. Mirrors the player staging pipeline so we can inspect JSON before any writes occur.

## What It Does

- Loads SalarySwish team data from `team-scrape/team-data/output/`
- Optionally merges RealGM draft pick data (`team-scrape/draft-picks/output/structured/`)
- Resolves roster and cap-hold names to canonical `playerId`s using `player_index.json`
- Validates against `BaseTeamDocZ` from `src/schemas/architect.ts`
- Writes preview JSON under `team-scrape/shared/firestore_staging/output/`

## Usage

```bash
# Stage the default Lakers sample
npm run stage:team

# Explicit flags
npm run stage:team -- --team=LAL --season=2025-26 --validate
```

Outputs:

- `firestore_staging/output/baseTeams/LAL.json` – Firestore payload
- `firestore_staging/output/snapshots/LAL/team_data.json` – Raw SalarySwish input
- `firestore_staging/output/snapshots/LAL/draft_picks.json` – Draft pick source used

The output directory is git-ignored; copy snippets into docs if you need to share results.

## Expected Inputs

| Input | Source | Command |
| --- | --- | --- |
| `team-scrape/team-data/output/team_{TEAM}.json` | SalarySwish parser | `npm run parse` |
| `team-scrape/draft-picks/output/structured/draft_picks_{TEAM}.json` | RealGM scraper | `npm run realgm:drafts -- --teams TEAM` |
| `player-scrape/shared/outputs/player_index.json` | Player scrape shared outputs | `npm run build:index` |

If RealGM data is missing, the stager falls back to the lighter `draftPicks` array embedded in the SalarySwish output and logs a warning.

## Folder Guide

```
team-scrape/shared/firestore_staging/
├── README.md               # This file
├── stage_team.ts           # CLI entry point
└── docs/                   # Markdown visuals (created in subsequent steps)
```

## Validation

Pass `--validate` to run `BaseTeamDocZ.parse(...)` during staging. Full project validation:

```bash
npm run stage:team -- --team=LAL --validate
npm run validate:project
```

## Relationship to BasePlayers

This is the team-side counterpart to `player-scrape/firestore_staging/stage_player.ts`. Both pipelines:

- Take normalized scrape outputs
- Resolve IDs against canonical indices
- Produce Firestore-ready payloads for `/architect` collections
- Write git-ignored JSON for human review

Keep both staging directories in sync so downstream tooling can rely on consistent shapes.

