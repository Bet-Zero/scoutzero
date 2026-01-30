# PHASE 60 — Mutation Persistence Sanitization + No-Leak Guardrails — EXECUTION RETURN PACKAGE

**Phase:** 60  
**Type:** EXECUTION  
**Date:** 2026-01-30  
**Master Doc:** `docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md`

---

## Executive Summary

Phase 60 implemented surgical sanitization at the Firestore persistence boundary to ensure transient validation/context artifacts are **never** written to world documents. The mutation pipeline uses internal fields (e.g., `_validatedTradeContext`, `_signingValidation`) during compute/validation, but these are now stripped before `batch.set()` calls in `persistWorldMutation()`.

**Key Outcomes:**

- ✅ Persistence boundary identified and mapped (single function: `persistWorldMutation`)
- ✅ Explicit forbidden key list defined and frozen (`FORBIDDEN_TRANSIENT_KEYS`)
- ✅ Sanitization applied at persistence boundary (team, player, event writes)
- ✅ 17 guardrail tests added (unit, deep-scan, source-scan)
- ✅ 330 architect tests passing
- ✅ Build passing
- ✅ No regressions to Phase 50-59 functionality

---

## 1. Persistence Boundary Map

### 1.1 Authoritative Persistence Function

| Function                 | File                             | Role                                                      |
| ------------------------ | -------------------------------- | --------------------------------------------------------- |
| `persistWorldMutation()` | `mutationPipeline.js` L2318-2418 | **THE ONLY PLACE THAT WRITES TO FIRESTORE FOR MUTATIONS** |

### 1.2 Objects Written to Firestore

| Write Target     | Doc Ref Pattern                                                  | Source Object                              | Sanitized?                |
| ---------------- | ---------------------------------------------------------------- | ------------------------------------------ | ------------------------- |
| Team Snapshots   | `architect_worlds/{worldId}/teams/{teamCode}`                    | `computeResult.teamUpdates[].team`         | ✅ Phase 60               |
| Player Overrides | `architect_worlds/{worldId}/teams/{teamCode}/players/{playerId}` | `computeResult.playerUpdates[].player`     | ✅ Phase 60               |
| Event Log        | `architect_worlds/{worldId}/events/{eventId}`                    | `event` object (constructed inline)        | ✅ Phase 60               |
| World Metadata   | `architect_worlds/{worldId}/metadata`                            | `worldPatch` (server timestamp, team list) | N/A (no transient fields) |

### 1.3 computeResult Structure

The `computeResult` object returned by compute functions contains:

| Property                 | Written to Firestore?     | Contains Transient Fields?            |
| ------------------------ | ------------------------- | ------------------------------------- |
| `success`                | ❌ No                     | ❌ No                                 |
| `teamUpdates[]`          | ✅ Yes (team snapshots)   | Possible (via nested team objects)    |
| `playerUpdates[]`        | ✅ Yes (player overrides) | Possible (via nested player objects)  |
| `metadata`               | ✅ Yes (in event)         | ⚠️ Unlikely but sanitized defensively |
| `_validatedTradeContext` | ❌ No (stripped)          | ⚠️ **YES - TRANSIENT**                |
| `_signingValidation`     | ❌ No (stripped)          | ⚠️ **YES - TRANSIENT**                |

---

## 2. Forbidden Transient Keys (Final List)

```javascript
const FORBIDDEN_TRANSIENT_KEYS = Object.freeze([
  '_validatedTradeContext', // Pre-validated trade context for dedup (Phase 55/56)
  '_signingValidation', // Pre-validated signing result for S&T (Phase 48)
  '_isPostTradeSnapshot', // Sentinel flag for snapshot shape detection (Phase 58)
  '_isValidatedTradeContext', // Sentinel flag for validated context detection (Phase 56)
  '_rawValidation', // Raw validation result for debugging (Phase 56)
]);
```

### Keys Explicitly Preserved

| Key     | Reason                                                               |
| ------- | -------------------------------------------------------------------- |
| `_meta` | Used by UI for computed totals display (CapSheet.jsx L190, L438-441) |

---

## 3. Sanitization Approach

### 3.1 Sanitization Function

Added `sanitizeTransientFieldsForPersistence()` to `mutationPipeline.js`:

```javascript
function sanitizeTransientFieldsForPersistence(
  obj,
  forbiddenKeys = FORBIDDEN_TRANSIENT_KEYS
) {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) {
    return obj.map((item) =>
      sanitizeTransientFieldsForPersistence(item, forbiddenKeys)
    );
  }
  if (typeof obj === 'object') {
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
      if (forbiddenKeys.includes(key)) continue; // Skip forbidden keys
      result[key] = sanitizeTransientFieldsForPersistence(value, forbiddenKeys);
    }
    return result;
  }
  return obj; // Primitives pass through
}
```

