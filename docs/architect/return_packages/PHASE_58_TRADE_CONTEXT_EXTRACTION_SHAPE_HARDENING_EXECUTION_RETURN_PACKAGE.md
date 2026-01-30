# PHASE 58 — Trade Context Extraction + Shape Hardening — EXECUTION RETURN PACKAGE

**Date:** 2026-01-30  
**Mode:** EXECUTION  
**Master Doc:** `docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md`

---

## 1. Summary

Phase 58 extracted the Phase 56/57 trade snapshot and validation context helpers from `mutationPipeline.js` into a dedicated `tradeContext/` module. This refactoring:

1. **Improves maintainability** - Smaller, focused files with single responsibility
2. **Enforces shape guarantees** - Canonical JSDoc typedefs + runtime assertions
3. **Clarifies module boundaries** - Clear separation between snapshot building, validation, and computation
4. **Strengthens guardrails** - Extended Phase 57 tests to cover new file paths with allowlist approach

**What Moved:**

- `buildPostTradeTeamsSnapshot()` → `tradeContext/tradeContext.js`
- `validatePostTradeSnapshotForContext()` → `tradeContext/tradeContext.js`
- `validateTradeForContext()` → `tradeContext/tradeContext.js` (deprecated wrapper)
- `calculateTeamTotals()` → copied to `tradeContext/tradeContext.js` (internal helper)

---

## 2. Files Changed

### New Files Created

| File                                                        | Purpose                                |
| ----------------------------------------------------------- | -------------------------------------- |
| `src/features/architect/utils/tradeContext/index.js`        | Public API re-exports                  |
| `src/features/architect/utils/tradeContext/tradeContext.js` | Snapshot + validation context builders |
| `src/features/architect/utils/tradeContext/assertions.js`   | Runtime shape assertions               |
| `src/features/architect/utils/tradeContext/types.js`        | Canonical JSDoc typedefs               |

### Files Modified

| File                                                                            | Changes                                                                                                                                                                                                                                                                                                     |
| ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/features/architect/utils/mutationPipeline.js`                              | - Removed Phase 56 inline functions<br>- Added imports from tradeContext module<br>- Re-exports for backward compatibility<br>- Updated `computeTradeResult()` to use `assertTradeComputeInputs()`<br>- Marked `validateTradeForPipeline()` as `@deprecated`<br>- Updated file header with Phase 58 history |
| `src/tests/architect/phase57_forbid_validateTrade_in_compute_guardrail.test.js` | - Updated header for Phase 58<br>- Test 3 now checks tradeContext module<br>- Added Tests 8-12 for tradeContext module guardrails                                                                                                                                                                           |
| `docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md`                   | - Added Phase 58 entry to history<br>- Added new Phase 58 section with module structure, canonical shapes, architecture diagram                                                                                                                                                                             |

---

## 3. New Module API Surface

### Exports from `tradeContext/index.js`

```javascript
// Snapshot + validation context builders
export { buildPostTradeTeamsSnapshot } from './tradeContext';
export { validatePostTradeSnapshotForContext } from './tradeContext';
export { validateTradeForContext } from './tradeContext'; // @deprecated

