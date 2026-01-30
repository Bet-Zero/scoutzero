# PHASE 51 — Season Advance TPE Expiry Integration — EXECUTION RETURN PACKAGE

**Date:** 2026-01-29  
**Mode:** EXECUTION  
**Scope:** `src/tests/architect/**` (tests only, no production code changes)  
**Master Doc:** `docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md`

---

## 1. Executive Summary

### Objective

Create integration-level tests for season advance TPE expiry flow verifying:

1. Expired TPEs are removed when `expiresOn < boundary`
2. Active TPEs remain when `expiresOn >= boundary`
3. Boundary semantics are explicitly locked in tests
4. No "ghost" TPEs from dual-source hydration (`tradeExceptions[]` + `exceptions.tpe[]`)
5. Idempotency: running season advance twice produces no additional changes

### Implementation

- Created test file `src/tests/architect/phase51_seasonAdvance_tpe_expiry_integration.test.js` with 18 test cases across 5 test groups.
- Tests use the real `processTradeExceptions()` function from `tpeLifecycle.js` (pure compute layer).
- Simulates the complete season advance TPE expiry pipeline including dual-source merging.

### Results

- All 18 Phase 51 tests passing
- All 253 architect tests passing (up from 235 in Phase 50)
- Production build successful

---

## 2. Boundary Decision (DOCUMENTED)

### Semantics Locked In Tests

The expiry boundary for season advance is **July 1st of the start year** of the target season:

| Target Season | Boundary Date              | Explanation                                |
| ------------- | -------------------------- | ------------------------------------------ |
| `2026-27`     | `2026-07-01T00:00:00.000Z` | Start year = 2026, boundary = July 1, 2026 |
| `2027-28`     | `2027-07-01T00:00:00.000Z` | Start year = 2027, boundary = July 1, 2027 |

### Expiry Logic

```
TPE.expiresOn < boundary  → EXPIRED (removed from tradeExceptions[])
TPE.expiresOn >= boundary → ACTIVE (kept in tradeExceptions[])
```

**Critical Decision:** A TPE that expires **exactly on** the boundary (e.g., `2026-07-01T00:00:00.000Z` for `2026-27` season) is **ACTIVE** and kept. This is because the comparison is `<` (strictly less than), not `<=`.

This behavior is now explicitly locked by test case `Test 2: Boundary Condition (Exact Cutoff)`.

---

## 3. Test Coverage

### Test Group 1: Expired TPE Removed/Inactive After Season Advance

| Test | Scenario                                                | Assertions                                                                              |
| ---- | ------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| 1.1  | TPE expiring before boundary removed; TPE after remains | `persistedTradeExceptions` contains only active TPE; `expiredTPEs` contains expired TPE |
| 1.2  | Multiple expired TPEs all removed                       | All expired TPEs in `expiredTPEs`; only active TPE remains                              |

### Test Group 2: Boundary Condition (Exact Cutoff)

| Test | Scenario                                      | Assertions                                      |
| ---- | --------------------------------------------- | ----------------------------------------------- |
| 2.1  | TPE expiring exactly on boundary (2026-07-01) | **ACTIVE** - kept in `persistedTradeExceptions` |
| 2.2  | TPE expiring 1ms before boundary              | **EXPIRED** - removed                           |
| 2.3  | TPE expiring 1ms after boundary               | **ACTIVE** - kept                               |

### Test Group 3: Dual-Source "No Ghosts" Dedupe

| Test | Scenario                                           | Assertions                                                   |
| ---- | -------------------------------------------------- | ------------------------------------------------------------ |
| 3.1  | Same TPE id in both sources                        | Deduped to 1 entry; prefers canonical fields from primary    |
| 3.2  | Legacy-only TPE in `exceptions.tpe[]`              | Included in merge; processed correctly                       |
| 3.3  | Legacy TPE gains `expiresOn` via backfill          | `expiresOn` backfilled from `expiryISO`; `hasChanges = true` |
| 3.4  | No ghost TPEs: output count matches deduped active | Verifies `mergedCount` and `dedupeApplied` flags             |

### Test Group 4: Idempotency

| Test | Scenario                                  | Assertions                                                               |
| ---- | ----------------------------------------- | ------------------------------------------------------------------------ |
| 4.1  | Run twice produces identical results      | Second run has `hasChanges = false`; no additional drops                 |
| 4.2  | Dual sources: same merged result each run | After first run consolidates to `tradeExceptions[]`, second run is no-op |
| 4.3  | Pure function: same input → same output   | Results deeply equal across runs                                         |

### Test Group 5: Edge Cases

| Test | Scenario                                         | Assertions                          |
| ---- | ------------------------------------------------ | ----------------------------------- |
| 5.1  | Empty `tradeExceptions[]` and `exceptions.tpe[]` | `hasChanges = false`; empty outputs |
| 5.2  | TPE with missing expiry date                     | Preserved (fail-safe)               |
| 5.3  | TPE with invalid expiry date                     | Preserved (fail-safe)               |

### Test Utilities Validation

| Test | Scenario                                    | Assertions                         |
| ---- | ------------------------------------------- | ---------------------------------- |
| U.1  | `getTpeExpiryISO` prioritizes `expiresOn`   | Returns canonical field first      |
| U.2  | `getTpeExpiryISO` falls back to `expiryISO` | Legacy support                     |
| U.3  | `dedupeById` keeps primary source           | First entry wins when scores equal |

