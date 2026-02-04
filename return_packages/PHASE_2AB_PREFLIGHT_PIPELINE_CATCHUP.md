<!--
/**
 * FILE: return_packages/PHASE_2AB_PREFLIGHT_PIPELINE_CATCHUP.md
 * PURPOSE: Preflight inventory of emulator vs pipeline data changes since 2025-11-10, with guardrails and upstream checklist references.
 * OWNERSHIP: Scouting data pipeline
 *
 * HISTORY:
 *  - 2026-02-04: Created by plan `plans/_archive/phase-2ab-pipeline-catchup-preflight/plan.md` (no chunks).
 *
 * LINKS:
 *  - Plan: plans/_archive/phase-2ab-pipeline-catchup-preflight/plan.md
 *  - Latest Chunk: n/a (no chunks)
 */
-->

# PHASE 2AB PREFLIGHT - Pipeline Catchup Inventory (Emu -> Prod)

**DATE**: 2026-02-04  
**MODE**: PREFLIGHT (Discovery only - no writes)  
**MASTER DOC (SSOT)**: `docs/scouting/SCOUTING_PLAYER_TABLE_MASTER_AUDIT.md`

---

## Executive Summary

This preflight maps the **players_v2 pipeline chain**, inventories **all data-changing scripts** that can affect emulator/prod, and separates **pipeline-capable** changes from **emulator-only** changes since the 2025-11-10 pipeline run. The checklist doc is the SSOT for what must be re-applied after a clean reseed or before a prod push: `docs/scouting/PIPELINE_CATCHUP_CHECKLIST.md`.

---

## Task A - Pipeline Map (players_v2 SSOT chain)

### 1) Staging/base writer (players_v2 payload)
- **Primary writer**: `player-scrape/firestore_staging/scripts/stage_player.ts` builds `players_v2` payloads and writes to `_artifacts/output/players_v2`. (`stage_player.ts` default output dir + writeFile paths).  
  Evidence: `player-scrape/firestore_staging/scripts/stage_player.ts` lines 186-190 and 1124-1133.
- **Batch entrypoint**: `player-scrape/firestore_staging/scripts/stage_all_players.ts` runs `stage_player.ts` across `player_index.json`.  
  Evidence: `stage_all_players.ts` lines 14-22, 34-38, 60-68.

### 2) Artifacts output location(s)
- **Current writer output**: `player-scrape/firestore_staging/_artifacts/output/{players_v2,basePlayers}` (default `outDir`).  
  Evidence: `stage_player.ts` lines 186-190 and 1124-1137.
- **Potential drift**: Runbook still references `player-scrape/firestore_staging/output/...` and `team-scrape/shared/firestore_staging/output/...` (likely stale vs `_artifacts/output`).  
  Evidence: `docs/runbooks/data-scrape.md` lines 32-35 and 54-56.

### 3) Emulator seed script(s)
- **Player seed helper**: `scripts/emu/seedPlayersIfMissing.ts` reads from `firestore_staging/_artifacts/output` and writes `players_v2` + `architect_basePlayers` into emulator when missing.  
  Evidence: `scripts/emu/seedPlayersIfMissing.ts` lines 18-21 and 201-219.
- **Emulator startup flow**: `scripts/emu/seedIfMissing.ts` runs seed scripts and can auto-backfill `optionsByYear`.  
  Evidence: `scripts/emu/seedIfMissing.ts` lines 305-373.

### 4) Production push script(s)
- **Primary push (current)**: `player-scrape/firestore_staging/scripts/push_staged_players.ts` uses `serviceAccountKey.json` and reads from `./firestore_staging/_artifacts/output`.  
  Evidence: `player-scrape/firestore_staging/scripts/push_staged_players.ts` lines 28-40 and 95-103.
- **Legacy push (stale path)**: `player-scrape/firestore_staging/push_staged_players.ts` reads from `player-scrape/firestore_staging/output` (directory currently missing).  
  Evidence: `player-scrape/firestore_staging/push_staged_players.ts` lines 5-9 and 24-33.

