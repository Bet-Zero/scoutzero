# PHASE 54 — Trade Validation Separation Preflight Return Package

**Date:** 2026-01-29  
**Status:** PREFLIGHT COMPLETE (Discovery only, no code changes)  
**Master Doc:** `docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md`

---

## Executive Summary

This preflight maps the current validation/compute coupling in the trade pipeline and identifies the minimal safe refactor seam to make `computeTradeResult()` pure (no validation calls inside). The key finding is that **validation currently runs INSIDE `computeTradeResult()`** (at line ~1166) to provide SSOT data (`createdTPE`, `matchIncoming`) that persistence logic depends on.

**Current Problem:** `computeTradeResult()` calls `validateTrade()` internally to obtain TPE creation/consumption data. This creates:

1. Validator runs twice for pipeline trades (once in `validateMutation()`, once in `computeTradeResult()`)
2. Compute is impure (depends on validator state)
3. Architectural debt for future Cloud Functions migration

**Recommended Solution:** **Option A** — Move validation to mutation entrypoint, pass `validatedTradeContext` to compute.

---

## 1. Current Call Graph (AUTHORITATIVE)

### Entrypoints to `computeTradeResult()`

| Entrypoint | File | Function | Path to computeTradeResult | Notes |
|---|---|---|---|---|
| `applyWorldMutation()` | `mutationPipeline.js` | `computeWorldMutation()` | `applyWorldMutation() → computeWorldMutation() → computeTradeResult()` | Primary pipeline for `executeTrade` mutation |
| `signAndTrade` mutation | `mutationPipeline.js` | `computeSignAndTradeResult()` | `computeWorldMutation() → computeSignAndTradeResult() → computeTradeResult()` | S&T calls compute after signing validation |
| UI Preview (read-only) | `useTradeMachine.js` | `validateCurrentTrade()` | Does NOT call `computeTradeResult()` — only `validateTrade()` | UI validation only, no persistence |
| Legacy (unused?) | `tradeManager.js` | `executeTrade()` | `executeTrade() → validateTrade()` (no computeTradeResult) | Read-only module, no persistence |

### Call Graph Visualization

```
applyWorldMutation()           <-- Main entry for mutations
  └── computeWorldMutation()    <-- Switch on mutationType
      ├── case 'executeTrade':
      │     └── computeTradeResult()  ✅ CALLS validateTrade() INSIDE (line 1166)
      │
      └── case 'signAndTrade':
            └── computeSignAndTradeResult()
                  ├── validateSigning()  ✅ Added Phase 48 (before compute)
                  └── computeTradeResult()  ✅ CALLS validateTrade() INSIDE

validateMutation()              <-- Called AFTER compute in pipeline
  ├── case 'executeTrade':
  │     └── validateTradeForPipeline()  → validateTrade()  ✅ DUPLICATE CALL
  │
  └── case 'signAndTrade':
        ├── validateSigning()   ✅ DUPLICATE (already in computeSignAndTradeResult)
        └── validateTradeForPipeline()  → validateTrade()  ✅ DUPLICATE CALL
```

**Key Finding:** For `executeTrade`, validation runs **twice**:

1. Inside `computeTradeResult()` (line 1166) — to get TPE SSOT data
2. Inside `validateMutation()` (line 2138) — to gate persistence

---

## 2. Validator Invocation Map

### All `validateTrade()` Callsites

| File | Function | Line | Data Passed In | Outputs Consumed |
|---|---|---|---|---|
| `mutationPipeline.js` | `computeTradeResult()` | ~1166 | `validationTeams`, `capProjections`, `currentYear`, `tradeCtx` | `validation.teamResults[i].createdTPE`, `validation.teamResults[i].rules.tradeExceptions` |
| `mutationPipeline.js` | `validateTradeForPipeline()` | ~2474 | `tradeInput` (built from payload + currentState) | `validation.legal`, `validation.reason`, `validation.teamResults.violations` |
| `useTradeMachine.js` | `validateCurrentTrade()` | ~723 | `teams`, `capProjections`, `yearKey` | Full validation result for UI display |
| `tradeManager.js` | `executeTrade()` | ~70 | `tradeInput` | `validation.legal`, `validation.reason` (throws on invalid) |

### All `validateTradeForPipeline()` Callsites

