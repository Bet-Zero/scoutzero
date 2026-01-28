# CAP SHEET CONTRACT RULES — PHASE 18.2 RETURN PACKAGE

## Offer Sheet Audit-Grade Lock: True Idempotency + Cleanup-by-dedupKey + worldId Required + UI Wire

**Date:** 2026-01-20  
**Master Doc:** `docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md`

---

## 1. Summary of Changes

Phase 18.2 closes remaining audit-grade gaps from Phase 18.1:

| Gap | Fix |
|-----|-----|
| Idempotency tests only proved string determinism | New tests execute `computeStoreOfferSheetResult` twice and verify only 1 entry exists |
| `finalizeDeclinedOfferSheet` cleanup used `id` only | Now removes by `id` OR `dedupKey` to handle mirrored array divergence |
| `dedupKey` used `worldId || 'world'` fallback | `worldId` now required; missing worldId fails fast |
| UI called `signFreeAgent` for DECLINED | UI now calls `finalizeDeclinedOfferSheet` mutation with `dedupKey` |

---

## 2. Idempotency Proof Tests (A1/A2)

**File:** [offerSheetPersistence.test.js](file:///Users/brenthibbitts/Desktop/ScoutZero/tests/architect/offerSheetPersistence.test.js)

### Test A1: Store Twice with Different offerSheetId → Still 1 Entry

```javascript
// First store with offerSheetId: 'os_test_1'
// Second store with offerSheetId: 'os_test_2' (same worldId, teamCode, playerId, seasonKey)
// Assert: offerSheets.length === 1
// Assert: stored sheet.id === 'os_test_1' (original preserved)
// Assert: dedupKey === 'os:world_test_123:LAL:player123:2025-26'
```

### Test A2: Store Twice with NO offerSheetId → Still 1 Entry

```javascript
// First store with no offerSheetId (timestamp-generated ID)
// Second store with no offerSheetId (different timestamp)
// Assert: offerSheets.length === 1
// Assert: original ID preserved
// Assert: original createdAt preserved
```

---

## 3. Cleanup-by-dedupKey Proof (B1)

**Scenario:** Mirrored arrays have different IDs but same `dedupKey`

```javascript
// offeringTeam.offerSheets[0].id = 'os_offering_id_1'
// homeTeam.incomingOfferSheets[0].id = 'os_home_id_2'
// Both have dedupKey = 'os:world1:LAL:player123:2025-26'

// Call finalizeDeclinedOfferSheet with:
//   offerSheetId: 'os_offering_id_1'
//   dedupKey: 'os:world1:LAL:player123:2025-26'

// Assert: offeringTeam.offerSheets.length === 0
// Assert: homeTeam.incomingOfferSheets.length === 0
```

**Implementation:** `computeFinalizeDeclinedOfferSheetResult` now:

1. Finds by `id` first, then by `dedupKey` if not found
2. Filters both arrays by `id !== offerSheetId && (!dedupKey || os.dedupKey !== dedupKey)`

---

## 4. worldId Required Proof (C1)

**Test:** storeOfferSheet without worldId must fail fast

```javascript
const result = computeWorldMutation({
    mutationType: 'storeOfferSheet',
    payload: { 
        teamCode: 'LAL',
        playerId: 'player123',
        // worldId is MISSING
        contract: { ... }
    },
    ...
});

expect(result.success).toBe(false);
expect(result.error).toContain('worldId');
```

**Error message:** `"worldId is required for offer sheet identity. Cannot store offer sheet without worldId."`

---

## 5. UI Wiring Summary (D)

| Button | State | Handler | Mutation |
|--------|-------|---------|----------|
| "Finalize Signing" | DECLINED + offering team | `handleFinalizeOfferSheet` | `finalizeDeclinedOfferSheet` |
| "Finalize Match" | MATCHED + home team | `handleFinalizeOfferSheet` | `finalizeMatchedOfferSheet` |

**Payload for finalizeDeclinedOfferSheet:**

```javascript
{
    teamCode: 'LAL',              // Offering team (actor)
    offeringTeamCode: 'LAL',
    homeTeamCode: 'BOS',
    offerSheetId: 'os_...',
    dedupKey: 'os:world1:LAL:player123:2025-26', // Phase 18.2
    playerId: 'player123',
    seasonKey: '2025-26'
}
```

---

## 6. Files Changed

| File | Changes |
|------|---------|
| [mutationPipeline.js](file:///Users/brenthibbitts/Desktop/ScoutZero/src/features/architect/utils/mutationPipeline.js) | `computeStoreOfferSheetResult`: fail fast if worldId missing. `computeFinalizeDeclinedOfferSheetResult`: dual find/filter by id OR dedupKey. |
| [useArchitectActions.ts](file:///Users/brenthibbitts/Desktop/ScoutZero/src/features/architect/GMDashboard/hooks/useArchitectActions.ts) | `handleFinalizeOfferSheet`: DECLINED → `finalizeDeclinedOfferSheet` mutation. `handleStoreOfferSheet`: add `worldId` to payload. |
| [offerSheetPersistence.test.js](file:///Users/brenthibbitts/Desktop/ScoutZero/tests/architect/offerSheetPersistence.test.js) | Added 13 new tests: idempotency proof (4), worldId required (3), cleanup by dedupKey (1), plus decision table expansion (5) |
| [CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md](file:///Users/brenthibbitts/Desktop/ScoutZero/docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md) | Added Phase 18.2 changelog entry |

---

## 7. Test Output

```
npm test -- --run tests/architect/offerSheetPersistence.test.js tests/architect/offerSheetResolution.test.js

 RUN  v1.6.1 /Users/brenthibbitts/Desktop/ScoutZero

 ✓ tests/architect/offerSheetResolution.test.js (6)
 ✓ tests/architect/offerSheetPersistence.test.js (26)
                           
 Test Files  2 passed (2) 
      Tests  32 passed (32)
   Start at  03:32:37
   Duration  7.69s
```

---

## 8. Build Output

```
npm run build

vite v4.5.14 building for production...
✓ 2930 modules transformed.
dist/index.html                            0.60 kB │ gzip:   0.37 kB
dist/assets/index-4afc0256.css            73.91 kB │ gzip:  12.97 kB
dist/assets/index.esm-190a0909.js          3.62 kB │ gzip:   1.56 kB
dist/assets/tradeManager-c269da1d.js       5.24 kB │ gzip:   2.05 kB
dist/assets/seasonManager-cc4f02b0.js     15.22 kB │ gzip:   5.13 kB
dist/assets/index-ef1d76b3.js          1,910.51 kB │ gzip: 556.98 kB
✓ built in 33.96s
```

---

## 9. Master Doc Updates

**Section:** Change Log  
**Entry added:**

> | 2026-01-20 | **Contract Rules Phase 18.2:** Offer Sheet Audit-Grade Lock. (1) Idempotency proof tests now execute `computeStoreOfferSheetResult` twice and verify no duplicate entries. (2) `worldId` now required for `storeOfferSheet` - missing worldId fails fast. (3) `computeFinalizeDeclinedOfferSheetResult` cleanup removes by `id` OR `dedupKey`. (4) UI wiring: DECLINED finalization now calls `finalizeDeclinedOfferSheet` mutation with `dedupKey`. 13 new tests added. Build succeeds. |

---

## 10. Acceptance Criteria Verification

| # | Criterion | Status |
|---|-----------|--------|
| 1 | Two store attempts with same dedupKey result in ONLY ONE stored offer sheet | ✅ PASS |
| 2 | `finalizeDeclinedOfferSheet` removes mirrored entries using id OR dedupKey | ✅ PASS |
| 3 | `worldId` fallback removed; missing worldId fails fast (test included) | ✅ PASS |
| 4 | UI wired: DECLINED finalize triggers `finalizeDeclinedOfferSheet` mutation | ✅ PASS |
| 5 | Tests pass: offerSheetPersistence + offerSheetResolution | ✅ PASS (32/32) |
| 6 | Build passes | ✅ PASS |
| 7 | Master Doc updated with Phase 18.2 changelog | ✅ PASS |
| 8 | Return Package created | ✅ PASS |

---

**END OF RETURN PACKAGE**
