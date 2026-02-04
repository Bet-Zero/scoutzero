# PHASE 2AF — SCOUTING PROD SYNC WIRING

**DATE**: 2026-02-04  
**STATUS**: EXECUTED  
**MODE**: EXECUTION (repo changes only — NO production writes)

---

## 1. EXECUTIVE SUMMARY

This phase creates a documented, repeatable production sync workflow for scouting data. It establishes:

1. **Artifact-based SSOT**: All production data derives from staged JSON artifacts, not emulator state
2. **Single entrypoint**: `npm run pipeline:sync:plan` shows all commands needed
3. **Guardrails**: Prevent accidental writes to wrong project or while emulator env is set
4. **Full documentation**: Complete runbook with preflight checklists and failure modes

---

## 2. WHAT CHANGED

### 2.1 New Files Created

| File                                         | Purpose                                       |
| -------------------------------------------- | --------------------------------------------- |
| `scripts/release/scouting_prod_sync_plan.ts` | Single entrypoint for prod sync planning      |
| `scripts/release/prodGuardrails.ts`          | Shared guardrails module for push scripts     |
| `docs/scouting/PROD_SYNC_RUNBOOK.md`         | Complete documentation for prod sync workflow |

### 2.2 Files Modified

| File                                                                | Change                           |
| ------------------------------------------------------------------- | -------------------------------- |
| `package.json`                                                      | Added 8 new npm pipeline scripts |
| `player-scrape/firestore_staging/scripts/push_staged_players.ts`    | Added production guardrails      |
| `team-scrape/shared/firestore_staging/scripts/push_staged_teams.ts` | Added production guardrails      |
| `docs/scouting/SCOUTING_PLAYER_TABLE_MASTER_AUDIT.md`               | Added Phase 2AF section          |

---

## 3. NPM SCRIPTS ADDED

| Script                       | Command                                                                  | Purpose                             |
| ---------------------------- | ------------------------------------------------------------------------ | ----------------------------------- |
| `pipeline:sync:plan`         | `npx tsx scripts/release/scouting_prod_sync_plan.ts`                     | Full sync plan (no writes)          |
| `pipeline:sync:verify`       | `npx tsx scripts/release/scouting_prod_sync_plan.ts --verify-only`       | Verify artifacts only               |
| `pipeline:stage:players`     | `npx tsx player-scrape/firestore_staging/scripts/stage_all_players.ts`   | Regenerate player artifacts         |
| `pipeline:stage:teams:patch` | `npm run stage:patch:baseTeams:entitlementIds:write`                     | Patch baseTeams with entitlementIds |
| `pipeline:verify:artifacts`  | `npm run verify:artifacts:players && npm run verify:artifacts:baseTeams` | Verify all artifacts                |
| `pipeline:prod:push:players` | Echo command reference                                                   | Reference (prints command to run)   |
| `pipeline:prod:push:teams`   | Echo command reference                                                   | Reference (prints command to run)   |
| `pipeline:prod:push:pst`     | Echo command reference                                                   | Reference (prints command to run)   |

---

## 4. STAGING COMMANDS

### 4.1 Player Artifacts

```bash
npm run pipeline:stage:players
# Regenerates: firestore_staging/_artifacts/output/players_v2/*.json (660 files)
# Regenerates: firestore_staging/_artifacts/output/basePlayers/*.json (660 files)
# Includes: currentContractView.optionsByYear
```

### 4.2 Team Artifacts Patch

```bash
npm run pipeline:stage:teams:patch
# Patches: team-scrape/shared/firestore_staging/_artifacts/output/baseTeams/*.json (30 files)
# Adds: entitlementIds from data/pst/pst_entitlements_by_team_2026_2033.json
```

### 4.3 Verify Artifacts

```bash
npm run pipeline:verify:artifacts
# Checks: players_v2 count, optionsByYear presence
# Checks: baseTeams count, entitlementIds presence
```

---

## 5. PROD PUSH COMMANDS

### 5.1 Players + Base Players

```bash
npx tsx player-scrape/firestore_staging/scripts/push_staged_players.ts --all --confirmProject=scoutzero-bf1ae
```

