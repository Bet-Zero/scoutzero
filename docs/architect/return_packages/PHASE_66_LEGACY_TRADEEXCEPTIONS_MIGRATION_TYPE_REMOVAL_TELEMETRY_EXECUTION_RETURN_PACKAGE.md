# PHASE 66 — Legacy tradeExceptions Migration + Type Removal + Telemetry — EXECUTION RETURN PACKAGE

**Date:** 2026-01-31  
**Phase:** 66  
**Mode:** EXECUTION  
**Master Doc:** docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md

---

## SUMMARY

Phase 66 completes TPE canonicalization (started in Phases 64-65) by:

1. Creating a migration script to remove legacy `tradeExceptions` from persisted Firestore team docs
2. Adding dev-only telemetry to detect legacy fallback reads during rollout
3. Updating internal compute types with deprecation comments
4. Adding 17 new guardrail tests

**Result:** All 471 architect tests pass. Build passes. Migration tooling ready.

---

## ACCEPTANCE CRITERIA OUTCOMES

| AC  | Requirement                                                   | Status | Notes                                                                        |
| --- | ------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------- |
| AC1 | Migration script exists, supports dry-run, is idempotent      | ✅     | `scripts/migrations/phase66_migrate_tradeExceptions.js` created              |
| AC2 | Canonical team schema/type no longer contains tradeExceptions | ✅     | Zod schema already clean; `NormalizedTeam` marked deprecated                 |
| AC3 | New Phase 66 guardrail tests exist and pass                   | ✅     | 17 tests in `phase66_no_legacy_tradeExceptions_persisted_guardrails.test.js` |
| AC4 | Phase 64 + Phase 65 guardrails pass unchanged                 | ✅     | 26 + 18 tests pass                                                           |
| AC5 | Full architect suite passes green                             | ✅     | 471 tests pass                                                               |
| AC6 | Build passes                                                  | ✅     | Production build successful                                                  |
| AC7 | Master doc + contracts doc updated + return package written   | ✅     | This document                                                                |

---

## STOP CONDITIONS OUTCOMES

| Condition | Description                                            | Status  |
| --------- | ------------------------------------------------------ | ------- |
| STOP-1    | Multiple incompatible legacy shapes                    | NOT HIT |
| STOP-2    | Migration requires touching non-team docs              | NOT HIT |
| STOP-3    | Removing tradeExceptions from types breaks major flows | NOT HIT |

**No stop conditions were triggered.**

---

## FILES CHANGED

### New Files Created

| File                                                                                 | Purpose                               |
| ------------------------------------------------------------------------------------ | ------------------------------------- |
| `scripts/migrations/phase66_migrate_tradeExceptions.js`                              | Migration script with dry-run support |
| `src/tests/architect/phase66_no_legacy_tradeExceptions_persisted_guardrails.test.js` | Phase 66 guardrail tests (17 tests)   |

### Files Modified

| File                                                                     | Change                                                        |
| ------------------------------------------------------------------------ | ------------------------------------------------------------- |
| `src/features/architect/utils/persistenceContracts/normalizeTeamTpe.js`  | Added telemetry (counter + console.warn on fallback)          |
| `src/features/architect/utils/tradeMachine/utils/normalizeTradeInput.js` | Use `getTeamTpeList(raw)` instead of `raw.tradeExceptions`    |
| `src/features/architect/utils/tradeMachine/constants/types.ts`           | Added deprecation comment to `NormalizedTeam.tradeExceptions` |
| `docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md`            | Added Phase 66 HISTORY entry                                  |
| `docs/architect/contracts/PERSISTENCE_CONTRACTS.md`                      | Added Phase 66 section + telemetry flag documentation         |

---

## MIGRATION SCRIPT DETAILS

### Location

`scripts/migrations/phase66_migrate_tradeExceptions.js`

### Features