### 5) ProjectId + emulator host/port resolution
- **Emulator projectId resolution + hard guard**: `scripts/emu/adminEmu.ts` resolves projectId via `GCLOUD_PROJECT` -> `FIREBASE_PROJECT` -> `PROJECT_ID` -> `scoutzero-bf1ae` and refuses to run without `FIRESTORE_EMULATOR_HOST`.  
  Evidence: `scripts/emu/adminEmu.ts` lines 21-35 and 38-48.
- **Emulator env vars + ports**: `scripts/emu/runEmu.ts` sets `FIRESTORE_EMULATOR_HOST=127.0.0.1:8082` and exports projectId variants.  
  Evidence: `scripts/emu/runEmu.ts` lines 24-50.
- **Repo emulator config**: `firebase.json` defines Firestore emulator at `127.0.0.1:8082`.  
  Evidence: `firebase.json` lines 16-20.
- **App emulator connection**: `src/firebaseConfig.js` connects to `localhost:8082` in DEV.  
  Evidence: `src/firebaseConfig.js` lines 21-26.
- **Default projectId**: `.env` sets `VITE_FIREBASE_PROJECT_ID=scoutzero-bf1ae`.  
  Evidence: `.env` line 3.

---

## Task B - Inventory of Data-Changing Actions (All Emulator Data)

**Legend**:  
- Target: Emulator / Prod / Both / Local Artifacts  
- Change Type: Schema shape, Data fill/backfill, Seed/Reset, Debug/Test

### Player pipeline (staging + push)

| Script / Process | Target | ProjectId resolution | Emulator host/port | Change type |
| --- | --- | --- | --- | --- |
| `player-scrape/firestore_staging/scripts/stage_player.ts` | Local artifacts | N/A | N/A | Data fill (staged JSON) | 
| `player-scrape/firestore_staging/scripts/stage_all_players.ts` | Local artifacts | N/A | N/A | Data fill (batch staging) | 
| `player-scrape/firestore_staging/scripts/push_staged_players.ts` | Prod (service account); emulator possible if env set (ambiguous) | Service account (`serviceAccountKey.json`) | Not logged | Data fill (writes players_v2 + basePlayers) | 
| `player-scrape/firestore_staging/push_staged_players.ts` | Prod (service account); path appears stale | Service account (`serviceAccountKey.json`) | Not logged | Data fill (writes players_v2 + basePlayers) | 

### Emulator workflow (seed / reseed / repair)

| Script / Process | Target | ProjectId resolution | Emulator host/port | Change type |
| --- | --- | --- | --- | --- |
| `scripts/emu/runEmu.ts` | Emulator | `GCLOUD_PROJECT` -> `FIREBASE_PROJECT_ID` -> fallback | 127.0.0.1:8082 | Seed/Reset orchestration | 
| `scripts/emu/seedIfMissing.ts` | Emulator | `initAdminEmu` (guarded) | 127.0.0.1:8082 | Seed/Repair + backfill | 
| `scripts/emu/seedPlayersIfMissing.ts` | Emulator | `initAdminEmu` (guarded) | Uses env from `runEmu` | Seed (players_v2 + basePlayers) | 
| `scripts/emu/reseedEntitlements.ts` | Emulator (guarded) | `initAdminEmu` | Requires `FIRESTORE_EMULATOR_HOST` | Reset + re-push entitlements | 
| `scripts/emu/reseedBaseTeams.ts` | Emulator (guarded) | `initAdminEmu` | Requires `FIRESTORE_EMULATOR_HOST` | Reset baseTeams from staged JSON | 
| `scripts/emu/repairTeams.ts` | Emulator (guarded) | `initAdminEmu` | Requires `FIRESTORE_EMULATOR_HOST` | Repair baseTeams + entitlements | 

### PST / Team pipeline (entitlements, pick rules, teams)

