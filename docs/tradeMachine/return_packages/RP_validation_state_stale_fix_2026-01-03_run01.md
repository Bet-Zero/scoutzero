# Return Package: Validation State Stale Fix

> **Run**: 01  
> **Date**: 2026-01-03  
> **Status**: ✅ Complete

---

## 1. Summary

**Problem**: The ValidationStateHeader showed "Validated" immediately when selecting a 2nd team, without the user clicking "Validate Trade". This occurred because:

1. An auto-validation `useEffect` in `useTradeMachine.js` triggered validation on every trade state change
2. `hasValidatorResult` was computed simply as `Boolean(result?.teamResults?.length)` — treating any existing result as valid
3. No tracking of whether the result was "current" for the active trade configuration

**Solution**: Implemented a "draft key" system that tracks which trade configuration was validated:

1. **Created `computeTradeDraftKey.js`** — Computes a deterministic key from trade configuration (yearKey, teams, players, picks)
2. **Stored `lastValidatedDraftKey`** — Only set when user explicitly clicks "Validate Trade"
3. **Added `hasCurrentValidation`** — Returns true only if `result` exists AND keys match
4. **Removed auto-validation effect** — Validation now requires explicit user action

---

## 2. Files Changed

| File | Change Type | Description |
|------|-------------|-------------|
| `src/features/architect/tradeMachine/utils/computeTradeDraftKey.js` | **NEW** | Draft key computation utility |
| `src/features/architect/hooks/useTradeMachine.js` | **MODIFIED** | Removed auto-validation, added draft key tracking |
| `src/features/architect/tradeMachine/TradeEditor.jsx` | **MODIFIED** | Uses `hasCurrentValidation` instead of `hasValidatorResult` |
| `src/tests/trade/staleValidationFix.test.js` | **NEW** | 20 guardrail tests for draft key and stale validation |

---

## 3. Before/After Behavior

### Selecting 2nd Team

| Scenario | Before | After |
|----------|--------|-------|
| User selects 2nd team | ❌ Shows "Validated" (green pill) | ✅ Shows "Not validated" (gray pill) |
| Validation Details panel | ❌ Shows official sections | ✅ Shows "Run Validate Trade..." callout |

### Post-Validation

| Scenario | Before | After |
|----------|--------|-------|
| User clicks "Validate Trade" | ❌ Shows "Validated" (but was already showing) | ✅ Shows "Validated at HH:MM" |
| Validation Details panel | ❌ Official sections visible | ✅ Official sections render with mode tags |

### Editing Trade After Validation

| Scenario | Before | After |
|----------|--------|-------|
| User adds/removes player | ❌ Still shows "Validated" | ✅ Reverts to "Not validated" |
| User switches team | ❌ Still shows "Validated" | ✅ Reverts to "Not validated" |
| User adds/removes pick | ❌ Still shows "Validated" | ✅ Reverts to "Not validated" |

---

## 4. Draft Key Design

The draft key is a deterministic string computed from the current trade configuration:

```text
Format: "{yearKey}|{team1Id}:{player1,player2}:{pick1,pick2}|{team2Id}:..."
```

### Inputs Included

| Input | Purpose |
|-------|---------|
| `yearKey` | Season year (e.g., 2025) |
| `teams[].team.id` | Team identifiers |
| `teams[].sends[].id` | Player IDs being traded out |
| `teams[].picksOut[]` | Pick year-round-originalTeam identifiers |

### Key Properties

- **Deterministic**: Same configuration always produces same key
- **Order-independent**: Players/picks/teams sorted before joining
- **Null-safe**: Handles missing teams, empty arrays gracefully

### Gating Logic

```javascript
hasCurrentValidation = 
  result?.teamResults?.length > 0 &&
  currentDraftKey === lastValidatedDraftKey;
```

---

## 5. Test Files Added/Updated

### New: `src/tests/trade/staleValidationFix.test.js` (20 tests)

| Test Group | Count | Assertions |
|------------|-------|------------|
| `computeTradeDraftKey` - Basic computation | 3 | Key format, year/team inclusion |
| `computeTradeDraftKey` - Player changes | 2 | Different keys when players added/changed |
| `computeTradeDraftKey` - Pick changes | 2 | Different keys when picks added/changed |
| `computeTradeDraftKey` - Deterministic ordering | 2 | Order-independent for players and teams |
| `computeTradeDraftKey` - Edge cases | 3 | Empty arrays, null teams, missing fields |
| `isValidationCurrent` | 4 | Null handling, key matching |
| `Stale Validation State Scenarios` | 4 | Real-world scenarios: team change, player add/remove |

---

## 6. Command Outputs

### Tests: `npm run test src/tests/trade/ -- --run`

```text
✓ src/tests/trade/tradeMultiSurfaceOfficialValues.test.js (28)
✓ src/tests/trade/tradeSnapshotWiring.test.js (25)
✓ src/tests/trade/TradeSalaryCalculator.guardrail.test.jsx (19)
✓ src/tests/trade/goldenTrades.test.js (11)
✓ src/tests/trade/TradeValidationGating.guardrail.test.jsx (27)
✓ src/tests/trade/staleValidationFix.test.js (20)

Test Files  6 passed (6)
     Tests  130 passed (130)
```

### Tests: `npm run test tests/trade/ -- --run`

```text
Test Files  31 passed (31)
     Tests  224 passed (224)
```

### Build: `npm run build`

```text
✓ 2917 modules transformed.
✓ built in 1m 2s
Exit code: 0
```

---

## 7. No-Scope Confirmation

> ✅ **No validator math changed**

This fix only affects:

- UI state gating logic (when to show "Validated" vs "Not validated")
- When validation is triggered (removed auto-trigger, kept manual trigger)

The following were **NOT** modified:

- `validateTrade()` function
- `validateSalaryMatching()` rules
- `salaryMatchingRules.js` calculations
- `getOfficialSalaryMatchingSnapshot.js` selector
- Any salary matching formulas or band calculations

---

## 8. Related Documentation

- [MASTER_TRADE_MACHINE_ALIGNMENT.md](../../MASTER_TRADE_MACHINE_ALIGNMENT.md) — Section 7: UX / Mode Legend
- [computeTradeDraftKey.js](../../../src/features/architect/tradeMachine/utils/computeTradeDraftKey.js) — Draft key utility

---

## 9. Acceptance Criteria Verification

| Criteria | Status |
|----------|--------|
| "Validated" pill NEVER appears unless user clicked Validate Trade for current draft | ✅ Pass |
| Adding/selecting a second team does not show validated state | ✅ Pass |
| Official sections are not visible until validation is current | ✅ Pass |
| All tests pass | ✅ 224 tests pass |
| Build succeeds | ✅ Exit code 0 |