### 3.2 Application Points in `persistWorldMutation()`

| Write           | Before (Phase 59)                             | After (Phase 60)                                                                     |
| --------------- | --------------------------------------------- | ------------------------------------------------------------------------------------ |
| Team snapshot   | `removeUndefinedDeep(team)`                   | `removeUndefinedDeep(sanitizeTransientFieldsForPersistence(team))`                   |
| Player override | `removeUndefinedDeep(player)`                 | `removeUndefinedDeep(sanitizeTransientFieldsForPersistence(player))`                 |
| Event metadata  | `removeUndefinedDeep(computeResult.metadata)` | `removeUndefinedDeep(sanitizeTransientFieldsForPersistence(computeResult.metadata))` |
| Event object    | `removeUndefinedDeep(event)`                  | `removeUndefinedDeep(sanitizeTransientFieldsForPersistence(event))`                  |

### 3.3 Export for Testing

```javascript
export { FORBIDDEN_TRANSIENT_KEYS, sanitizeTransientFieldsForPersistence };
```

---

## 4. Guardrail Tests

### 4.1 Test File

**Location:** `src/tests/architect/phase60_mutation_persist_no_internal_leaks_guardrail.test.js`

### 4.2 Test Categories

| Category               | Tests      | Description                                                                                                                                              |
| ---------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit Tests (sanitizer) | TEST 1-6   | Validates `sanitizeTransientFieldsForPersistence()` removes forbidden keys, handles nesting, preserves `_meta`, handles null/undefined/arrays/primitives |
| Deep-scan Helper       | TEST 7-9   | Validates `findForbiddenKeyPaths()` helper that reports exact paths of forbidden keys (e.g., `teams.BOS._validatedTradeContext`)                         |
| Integration Mock       | TEST 10-11 | Simulates executeTrade/signAndTrade compute results and verifies sanitization removes transient fields                                                   |
| Source-scan            | TEST 12-13 | Reads `mutationPipeline.js` source and verifies `sanitizeTransientFieldsForPersistence()` is called for team/player writes                               |
| Export Verification    | TEST 14-15 | Verifies `FORBIDDEN_TRANSIENT_KEYS` is exported, frozen, and contains expected keys                                                                      |
| Event Sanitization     | TEST 16-17 | Verifies event metadata and event object sanitization in source                                                                                          |

### 4.3 Deep-Scan Error Reporting

The `findForbiddenKeyPaths()` helper returns exact paths where forbidden keys are found:

```javascript
// Input:
const obj = {
  teamUpdates: [
    {
      team: { _isValidatedTradeContext: true, nested: { _rawValidation: {} } },
    },
  ],
};

// Output:
[
  'teamUpdates[0].team._isValidatedTradeContext',
  'teamUpdates[0].team.nested._rawValidation',
];
```

---

## 5. Test Outputs

### 5.1 Phase 60 Guardrail Tests

```
✓ src/tests/architect/phase60_mutation_persist_no_internal_leaks_guardrail.test.js (17)
  ✓ Phase 60: sanitizeTransientFieldsForPersistence unit tests (6)
  ✓ Phase 60: findForbiddenKeyPaths helper (3)
  ✓ Phase 60: executeTrade compute result sanitization (2)
  ✓ Phase 60: Source-scan guardrails for persistence boundary (4)
  ✓ Phase 60: Event metadata sanitization (2)

Test Files  1 passed (1)
Tests       17 passed (17)
```

### 5.2 Phase 59/57/56/55 Guardrails

```
✓ src/tests/architect/phase59_legacy_import_guardrail.test.js (13)
✓ src/tests/architect/phase57_forbid_validateTrade_in_compute_guardrail.test.js (18)
✓ src/tests/architect/phase56_pure_computeTradeResult_guardrails.test.js (7)
✓ src/tests/architect/phase55_trade_validation_separation_guardrails.test.js (5)

Test Files  4 passed (4)
Tests       43 passed (43)
```

### 5.3 Phase 50/53 Integration Tests

```
✓ src/tests/architect/phase50_executeTrade_integration_persistence.test.js (5)
✓ src/tests/architect/phase53_seasonAdvance_tpe_expiry_history_integration.test.js (17)

Test Files  2 passed (2)
Tests       22 passed (22)
```

