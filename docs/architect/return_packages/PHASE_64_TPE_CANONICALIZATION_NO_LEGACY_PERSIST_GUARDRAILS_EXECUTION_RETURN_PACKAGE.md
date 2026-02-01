# Phase 64: TPE Schema Canonicalization + No-Legacy-Persist Guardrails - Execution Return Package

**Date:** 2026-01-30  
**Type:** EXECUTION  
**Status:** ✅ COMPLETE

---

## Summary

Phase 64 removes the dual-schema ambiguity for Trade Player Exceptions (TPEs) by establishing `team.exceptions.tpe[]` as the **only canonical persisted location**. Legacy `team.tradeExceptions[]` is now:

- Supported for backward-compatible READS (old worlds)
- FORBIDDEN for persistence (normalized away before contract validation)

---

## Task 1: Usage Audit Table

| File                                                             | Field             | Classification    | Notes                                            |
| ---------------------------------------------------------------- | ----------------- | ----------------- | ------------------------------------------------ |
| `src/features/architect/utils/persistenceContracts/contracts.js` | `tradeExceptions` | ~~Write~~ REMOVED | Phase 64: Removed from allowlist                 |
| `src/features/architect/utils/persistenceContracts/contracts.js` | `exceptions.tpe`  | Write             | Canonical TPE path                               |
| `src/features/architect/utils/mutationPipeline.js`               | `tradeExceptions` | Write             | Multiple: TPE assembly in `computeTradeResult()` |
| `src/features/architect/utils/seasonManager.js`                  | `tradeExceptions` | Write             | Season advance TPE updates                       |
| `src/features/architect/utils/firebaseTeamPlanHelpers.js`        | `tradeExceptions` | Read              | Loading team data                                |
| `src/features/architect/tradeMachine/*.jsx`                      | `tradeExceptions` | Read (UI)         | Multiple UI components                           |
| `src/features/architect/hooks/useTradeMachine.js`                | `tradeExceptions` | Read              | Hook reads for UI                                |
| `src/features/architect/utils/buildRuleContext.ts`               | `tradeExceptions` | Read              | Rule context building                            |
| `src/features/architect/utils/tradeMachine/rules/*.js`           | `tradeExceptions` | Read              | Validation rules                                 |
| `src/features/architect/utils/schemaAdapter.js`                  | `tradeExceptions` | Read              | Schema adaptation                                |
| `src/tests/architect/phase50_*.test.js`                          | `tradeExceptions` | Test Fixture      | Integration tests                                |
| `src/tests/architect/phase51_*.test.js`                          | `tradeExceptions` | Test Fixture      | Season advance tests                             |
| `src/tests/architect/phase53_*.test.js`                          | `tradeExceptions` | Test Fixture      | TPE expiry tests                                 |
| `src/tests/architect/signAndTrade.test.js`                       | `tradeExceptions` | Test Fixture      | S&T tests                                        |
| `src/tests/architect/phase63_*.test.js`                          | `tradeExceptions` | Test Expectation  | Updated in Phase 64                              |

**Total References:**

- `tradeExceptions`: ~100+ occurrences
- `exceptions.tpe`: ~60+ occurrences

**Classification Summary:**

- Read (UI/logic): Most UI components and validation rules
- Write (mutation): `mutationPipeline.js`, `seasonManager.js` (normalized at persist boundary)
- Test fixtures: Many test files use fixtures with `tradeExceptions`
- Docs: Return packages and master doc

---

## Task 2: Canonical Interface Implementation

### New Files

**`src/features/architect/utils/persistenceContracts/normalizeTeamTpe.js`**

Created normalization helpers:

```javascript
// Normalize TPE schema for persistence
// 1) Merge legacy tradeExceptions into exceptions.tpe
// 2) Deduplicate by id (canonical wins)
// 3) Remove tradeExceptions field
export function normalizeTeamTpeSchema(team) { ... }

// Read helper with backward-compatible fallback
// Returns exceptions.tpe if available, else tradeExceptions
export function getTeamTpeList(team) { ... }

// Identity key for deduplication
// Uses TPE id if present, else deterministic signature
export function getTpeIdentityKey(tpe) { ... }
```

**Deduplication Strategy:**

- Primary key: TPE `id` field (format: `id:{tpeId}`)
- Fallback: Deterministic signature from stable fields (`sig:totalAmount:...|createdFrom:...`)
- Canonical (`exceptions.tpe`) wins over legacy (`tradeExceptions`) when same key