| File | Function | Line | Data Passed In | Outputs Consumed |
|---|---|---|---|---|
| `mutationPipeline.js` | `validateMutation()` (case `executeTrade`) | ~2138 | `payload`, `currentState`, `seasonId` | `{ valid, error, violations }` |
| `mutationPipeline.js` | `validateMutation()` (case `signAndTrade`) | ~2420 | Fake trade payload + state | `{ valid, error, violations, warnings }` |

### All `validateSigning()` Callsites (Trade-Adjacent)

| File | Function | Line | Context |
|---|---|---|---|
| `mutationPipeline.js` | `computeSignAndTradeResult()` | ~3239 | Phase 48 fix: validation before `computeTradeResult()` |
| `mutationPipeline.js` | `validateMutation()` (case `signAndTrade`) | ~2301 | Duplicate call after compute (pre-persist gate) |
| `mutationPipeline.js` | `validateMutation()` (case `signFreeAgent`) | ~2175 | Standard signing validation |

### `validateTradeExceptions()` Callsites

| File | Function | Line | Notes |
|---|---|---|---|
| `tradeValidator.js` | `validateTrade()` | ~566 | Called via `validators.validateTradeExceptions(team, context)` |
| Re-exported from | `rules/validateTradeExceptions.js` | - | Primary implementation |

---

## 3. SSOT Outputs Currently Pulled From Validator

### Critical Data Flows (Persistence Depends On)

| Data | Produced By | Consumed By | Location in Persistence Logic |
|---|---|---|---|
| `teamResult.createdTPE` | `validateTradeExceptions()` via `createTPE()` | TPE creation in `computeTradeResult()` | `mutationPipeline.js:1300-1380` |
| `player.matchIncoming` | `computeMatchingValues()` called inside `validateTrade()` | TPE consumption amount | `mutationPipeline.js:1217` |
| `tradeExceptionsResult` | `validateTradeExceptions()` result | Gating TPE consumption (Phase 50 fix) | `mutationPipeline.js:1189` |
| `validation.legal` | `validateTrade()` overall | Not used by compute (checked in validate phase) | N/A |

### Detailed Flow: TPE Creation

```
validateTrade()
  └── validateTradeExceptions(team, context)
        └── createTPE({ teamCtx, outgoing, incoming, tradeDate })
              └── Returns { amount, createdSeason, expiresOn } or null

Result: validation.teamResults[i].createdTPE → persisted to team.tradeExceptions[]
```

### Detailed Flow: TPE Consumption

```
validateTrade()
  └── computeMatchingValues({ teams, yearKey })  // Mutates player objects
        └── player.matchIncoming = computed value

Result: player.matchIncoming → used to calculate TPE consumption amount
```

### Detailed Flow: Exception History Logging

```
computeTradeResult()
  └── After TPE updates, calls:
        └── createTpeCreationHistoryEntry({ ...context from createdTPE... })
        └── createTpeConsumptionHistoryEntry({ ...context from matchIncoming... })
        └── appendExceptionHistory(updatedTeam, historyEntries)
```

**Key Insight:** All SSOT data (`createdTPE`, `matchIncoming`) is computed during `validateTrade()`. The only reason compute calls validate is to access this data.

---

## 4. Minimal Refactor Seam Proposal

### Chosen Option: **OPTION A** — Pre-Compute Validation with Context Injection

**Rationale:**

- Option A is cleaner architecturally (validation happens once, at mutation entrypoint)
- Option B (wrapper function) would just move the problem up one level
- Option A aligns with eventual Cloud Functions migration (validate → compute → persist)

### Proposed Changes

#### 4.1 New Data Structure: `ValidatedTradeContext`

```typescript
interface ValidatedTradeContext {
  // Core validation result
  legal: boolean;
  reason?: string;
  violations?: string[];
  warnings?: string[];
  
  // SSOT data extracted from validator
  teamResults: Array<{
    teamCode: string;
    createdTPE: TPECreationData | null;  // From validateTradeExceptions
    tradeExceptionsResult: TradeExceptionsResult;  // Full rule result
    salaryMatchingResult: SalaryMatchingResult;  // For salary totals
  }>;
  
  // Pre-computed matching values (already on player objects)
  // Players in teams[].sends will have matchOutgoing/matchIncoming set
}
```

