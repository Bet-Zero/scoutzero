# Team Firestore Staging

Transforms raw scrape outputs into Firestore-ready `/architect/baseTeams/{teamCode}` payloads. Mirrors the player staging pipeline so we can inspect JSON before any writes occur.

## What It Does

- Loads SalarySwish team data from `team-scrape/team-data/_artifacts/output/`
- Optionally merges RealGM draft pick data (`team-scrape/draft-picks/_artifacts/output/structured/`)
- Resolves roster and cap-hold names to canonical `playerId`s using `player_index.json`
- Validates against `BaseTeamDocZ` from `src/schemas/architect.ts`
- Writes preview JSON under `team-scrape/shared/firestore_staging/_artifacts/output/`

## Usage

```bash
# Stage the default Lakers sample
npm run stage:team

# Explicit flags
npm run stage:team -- --team=LAL --season=2025-26 --validate
```

### Pipeline shortcuts

```bash
# RealGM draft picks → _artifacts/output/structured (staging-ready)
npm run team:draft-picks -- --teams=LAL --pretty

# SalarySwish fetch/parse/stage (uses existing RealGM outputs if present, validates by default)
npm run team:salaryswish -- --teams=LAL --season=2025-26

# Combined: RealGM draft picks then SalarySwish pipeline (staging validates by default)
npm run team:full -- --teams=LAL --season=2025-26 --pretty

# Disable validation explicitly if needed
npm run team:salaryswish -- --validate=false
npm run team:full -- --validate=false

# Push staged baseTeams to Firestore (after review)
npm run team:push -- LAL BOS --stageDir=/abs/path/to/output
```

Outputs:

- `firestore_staging/_artifacts/output/baseTeams/LAL.json` – Firestore payload
- `firestore_staging/_artifacts/output/snapshots/LAL/team_data.json` – Raw SalarySwish input
- `firestore_staging/_artifacts/output/snapshots/LAL/draft_picks.json` – Draft pick source used

# Dry Run / Shadow Push Preview

Review staged payloads without writing to Firestore:

```bash
# Preview every staged team (defaults to Lakers sample)
npx tsx team-scrape/shared/firestore_staging/dry_run_write.ts

# Limit to specific teams and/or use a custom staging directory
npx tsx team-scrape/shared/firestore_staging/dry_run_write.ts --teams=LAL --stageDir=/abs/path/to/output
```

The script mirrors the player tooling and prints each Firestore path (`architect/baseTeams/{teamCode}`) followed by the JSON payload so you can sanity-check the shadow push.

## Push to Firestore

Write staged payloads to the live `architect_baseTeams` collection (only after staging + dry run look good):

```bash
# Push Lakers staged doc to Firestore
npx tsx team-scrape/shared/firestore_staging/scripts/push_staged_teams.ts LAL

# Multiple teams / alternate staging directory
npx tsx team-scrape/shared/firestore_staging/scripts/push_staged_teams.ts LAL BOS --stageDir=/abs/path/to/output
```

Requires `serviceAccountKey.json` at project root (same as player push tooling). The script writes only `/architect_baseTeams/{teamCode}` documents.

The output directory is git-ignored; copy snippets into docs if you need to share results.

## Expected Inputs

| Input | Source | Command |
| --- | --- | --- |
| `team-scrape/team-data/_artifacts/output/team_{TEAM}.json` | SalarySwish parser | `npm run parse` |
| `team-scrape/draft-picks/_artifacts/output/structured/draft_picks_{TEAM}.json` | RealGM scraper | `npm run team:draft-picks -- --teams TEAM` |
| `player-scrape/shared/_artifacts/outputs/player_index.json` | Player scrape shared outputs | `npm run build:index` |

If RealGM data is missing, the stager falls back to the lighter `draftPicks` array embedded in the SalarySwish output and logs a warning.

## Folder Guide

```
team-scrape/shared/firestore_staging/
├── README.md                    # This file
├── scripts/
│   ├── stage_team.ts            # CLI entry point
│   └── push_staged_teams.ts     # Writes staged teams to Firestore
├── _dev/
│   └── dry_run_write.ts         # Prints staged `/architect/baseTeams` payloads
└── docs/                         # Markdown visuals (created in subsequent steps)
```

## Validation

Pass `--validate` to run `BaseTeamDocZ.parse(...)` during staging. Full project validation:

```bash
npm run stage:team -- --team=LAL --validate
npm run validate:project
```

## Relationship to BasePlayers

This is the team-side counterpart to `player-scrape/firestore_staging/scripts/stage_player.ts`. Both pipelines:

- Take normalized scrape outputs
- Resolve IDs against canonical indices
- Produce Firestore-ready payloads for `/architect` collections
- Write git-ignored JSON for human review

Keep both staging directories in sync so downstream tooling can rely on consistent shapes.