| Script / Process | Target | ProjectId resolution | Emulator host/port | Change type |
| --- | --- | --- | --- | --- |
| `team-scrape/shared/firestore_staging/scripts/stage_team.ts` | Local artifacts | N/A | N/A | Data fill (staged baseTeams + snapshots) | 
| `team-scrape/shared/firestore_staging/scripts/push_staged_teams.ts` | Prod (service account); emulator possible if env set (ambiguous) | Service account (`serviceAccountKey.json`) | Not logged | Data fill (writes baseTeams) | 
| `team-scrape/draft-picks/scripts/pst/pst_phase_10_push_base_entitlements.ts` | Emulator or Prod | `FIRESTORE_EMULATOR_HOST` + env fallbacks | Uses emulator env if set | Data fill (baseEntitlements) | 
| `team-scrape/draft-picks/scripts/pst/pst_phase_10_patch_base_teams_entitlements.ts` | Emulator or Prod | `FIRESTORE_EMULATOR_HOST` + env fallbacks | Uses emulator env if set | Data fill (entitlementIds merge) | 
| `team-scrape/draft-picks/scripts/pst/pst_phase_12_3a_push_base_pick_rules.ts` | Emulator or Prod | `FIRESTORE_EMULATOR_HOST` + env fallbacks | Uses emulator env if set | Data fill (basePickRules) | 

### Migrations / Backfills

| Script / Process | Target | ProjectId resolution | Emulator host/port | Change type |
| --- | --- | --- | --- | --- |
| `scripts/migrations/backfill_optionsByYear.ts` | Prod (service account) | Service account only | Not logged | Data backfill | 
| `scripts/migrations/phase2y_backfill_optionsByYear.js` | Emulator or Prod | CLI flags + env fallbacks | Uses emulator if env set | Data backfill | 
| `scripts/migrations/phase66_migrate_tradeExceptions.js` | Emulator or Prod | Emulator hardcodes `demo-scoutzero`; prod uses service account | Uses emulator if env set | Schema migration (tradeExceptions -> exceptions.tpe) | 

### Proof harness / CI (debug-only)

| Script / Process | Target | ProjectId resolution | Emulator host/port | Change type |
| --- | --- | --- | --- | --- |
| `scripts/seed/phase69_seed_architect_worlds_for_tpe_migration.js` | Emulator only | Hardcoded `demo-scoutzero` | Requires `FIRESTORE_EMULATOR_HOST` | Debug/test seed (architect_worlds) | 
| `scripts/seed/phase69_run_tpe_migration_proof.js` | Emulator only | Delegates to seed + migration scripts | Requires `FIRESTORE_EMULATOR_HOST` | Debug/test harness | 
| `scripts/ci/run_phase80_cap_sheet_e2e_proof.js` | Emulator only | Hardcoded `demo-scoutzero` | Requires `FIRESTORE_EMULATOR_HOST` | Debug/test seed & write | 

---

## Task C - Upstreamed vs Emulator-Only (Summary Highlights)

**Documented prod execution** (from runbook, 2025-11-12):  
- `players_v2` + `architect_basePlayers`: **20 players pushed** (subset).  
- `architect_baseTeams`: **23 teams pushed** (subset).  
Evidence: `docs/runbooks/data-scrape.md` lines 91-105.

**Pipeline-capable but no documented prod run (needs upstreaming):**
- `players_v2.currentContractView.optionsByYear` (writer + migration exist, prod run unknown).  
- `architect_baseEntitlements`, `architect_basePickRules`, `entitlementIds` patch (scripts exist, prod run unknown).

**Emulator-only / disposable (lost on reseed):**
- `scripts/emu/*` reseed/repair flows.
- Phase 69 TPE proof harness seed data in `architect_worlds`.
- Phase 80 cap sheet CI proof script.

For the full bucketed checklist and upstream steps, see:  
`docs/scouting/PIPELINE_CATCHUP_CHECKLIST.md`.

---

## Task D - Guardrails (Wrong-Project Writes)

