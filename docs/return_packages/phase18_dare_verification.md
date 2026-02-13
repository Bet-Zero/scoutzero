# Phase 18: DARE + Entitlement Invariants Verification

**Date**: 2026-02-04  
**Mode**: PREFLIGHT (Discovery/Verification only)  
**Verdict**: ❌ **NOT VERIFIED** — Test failures block verification

---

## Summary

Phase 18 verification **cannot be completed** due to test failures in DARE adapter tests and Phase 13 entitlement transfer guardrails. While the core invariant functions (B5/B6) pass all tests and the mutation pipeline integration is correctly wired, the DARE resolution adapter tests have **import/API mismatches** that cause 19 failures.

---

## Section A: Test Results

### Command 1: DARE + Entitlement Tests

```bash
npm test -- --run src/tests/architect/dare src/tests/architect/*entitlement*
```

**Result**: ❌ **19 FAILED** / 113 passed (132 total)

#### Passing Test Files (7)

| File                                                                                 | Tests |
| ------------------------------------------------------------------------------------ | ----- |
| `src/tests/architect/dare/protectionLadderFactory.test.js`                           | 27 ✅ |
| `src/tests/architect/dare/swapResolutionAdapter.test.js`                             | 8 ✅  |
| `src/tests/architect/entitlementInvariants.test.js`                                  | 12 ✅ |
| `src/tests/architect/phase15_trade_payload_entitlements_only_guardrail.test.js`      | 6 ✅  |
| `src/tests/architect/phase16_seasonmanager_entitlements_ssot_view_guardrail.test.js` | 19 ✅ |
| `src/tests/architect/phase17_entitlement_routing_guardrail.test.js`                  | 9 ✅  |
| `src/tests/architect/dare/phase17_1_protections_guardrail.test.ts`                   | 20 ✅ |

#### Failing Test Files (3)

##### 1. `src/tests/architect/dare/dareResolver.test.js` — 7 failures

**Root Cause**: Import mismatch. Tests import non-existent functions:

```javascript
// Test imports (WRONG):
import { classifyEntitlements, buildDAREInput } from '...dare/dareResolver';

// Actual exports:
export { resolveAllDraftAssets, resolveTeamDraftAssets, validateDAREInput };
```

**Failures**:

- `classifyEntitlements is not a function` (3 tests)
- `buildDAREInput is not a function` (1 test)
- `resolveAllDraftAssets` tests fail due to mock wiring issues (3 tests)

##### 2. `src/tests/architect/dare/conveyanceResolutionAdapter.test.js` — 10 failures

**Root Cause**: Import mismatch. Tests import wrong function name:

```javascript
// Test imports (WRONG):
import { resolveConveyance } from '...dare/conveyanceResolutionAdapter';

// Actual export:
export function resolveConveyanceForEntitlement(...) { ... }
```

**Error**: `TypeError: resolveConveyance is not a function` (all 10 tests)

##### 3. `src/tests/architect/phase13_entitlementIds_transfer_guardrail.test.js` — 2 failures

**Root Cause**: Implementation behavior mismatch for 3-team trades.

Tests expect "broadcast" behavior for unrouted entitlements in 3-team trades, but implementation logs:

```
[tradeContext] Entitlement "e2" has no toTeamId in 3-team trade - skipping
```

**Failures**:

- `should handle mixed routed and unrouted in same trade` - expects broadcast to Team B/C
- `should broadcast unrouted entitlement to ALL other trade participants` - expects broadcast

---

## Section B: Apply Trade Call Chain Proof

### ✅ VERIFIED: Phase 3.6 runs on real Apply Trade path

The call chain from UI to mutation pipeline is correctly wired:

```
TradeEditor.jsx (UI)
  │
  └─► props.onApplyTrade(tradeData)
        │
        └─► GMDashboard.jsx:309
              │ onApplyTrade={actions.applyTradeToCapSheet}
              │
              └─► useArchitectActions.ts:431
                    │ const applyTradeToCapSheet = useCallback(...)
                    │
                    └─► useArchitectActions.ts:402
                          │ const result = await applyWorldMutation({...})
                          │
                          └─► mutationPipeline.js:447
                                │ export async function applyWorldMutation({...})
                                │
                                ├─► Phase 3.5 (L540): validateMutationLeagueInvariants()
                                │     - Validates no duplicate players
                                │
                                └─► Phase 3.6 (L564-570): validateMutationEntitlementInvariants()
                                      - Validates no duplicate entitlements (B5)
                                      - Called for trade mutations
```

**Key File References**:

| Step           | File                                                                                              | Line(s) |
| -------------- | ------------------------------------------------------------------------------------------------- | ------- |
| UI Trigger     | [GMDashboard.jsx](../src/features/architect/GMDashboard/GMDashboard.jsx#L309)                     | 309     |
| Hook Entry     | [useArchitectActions.ts](../src/features/architect/GMDashboard/hooks/useArchitectActions.ts#L431) | 431     |
| Pipeline Call  | [useArchitectActions.ts](../src/features/architect/GMDashboard/hooks/useArchitectActions.ts#L402) | 402     |
| Mutation Entry | [mutationPipeline.js](../src/features/architect/utils/mutationPipeline.js#L447)                   | 447     |
| Import         | [mutationPipeline.js](../src/features/architect/utils/mutationPipeline.js#L98)                    | 98      |
| Phase 3.6 Call | [mutationPipeline.js](../src/features/architect/utils/mutationPipeline.js#L564-570)               | 564-570 |

**Mutation Pipeline Phase 3.6 Code**:

```javascript
// PHASE 3.6: ENTITLEMENT INVARIANTS - Validate no cross-team duplicate entitlements
// Phase B5: Prevents entitlements from appearing on multiple teams after trade
const entitlementInvariantResult = await validateMutationEntitlementInvariants(
  worldId,
  mutationType,
  computeResult
);
```

---

## Section C: B6 Pick-Slot Accounting Audit

### ✅ CORRECTLY IMPLEMENTED

The `validatePickSlotAccounting()` function correctly validates **underlying pick slots**, not raw entitlement document count.

**Implementation Location**: [leagueInvariants.ts](../src/features/architect/utils/leagueInvariants.ts#L556-650)

### Key Implementation Details

#### 1. Validates Underlying Pick Slots ✅

The function builds expected slots from a canonical formula:

```typescript
const expectedSlots = teamCodes.length * 2 * yearRange.length;
// Example: 30 teams × 2 rounds × 7 years = 420 slots

// Build expected slot set
const expectedSlotSet = new Set<string>();
for (const year of yearRange) {
  for (const round of [1, 2]) {
    for (const teamCode of teamCodes) {
      expectedSlotSet.add(`${teamCode}_${year}_${round}`);
    }
  }
}
```

#### 2. Only Counts `pick_ownership` Entitlements ✅

The function explicitly filters by entitlement kind:

```typescript
for (const ent of entitlements) {
  // Only count pick_ownership entitlements
  if (ent.kind !== 'pick_ownership') continue;
  if (!yearRange.includes(ent.seasonYear as number)) continue;

  // Parse slot from underlyingPickId (format: "LAL_2027_1st")
  const slotKey = parseSlotKeyFromEntitlement(ent);
  // ...
}
```

#### 3. Uses Underlying Pick IDs (Not Entitlement Count) ✅

Slot key is derived from `underlyingPickId` field:

```typescript
// Format: "LAL_2027_1st" → slotKey: "LAL_2027_1"
const slotKey = parseSlotKeyFromEntitlement(ent);
```

#### 4. Reports Deltas Meaningfully ✅

Returns structured results with missing/extra slots:

```typescript
return {
  valid: false,
  error: `Pick slot accounting mismatch: expected ${expectedSlots}, found ${actualCount}. Missing: ${missingSlots.length}, Extra: ${extraSlots.length}`,
  expected: expectedSlots,
  actual: actualCount,
  missingSlots, // Array<{ year, round, team }>
  extraSlots, // Array<{ year, round, team, entitlementId }>
};
```

#### 5. Swap/Conveyance Entitlements Do Not False-Fail ✅

From test evidence:

```javascript
// swap_right should not be counted as a slot
{ id: 'ent:3', kind: 'swap_right', seasonYear: 2026, round: 1, underlyingPickId: 'LAL_2026_1st' },
// ↑ This is correctly ignored - only pick_ownership counts
```

### Test Evidence (All 12 Tests Pass)

| Test | Description                             | Status |
| ---- | --------------------------------------- | ------ |
| 1    | Passes when all slots accounted for     | ✅     |
| 2    | Detects missing slots                   | ✅     |
| 3    | Detects duplicate slot coverage         | ✅     |
| 4    | Only counts pick_ownership entitlements | ✅     |
| 5    | Handles multi-year ranges correctly     | ✅     |
| 6    | Handles edge cases (empty arrays)       | ✅     |
| 7-12 | Additional boundary cases               | ✅     |

### B6 Verdict: ✅ CORRECTLY DEFINED

The function counts **underlying pick slots** (e.g., `LAL_2027_1st`), not raw entitlement document count. Swap rights and conveyance rights are correctly excluded from slot accounting.

---

## Blocking Issues Summary

| Issue                           | Severity | File                                                | Fix Required                                                   |
| ------------------------------- | -------- | --------------------------------------------------- | -------------------------------------------------------------- |
| DARE test import mismatch       | HIGH     | `dareResolver.test.js`                              | Update imports to match actual exports                         |
| Conveyance test import mismatch | HIGH     | `conveyanceResolutionAdapter.test.js`               | Change `resolveConveyance` → `resolveConveyanceForEntitlement` |
| 3-team broadcast behavior       | MEDIUM   | `phase13_entitlementIds_transfer_guardrail.test.js` | Either fix implementation or update test expectations          |

---

## Final Verdict

| Criterion                     | Status | Notes                                             |
| ----------------------------- | ------ | ------------------------------------------------- |
| All tests in Section A pass   | ❌     | 19 failures (import mismatches + behavior)        |
| Apply Trade → Phase 3.6 wired | ✅     | Verified with line references                     |
| B6 correctly defined          | ✅     | Validates underlying slots, not entitlement count |

### Verdict: ❌ NOT VERIFIED

**Reason**: Test failures in DARE adapter tests and Phase 13 block full verification. The failures are **import/API naming mismatches**, not functional bugs in the implementation. The tests were written speculatively against an API that was later implemented with different function names.

### Recommended Next Steps

1. **Fix test imports** in `dareResolver.test.js` and `conveyanceResolutionAdapter.test.js` to match actual exports
2. **Investigate Phase 13 broadcast behavior** — determine if tests or implementation need adjustment
3. **Re-run verification** after fixes

---

**Generated**: 2026-02-04  
**Master Doc**: `docs/architect/DRAFT_ASSET_TERMS_AND_LIFECYCLE_COMPLETION_AUDIT.md`
