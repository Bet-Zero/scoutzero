# SCOUTING DATA PROD SYNC RUNBOOK

**DATE**: 2026-02-04  
**VERSION**: 1.0.0  
**STATUS**: ACTIVE

---

## 1. PURPOSE

This runbook documents the exact process to synchronize scouting data from local artifacts to production Firestore. It ensures:

1. **Artifact-based SSOT**: All production data derives from staged JSON artifacts, not emulator state
2. **Repeatable workflow**: Same commands produce same results
3. **Guardrails**: Prevent accidental writes to wrong project or while emulator env is set

---

## 2. ARCHITECTURE OVERVIEW

### 2.1 Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SCOUTING DATA PIPELINE                            │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   RAW SOURCES    │────▶│  STAGING WRITERS │────▶│    ARTIFACTS     │
│                  │     │                  │     │    (JSON)        │
│ • Scraper output │     │ • stage_player   │     │                  │
│ • PST pages      │     │ • stage_team     │     │ • players_v2/*.json
│ • Contracts data │     │ • PST parsers    │     │ • basePlayers/*.json
└──────────────────┘     └──────────────────┘     │ • baseTeams/*.json
                                                  │ • pst_entitlements.json
                                                  │ • pst_pick_ledger.json
                                                  └────────┬─────────┘
                                                           │
                    ┌──────────────────────────────────────┼──────────────────────────────────────┐
                    │                                      │                                      │
                    ▼                                      ▼                                      ▼
        ┌──────────────────┐               ┌──────────────────┐               ┌──────────────────┐
        │    EMULATOR      │               │   PRODUCTION     │               │   VERIFICATION   │
        │  (Development)   │               │   (scoutzero-    │               │                  │
        │                  │               │    bf1ae)        │               │ • verify:players │
        │ npm run emu      │               │                  │               │ • verify:teams   │
        │ (seeds from      │               │ push_staged_*    │               │                  │
        │  artifacts)      │               │ pst_phase_10_*   │               └──────────────────┘
        └──────────────────┘               │ pst_phase_12_*   │
                                           └──────────────────┘
```

### 2.2 Collections

| Collection                   | Purpose                                    | Artifact Source                                                           |
| ---------------------------- | ------------------------------------------ | ------------------------------------------------------------------------- |
| `players_v2`                 | Player bios, contracts, stats, evaluations | `firestore_staging/_artifacts/output/players_v2/*.json`                   |
| `architect_basePlayers`      | Simplified player docs for Architect tools | `firestore_staging/_artifacts/output/basePlayers/*.json`                  |
| `architect_baseTeams`        | Team rosters, cap data, entitlementIds     | `team-scrape/shared/firestore_staging/_artifacts/output/baseTeams/*.json` |
| `architect_baseEntitlements` | Draft pick entitlement definitions         | `data/pst/pst_entitlement_assets_2026_2033.json`                          |
| `architect_basePickRules`    | Draft pick rules and protections           | `data/pst/pst_pick_ledger_final_2026_2033.json`                           |

---

## 3. HOW EMULATOR DIFFERS FROM PROD

### 3.1 Seeding Sources

| Target                       | Emulator Source                                                           | Prod Source | Same? |
| ---------------------------- | ------------------------------------------------------------------------- | ----------- | ----- |
| `players_v2`                 | `firestore_staging/_artifacts/output/players_v2/*.json`                   | Same        | ✅    |
| `architect_basePlayers`      | `firestore_staging/_artifacts/output/basePlayers/*.json`                  | Same        | ✅    |
| `architect_baseTeams`        | `team-scrape/shared/firestore_staging/_artifacts/output/baseTeams/*.json` | Same        | ✅    |
| `architect_baseEntitlements` | `data/pst/pst_entitlement_assets_2026_2033.json`                          | Same        | ✅    |
| `architect_basePickRules`    | `data/pst/pst_pick_ledger_final_2026_2033.json`                           | Same        | ✅    |

### 3.2 Key Differences

- **Emulator**: Auto-seeds on `npm run emu` using `seedPlayersIfMissing.ts` and related scripts
- **Production**: Requires explicit push commands with `--confirmProject=scoutzero-bf1ae`
- **Emulator**: Writes go to local `.emulator-data/`
- **Production**: Writes go to live Firestore project

### 3.3 Important: Artifact Freshness

If emulator data differs from artifacts, the **artifact is SSOT**. To make emulator match:

```bash
# Clear and reseed emulator from artifacts
rm -rf .emulator-data
npm run emu
```

To make prod match emulator, you must first ensure artifacts are current, then push to prod.

---

## 4. REGENERATE ARTIFACTS

### 4.1 Regenerate Player Artifacts

This regenerates all ~660 player files with current schema (including `optionsByYear`):

```bash
npm run pipeline:stage:players
# Equivalent to: npx tsx player-scrape/firestore_staging/scripts/stage_all_players.ts
```

**Output**:

- `firestore_staging/_artifacts/output/players_v2/*.json`
- `firestore_staging/_artifacts/output/basePlayers/*.json`

**Time**: ~10-20 minutes

### 4.2 Patch BaseTeams with EntitlementIds

This patches staged baseTeams JSON files with entitlementIds from PST data:

```bash
npm run pipeline:stage:teams:patch
# Equivalent to: npm run stage:patch:baseTeams:entitlementIds:write
```

**Output**: Updates `team-scrape/shared/firestore_staging/_artifacts/output/baseTeams/*.json`

**Note**: This is a PATCH step - it reads `data/pst/pst_entitlements_by_team_2026_2033.json` and merges into existing team artifacts.

### 4.3 Verify Artifacts

After regenerating, verify the artifacts are correct:

```bash
npm run pipeline:verify:artifacts
# Equivalent to: npm run verify:artifacts:players && npm run verify:artifacts:baseTeams
```

**Expected output**:

- Players: 99.6%+ coverage with optionsByYear
- Teams: 30/30 teams with entitlementIds

---

## 5. PUSH TO PRODUCTION

### 5.1 Preflight Checklist

**BEFORE running any push commands**:

```bash
# 1. Confirm project ID in service account
cat serviceAccountKey.json | grep project_id
# Expected: "project_id": "scoutzero-bf1ae"

# 2. Unset ALL emulator env vars
unset FIRESTORE_EMULATOR_HOST
unset FIREBASE_EMULATOR_HOST
unset FIREBASE_AUTH_EMULATOR_HOST
unset GCLOUD_PROJECT
unset FIREBASE_PROJECT
unset PROJECT_ID

# 3. Verify emulator is NOT running
lsof -nP -iTCP:8082 -sTCP:LISTEN
# Expected: no output (port not in use)

# 4. Verify artifacts are fresh
npm run pipeline:verify:artifacts
```

### 5.2 Push Players (players_v2 + architect_basePlayers)

```bash
npx tsx player-scrape/firestore_staging/scripts/push_staged_players.ts --all --confirmProject=scoutzero-bf1ae
```

**Writes**: ~660 docs to `players_v2`, ~660 docs to `architect_basePlayers`  
**Time**: ~5-10 minutes

### 5.3 Push Teams (architect_baseTeams)

```bash
npx tsx team-scrape/shared/firestore_staging/scripts/push_staged_teams.ts ATL BKN BOS ... --confirmProject=scoutzero-bf1ae
```

Or push all 30 teams:

```bash
npx tsx team-scrape/shared/firestore_staging/scripts/push_staged_teams.ts \
  ATL BKN BOS CHA CHI CLE DAL DEN DET GSW HOU IND LAC LAL MEM MIA MIL MIN NOP NYK OKC ORL PHI PHX POR SAC SAS TOR UTA WAS \
  --confirmProject=scoutzero-bf1ae
```

**Writes**: 30 docs to `architect_baseTeams`

### 5.4 Push Entitlements (architect_baseEntitlements)

```bash
# Must have emulator env UNSET
npx tsx team-scrape/draft-picks/scripts/pst/pst_phase_10_push_base_entitlements.ts
```

**Writes**: ~450 docs to `architect_baseEntitlements`  
**Source**: `data/pst/pst_entitlement_assets_2026_2033.json`

### 5.5 Patch Teams with EntitlementIds (Firestore patch, not artifact)

```bash
# Must have emulator env UNSET
npx tsx team-scrape/draft-picks/scripts/pst/pst_phase_10_patch_base_teams_entitlements.ts
```

**Updates**: `entitlementIds` field on 30 `architect_baseTeams` docs

### 5.6 Push Pick Rules (architect_basePickRules)

```bash
# Must have emulator env UNSET
npx tsx team-scrape/draft-picks/scripts/pst/pst_phase_12_3a_push_base_pick_rules.ts
```

**Writes**: ~240 docs to `architect_basePickRules`  
**Source**: `data/pst/pst_pick_ledger_final_2026_2033.json`

---

## 6. VERIFY PROD MATCHES EMULATOR

After pushing to prod, verify key fields:

1. **Check a player** in Firebase Console:
   - Navigate to: `players_v2/{playerId}`
   - Verify `currentContractView.optionsByYear` exists for players with options

2. **Check a team** in Firebase Console:
   - Navigate to: `architect_baseTeams/{teamCode}`
   - Verify `entitlementIds` is a non-empty array

3. **Check entitlements**:
   - Navigate to: `architect_baseEntitlements`
   - Verify doc count matches artifact count

4. **Check pick rules**:
   - Navigate to: `architect_basePickRules`
   - Verify doc count matches artifact count

---

## 7. COMMON FAILURE MODES

### 7.1 Wrong Project

**Symptom**: Changes appear in wrong Firebase project

**Prevention**:

- Push scripts require `--confirmProject=scoutzero-bf1ae`
- Scripts check service account `project_id`

**Recovery**:

- Delete errant data from wrong project
- Push to correct project

### 7.2 Emulator Env Var Set

**Symptom**: Script fails with "BLOCKED: EMULATOR MODE IS SET"

**Fix**:

```bash
unset FIRESTORE_EMULATOR_HOST
```

### 7.3 Stale Artifacts

**Symptom**: Pushed data missing fields (e.g., `optionsByYear`)

**Prevention**:

- Always run `npm run pipeline:verify:artifacts` before push
- Regenerate artifacts if stale

**Recovery**:

- Regenerate artifacts: `npm run pipeline:stage:players`
- Re-push to prod

### 7.4 Missing --confirmProject Flag

**Symptom**: Script fails with "BLOCKED: MISSING --confirmProject FLAG"

**Fix**: Add the required flag:

```bash
npx tsx <script>.ts --all --confirmProject=scoutzero-bf1ae
```

### 7.5 Emulator Running During Prod Push

**Symptom**: Confusion about where data went

**Prevention**:

- Stop emulator before prod push: `pkill -f "firebase.*emulators"`
- Scripts detect emulator env and warn

---

## 8. QUICK REFERENCE COMMANDS

### Full Sync Plan (No Writes)

```bash
npm run pipeline:sync:plan
```

### Verify Only

```bash
npm run pipeline:sync:verify
```

### Full Staging Regeneration

```bash
npm run pipeline:stage:players
npm run pipeline:stage:teams:patch
npm run pipeline:verify:artifacts
```

### All Prod Push Commands (Reference Only)

```bash
# Players + Base Players
npx tsx player-scrape/firestore_staging/scripts/push_staged_players.ts --all --confirmProject=scoutzero-bf1ae

# Base Teams
npx tsx team-scrape/shared/firestore_staging/scripts/push_staged_teams.ts ATL BKN BOS CHA CHI CLE DAL DEN DET GSW HOU IND LAC LAL MEM MIA MIL MIN NOP NYK OKC ORL PHI PHX POR SAC SAS TOR UTA WAS --confirmProject=scoutzero-bf1ae

# Entitlements (emulator env MUST be unset)
npx tsx team-scrape/draft-picks/scripts/pst/pst_phase_10_push_base_entitlements.ts

# Teams Entitlement Patch (emulator env MUST be unset)
npx tsx team-scrape/draft-picks/scripts/pst/pst_phase_10_patch_base_teams_entitlements.ts

# Pick Rules (emulator env MUST be unset)
npx tsx team-scrape/draft-picks/scripts/pst/pst_phase_12_3a_push_base_pick_rules.ts
```

---

## 9. LINKS

- **Master Audit Doc**: `SCOUTING_PLAYER_TABLE_MASTER_AUDIT.md` (archived to `archive/docs/scouting/`)
- **Sync Plan Script**: [scripts/release/scouting_prod_sync_plan.ts](../../scripts/release/scouting_prod_sync_plan.ts)
- **Guardrails Module**: [scripts/release/prodGuardrails.ts](../../scripts/release/prodGuardrails.ts)
- **Emulator Seeding**: [scripts/emu/README.md](../../scripts/emu/README.md)
- **Pipeline Artifacts**:
  - Players: `firestore_staging/_artifacts/output/players_v2/`
  - Teams: `team-scrape/shared/firestore_staging/_artifacts/output/baseTeams/`
  - PST: `data/pst/`