// Runtime shape assertions
export { assertPostTradeSnapshot } from './assertions';
export { assertValidatedTradeContext } from './assertions';
export { assertTradeComputeInputs } from './assertions';
```

### Re-exports from `mutationPipeline.js` (Backward Compatibility)

```javascript
export {
  buildPostTradeTeamsSnapshot,
  validatePostTradeSnapshotForContext,
  validateTradeForContext,
};
```

---

## 4. Canonical Typedefs + Assertion Usage Points

### Canonical Shapes (in `types.js`)

| Typedef                 | Sentinel Flag                    | Required Fields                                        |
| ----------------------- | -------------------------------- | ------------------------------------------------------ |
| `PostTradeSnapshot`     | `_isPostTradeSnapshot: true`     | `teamUpdates[]`, `validationTeams[]`, `payloadTeams[]` |
| `ValidatedTradeContext` | `_isValidatedTradeContext: true` | `legal`, `teamResults[]`, `validationTeams[]`          |

### Runtime Assertions (in `assertions.js`)

| Function                        | Call Site                               | Purpose                             |
| ------------------------------- | --------------------------------------- | ----------------------------------- |
| `assertPostTradeSnapshot()`     | `validatePostTradeSnapshotForContext()` | Validate snapshot before validation |
| `assertValidatedTradeContext()` | Part of `assertTradeComputeInputs()`    | Validate context has sentinel       |
| `assertTradeComputeInputs()`    | `computeTradeResult()` entry            | Combined assertion for both shapes  |

### Error Message Format

```
[Phase 58 invariant violated at {callSite}] {Description}
```

---

## 5. Guardrail Changes

### Enforcement Rules

| Rule                       | Scope                                      | Enforcement         |
| -------------------------- | ------------------------------------------ | ------------------- |
| `validateTrade(` forbidden | `computeTradeResult` function              | Source scan + regex |
| `validateTrade(` forbidden | `persistWorldMutation` function            | Source scan + regex |
| `validateTrade(` forbidden | `buildPostTradeTeamsSnapshot` function     | Source scan + regex |
| `validateTrade(` forbidden | `assertions.js`                            | Source scan + regex |
| `validateTrade(` ALLOWED   | `validatePostTradeSnapshotForContext` ONLY | Allowlist check     |

### New Tests Added (Tests 8-12)

| Test    | Coverage                                                                 |
| ------- | ------------------------------------------------------------------------ |
| Test 8  | tradeContext module structure (exports exist)                            |
| Test 9  | validateTrade allowlist enforcement (only 1 call in designated function) |
| Test 10 | assertions.js purity (no validateTrade calls)                            |
| Test 11 | mutationPipeline imports from tradeContext module                        |
| Test 12 | computeTradeResult uses shared assertions                                |

---

## 6. Required Test Outputs

### 6.1 Phase 57 Guardrail Test

```
npm run test -- --run src/tests/architect/phase57_forbid_validateTrade_in_compute_guardrail.test.js

 ✓ src/tests/architect/phase57_forbid_validateTrade_in_compute_guardrail.test.js (17)
   ✓ Phase 57: Forbid validateTrade in Compute/Persist Modules (17)
     ✓ Test 1-7: Original Phase 57 tests (7)
     ✓ Test 8: tradeContext module exists and has expected structure (3)
     ✓ Test 9: validateTrade ONLY allowed in validatePostTradeSnapshotForContext (1)
     ✓ Test 10: assertions module is pure (1)
     ✓ Test 11: mutationPipeline imports from tradeContext module (2)
     ✓ Test 12: computeTradeResult uses shared assertions (1)

 Test Files  1 passed (1)
      Tests  17 passed (17)
```

### 6.2 Phase 56 Guardrail Test

```
npm run test -- --run src/tests/architect/phase56_pure_computeTradeResult_guardrails.test.js

 ✓ src/tests/architect/phase56_pure_computeTradeResult_guardrails.test.js (7)
   ✓ Phase 56: Pure computeTradeResult Guardrails (7)

 Test Files  1 passed (1)
      Tests  7 passed (7)
```

### 6.3 signAndTrade Test

```
npm run test -- --run src/tests/architect/signAndTrade.test.js

 ✓ src/tests/architect/signAndTrade.test.js (20 tests)

 Test Files  1 passed (1)
      Tests  20 passed (20)
```

### 6.4 Phase 50 Integration Test

```
npm run test -- --run src/tests/architect/phase50_executeTrade_integration_persistence.test.js

 ✓ src/tests/architect/phase50_executeTrade_integration_persistence.test.js (5 tests)

 Test Files  1 passed (1)
      Tests  5 passed (5)
```

### 6.5 Phase 53 Integration Test

```
npm run test -- --run src/tests/architect/phase53_seasonAdvance_tpe_expiry_history_integration.test.js

 ✓ src/tests/architect/phase53_seasonAdvance_tpe_expiry_history_integration.test.js (17 tests)

 Test Files  1 passed (1)
      Tests  17 passed (17)
```

### 6.6 Full Architect Suite

```
npm run test -- --run src/tests/architect/

 Test Files  27 passed (27)
      Tests  299 passed (299)
   Duration  24.44s
```

### 6.7 Build

```
npm run build

✓ 2956 modules transformed.
✓ built in 33.46s
```

---

## 7. Master Doc Changelog Snippet

Added to `docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md`:

**History Entry:**

```
- 2026-01-30: Phase 58 Trade Context Extraction + Shape Hardening (EXECUTION) -
  Extracted Phase 56/57 trade snapshot/context helpers to dedicated module for maintainability.
  (1) Created src/features/architect/utils/tradeContext/ module with: tradeContext.js,
  assertions.js, types.js, index.js. (2) Defined canonical shapes: PostTradeSnapshot,
  ValidatedTradeContext with sentinel flags. (3) Added runtime assertions used in
  computeTradeResult(). (4) Updated Phase 57 guardrail tests with allowlist enforcement.
  (5) Marked validateTradeForPipeline() as @deprecated. Return package:
  docs/architect/return_packages/PHASE_58_TRADE_CONTEXT_EXTRACTION_SHAPE_HARDENING_EXECUTION_RETURN_PACKAGE.md.
```

**New Section (Phase 58):**

- Module Location table
- Canonical Shapes documentation (PostTradeSnapshot, ValidatedTradeContext)
- Runtime Assertions table
- Updated Architecture Diagram
- Guardrail Test Coverage table

---

## 8. Acceptance Criteria Verification

| AC  | Requirement                                                         | Status             |
| --- | ------------------------------------------------------------------- | ------------------ |
| AC1 | Snapshot + validation context helpers extracted to dedicated module | ✅ PASS            |
| AC2 | computeTradeResult() remains pure (no validateTrade calls)          | ✅ PASS            |
| AC3 | Runtime shape assertions exist and are used in pipeline             | ✅ PASS            |
| AC4 | Phase 57 guardrail test updated to cover new file paths             | ✅ PASS (17 tests) |
| AC5 | All required tests + full suite pass                                | ✅ PASS (299/299)  |
| AC6 | Build succeeds                                                      | ✅ PASS            |
| AC7 | Master Doc updated (Phase 58 entry + module boundary + shapes)      | ✅ PASS            |

---

## 9. Risks / Follow-ups

### Low Risk

1. **Duplicate `calculateTeamTotals`** - The function was copied to tradeContext rather than shared. This is intentional to avoid circular dependencies, but creates minor duplication.
   - **Mitigation:** Function is small (~40 lines), pure, and unlikely to diverge.

2. **Legacy `validateTradeForContext`** - Still exported for backward compatibility.
   - **Mitigation:** Marked as `@deprecated` with clear docstring warning.

3. **`validateTradeForPipeline`** - Still exists in mutationPipeline.js (deprecated).
   - **Mitigation:** Marked as `@deprecated`. Can be removed in future phase if confirmed unused.

### Future Work (Optional)

- Consider TypeScript conversion of tradeContext module for stronger typing
- Consider moving `calculateTeamTotals` to a shared utilities module if used elsewhere

---

## 10. Non-Negotiables Verification

| Non-Negotiable                                                 | Status                           |
| -------------------------------------------------------------- | -------------------------------- |
| N1: computeTradeResult() remains pure (no validateTrade calls) | ✅ VERIFIED (Test 1, 12)         |
| N2: Pipeline remains snapshot → validate → compute/persist     | ✅ VERIFIED (Test 5)             |
| N3: Phase 50/53 integration behaviors unchanged                | ✅ VERIFIED (Tests pass)         |
| N4: Guardrails protect against regression                      | ✅ VERIFIED (17 guardrail tests) |

---

**Phase 58 COMPLETE**