---

## 4. Fixture Design

### Minimal Team Fixture

```javascript
const team = {
  teamCode: 'BOS',
  tradeExceptions: [
    { id: 'tpe_1', amount: 5_000_000, expiresOn: '2026-06-30T23:59:59.999Z' }, // Expired
    { id: 'tpe_2', amount: 10_000_000, expiresOn: '2026-08-15T00:00:00.000Z' }, // Active
  ],
  exceptions: { tpe: [] },
};
```

### Dual-Source Fixture

```javascript
const team = {
  teamCode: 'DAL',
  tradeExceptions: [
    { id: 'tpe_1', amount: 5_000_000, expiresOn: '2026-09-01T00:00:00.000Z' }, // Active
    { id: 'tpe_2', amount: 3_000_000, expiresOn: '2026-04-01T00:00:00.000Z' }, // Expired
  ],
  exceptions: {
    tpe: [
      { id: 'tpe_1', amount: 5_000_000, expiryISO: '2026-09-01T00:00:00.000Z' }, // Dupe
      { id: 'tpe_3', amount: 7_000_000, expiryISO: '2027-03-01T00:00:00.000Z' }, // Active, legacy
    ],
  },
};
```

### Season Transition Constants

```javascript
const TO_SEASON = '2026-27';
const BOUNDARY_ISO = '2026-07-01T00:00:00.000Z';
const BEFORE_BOUNDARY_ISO = '2026-06-30T23:59:59.999Z';
const AFTER_BOUNDARY_ISO = '2026-07-01T00:00:00.001Z';
```

---

## 5. Integration Harness Pattern

Since `processTeamSeasonTransitionWithOptions` is an internal async function tied to Firestore, we created a pure compute harness:

```javascript
const simulateSeasonAdvanceTPEExpiry = (team, toSeason) => {
  // 1. Gather TPEs from both sources
  const primaryTPEs = team.tradeExceptions ?? [];
  const legacyTPEs = team.exceptions?.tpe ?? [];

  // 2. Dedupe by ID (prefer primary source)
  const mergedTPEs = dedupeById([...primaryTPEs, ...legacyTPEs]);

  // 3. Run expiry processing (real function)
  const result = processTradeExceptions(mergedTPEs, toSeason);

  // Return persisted state
  return {
    persistedTradeExceptions: result.activeTPEs,
    expiredTPEs: result.expiredTPEs,
    hasChanges: result.hasChanges,
    mergedCount: mergedTPEs.length,
    dedupeApplied: primaryTPEs.length + legacyTPEs.length > mergedTPEs.length,
  };
};
```

This pattern mirrors the flow in `processTeamSeasonTransitionWithOptions` without requiring Firestore.

---

## 6. Files Changed

### Created

| File                                                                       | Purpose                                                   |
| -------------------------------------------------------------------------- | --------------------------------------------------------- |
| `src/tests/architect/phase51_seasonAdvance_tpe_expiry_integration.test.js` | 18 integration tests for TPE expiry during season advance |

### Modified

| File                                                          | Change                                  |
| ------------------------------------------------------------- | --------------------------------------- |
| `docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md` | Added Phase 51 entry to HISTORY section |

---

## 7. Validation Results

### Test Results

```
 ✓ src/tests/architect/phase51_seasonAdvance_tpe_expiry_integration.test.js (18 tests) 32ms

 Test Files  23 passed (23)
      Tests  253 passed (253)
```

### Build Results

```
✓ built in 33.40s
```

No compilation errors. Large chunk warning (>500KB) is pre-existing and not related to this phase.

---

## 8. Acceptance Criteria Checklist

| Criterion                                         | Status                                               |
| ------------------------------------------------- | ---------------------------------------------------- |
| ✅ Phase 51 test file added + passing             | 18 tests passing                                     |
| ✅ Explicitly locks expiry boundary semantics     | Test 2.1 confirms `expiresOn === boundary` is ACTIVE |
| ✅ Proves "no ghost TPEs" with dual-source dedupe | Tests 3.1-3.4 cover all scenarios                    |
| ✅ Proves idempotency                             | Tests 4.1-4.3 verify no duplicate operations         |
| ✅ No regressions in architect suite              | 253/253 tests passing                                |
| ✅ Master Doc updated with Phase 51 entry         | HISTORY section updated                              |
| ✅ Return package written to required path        | This file                                            |

---

## 9. Notes

### No Production Code Changes

This phase added tests only. No modifications to `tpeLifecycle.js`, `seasonManager.js`, or any other production files.

### Harness Approach

Rather than exposing `processTeamSeasonTransitionWithOptions` for testing (which would require invasive refactors), we created a harness that:

1. Uses the exported `processTradeExceptions()` function directly
2. Simulates the dual-source merge pattern from Phase 47C
3. Validates the complete flow without Firestore dependencies

This approach aligns with the Phase 50 pattern of using pure compute functions for integration testing.

---

## 10. Doc Changelog

| Doc                                            | Change                       |
| ---------------------------------------------- | ---------------------------- |
| `CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md` | Added Phase 51 history entry |