- **DRY_RUN mode:** Enabled by default (`DRY_RUN=true`) for safety
- **WorldId targeting:** `--worldId=<WORLD_ID>` for targeted migration
- **All worlds scan:** Run without `--worldId` to scan all worlds
- **Idempotent:** Safe to re-run (uses `normalizeTeamTpeSchema()`)
- **Reports:** Generates JSON + markdown reports in `docs/architect/migrations/`

### Usage Examples

```bash
# Dry run on all worlds
DRY_RUN=true node scripts/migrations/phase66_migrate_tradeExceptions.js

# Dry run on specific world
DRY_RUN=true node scripts/migrations/phase66_migrate_tradeExceptions.js --worldId=abc123

# Live migration on specific world
DRY_RUN=false node scripts/migrations/phase66_migrate_tradeExceptions.js --worldId=abc123
```

### Report Output

- **JSON:** `docs/architect/migrations/phase66_migration_report_<timestamp>.json`
- **Markdown:** `docs/architect/migrations/phase66_migration_report_<timestamp>.md`

---

## TELEMETRY DETAILS

### Location

`src/features/architect/utils/persistenceContracts/normalizeTeamTpe.js`

### Exports Added

| Export                              | Purpose                            |
| ----------------------------------- | ---------------------------------- |
| `getLegacyTpeFallbackCount()`       | Get current fallback counter value |
| `resetLegacyTpeFallbackTelemetry()` | Reset counter (for testing)        |

### Behavior

- **In development:** Logs console warning when `getTeamTpeList()` falls back to legacy location
- **In production:** Telemetry disabled by default
- **Rate limiting:** Max 1 warning per 5 seconds to avoid console spam
- **Environment variables:**
  - `LOG_LEGACY_TPE_FALLBACK=true` — Force enable telemetry
  - `LOG_LEGACY_TPE_FALLBACK=false` — Force disable telemetry

### Removal Plan

Telemetry is intended to be removed in Phase 67/68 once migration is confirmed complete across all worlds.

---

## GUARDRAILS SUMMARY

### Phase 66 Guardrail Tests (17 tests)

| Test Group                                     | Count | Description                                      |
| ---------------------------------------------- | ----- | ------------------------------------------------ |
| Zod Schema Canonical Shape                     | 2     | Verify `architect.ts` excludes `tradeExceptions` |
| Persistence Contracts Normalization            | 3     | Verify `normalizeTeamTpeSchema()` behavior       |
| Legacy Fallback Telemetry                      | 4     | Verify telemetry fires on fallback only          |
| Persistence Allowlists Exclude tradeExceptions | 2     | Verify allowlist exclusion                       |
| normalizeTradeInput Uses getTeamTpeList        | 2     | Verify canonical accessor usage                  |
| Persisted Team Fixture Shape                   | 2     | Verify fixture keyset correctness                |
| Migration Script Exists                        | 2     | Verify script exists and contains expected logic |

---

## TEST OUTPUTS

### Phase 66 Guardrails

```
✓ src/tests/architect/phase66_no_legacy_tradeExceptions_persisted_guardrails.test.js (17)
  ✓ Phase 66 Guardrail: Zod Schema Canonical Shape (2)
  ✓ Phase 66 Guardrail: Persistence Contracts Normalization (3)
  ✓ Phase 66 Guardrail: Legacy Fallback Telemetry (4)
  ✓ Phase 66 Guardrail: Persistence Allowlists Exclude tradeExceptions (2)
  ✓ Phase 66 Guardrail: normalizeTradeInput Uses getTeamTpeList (2)
  ✓ Phase 66 Guardrail: Persisted Team Fixture Shape (2)
  ✓ Phase 66 Guardrail: Migration Script Exists (2)

Test Files  1 passed (1)
Tests  17 passed (17)
```

### Phase 64 Guardrails

