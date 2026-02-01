# PHASE 63 — Sign-and-Trade Test Restoration + Anti-Regression Guardrails — EXECUTION RETURN PACKAGE

**Date:** 2026-01-30  
**Mode:** EXECUTION  
**Scope:** Persistence contract allowlist completion for S&T mutations  
**Master Doc:** `docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md`

---

## 1. Summary

**What was done:**

Phase 63 restored the Architect test suite to a clean green baseline by fixing 6 failing sign-and-trade tests. The root cause was **Category C: State assembly regression** - the Phase 61 persistence contract allowlists were incomplete, missing legitimately persisted fields that the S&T mutation pathway writes.

**Fix approach:** Minimal, localized additions to the existing allowlists - no architectural changes.

---

## 2. Failing Tests (Before Fix)

All 6 failures were in `src/tests/architect/signAndTrade.test.js`:

| Test  | Name                                                    | Error                                                                                  |
| ----- | ------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| SAT1  | should successfully execute a sign and trade            | `PERSISTENCE CONTRACT VIOLATION: team.players, team.tradeExceptions`                   |
| SAT1  | should mark contract as Sign & Trade type               | `PERSISTENCE CONTRACT VIOLATION: team.players, team.tradeExceptions`                   |
| SAT9  | should update both teams atomically on success          | `PERSISTENCE CONTRACT VIOLATION: team.players, team.tradeExceptions`                   |
| SAT10 | should preserve warnings from signing validation        | `PERSISTENCE CONTRACT VIOLATION: event_metadata.sourceTeam, destinationTeam, contract` |
| SAT11 | should carry player data through to destination         | `PERSISTENCE CONTRACT VIOLATION: event_metadata.sourceTeam, destinationTeam, contract` |
| SAT15 | should document that receiving team becomes hard-capped | `PERSISTENCE CONTRACT VIOLATION: event_metadata.sourceTeam, destinationTeam, contract` |

---

## 3. Root Cause Analysis

**Category:** C (State assembly regression)

**Diagnosis:** The Phase 61 persistence contracts introduced allowlist-based validation at the persistence boundary. However, the allowlists were incomplete - they did not include:

1. **TEAM document fields:**
   - `players` - Array of full player objects (used extensively by mutation pipeline since Phase 47+)
   - `tradeExceptions` - Legacy TPE array (explicitly added in Phase 47 for TPE persistence)

2. **EVENT_METADATA fields:**
   - `sourceTeam` - Origin team code in S&T events
   - `destinationTeam` - Receiving team code in S&T events
   - `contract` - Signed contract details object

**Evidence:**

- Phase 47 return package explicitly states: "created TPEs now added to `team.tradeExceptions[]`"
- `team.players` is used on lines 750, 1390, 1409, 1410, 1412, 1558, etc. of `mutationPipeline.js`
- Phase 60 tests explicitly show `players: []` in test fixtures and expect it to pass sanitization

---

## 4. Files Modified

| File                                                                      | Change Type | Description                                 |
| ------------------------------------------------------------------------- | ----------- | ------------------------------------------- |
| `src/features/architect/utils/persistenceContracts/contracts.js`          | Modified    | Added missing fields to allowlists          |
| `src/tests/architect/phase63_signAndTrade_restoration_guardrails.test.js` | Created     | 13 guardrail tests                          |
| `docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md`             | Updated     | Phase 63 history entry + guardrails section |

### 4.1 contracts.js Changes

**TEAM_OVERLAY_TOP_LEVEL_ALLOWLIST additions:**

```javascript
'players', // Phase 63: Array of full player objects (used by mutation pipeline)
'tradeExceptions', // Phase 63: Legacy TPE array (Phase 47 persistence, parallel to exceptions.tpe)
```

**TEAM_DEEP_RULES addition:**

```javascript
tradeExceptions: TRADE_EXCEPTION_ITEM_ALLOWLIST, // Phase 63: Legacy TPE array (Phase 47)
```

**EVENT_METADATA_TOP_LEVEL_ALLOWLIST additions:**

```javascript
// Sign-and-Trade events (Phase 63)
'sourceTeam', // Origin team code
'destinationTeam', // Receiving team code
'contract', // Signed contract details object
```

---

## 5. Guardrails Added

**File:** `src/tests/architect/phase63_signAndTrade_restoration_guardrails.test.js`

| Test ID | Category               | What It Enforces                                                             |
| ------- | ---------------------- | ---------------------------------------------------------------------------- |
| 1-4     | Allowlist completeness | `players`, `tradeExceptions`, `roster`, `exceptions` on TEAM allowlist       |
| 5-7     | Allowlist completeness | `sourceTeam`, `destinationTeam`, `contract` on EVENT_METADATA allowlist      |
| 8-9     | Deep rules             | `tradeExceptions` and `exceptions.tpe` deep rules use same allowlist         |
| 10      | Validation order       | `validateSigning` called before `buildPostTradeTeamsSnapshot` in S&T path    |
| 11      | Short-circuit          | Signing validation failure check exists before trade validation              |
| 12      | Architecture pattern   | `executeTrade` case follows Phase 56 pattern (snapshot → validate → compute) |
| 13      | Architecture pattern   | `computeTradeResult` does not call `validateTrade` directly                  |