### Updated Index

**`src/features/architect/utils/persistenceContracts/index.js`**

Added exports:

```javascript
export {
  normalizeTeamTpeSchema,
  getTeamTpeList,
  getTpeIdentityKey,
} from './normalizeTeamTpe.js';
```

---

## Task 3: Mutation Pipeline Update

**`src/features/architect/utils/mutationPipeline.js`**

Updated `persistWorldMutation()` team write section:

**Before (Phase 60/61):**

```
sanitize → validate contract → removeUndefined → write
```

**After (Phase 64):**

```
sanitize → normalize TPE → validate contract → removeUndefined → write
```

Key changes:

- Added import: `normalizeTeamTpeSchema` from persistenceContracts
- Added normalization step after sanitization, before contract validation
- `assertPersistableOrThrow()` now receives `afterTpeNormalize` instead of `afterSanitize`

---

## Task 4: Persistence Contract Updates

**`src/features/architect/utils/persistenceContracts/contracts.js`**

### Removed from `TEAM_OVERLAY_TOP_LEVEL_ALLOWLIST`

```javascript
// Phase 64: 'tradeExceptions' REMOVED from allowlist. Legacy TPE data is now normalized
// into exceptions.tpe[] via normalizeTeamTpeSchema() before persistence. See Phase 64 docs.
```

### Removed from `TEAM_DEEP_RULES`

```javascript
// Phase 64: ONLY exceptions.tpe is canonical. tradeExceptions is legacy read-only.
// Legacy tradeExceptions is normalized into exceptions.tpe via normalizeTeamTpeSchema()
// before persistence, so no deep rule is needed for tradeExceptions.
```

### Preserved

- `exceptions` in top-level allowlist (parent object)
- `exceptions.tpe` in deep rules (canonical TPE path)

---

## Task 5: Phase 64 Guardrail Tests

**`src/tests/architect/phase64_tpe_canonicalization_no_legacy_persist_guardrails.test.js`**

26 tests across 6 categories:

| Category                              | Tests | Description                                                   |
| ------------------------------------- | ----- | ------------------------------------------------------------- |
| `normalizeTeamTpeSchema()` unit tests | 6     | Merge, cleanup, immutability                                  |
| TPE deduplication tests               | 4     | By-id, merge unique, deterministic order, signature fallback  |
| `getTeamTpeList()` read helper        | 5     | Canonical preference, legacy fallback, null handling          |
| Source-scan guardrails                | 3     | Normalization ordering, import verification                   |
| Contract guardrails                   | 4     | Allowlist exclusion, deep rule exclusion, canonical inclusion |
| `getTpeIdentityKey()` unit tests      | 4     | Key generation and determinism                                |

### Phase 63 Test Updates

**`src/tests/architect/phase63_signAndTrade_restoration_guardrails.test.js`**

Updated 2 tests to reflect Phase 64 changes:

- `includes "tradeExceptions"` → `does NOT include "tradeExceptions" (Phase 64: canonicalized)`
- `has deep rule for tradeExceptions` → `does NOT have deep rule for tradeExceptions (Phase 64: canonicalized)`

---

## Task 6: Regression Test Results

### Individual Test Suites

| Suite                                                                | Tests | Status  |
| -------------------------------------------------------------------- | ----- | ------- |
| `phase64_tpe_canonicalization_no_legacy_persist_guardrails.test.js`  | 26    | ✅ PASS |
| `signAndTrade.test.js`                                               | 20    | ✅ PASS |
| `phase50_executeTrade_integration_persistence.test.js`               | 5     | ✅ PASS |
| `phase53_seasonAdvance_tpe_expiry_history_integration.test.js`       | 17    | ✅ PASS |
| `phase60_mutation_persist_no_internal_leaks_guardrail.test.js`       | 17    | ✅ PASS |
| `phase61_persistence_contract_allowlist_guardrails.test.js`          | 34    | ✅ PASS |
| `phase62_persistence_contract_fixtures_deep_rules_guardrail.test.js` | 33    | ✅ PASS |
| `phase63_signAndTrade_restoration_guardrails.test.js`                | 13    | ✅ PASS |

### Full Architect Suite

```
Test Files  33 passed (33)
     Tests  436 passed (436)
  Duration  39.29s
```

