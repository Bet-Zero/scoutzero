# Team-Scrape Folder Structure

## Overview

The `team-scrape/` workspace is now split into three process-specific areas plus a shared toolbox. Each process owns its own scripts, documentation, examples, and outputs. Shared utilities (merge + staging) live alongside combined outputs.

## Layout

```
team-scrape/
├── draft-picks/                      # RealGM draft pick workflow
│   ├── docs/                         # Draft-pick specific docs
│   ├── output/                       # Structured + debug pick JSON
│   └── scripts/                      # Playwright + validation scripts
├── shared/                           # Cross-process tooling
│   ├── firestore_staging/            # Architect staging CLI + docs
│   ├── output/
│   │   └── merged/                   # Team + pick merged JSON
│   └── review_and_merge/             # Merge scripts + documentation
├── team-data/                        # SalarySwish cap/roster workflow
│   ├── config/                       # Selector map + Zod schema
│   ├── docs/                         # Team-data write-ups
│   ├── examples/                     # Sample HTML/JSON snapshots
│   ├── output/                       # SalarySwish JSON outputs
│   ├── scripts/                      # Fetch/inspect/probe/parse tools
│   └── working/                      # Playwright cache (`page.html`)
├── FOLDER_STRUCTURE.md               # This guide
├── README.md                         # Detailed overview
└── team.plan.md                      # Agent plan tracker (read-only)
```

## Outputs by Process

### Team Data (`team-data/output/`)

- `team_{CODE}.json` – Structured SalarySwish output per team
- `team.json` – Legacy latest-run snapshot (optional)

### Draft Picks (`draft-picks/output/`)

- `structured/draft_picks_{CODE}.json` – Canonical per-team files
- `draft_picks_structured.json` – All picks + metadata (optional)
- `draft_picks_by_current_owner.json` – Aggregated by current owner
- `by_current_owner/draft_picks_{CODE}.json` – Ownership-centric view
- `draft_picks_raw.json` – Raw RealGM scrape (debug)

### Shared Merge (`shared/output/merged/`)

- `{CODE}_merged.json` – Combined team + draft pick payload
- `all_teams_merged.json` – Aggregate of all merged teams

## Script Entry Points

| Purpose            | Location                                             | Command                          | Notes                                   |
| ------------------ | ---------------------------------------------------- | -------------------------------- | --------------------------------------- |
| Fetch HTML         | `team-data/scripts/fetch_page.ts`                    | `npm run fetch`                  | Writes `team-data/working/page.html`    |
| Probe / Inspect    | `team-data/scripts/{inspect,probe}.ts`               | `npm run inspect`, `npm run probe` | Uses `team-data/examples/page.html`     |
| Parse Team Data    | `team-data/scripts/parse_team.ts`                    | `npm run parse`                  | Writes `team-data/output/team_{CODE}.json` |
| Validate Team JSON | `team-data/scripts/validate_output.ts`               | `npm run validate:team`? (set env)| Reads `team-data/examples/team.json` by default |
| Draft Picks Scrape | `draft-picks/scripts/realgm_draft_picks.ts`          | `npm run realgm:drafts -- --teams LAL,OKC` | Writes under `draft-picks/output/` |
| Draft Picks Check  | `draft-picks/scripts/validate_pick_parsing.ts`       | `npx tsx ...`                    | Validates structured outputs            |
| Merge              | `shared/review_and_merge/scripts/merge_team_outputs.ts` | `npm run merge:samples`          | Reads team-data + draft-picks outputs   |
| Clean View         | `shared/review_and_merge/scripts/create_clean_view.ts` | `npm run clean-view`             | Produces markdown summaries             |
| Stage to Firestore | `shared/firestore_staging/stage_team.ts`             | `npm run stage:team -- --team=LAL` | Uses merged outputs for architect docs |

## Common Tasks

### Scrape + Merge One Team

```bash
# Team cap data (SalarySwish)
TEAM_URL="https://www.salaryswish.com/teams/lakers" TEAM_CODE="LAL" npm run parse

# Draft picks (RealGM)
npm run realgm:drafts -- --teams LAL --pretty

# Merge into a single payload
npm run merge:samples

# Inspect merged result
cat team-scrape/shared/output/merged/LAL_merged.json
```

### Inspect Outputs

- Team data: `ls team-scrape/team-data/output/`
- Draft picks: `ls team-scrape/draft-picks/output/structured/`
- Merged: `ls team-scrape/shared/output/merged/`

### Stage for Architect Review

```bash
npm run stage:team -- --team=LAL --validate
open team-scrape/shared/firestore_staging/output/baseTeams/LAL.json
```

## Notes

- Each process keeps its own docs to avoid cross-contamination.
- Shared tooling should only live under `shared/`.
- Update this file whenever directories or script entry points change so agents stay in sync.