---

## 6. Acceptance Criteria Verification

| Criterion                                      | Status | Evidence                                                                 |
| ---------------------------------------------- | ------ | ------------------------------------------------------------------------ |
| AC1: signAndTrade.test.js passes (20 tests)    | ✅     | `Test Files  1 passed (1), Tests  20 passed (20)`                        |
| AC2: Full architect suite passes               | ✅     | `Test Files  32 passed (32), Tests  410 passed (410)`                    |
| AC3: Phase 63 guardrail file exists and passes | ✅     | `phase63_signAndTrade_restoration_guardrails.test.js` - 13 tests passing |
| AC4: Phase 56-62 guardrails still pass         | ✅     | All guardrail tests pass unchanged                                       |
| AC5: Build passes                              | ✅     | `✓ built in 26.42s`                                                      |
| AC6: Master Doc updated + return package       | ✅     | This document + history entry added                                      |

---

## 7. Command Outputs

### 7.1 signAndTrade.test.js (After Fix)

```
npm run test -- --run src/tests/architect/signAndTrade.test.js

 ✓ src/tests/architect/signAndTrade.test.js  (20 tests) 51ms
 Test Files  1 passed (1)
      Tests  20 passed (20)
```

### 7.2 Phase 63 Guardrails

```
npm run test -- --run src/tests/architect/phase63_signAndTrade_restoration_guardrails.test.js

 ✓ src/tests/architect/phase63_signAndTrade_restoration_guardrails.test.js  (13 tests) 18ms
 Test Files  1 passed (1)
      Tests  13 passed (13)
```

### 7.3 Phase 60-62 Guardrails (Unchanged)

```
npm run test -- --run src/tests/architect/phase60_mutation_persist_no_internal_leaks_guardrail.test.js \
  src/tests/architect/phase61_persistence_contract_allowlist_guardrails.test.js \
  src/tests/architect/phase62_persistence_contract_fixtures_deep_rules_guardrail.test.js

 ✓ phase62_persistence_contract_fixtures_deep_rules_guardrail.test.js  (33 tests)
 ✓ phase61_persistence_contract_allowlist_guardrails.test.js  (34 tests)
 ✓ phase60_mutation_persist_no_internal_leaks_guardrail.test.js  (17 tests)
 Test Files  3 passed (3)
      Tests  84 passed (84)
```

### 7.4 Phase 57/59 Guardrails (Unchanged)

```
npm run test -- --run src/tests/architect/phase59_legacy_import_guardrail.test.js \
  src/tests/architect/phase57_forbid_validateTrade_in_compute_guardrail.test.js

 ✓ phase57_forbid_validateTrade_in_compute_guardrail.test.js  (18 tests)
 ✓ phase59_legacy_import_guardrail.test.js  (13 tests)
 Test Files  2 passed (2)
      Tests  31 passed (31)
```

### 7.5 Full Architect Suite

```
npm run test -- --run src/tests/architect/

 Test Files  32 passed (32)
      Tests  410 passed (410)
```

### 7.6 Build

```
npm run build

✓ 2965 modules transformed
✓ built in 26.42s
```

---

## 8. Invariants Preserved

| Phase       | Invariant                                                            | Status       |
| ----------- | -------------------------------------------------------------------- | ------------ |
| Phase 48    | Signing validation before trade validation in S&T                    | ✅ Preserved |
| Phase 56-59 | Trade validation architecture: snapshot → validate → compute/persist | ✅ Preserved |
| Phase 60    | Transient keys never persist                                         | ✅ Preserved |
| Phase 61/62 | Persistence contract enforcement (test-on, prod-off)                 | ✅ Preserved |

---

## 9. Files in Diff

```
src/features/architect/utils/persistenceContracts/contracts.js
src/tests/architect/phase63_signAndTrade_restoration_guardrails.test.js
docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md
docs/architect/return_packages/PHASE_63_SIGN_AND_TRADE_TEST_RESTORATION_GUARDRAILS_EXECUTION_RETURN_PACKAGE.md
```

---

## 10. Future Considerations

1. **Consider consolidating `players` vs `roster`:** The current model has both `roster` (array of IDs) and `players` (array of full objects). A future phase could evaluate whether to unify these or maintain the split.

2. **Consider consolidating `tradeExceptions` vs `exceptions.tpe`:** Phase 47 added `tradeExceptions[]` at the top level, parallel to `exceptions.tpe[]`. A future phase could migrate to a single canonical location.

Neither of these is blocking - the current model works correctly. These are schema hygiene considerations for a future cleanup phase.
