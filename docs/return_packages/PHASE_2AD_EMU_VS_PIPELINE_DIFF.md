<!--
/**
 * FILE: return_packages/PHASE_2AD_EMU_VS_PIPELINE_DIFF.md
 * PURPOSE: Preflight diff inventory comparing emulator data vs pipeline artifacts, with upstreaming recommendations.
 * OWNERSHIP: Scouting data pipeline
 *
 * HISTORY:
 *  - 2026-02-04: Created by plan `plans/_archive/phase-2ad-emu-vs-pipeline-diff/plan.md` (no chunks).
 *
 * LINKS:
 *  - Plan: plans/_archive/phase-2ad-emu-vs-pipeline-diff/plan.md
 *  - Latest Chunk: n/a (no chunks)
 */
-->

# PHASE 2AD — EMU vs PIPELINE DIFF INVENTORY (Preflight)

**DATE**: 2026-02-04  
**MODE**: PREFLIGHT (Discovery only — no writes)  
**MASTER DOC (SSOT)**: `docs/scouting/SCOUTING_PLAYER_TABLE_MASTER_AUDIT.md`

---

## 1. Executive Summary

This preflight compares **emulator state** (read-only query) against **pipeline artifacts** (staged JSON + PST inputs). The emulator currently contains base collections plus `players_v2` with `optionsByYear` and baseTeams with `entitlementIds`. The **pipeline artifacts are missing** `currentContractView.optionsByYear` in staged `players_v2` JSON and **baseTeams artifacts lack entitlementIds**, so those changes will **not survive a reseed** unless the staging outputs are regenerated and the entitlement patch step is applied. Entitlements and pick-rule source artifacts are present in `data/pst/`.

---

## 2. Task A — Emulator SSOT + Collections (Read-Only)

**SSOT**: `.emulator-data` (hardcoded in `scripts/emu/runEmu.ts`).  
**Folder exists**: `.emulator-data/` contains `firebase-export-metadata.json`, `auth_export/`, `firestore_export/`.  
**Emulator status**: Firestore emulator is already running on `127.0.0.1:8082` (no restart performed).

**Collections + sample doc IDs (emulator):**

- `architect_baseEntitlements`: `ent:ATL:2026:1:conv:cdbad2a3`, `ent:ATL:2027:1:own:a9553581`, `ent:ATL:2028:1:conv:637154f3`
- `architect_basePickRules`: `ATL_2026_1st`, `ATL_2026_2nd`, `ATL_2028_1st`
- `architect_basePlayers`: `aaron_gordon`, `aaron_holiday`, `aaron_nesmith`
- `architect_baseTeams`: `ATL`, `BKN`, `BOS`
- `players_v2`: `aaron_gordon`, `aaron_holiday`, `aaron_nesmith`

**Sample field checks (emulator):**

- `players_v2/aaron_gordon`: `currentContractView.optionsByYear` **present**
- `architect_baseTeams/ATL`: `entitlementIds` **present**
- `architect_baseEntitlements`: **has docs**
- `architect_basePickRules`: **has docs**

---

## 3. Task B — Pipeline Artifacts (Read-Only Sampling)

### 3.1 Player artifacts

**Seeding source**: `scripts/emu/seedPlayersIfMissing.ts` points to `firestore_staging/_artifacts/output` for both `players_v2` and `basePlayers`.

**Sample `players_v2` JSON files** (staged):

- `firestore_staging/_artifacts/output/players_v2/aaron_gordon.json` → `currentContractView.optionsByYear` **missing** (0 keys)
- `firestore_staging/_artifacts/output/players_v2/aaron_holiday.json` → `currentContractView.optionsByYear` **missing** (0 keys)
- `firestore_staging/_artifacts/output/players_v2/aaron_nesmith.json` → `currentContractView.optionsByYear` **missing** (0 keys)

### 3.2 Team/PST artifacts

**BaseTeams staged JSON** (`team-scrape/shared/firestore_staging/_artifacts/output/baseTeams`):

- `LAL.json`, `BOS.json`, `HOU.json` include `teamCode`, `teamName`, `roster` but `entitlementIds` **absent**

**Entitlements assets** (`data/pst/pst_entitlement_assets_2026_2033.json`):

- Sample asset IDs present (e.g., `ent:ATL:2026:1:conv:cdbad2a3`)

**Entitlements-by-team** (`data/pst/pst_entitlements_by_team_2026_2033.json`):

- Sample team payloads present (e.g., `ATL` has 13 assets)

**Pick ledger** (`data/pst/pst_pick_ledger_final_2026_2033.json`):

- Sample pick IDs present (e.g., `ATL_2026_1st`, `BKN_2026_1st`, `BOS_2026_1st`)

---

## 4. Task C — Diff Table (Money Output)

| Item / Feature | Exists in Emulator? | Exists in Pipeline Artifacts? | Exists in Writer Code? | Upstream Path Needed? | Recommended Fix Type |
| --- | ---: | ---: | ---: | ---: | --- |
| `players_v2.currentContractView.optionsByYear` | Yes (sample `aaron_gordon`) | **No** (staged JSON missing) | Yes (`stage_player.ts`) | **Yes** | **Both** (re-stage + prod backfill) |
| Entitlements collection exists | Yes (`architect_baseEntitlements`) | Yes (`pst_entitlement_assets_2026_2033.json`) | Yes (`pst_phase_10_push_base_entitlements.ts`) | No | — |
| Pick rules collection exists | Yes (`architect_basePickRules`) | Yes (`pst_pick_ledger_final_2026_2033.json`) | Yes (`pst_phase_12_3a_push_base_pick_rules.ts`) | No | — |
| BaseTeams entitlements linkage (`entitlementIds`) | Yes (sample `ATL`) | **No** (baseTeams artifacts lack `entitlementIds`) | Yes (`pst_phase_10_patch_base_teams_entitlements.ts`) | **Yes** | **Both** (patch step + prod backfill) |
| “Repairs” done manually | Unknown | Unknown | No | **Yes** | **Migration** |

**Interpretation**: Items marked **Yes** in emulator but **No** in artifacts will not survive a clean reseed unless the pipeline artifacts are regenerated or a migration is run.

---

## 5. Task D — Recommendations (Short)

- **optionsByYear**: Run the staging pipeline to regenerate `players_v2` artifacts (writer), and run a production backfill migration for existing docs if needed (**Both**).
- **BaseTeams entitlementIds**: Ensure the entitlements patch step runs after staging and run the patch in prod to backfill existing baseTeams (**Both**).
- **Manual repairs**: Identify explicit edits and formalize as a targeted migration (**Migration**).

---

## 6. Validation Commands Used (Read-Only)

```bash
# Confirm DATA_DIR definition
rg -n "DATA_DIR" scripts/emu/runEmu.ts

# Verify emulator data folder exists
ls -la .emulator-data

# Check emulator listener
lsof -nP -iTCP:8082 -sTCP:LISTEN

# Emulator collection list + sample IDs (read-only)
FIRESTORE_EMULATOR_HOST=127.0.0.1:8082 node plans/phase-2ad-emu-vs-pipeline-diff/temp/list_emu_collections.mjs

# Inspect staged artifacts + PST inputs
node plans/phase-2ad-emu-vs-pipeline-diff/temp/inspect_pipeline_artifacts.mjs
```

Note: Temporary scripts were created under `plans/phase-2ad-emu-vs-pipeline-diff/temp/` for this preflight and removed during closeout.

---

## 7. Read-Only Stance

No Firestore writes, migrations, or prod pushes were executed. All emulator queries were read-only.