### Build

```
✓ built in 28.53s
```

---

## What Changed (Diff Summary)

### New Files

- `src/features/architect/utils/persistenceContracts/normalizeTeamTpe.js`
- `src/tests/architect/phase64_tpe_canonicalization_no_legacy_persist_guardrails.test.js`

### Modified Files

- `src/features/architect/utils/persistenceContracts/contracts.js` - Removed `tradeExceptions` from allowlists
- `src/features/architect/utils/persistenceContracts/index.js` - Added new exports
- `src/features/architect/utils/mutationPipeline.js` - Added normalization step
- `src/tests/architect/phase63_signAndTrade_restoration_guardrails.test.js` - Updated expectations

### Documentation Updated

- `docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md` - Phase 64 history entry
- `docs/architect/contracts/PERSISTENCE_CONTRACTS.md` - Canonical TPE path section

---

## Guardrails Added

| Guardrail                                                     | Enforces                         |
| ------------------------------------------------------------- | -------------------------------- |
| `normalizeTeamTpeSchema()` merges legacy → canonical          | Legacy data is not lost          |
| `normalizeTeamTpeSchema()` removes `tradeExceptions`          | Legacy field never persists      |
| Deduplication is deterministic                                | No random order variations       |
| `TEAM_OVERLAY_TOP_LEVEL_ALLOWLIST` excludes `tradeExceptions` | Contract rejects legacy field    |
| `TEAM_DEEP_RULES` excludes `tradeExceptions`                  | No deep validation of legacy     |
| Source-scan: normalization before contract validation         | Correct ordering enforced        |
| `getTeamTpeList()` falls back to legacy                       | Backward compatibility preserved |

---

## Acceptance Criteria Status

| AC  | Requirement                                                                   | Status                         |
| --- | ----------------------------------------------------------------------------- | ------------------------------ |
| AC1 | TEAM docs written by `persistWorldMutation()` never contain `tradeExceptions` | ✅ Normalization removes it    |
| AC2 | `exceptions.tpe[]` is the only persisted TPE location                         | ✅ Allowlist enforces this     |
| AC3 | Backward compatibility: old worlds with `tradeExceptions` still work          | ✅ `getTeamTpeList()` fallback |
| AC4 | New Phase 64 guardrail test file exists and passes                            | ✅ 26 tests passing            |
| AC5 | All specified test suites pass                                                | ✅ See Task 6 results          |
| AC6 | Build passes                                                                  | ✅ Built in 28.53s             |
| AC7 | Master doc + contracts doc updated + return package written                   | ✅ This document               |

---

## Command Outputs

### Phase 64 Tests

```
npm run test -- --run src/tests/architect/phase64_tpe_canonicalization_no_legacy_persist_guardrails.test.js

Test Files  1 passed (1)
     Tests  26 passed (26)
  Duration  5.20s
```

### Full Architect Suite

```
npm run test -- --run src/tests/architect/

Test Files  33 passed (33)
     Tests  436 passed (436)
  Duration  39.29s
```

### Build

```
npm run build

✓ built in 28.53s
```

---

## Future Considerations

1. **UI Components:** Many UI files still read `team.tradeExceptions` directly. Consider updating to use `getTeamTpeList()` for consistency (non-blocking, works with normalized data).

2. **Mutation Logic:** `mutationPipeline.js` and `seasonManager.js` still write to `team.tradeExceptions` internally. This is fine because normalization at the persist boundary converts it to canonical form.

3. **Test Fixtures:** Many test files use `tradeExceptions` in fixtures. These work correctly because normalization handles them at persist time.

---

## Files Changed Summary

```
Created:
  src/features/architect/utils/persistenceContracts/normalizeTeamTpe.js
  src/tests/architect/phase64_tpe_canonicalization_no_legacy_persist_guardrails.test.js
  docs/architect/return_packages/PHASE_64_TPE_CANONICALIZATION_NO_LEGACY_PERSIST_GUARDRAILS_EXECUTION_RETURN_PACKAGE.md

Modified:
  src/features/architect/utils/persistenceContracts/contracts.js
  src/features/architect/utils/persistenceContracts/index.js
  src/features/architect/utils/mutationPipeline.js
  src/tests/architect/phase63_signAndTrade_restoration_guardrails.test.js
  docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md
  docs/architect/contracts/PERSISTENCE_CONTRACTS.md
```