#### 4.2 New Function: `validateTradeForContext()`

**Location:** `mutationPipeline.js` (or new file `tradeValidationContext.js`)

```typescript
/**
 * Run trade validation and extract SSOT data needed for persistence.
 * Returns a context object that can be passed to computeTradeResult().
 * 
 * @param {Object} payload - Trade payload
 * @param {Object} currentState - Current team states
 * @param {string} seasonId - Season ID
 * @returns {ValidatedTradeContext}
 */
function validateTradeForContext(payload, currentState, seasonId): ValidatedTradeContext {
  // Build validation input (existing logic from computeTradeResult lines ~1130-1165)
  // Call validateTrade()
  // Extract and return structured context
}
```

#### 4.3 Modified `computeTradeResult()` Signature

**Before (current):**

```javascript
function computeTradeResult({
  payload,
  currentState,
  seasonId,
  timestamp,
  historyContext = {},
}) {
  // ...
  // Line ~1166: const validation = validateTrade({ ... });  ❌ VALIDATION INSIDE
  // ...
}
```

**After (proposed):**

```javascript
function computeTradeResult({
  payload,
  currentState,
  seasonId,
  timestamp,
  historyContext = {},
  validatedContext,  // ✅ NEW: Pre-validated context from upstream
}) {
  // If validatedContext provided, use it (pipeline path)
  // Otherwise, compute on the fly (legacy/test compatibility)
  const validation = validatedContext ?? validateTradeForContext(payload, currentState, seasonId);
  
  // Rest of logic unchanged - uses validation.teamResults[i].createdTPE, etc.
}
```

#### 4.4 Modified Pipeline Flow

**Before:**

```
applyWorldMutation()
  → computeWorldMutation() → computeTradeResult()  // Validates inside ❌
  → validateMutation() → validateTradeForPipeline()  // Validates again ❌
  → persistWorldMutation()
```

**After:**

```
applyWorldMutation()
  → validateTradeForContext()  // Validate ONCE ✅
  → if (!valid) return early
  → computeWorldMutation() → computeTradeResult(validatedContext)  // No internal validation ✅
  → persistWorldMutation()
```

#### 4.5 Sign-and-Trade Modification

**Current flow:**

```javascript
// computeSignAndTradeResult()
validateSigning(...)  // Phase 48 fix
computeTradeResult(...)  // Calls validateTrade inside
```

**Proposed flow:**

```javascript
// computeSignAndTradeResult()
const signingValidation = validateSigning(...);
if (!signingValidation.valid) return error;

// Build intermediate state after signing
const validatedContext = validateTradeForContext(tradePayload, tradeState, seasonId);
if (!validatedContext.legal) return error;

computeTradeResult({ ..., validatedContext });  // Pure compute
```

### 4.6 `validateMutation()` Simplification

After this refactor, `validateMutation()` for `executeTrade` and `signAndTrade` can be simplified to just return the already-computed result:

```javascript
case 'executeTrade':
  // Validation already happened; just return cached result
  return computeResult._validationContext;  // Or similar pattern
```

---

## 5. Risk List + Tests Impact

### 5.1 Tests That Will Be Impacted

| Test File | # Tests | Impact | Why |
|---|---|---|---|
| `phase47_tpe_persistence_guardrails.test.js` | 14 | **LOW** | Tests TPE persistence outcomes; should pass if SSOT preserved |
| `phase47c_tpe_persistence_hardening_guardrails.test.js` | 16 | **LOW** | Tests dedupe and idempotency; unaffected by validation location |
| `phase49_tpe_exception_history_logging_guardrails.test.js` | ~10 | **LOW** | Tests history entry creation; unaffected |
| `phase50_executeTrade_integration_persistence.test.js` | 5 | **MEDIUM** | Integration tests; may need to verify context passing |
| `signAndTrade.test.js` | ~30 | **MEDIUM** | May mock `validateTrade`; need to update mock patterns |
| `goldenTrades.test.js` | ~10 | **LOW** | Tests `validateTrade()` directly; unaffected |
| `P0_hardCapSkip_worldless.guardrail.test.js` | ~10 | **LOW** | Tests validator edge cases; unaffected |

### 5.2 Key Risks