```
✓ src/tests/architect/phase64_tpe_canonicalization_no_legacy_persist_guardrails.test.js (26)
  ✓ Phase 64: normalizeTeamTpeSchema() unit tests (6)
  ✓ Phase 64: TPE deduplication tests (4)
  ✓ Phase 64: getTeamTpeList() read helper (5)
  ✓ Phase 64: Source-scan guardrails for mutation pipeline (3)
  ✓ Phase 64: Contract guardrails (no legacy persist) (4)
  ✓ Phase 64: getTpeIdentityKey() unit tests (4)

Test Files  1 passed (1)
Tests  26 passed (26)
```

### Phase 65 Guardrails

```
✓ src/tests/architect/phase65_forbid_direct_tradeExceptions_reads_guardrail.test.js (18)
  ✓ Phase 65: Forbid Direct .tradeExceptions Reads in Production Code (4)
  ✓ Phase 65: getTeamTpeList() Canonical Accessor (5)
  ✓ Phase 65: seasonManager TPE Normalization at Persistence (2)
  ✓ Phase 65: UI Components Use Canonical Accessor (4)
  ✓ Phase 65: Validation Rules Use Canonical Accessor (3)

Test Files  1 passed (1)
Tests  18 passed (18)
```

### signAndTrade Tests

```
✓ src/tests/architect/signAndTrade.test.js (20)
  ✓ Sign and Trade Mutation (20)
    ✓ SAT1: Success Path (2)
    ✓ SAT2-4: Missing Input Validation (3)
    ✓ SAT5-6: Signing/Trade Validation Failure (4)
    ✓ SAT7-9: Constraints (3)
    ✓ SAT10-13: Data Integrity (4)
    ✓ SAT14-15: Validation Order (3)

Test Files  1 passed (1)
Tests  20 passed (20)
```

### Phase 50 + Phase 53 Integration Tests

```
✓ src/tests/architect/phase50_executeTrade_integration_persistence.test.js (5)
✓ src/tests/architect/phase53_seasonAdvance_tpe_expiry_history_integration.test.js (17)

Test Files  2 passed (2)
Tests  22 passed (22)
```

### Phase 60-63 Guardrails

```
✓ src/tests/architect/phase60_mutation_persist_no_internal_leaks_guardrail.test.js (17)
✓ src/tests/architect/phase61_persistence_contract_allowlist_guardrails.test.js (34)
✓ src/tests/architect/phase62_persistence_contract_fixtures_deep_rules_guardrail.test.js (33)
✓ src/tests/architect/phase63_signAndTrade_restoration_guardrails.test.js (13)

Test Files  4 passed (4)
Tests  97 passed (97)
```

### Full Architect Suite

```
Test Files  35 passed (35)
Tests  471 passed (471)
```

### Build

```
✓ built in 32.19s
dist/index.html                  0.60 kB │ gzip:   0.37 kB
dist/assets/index-2ea50c22.css  75.86 kB │ gzip:  13.24 kB
dist/assets/index-f7f0b449.js   2,017.01 kB │ gzip: 586.70 kB
```

---

## NOTES

1. **Telemetry observation:** During test runs, telemetry correctly fired when tests triggered legacy fallback paths:

   ```
   [Phase66 Telemetry] Legacy TPE fallback used for team "BOS". Total fallbacks: 1. Consider running migration script.
   ```

2. **Migration not yet executed:** The migration script is ready but has not been run against production/emulator worlds yet. Recommend running in DRY_RUN mode first to assess scope.

3. **Type change is documentation-only:** The `NormalizedTeam` interface retains `tradeExceptions` field for internal compute compatibility, but is now marked with `@deprecated` JSDoc comment clarifying it's not the persisted shape.

4. **Zod schema already correct:** `src/schemas/architect.ts` already uses `exceptions.tpe[]` as the only canonical TPE location - no changes were needed.

---

## NEXT STEPS (Phase 67/68)

1. **Execute migration:** Run migration script against all worlds (after dry-run verification)
2. **Monitor telemetry:** Watch for legacy fallback warnings in development
3. **Remove telemetry:** Once migration is confirmed complete, remove telemetry code
4. **Clean up types:** Consider renaming `tradeExceptions` to `tpeList` in `NormalizedTeam` for clarity

---

**Phase 66 complete.**