- Writes: ~660 docs to `players_v2`
- Writes: ~660 docs to `architect_basePlayers`
- Source: `firestore_staging/_artifacts/output/players_v2/*.json`
- Source: `firestore_staging/_artifacts/output/basePlayers/*.json`

### 5.2 Base Teams

```bash
npx tsx team-scrape/shared/firestore_staging/scripts/push_staged_teams.ts \
  ATL BKN BOS CHA CHI CLE DAL DEN DET GSW HOU IND LAC LAL MEM MIA MIL MIN NOP NYK OKC ORL PHI PHX POR SAC SAS TOR UTA WAS \
  --confirmProject=scoutzero-bf1ae
```

- Writes: 30 docs to `architect_baseTeams`
- Source: `team-scrape/shared/firestore_staging/_artifacts/output/baseTeams/*.json`

### 5.3 Entitlements

```bash
# REQUIRES: FIRESTORE_EMULATOR_HOST unset
npx tsx team-scrape/draft-picks/scripts/pst/pst_phase_10_push_base_entitlements.ts
```

- Writes: ~450 docs to `architect_baseEntitlements`
- Source: `data/pst/pst_entitlement_assets_2026_2033.json`

### 5.4 Entitlements Patch to Teams

```bash
# REQUIRES: FIRESTORE_EMULATOR_HOST unset
npx tsx team-scrape/draft-picks/scripts/pst/pst_phase_10_patch_base_teams_entitlements.ts
```

- Updates: `entitlementIds` on 30 `architect_baseTeams` docs

### 5.5 Pick Rules

```bash
# REQUIRES: FIRESTORE_EMULATOR_HOST unset
npx tsx team-scrape/draft-picks/scripts/pst/pst_phase_12_3a_push_base_pick_rules.ts
```

- Writes: ~240 docs to `architect_basePickRules`
- Source: `data/pst/pst_pick_ledger_final_2026_2033.json`

---

## 6. GUARDRAILS ADDED

### 6.1 Player Push Script Guardrails

Added to `player-scrape/firestore_staging/scripts/push_staged_players.ts`:

```typescript
// If FIRESTORE_EMULATOR_HOST is set → Skip guardrails (emulator mode)
// If FIRESTORE_EMULATOR_HOST is NOT set:
//   - Require --confirmProject=scoutzero-bf1ae
//   - Block if project ID doesn't match
```

### 6.2 Team Push Script Guardrails

Added to `team-scrape/shared/firestore_staging/scripts/push_staged_teams.ts`:

```typescript
// Same logic as player push script
```

### 6.3 Guardrail Behaviors

| Scenario                                          | Result                         |
| ------------------------------------------------- | ------------------------------ |
| Run with `FIRESTORE_EMULATOR_HOST=127.0.0.1:8082` | ✅ Allowed (emulator mode)     |
| Run without emulator, no `--confirmProject`       | 🚫 BLOCKED with instructions   |
| Run with `--confirmProject=wrong-project`         | 🚫 BLOCKED with mismatch error |
| Run with `--confirmProject=scoutzero-bf1ae`       | ✅ Allowed                     |

---

## 7. INVENTORY OF STAGING WRITERS

| Dataset                      | Staging Writer                                                                   | Artifact Location                                                         |
| ---------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `players_v2`                 | `player-scrape/firestore_staging/scripts/stage_all_players.ts`                   | `firestore_staging/_artifacts/output/players_v2/*.json`                   |
| `architect_basePlayers`      | Same as above                                                                    | `firestore_staging/_artifacts/output/basePlayers/*.json`                  |
| `architect_baseTeams`        | `team-scrape/shared/firestore_staging/scripts/stage_team.ts`                     | `team-scrape/shared/firestore_staging/_artifacts/output/baseTeams/*.json` |
| BaseTeams entitlementIds     | `team-scrape/shared/firestore_staging/scripts/patch_baseTeams_entitlementIds.ts` | Patches existing team artifacts                                           |
| `architect_baseEntitlements` | PST phase 8                                                                      | `data/pst/pst_entitlement_assets_2026_2033.json`                          |
| `architect_basePickRules`    | PST phase 5                                                                      | `data/pst/pst_pick_ledger_final_2026_2033.json`                           |