### Findings (hardcoded or ambiguous targeting)
- **Hardcoded demo projectId** in emulator scripts:
  - `scripts/migrations/phase66_migrate_tradeExceptions.js` uses `demo-scoutzero` when `FIRESTORE_EMULATOR_HOST` is set.  
    Evidence: `scripts/migrations/phase66_migrate_tradeExceptions.js` lines 68-72.
  - `scripts/seed/phase69_seed_architect_worlds_for_tpe_migration.js` uses `demo-scoutzero`.  
    Evidence: `scripts/seed/phase69_seed_architect_worlds_for_tpe_migration.js` lines 188-192.
  - `scripts/ci/run_phase80_cap_sheet_e2e_proof.js` uses `demo-scoutzero`.  
    Evidence: `scripts/ci/run_phase80_cap_sheet_e2e_proof.js` lines 107-112.
- **Ambiguous prod/emulator targeting** in push scripts:
  - `player-scrape/firestore_staging/scripts/push_staged_players.ts` and `team-scrape/shared/firestore_staging/scripts/push_staged_teams.ts` always initialize with service account and do not log resolved projectId or emulator host.  
    Evidence: `player-scrape/firestore_staging/scripts/push_staged_players.ts` lines 28-40; `team-scrape/shared/firestore_staging/scripts/push_staged_teams.ts` lines 27-40.

### Official projectId sources
- `.env` sets `VITE_FIREBASE_PROJECT_ID=scoutzero-bf1ae`.  
  Evidence: `.env` line 3.
- Emulator scripts resolve projectId via `adminEmu.ts` and `runEmu.ts` fallbacks (scoutzero-bf1ae).  
  Evidence: `scripts/emu/adminEmu.ts` lines 21-35; `scripts/emu/runEmu.ts` lines 30-34.

### Recommended minimal guardrails (no code changes in preflight)
- Require **explicit projectId confirmation** for any production write (`--prod --confirmProject=scoutzero-bf1ae` or env allowlist).
- Standardize emulator Admin init on `scripts/emu/adminEmu.ts` for any script using emulator.
- Log resolved projectId + emulator host at script start for all push/migration scripts.
- For emulator scripts, **fail fast** if projectId resolves to anything other than `scoutzero-bf1ae` unless explicitly overridden.

---

## Validation (Read-Only Evidence)

**Emulator host/port configured**:
- `firebase.json` lines 16-20
- `scripts/emu/runEmu.ts` lines 24-50
- `src/firebaseConfig.js` lines 21-26

**ProjectId sources**:
- `scripts/emu/adminEmu.ts` lines 21-35
- `scripts/emu/runEmu.ts` lines 30-34
- `.env` line 3

**Staging writer constructs players_v2**:
- `player-scrape/firestore_staging/scripts/stage_player.ts` lines 690-725 and 1124-1133
- `player-scrape/firestore_staging/scripts/stage_all_players.ts` lines 14-22 and 60-68

**Seed scripts read staged artifacts**:
- `scripts/emu/seedPlayersIfMissing.ts` lines 18-21 and 201-219

**Commands run (read-only)**:
- `rg -n "players_v2" player-scrape scripts src docs return_packages team-scrape data -S`
- `rg -n "projectId|PROJECT_ID|FIRESTORE_EMULATOR_HOST|emulator|EMULATOR|FIREBASE" scripts player-scrape src docs firebase.json .env* -S`
- `sed -n ...` and `nl -ba ...` for referenced files

**Stop conditions**: Not triggered (writer, seed, and project targeting paths were found).

---

## Next Execution Options (Short List)

1. Regenerate full staging artifacts and run **prod push** for `players_v2` + `architect_basePlayers` (beyond the 20-player subset).
2. Run **prod backfill** for `currentContractView.optionsByYear` if not already present (migration script with explicit confirmation).
3. Execute **prod push** for `architect_baseEntitlements`, `entitlementIds` patch, and `architect_basePickRules` with explicit projectId confirmation.
4. Update runbook paths to `_artifacts/output` to eliminate staging path drift.
5. Add guardrails to prevent `demo-scoutzero` usage outside explicit debug contexts.