### 5.4 Sign-and-Trade Tests

```
✓ src/tests/architect/signAndTrade.test.js (20)

Test Files  1 passed (1)
Tests       20 passed (20)
```

### 5.5 Full Architect Suite

```
Test Files  29 passed (29)
Tests       330 passed (330)
Duration    30.30s
```

### 5.6 Build Output

```
✓ built in 26.01s
dist/index.html                  0.60 kB │ gzip:   0.37 kB
dist/assets/index-d12bed25.css  75.75 kB │ gzip:  13.21 kB
dist/assets/index-bab372f7.js   2,000.53 kB │ gzip: 581.43 kB
```

---

## 6. Master Doc Changelog Snippet

Added to HISTORY section:

```markdown
- 2026-01-30: Phase 60 Mutation Persistence Sanitization + No-Leak Guardrails (EXECUTION) -
  Ensured transient compute/validation artifacts never persist to Firestore. (1) Added
  `FORBIDDEN_TRANSIENT_KEYS` constant and `sanitizeTransientFieldsForPersistence()` function
  to `mutationPipeline.js`. (2) Forbidden keys: `_validatedTradeContext`, `_signingValidation`,
  `_isPostTradeSnapshot`, `_isValidatedTradeContext`, `_rawValidation`. (3) `_meta` explicitly
  preserved (used by UI for computed totals display). (4) Applied sanitization in
  `persistWorldMutation()` for team, player, and event writes before `removeUndefinedDeep()`.
  (5) Added 17 guardrail tests in `phase60_mutation_persist_no_internal_leaks_guardrail.test.js`:
  unit tests for sanitizer, deep-scan tests for forbidden key detection, source-scan tests
  verifying sanitizer usage at persistence boundary. 330 architect tests passing. Return
  package: `docs/architect/return_packages/PHASE_60_MUTATION_PERSIST_SANITIZATION_NO_LEAK_GUARDRAILS_EXECUTION_RETURN_PACKAGE.md`.
```

Added new subsection under §8.1 Anti-Regression Guardrails:

```markdown
#### Phase 60 Persistence No-Leak Guardrails

- Forbidden transient keys table
- Sanitization enforcement table
- Guardrail tests summary
```

---

## 7. Risks / Follow-ups

### 7.1 Risks

| Risk                                  | Mitigation                                                                 | Status       |
| ------------------------------------- | -------------------------------------------------------------------------- | ------------ |
| Sanitizer removes field that UI needs | Explicit forbidden list (no broad underscore stripping), `_meta` preserved | ✅ Mitigated |
| Multiple persistence pathways         | Verified single write path (`persistWorldMutation`)                        | ✅ Mitigated |
| Future transient fields not sanitized | Source-scan guardrails will catch if sanitizer not called                  | ✅ Covered   |

### 7.2 Future Considerations

| Item                                             | Priority | Notes                                                                    |
| ------------------------------------------------ | -------- | ------------------------------------------------------------------------ |
| Centralize forbidden keys in tradeContext module | Low      | Currently in mutationPipeline.js; could move to shared constants         |
| Add runtime telemetry for stripped keys          | Low      | Could log count of stripped keys in dev mode for debugging               |
| Extend to non-trade mutations if needed          | Low      | Current mutations don't attach transient fields, but pattern is in place |

---

## Acceptance Criteria Checklist

| AC  | Description                                                                   | Status |
| --- | ----------------------------------------------------------------------------- | ------ |
| AC1 | Persistence boundary and written objects are clearly mapped in return package | ✅     |
| AC2 | Sanitization exists at persist boundary and is used for all mutation writes   | ✅     |
| AC3 | No-leak guardrail tests exist and pass (executeTrade + signAndTrade)          | ✅     |
| AC4 | Phase 50 / signAndTrade / Phase 53 tests pass unchanged                       | ✅     |
| AC5 | Full architect suite passes                                                   | ✅     |
| AC6 | Build passes                                                                  | ✅     |
| AC7 | Master Doc updated and return package written to required path                | ✅     |

---

## Files Modified

| File                                                                               | Changes                                                                                                      |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `src/features/architect/utils/mutationPipeline.js`                                 | Added `FORBIDDEN_TRANSIENT_KEYS`, `sanitizeTransientFieldsForPersistence()`, applied at persistence boundary |
| `src/tests/architect/phase60_mutation_persist_no_internal_leaks_guardrail.test.js` | New file: 17 guardrail tests                                                                                 |
| `docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md`                      | Added Phase 60 history entry + guardrails subsection                                                         |