---

## 8. INVENTORY OF PUSH SCRIPTS

| Dataset                                | Push Script                                                                         | Target Mode                  |
| -------------------------------------- | ----------------------------------------------------------------------------------- | ---------------------------- |
| `players_v2` + `architect_basePlayers` | `player-scrape/firestore_staging/scripts/push_staged_players.ts`                    | Prod (with guardrails)       |
| `architect_baseTeams`                  | `team-scrape/shared/firestore_staging/scripts/push_staged_teams.ts`                 | Prod (with guardrails)       |
| `architect_baseEntitlements`           | `team-scrape/draft-picks/scripts/pst/pst_phase_10_push_base_entitlements.ts`        | Emulator or Prod (env-based) |
| BaseTeams entitlementIds               | `team-scrape/draft-picks/scripts/pst/pst_phase_10_patch_base_teams_entitlements.ts` | Emulator or Prod (env-based) |
| `architect_basePickRules`              | `team-scrape/draft-picks/scripts/pst/pst_phase_12_3a_push_base_pick_rules.ts`       | Emulator or Prod (env-based) |

---

## 9. EMULATOR-ONLY SCRIPTS (For Reference)

These scripts only run against the emulator and cannot write to prod:

| Script                                | Purpose                                  |
| ------------------------------------- | ---------------------------------------- |
| `scripts/emu/seedPlayersIfMissing.ts` | Seed players from artifacts if missing   |
| `scripts/emu/reseedBaseTeams.ts`      | Force-reseed baseTeams from artifacts    |
| `scripts/emu/reseedEntitlements.ts`   | Force-reseed entitlements from artifacts |
| `scripts/emu/repairTeams.ts`          | Repair team data in emulator             |

---

## 10. DOCUMENTATION CREATED

### 10.1 PROD_SYNC_RUNBOOK.md

Location: `docs/scouting/PROD_SYNC_RUNBOOK.md`

Contents:

- Architecture overview
- How emulator differs from prod
- Exact commands to regenerate artifacts
- Exact commands to push to prod
- How to verify prod matches emulator
- Common failure modes and fixes
- Quick reference command list

### 10.2 Master Doc Update

Location: `docs/scouting/SCOUTING_PLAYER_TABLE_MASTER_AUDIT.md`

Added Phase 2AF section with:

- Changes summary
- New npm scripts table
- Guardrail behaviors table
- Workflow summary

---

## 11. VALIDATION

### 11.1 Build Check

```bash
npm run build
# Expected: SUCCESS
```

### 11.2 Artifact Verification

```bash
npm run pipeline:sync:verify
# Expected: All artifacts pass verification
```

### 11.3 Sync Plan Output

```bash
npm run pipeline:sync:plan
# Expected: Prints staging commands, preflight checklist, prod push commands
```

### 11.4 Guardrail Test (Players)

```bash
# Without flag (should block)
npx tsx player-scrape/firestore_staging/scripts/push_staged_players.ts --all
# Expected: BLOCKED: MISSING --confirmProject FLAG

# With wrong flag (should block)
npx tsx player-scrape/firestore_staging/scripts/push_staged_players.ts --all --confirmProject=wrong
# Expected: BLOCKED: PROJECT ID MISMATCH
```

---

## 12. LINKS

- **Runbook**: [docs/scouting/PROD_SYNC_RUNBOOK.md](../docs/scouting/PROD_SYNC_RUNBOOK.md)
- **Master Doc**: [docs/scouting/SCOUTING_PLAYER_TABLE_MASTER_AUDIT.md](../docs/scouting/SCOUTING_PLAYER_TABLE_MASTER_AUDIT.md)
- **Sync Plan Script**: [scripts/release/scouting_prod_sync_plan.ts](../scripts/release/scouting_prod_sync_plan.ts)
- **Guardrails Module**: [scripts/release/prodGuardrails.ts](../scripts/release/prodGuardrails.ts)
