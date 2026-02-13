# Phase 2AE: Upstream Emulator-Only Data Into Pipeline Artifacts

**DATE**: 2026-02-04
**STATUS**: EXECUTED
**SCOPE**: Players `optionsByYear` + Teams `entitlementIds` upstreamed into staged artifacts

---

## 1. EXECUTIVE SUMMARY

This phase addresses a critical gap where emulator-only data (`optionsByYear` for players, `entitlementIds` for teams) was populated via runtime migrations but not present in staged JSON artifacts. This meant deleting `.emulator-data` and running `npm run emu` would fail to reproduce these fields without manual intervention.

**Resolution**:

1. **Players**: Re-staged all ~660 players using existing `stage_all_players.ts` which already had `optionsByYear` derivation logic (added in Phase 2AA)
2. **Teams**: Created artifact-level patch script to bake `entitlementIds` into staged baseTeams JSON

**Result**: Clean reseed (`rm -rf .emulator-data && npm run emu`) now reproduces both fields without manual migrations.

---

## 2. WHAT CHANGED

### 2.1 Players (optionsByYear)

**Before**: Staged `players_v2/*.json` artifacts were stale (created before Phase 2AA added optionsByYear logic)
**After**: All ~660 player artifacts regenerated with `currentContractView.optionsByYear` populated

| Metric | Before | After |
|--------|--------|-------|
| Players with contract options | 267 | 267 |
| Players with optionsByYear | 0 | 266 |
| Coverage | 0% | 99.6% |

**Files Regenerated**: `player-scrape/firestore_staging/_artifacts/output/players_v2/*.json` (660 files)

**Known Edge Case** (1 player):

- `toumani_camara`: Has TO option on original rookie contract, but extension contract (used for currentContractView) has no options. The `options: ['TO']` field is detected but `optionsByYear` derivation doesn't find it in the extension's salariesByYear. This is a pre-existing data modeling edge case for players with superseded contracts.

### 2.2 Teams (entitlementIds)

**Before**: Staged `baseTeams/*.json` artifacts did not include `entitlementIds` (was added via runtime patch to Firestore only)
**After**: All 30 team artifacts patched with `entitlementIds: string[]`

| Metric | Before | After |
|--------|--------|-------|
| Teams with entitlementIds | 0 | 30 |
| Coverage | 0% | 100% |

**Sample counts**:

- ATL: 13 entitlementIds
- BOS: 18 entitlementIds
- HOU: 21 entitlementIds
- LAL: 11 entitlementIds
- OKC: 30 entitlementIds (highest)

**Files Patched**: `team-scrape/shared/firestore_staging/_artifacts/output/baseTeams/*.json` (30 files)

---

## 3. NEW SCRIPTS ADDED

### 3.1 Verification Scripts

| Script | Path | Purpose |
|--------|------|---------|
| `verify:artifacts:players` | `scripts/emu/verifyArtifactsPlayersV2.ts` | Verify players_v2 artifacts have optionsByYear |
| `verify:artifacts:baseTeams` | `scripts/emu/verifyArtifactsBaseTeams.ts` | Verify baseTeams artifacts have entitlementIds |

### 3.2 Patch Script

| Script | Path | Purpose |
|--------|------|---------|
| `stage:patch:baseTeams:entitlementIds` | `team-scrape/shared/firestore_staging/scripts/patch_baseTeams_entitlementIds.ts` | Patch baseTeams artifacts with entitlementIds (dry run) |
| `stage:patch:baseTeams:entitlementIds:write` | Same script with `--write` flag | Apply changes |

### 3.3 npm Scripts Added to package.json

```json
"verify:artifacts:players": "npx tsx scripts/emu/verifyArtifactsPlayersV2.ts",
"verify:artifacts:baseTeams": "npx tsx scripts/emu/verifyArtifactsBaseTeams.ts",
"stage:patch:baseTeams:entitlementIds": "npx tsx team-scrape/shared/firestore_staging/scripts/patch_baseTeams_entitlementIds.ts",
"stage:patch:baseTeams:entitlementIds:write": "npx tsx team-scrape/shared/firestore_staging/scripts/patch_baseTeams_entitlementIds.ts --write"
```

---

## 4. PIPELINE-BACKED VS EMULATOR-ONLY

### Before Phase 2AE

| Field | In Staged Artifacts | In Emulator | Gap |
|-------|---------------------|-------------|-----|
| `currentContractView.optionsByYear` | NO | YES (via migration) | Runtime-only |
| `entitlementIds` | NO | YES (via patch) | Runtime-only |

### After Phase 2AE

| Field | In Staged Artifacts | In Emulator | Gap |
|-------|---------------------|-------------|-----|
| `currentContractView.optionsByYear` | YES | YES | Closed |
| `entitlementIds` | YES | YES | Closed |

---

## 5. HOW TO VERIFY ON FRESH RESEED

### 5.1 Verify Artifacts (Pre-Seed)

```bash
# Verify player artifacts have optionsByYear
npm run verify:artifacts:players
# Expected: 99.6% coverage (266/267) - 1 edge case documented above

# Verify team artifacts have entitlementIds
npm run verify:artifacts:baseTeams
# Expected: PASS: entitlementIds coverage (30/30 teams)
```

### 5.2 Clean Reseed Test

```bash
# Stop emulators if running
# Delete emulator data
rm -rf .emulator-data

# Run emulator
npm run emu

# Verify in emulator:
# 1. players_v2/aaron_gordon.currentContractView.optionsByYear should exist
# 2. architect_baseTeams/ATL.entitlementIds should exist and be non-empty
```

### 5.3 UI Verification

1. Open Player Table at `http://localhost:5173/scouts`
2. Apply "Option Type" filter for any year
3. Confirm players with options appear (e.g., Aaron Gordon for PO years)

---

## 6. MAINTENANCE NOTES

### When to Re-Run

| Scenario | Action |
|----------|--------|
| New player scrape | Run `stage_all_players.ts` - optionsByYear will be included |
| New team scrape | Run `stage:patch:baseTeams:entitlementIds:write` after staging |
| Entitlements data updated | Run `stage:patch:baseTeams:entitlementIds:write` |

### Idempotency

- `verifyArtifactsPlayersV2.ts`: Read-only, safe to run anytime
- `verifyArtifactsBaseTeams.ts`: Read-only, safe to run anytime
- `patch_baseTeams_entitlementIds.ts`: Idempotent, skips unchanged teams

---

## 7. FILES SUMMARY

### Created

- `scripts/emu/verifyArtifactsPlayersV2.ts`
- `scripts/emu/verifyArtifactsBaseTeams.ts`
- `team-scrape/shared/firestore_staging/scripts/patch_baseTeams_entitlementIds.ts`

### Modified

- `package.json` (4 new npm scripts)

### Regenerated (not code changes)

- `player-scrape/firestore_staging/_artifacts/output/players_v2/*.json` (660 files)
- `team-scrape/shared/firestore_staging/_artifacts/output/baseTeams/*.json` (30 files)
