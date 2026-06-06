# Data Scrape Runbook

## Overview

This runbook captures the operational steps and parameters for the 2025-11-10 data pipeline run that produces staged payloads for players (`players_v2`, `/architect/basePlayers`) and teams (`/architect/baseTeams` / merged team documents).

> **Draft-pick source note.** Where this runbook references the "RealGM draft scraper," note that RealGM is now the **legacy backup**. The current/primary draft-pick source is **ProSportsTransactions (PST)** (`pst:*` pipeline). See [`team-scrape/draft-picks/README.md`](../../team-scrape/draft-picks/README.md).

## Environment & Secrets

- Service account: `serviceAccountKey.json` at project root (shared with `src/serviceAccountKey.json` for local emulation).
- Firebase targets:
  - `PLAYERS_V2_COLLECTION` (defaults to `players_v2`)
  - `BASE_PLAYERS_COLLECTION` (defaults to `architect_basePlayers`)
  - `architect_baseTeams` (team push)
- Ensure `.env` parity across local/staging per `README` and confirm credentials before execution.

## Player Pipeline

Command template (per-team batching, exponential backoff, logs auto-generated under `player-scrape/logs/<timestamp>/`):

```bash
npx tsx player-scrape/firestore_staging/scripts/run_full_scrape.ts \
  --batchSize=4 \
  --concurrency=6 \
  --backoffMs=2000 \
  --backoffMultiplier=2 \
  --maxRetries=4 \
  --resume=true
```

- Wrapper orchestrates contract + stats scrapers with retries and logs per phase (`contracts/TEAM.log`, `stats/TEAM.log`).
- Failed runs can be retried with `--teams=ATL,BOS,...` and `--resume=false` to force refresh.
- Outputs written to:
  - `player-scrape/contracts/output/<TEAM>/<playerId>.json`
  - `player-scrape/stats/output/<TEAM>/<playerId>.json`
  - `player-scrape/firestore_staging/output/{players_v2,basePlayers}/`.

### Sandbox Note

Within the Cursor sandbox, `npx` fails to launch (`EPERM` on global npm `sigstore`). Re-run outside sandbox or request elevated permissions.

## Team Pipeline

Command template (Playwright fetch + parse + stage). Logs stream to `team-scrape/logs/<timestamp>/` grouped by phase (`fetch`, `parse`, `stage`):

```bash
npx tsx team-scrape/shared/firestore_staging/scripts/run_full_team_scrape.ts \
  --batchSize=3 \
  --delayMs=1500 \
  --maxRetries=3 \
  --backoffMs=2000 \
  --backoffMultiplier=2
```

- Orchestrator runs three phases per team with exponential backoff.
- SalarySwish slug map baked into the runner; override with `--teams=LAL,NYK` for targeted reruns.
- Staged outputs land in `team-scrape/shared/firestore_staging/output/{baseTeams,merged}/`.

### Draft Pick Merge

```bash
npx tsx team-scrape/shared/review_and_merge/scripts/merge_team_outputs.ts \
  --logDir=team-scrape/logs \
  --pretty=true
```

- Discovers teams dynamically from salary + draft directories.
- Writes per-team merged files and `all_teams_merged.json`.
- Generates merge log under `team-scrape/logs/merge-<timestamp>.log`.

## Firestore Push (Dry Run Recommended)

- Players: `npx tsx player-scrape/firestore_staging/_dev/dry_run_write.ts --players=<ids>`
- Teams: `npx tsx team-scrape/shared/firestore_staging/_dev/dry_run_write.ts --teams=<codes>`
- Push scripts now support retry/backoff (`push_staged_players.ts` inherits wrapper behaviour; `push_staged_teams.ts` exposes `--maxRetries`, `--retryDelayMs`, `--backoffMultiplier`).

## Validation & QA – 2025-11-10

- Ran `npx tsx player-scrape/firestore_staging/scripts/stage_player.ts --player=austin_reaves --validate` (passes; produces refreshed staging artifacts).
- Previewed Firestore payload via `npx tsx player-scrape/firestore_staging/_dev/dry_run_write.ts --players=austin_reaves`; inspected `players_v2` doc, contracts, seasons, and `architect/basePlayers` output — no schema errors.
- Ran `npx tsx team-scrape/shared/firestore_staging/scripts/stage_team.ts --team=LAL --validate`; passes with warnings for seven legacy cap-hold names lacking canonical playerIds (Wayne Ellington, Avery Bradley, Jared Dudley, Dwight Howard, Markieff Morris, Dion Waiters, Carmelo Anthony). Placeholder IDs prefixed with `tmp_` remain; manual resolution required if retaining those holds.
- Previewed team payload via `npx tsx team-scrape/shared/firestore_staging/_dev/dry_run_write.ts --teams=LAL`; verified roster, cap holds, exceptions, and draft pick routing data.
- Regenerated schema docs (`npm run schema:generate`) and ran project validator (`npm run validate:project`); both succeeded.

### QA Notes

- Player sample (Austin Reaves) validates end-to-end with up-to-date timestamps.
- Team sample surfaces expected unresolved veteran cap holds; follow-up: map those names to archival playerIds or exclude if not needed.
- No structural issues detected in schema regeneration/validator runs.
- Next run should extend spot-checks across additional teams/players once broader staging data is available.

## Firestore Push – 2025-11-12

### Push Results

**Players Pushed:** 20 players (subset from test runs)

- Includes: `shai_gilgeous_alexander`, `joel_embiid`, `lauri_markkanen`, `austin_reaves`, `lebron_james`, `luka_doncic`, and 14 others
- Collections: `players_v2` (with subcollections) + `/architect/basePlayers`
- Status: ✅ All 20 players pushed successfully

**Teams Pushed:** 23 teams (most of league)

- Includes: ATL, BKN, BOS, CHI, CLE, DAL, DEN, DET, GSW, HOU, IND, LAC, LAL, MIA, MIN, NOP, NYK, OKC, PHI, PHX, SAC, UTA, WAS
- Collection: `/architect/baseTeams`
- Status: ✅ All 23 teams pushed successfully
- Draft picks: ✅ Merged from RealGM scraper (ATL, BKN, MEM, NYK, OKC, WAS have picks)

### Fixes Applied

1. **Shai Gilgeous-Alexander contract scrape:** Fixed URL slug normalization to use `salarySwishSlug` from `player_index.json` (was missing hyphen: `shai-gilgeousalexander`)
2. **Brooklyn Nets timeout:** Made Playwright scroll-to-"TRADE EXCEPTIONS" optional with fallback to scroll-to-bottom
3. **RealGM draft scraper:** Added ATL (ID: 1) and BKN (ID: 38) to team URL config; improved Playwright launch args for Cloudflare challenges

### Next Steps

- **Stage remaining players:** Only 20 players staged/pushed; need to stage remaining ~400+ players from full scrape
- **Run smoke tests:** Execute manual UI smoke tests per `application-integration-verification.md`
- **Discover remaining RealGM IDs:** Use `discover_realgm_ids.ts` to find IDs for remaining 23 teams
- **Archive legacy collections:** After smoke tests pass, archive old `/teams` and `/players` collections

## Outstanding Follow-Ups

- Execute full-league scrapes outside sandbox and archive logs in `player-scrape/logs/` & `team-scrape/logs/`.
- Run `merge_team_outputs.ts` after staging draft pick outputs for all franchises.
- Perform `npm run validate:project` and `npm run schema:generate` post-run to keep docs in sync.
- Record QA notes (pass/fail sampling) once fresh payloads validated.
