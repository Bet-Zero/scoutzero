<!--
/**
 * FILE: docs/scouting/PIPELINE_CATCHUP_CHECKLIST.md
 * PURPOSE: Bucketed checklist of data changes since the 2025-11-10 pipeline run, with upstreaming guidance.
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

# Pipeline Catchup Checklist (Phase 2AB)

**Date**: 2026-02-04  
**Scope**: Emulator data changes since the 2025-11-10 pipeline run  
**Upstreamed tracking**: Pipeline-capable **and** documented production execution

**Legend**:

- **Pipeline-capable**: staging writer or repeatable migration exists.
- **Prod executed**: documented production execution in repo docs.
- **Bucket**: A = Writer-owned, B = Migration-owned, C = Debug-only / disposable.

---

## players_v2

| Change | Where it exists today | Pipeline-capable | Prod executed | Bucket | What's needed to upstream | Verification (reseed + prod) |
| --- | --- | --- | --- | --- | --- | --- |
| Base `players_v2` docs + subcollections (contracts, seasons, views) | Writer: `player-scrape/firestore_staging/scripts/stage_player.ts` builds payloads and writes `_artifacts/output/players_v2` (`parseArgs` default + writeFile paths). Emulator seed: `scripts/emu/seedPlayersIfMissing.ts` reads `firestore_staging/_artifacts/output/players_v2` and writes to emulator when missing. | YES Writer exists | YES Partial prod push documented (20 players on 2025-11-12). | A | Run full scrape + stage all players, then push staged players to prod. | Reseed: `npm run emu` -> confirm `players_v2` count >0. Prod: query `/players_v2` for expected player count. |
| `currentContractView.optionsByYear` (SSOT for option types) | Writer: `stage_player.ts` builds `optionsByYear` and includes in `currentContractView`. Emulator safety net: `scripts/emu/seedIfMissing.ts` runs `scripts/migrations/phase2y_backfill_optionsByYear.js` if needed. Migration: `scripts/migrations/phase2y_backfill_optionsByYear.js` + `scripts/migrations/backfill_optionsByYear.ts`. | YES Writer + YES Migration | UNKNOWN Unknown (no documented prod run found) | A (writer-owned) | Regenerate staged output and push to prod **or** run `phase2y_backfill_optionsByYear.js --write --prod --confirmProject=scoutzero-bf1ae`. | Reseed: run `npm run emu` and verify `optionsByYear` exists in sample player. Prod: run migration dry run to confirm `Would update: 0`. |

---

## architect_basePlayers

| Change | Where it exists today | Pipeline-capable | Prod executed | Bucket | What's needed to upstream | Verification (reseed + prod) |
| --- | --- | --- | --- | --- | --- | --- |
| Base `architect_basePlayers` docs (player bios/contracts) | Writer: `stage_player.ts` writes `_artifacts/output/basePlayers`. Emulator seed: `scripts/emu/seedPlayersIfMissing.ts` reads `firestore_staging/_artifacts/output/basePlayers`. | YES Writer exists | YES Partial prod push documented (20 players on 2025-11-12). | A | Run full scrape + stage + push to prod (basePlayers). | Reseed: `npm run emu` -> confirm `architect_basePlayers` count >0. Prod: query `/architect_basePlayers` for expected player count. |

---

## architect_baseTeams

| Change | Where it exists today | Pipeline-capable | Prod executed | Bucket | What's needed to upstream | Verification (reseed + prod) |
| --- | --- | --- | --- | --- | --- | --- |
| Base `architect_baseTeams` docs (rosters/cap data) | Writer: `team-scrape/shared/firestore_staging/scripts/stage_team.ts` writes `_artifacts/output/baseTeams`. Emulator reseed/repair: `scripts/emu/reseedBaseTeams.ts` and `scripts/emu/seedIfMissing.ts` auto-repair. | YES Writer exists | YES Partial prod push documented (23 teams on 2025-11-12). | A | Run full team pipeline and push staged teams to prod. | Reseed: `npm run emu` and inspect `architect_baseTeams` sample doc. Prod: verify `/architect_baseTeams/{team}` has full roster fields. |
| `entitlementIds` patch on baseTeams | Migration/pipeline: `team-scrape/draft-picks/scripts/pst/pst_phase_10_patch_base_teams_entitlements.ts` (merge). Emulator reseed: `scripts/emu/reseedEntitlements.ts` clears + re-patches. | YES Script exists | UNKNOWN Unknown | B | Run patch script in prod with explicit projectId controls (service account required). | Reseed: run `emu:reseed:entitlements` and confirm `entitlementIds` on 30 teams. Prod: spot-check `architect_baseTeams/{team}` includes entitlementIds. |

---

## architect_baseEntitlements

| Change | Where it exists today | Pipeline-capable | Prod executed | Bucket | What's needed to upstream | Verification (reseed + prod) |
| --- | --- | --- | --- | --- | --- | --- |
| Base entitlements docs | Pipeline script: `team-scrape/draft-picks/scripts/pst/pst_phase_10_push_base_entitlements.ts` (uses `data/pst/pst_entitlement_assets_2026_2033.json`). Emulator reseed: `scripts/emu/reseedEntitlements.ts` (delete + push). | YES Script exists | UNKNOWN Unknown | A | Run push script in prod with service account. | Reseed: run `emu:reseed:entitlements` and confirm expected count. Prod: count docs in `/architect_baseEntitlements`. |

---

## architect_basePickRules

| Change | Where it exists today | Pipeline-capable | Prod executed | Bucket | What's needed to upstream | Verification (reseed + prod) |
| --- | --- | --- | --- | --- | --- | --- |
| Base pick rules docs | Pipeline script: `team-scrape/draft-picks/scripts/pst/pst_phase_12_3a_push_base_pick_rules.ts` (from `data/pst/pst_pick_ledger_final_2026_2033.json`). Emulator seed: `scripts/emu/seedIfMissing.ts` runs `pst:push:base-pick-rules` when missing. | YES Script exists | UNKNOWN Unknown | A | Run push script in prod with service account and verify counts. | Reseed: `npm run emu` after clearing `.emulator-data` and confirm `architect_basePickRules` count >= expected threshold. Prod: count docs + spot-check sample pickId. |

---

## architect_worlds

| Change | Where it exists today | Pipeline-capable | Prod executed | Bucket | What's needed to upstream | Verification (reseed + prod) |
| --- | --- | --- | --- | --- | --- | --- |
| Migrate `tradeExceptions` -> `exceptions.tpe` in `architect_worlds/*/teams/*` | Migration: `scripts/migrations/phase66_migrate_tradeExceptions.js` (emulator/prod; hardcodes `demo-scoutzero` for emulator). | YES Migration exists | UNKNOWN Unknown | B | Run migration in prod only after explicit confirmation; confirm projectId resolution; consider replacing hardcoded demo project first. | Emulator: run verify-only and confirm legacy detection. Prod: verify no legacy `tradeExceptions` remain. |
| Phase 69 seed/proof harness (creates deterministic world + teams) | Emulator-only scripts: `scripts/seed/phase69_seed_architect_worlds_for_tpe_migration.js` and `scripts/seed/phase69_run_tpe_migration_proof.js`. | NO | NO | C | No upstreaming needed (debug-only). | Emulator only: re-run proof harness as needed. |
| Phase 80 cap sheet proof (CI) | Emulator-only script: `scripts/ci/run_phase80_cap_sheet_e2e_proof.js` (hardcodes `demo-scoutzero`). | NO | NO | C | No upstreaming needed (debug-only). | Emulator only: run CI proof when needed. |

---

## Notes on Staged Artifact Paths (Potential Drift)

- Runbook still references `player-scrape/firestore_staging/output` and `team-scrape/shared/firestore_staging/output`, but current staging writers default to `_artifacts/output`. Treat the runbook paths as **stale** until updated.