| Risk | Likelihood | Severity | Mitigation |
|---|---|---|---|
| Backward compat: direct `computeTradeResult()` callers | LOW | HIGH | Add optional `validatedContext` param with fallback |
| Sign-and-trade order-of-operations | MEDIUM | HIGH | Preserve Phase 48 fix: signing validation before trade validation |
| `matchIncoming` not populated | LOW | HIGH | Ensure `computeMatchingValues()` runs before context extraction |
| Duplicate TPE history entries on refactor | LOW | MEDIUM | Existing idempotency via `historyKey` should protect |
| Test mocking breaks | MEDIUM | MEDIUM | Update mocks to return `ValidatedTradeContext` structure |

### 5.3 Order-of-Operations Traps (Sign-and-Trade)

**Current S&T flow (Phase 48):**

1. `validateSigning()` — checks signing is legal
2. `computeSigningResult()` — computes signed player
3. `computeTradeResult()` — internally validates + persists trade

**Proposed S&T flow:**

1. `validateSigning()` — checks signing is legal  
2. `computeSigningResult()` — computes signed player
3. `validateTradeForContext()` — validates trade with signed player state ✅ NEW
4. `computeTradeResult({ validatedContext })` — pure compute + persist

**Critical:** Validation must use the **post-signing team state** (with signed player on roster) when validating the trade. This is already handled correctly by building `fakeSourceTeam` in current code.

---

## 6. Acceptance Criteria for Phase 55 (Execution)

### Must-Pass Checklist

- [ ] **AC-1:** No `validateTrade()` call anywhere inside `computeTradeResult()` module path
- [ ] **AC-2:** No `validateTrade()` call anywhere inside `computeSignAndTradeResult()`
- [ ] **AC-3:** Validation runs exactly ONCE per mutation (no duplicate calls)
- [ ] **AC-4:** `ValidatedTradeContext` structure documented and typed
- [ ] **AC-5:** `computeTradeResult()` accepts optional `validatedContext` param
- [ ] **AC-6:** If `validatedContext` not provided, `computeTradeResult()` falls back to inline validation (backward compat)
- [ ] **AC-7:** All TPE persistence (creation + consumption) still works identically
- [ ] **AC-8:** All `exceptionHistory[]` entries still correct (creation, consumption)
- [ ] **AC-9:** Sign-and-trade validation order preserved (signing before trade)
- [ ] **AC-10:** All 270+ architect tests still pass
- [ ] **AC-11:** No duplicate TPE creation on trade rerun (idempotency preserved)
- [ ] **AC-12:** `matchIncoming` values still available for consumption logic

### Test Coverage Requirements

- [ ] Add test: `validateTradeForContext()` returns correct `createdTPE` structure
- [ ] Add test: `computeTradeResult()` works with and without `validatedContext`
- [ ] Add test: Pipeline flow validates exactly once (instrument with spy)
- [ ] Verify: Phase 50 integration tests still pass

### Documentation Updates

- [ ] Update Master Doc §2.2 with new validation flow diagram
- [ ] Add `ValidatedTradeContext` to schema docs
- [ ] Update return package inventory

---

## 7. Stop Condition Analysis

**Question:** Is validation structurally required inside compute due to missing upstream data?

**Answer:** NO — All required data can be extracted from validator output:

| Data | Currently Derived Inside Compute | Can Be Passed From Upstream? |
|---|---|---|
| `createdTPE` | Yes (from `validation.teamResults[i].createdTPE`) | ✅ YES — extract from validation result |
| `matchIncoming` | Yes (from players mutated by `computeMatchingValues`) | ✅ YES — values already on player objects after validation |
| `tradeExceptionsResult` | Yes (from `validation.teamResults[i].rules.tradeExceptions`) | ✅ YES — extract from validation result |

**Conclusion:** No structural blockers. All SSOT data flows through `validateTrade()` output.

---

## 8. Summary

| Item | Status |
|---|---|
| Call graph mapped | ✅ Complete |
| Validator invocations mapped | ✅ Complete |
| SSOT outputs inventoried | ✅ Complete |
| Refactor seam proposed | ✅ Option A (pre-compute validation with context injection) |
| Risks identified | ✅ 5 risks, all mitigatable |
| Acceptance criteria defined | ✅ 12 criteria for Phase 55 |
| Stop conditions | ✅ None found — refactor is safe |

**Ready for Phase 55 Execution.**
