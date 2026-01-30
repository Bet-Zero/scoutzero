# PHASE 53 — TPE Expiry Exception History Logging (Season Advance) — EXECUTION RETURN PACKAGE

**Date:** 2026-01-29  
**Mode:** EXECUTION  
**Status:** ✅ COMPLETE

---

## GOAL

When season advance expires TPEs, emit durable `exceptionHistory[]` entries of type `TPE_EXPIRED` (idempotent, no dupes), persisted onto each team overlay doc.

This closes the remaining "TPEs disappear with no audit trail" hole, and aligns expiry events with Phase 49's durable activity feed.

---

## DISCOVERY SUMMARY

### A) Season Advance TPE Expiry Location

| Function                                   | File                                            | Purpose                                                                              |
| ------------------------------------------ | ----------------------------------------------- | ------------------------------------------------------------------------------------ |
| `advanceSeasonInWorld()`                   | `src/features/architect/utils/seasonManager.js` | Entry point for season advance; has access to `worldId`                              |
| `processTeamSeasonTransitionWithOptions()` | `src/features/architect/utils/seasonManager.js` | Per-team processing; now receives `worldId` via `resolutionContext`                  |
| `processTradeExceptions()`                 | `src/features/architect/utils/tpeLifecycle.js`  | Pure compute layer for TPE expiry; returns `{ activeTPEs, expiredTPEs, hasChanges }` |

**Team Write Point:**

- Line ~575 in `seasonManager.js`: `batch.set(snapshotRef, updatedTeam)` writes the updated team (including `tradeExceptions[]` and `exceptionHistory[]`) to Firestore

### B) `processTradeExceptions()` Output Structure

```javascript
{
  hasChanges: boolean,
  activeTPEs: Array<TPE>,      // TPEs that are still valid (not expired)
  expiredTPEs: Array<TPE>,     // TPEs that expired (includes _expiryParams metadata)
}
```

Each expired TPE includes:

- `id` - TPE identifier
- `remainingAmount` / `amount` - for logging expired value
- `totalAmount` - original TPE amount
- `expiresOn` (or legacy `expiryISO`) - expiry date
- `createdFrom` - source of TPE creation
- `_expiryParams` - metadata added by `processTradeExceptions()` containing `expiryStr` and `boundaryStr`

---

## IMPLEMENTATION SUMMARY

### Task A — New History Entry Type ✅

Added to `src/features/architect/utils/exceptionHistory/historyHelpers.js`:

```javascript
const ENTRY_TYPES = {
  CREATED: 'TPE_CREATED',
  CONSUMED: 'TPE_CONSUMED',
  EXPIRED: 'TPE_EXPIRED', // NEW
};
```

**Entry Shape:**

```javascript
{
  historyKey: string,           // Deterministic key for dedupe
  type: 'TPE_EXPIRED',
  teamCode: string,
  tpeId: string,
  amountExpired: number,        // remainingAmount at expiry
  totalAmount: number,          // Original TPE amount
  expiresOn: string,            // ISO date when TPE expired
  toSeason: string,             // Target season (e.g., "2026-27")
  timestamp: string,            // When entry was created
  createdFrom?: string,         // Optional: source of original TPE
  worldId?: string,             // Only present if not 'global'
}
```

### Task B — Deterministic History Key ✅

Added `buildExpiryHistoryKey()` helper:

**Key Format:**

```
seasonAdvance:{worldId}:{teamCode}:{tpeId}:expired:{toSeason}|{expiresOn}|{amountExpired}
```

Example:

```
seasonAdvance:world-123:BOS:tpe-abc:expired:2026-27|2026-06-15T00:00:00.000Z|5000000
```

### Task C — Emit History During Season Advance ✅

Updated `processTeamSeasonTransitionWithOptions()` in `seasonManager.js`:

1. Threaded `worldId` through from `advanceSeasonInWorld()` via `resolutionContext`
2. After `processTradeExceptions()` computes expired TPEs:
   - For each expired TPE, call `createTpeExpiryHistoryEntry()` to generate entry
   - Call `appendExceptionHistory(updatedTeam, entries)` to persist (with dedupe)
3. History entries are part of the same batch write as `tradeExceptions[]`

### Task D — Tests ✅

Created `src/tests/architect/phase53_seasonAdvance_tpe_expiry_history_integration.test.js` with 17 tests:

| Test Category                       | Tests | Description                                                                   |
| ----------------------------------- | ----- | ----------------------------------------------------------------------------- |
| Test 1: Expired TPE Creates History | 2     | Single and multiple expired TPEs create TPE_EXPIRED entries                   |
| Test 2: Boundary Condition          | 2     | Exact boundary = ACTIVE (no entry); before boundary = EXPIRED (entry created) |
| Test 3: Dual-Source No Ghosts       | 2     | Dedupe produces ONE entry; distinct TPEs produce distinct entries             |
| Test 4: Idempotency                 | 2     | Retry produces no duplicate entries; historyKey dedupe works                  |
| Test 5: Key Determinism             | 2     | Same inputs = same key; different inputs = different keys                     |
| Edge Cases                          | 4     | Empty TPEs, partial consumption, existing history preserved, worldId default  |
| Helper Validation                   | 3     | Required fields, valid entry, key format                                      |

---

## FILES MODIFIED

| File                                                              | Change                                                                                                                         |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `src/features/architect/utils/exceptionHistory/historyHelpers.js` | Added `TPE_EXPIRED` type, `buildExpiryHistoryKey()`, `createTpeExpiryHistoryEntry()`, updated exports                          |
| `src/features/architect/utils/seasonManager.js`                   | Imported history helpers + `getTpeExpiryISO`; threaded `worldId` through to team processing; added TPE expiry history emission |
| `docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md`     | Added Phase 53 entry                                                                                                           |

## FILES CREATED

| File                                                                               | Purpose                                             |
| ---------------------------------------------------------------------------------- | --------------------------------------------------- |
| `src/tests/architect/phase53_seasonAdvance_tpe_expiry_history_integration.test.js` | 17 integration tests for TPE expiry history logging |

---

## VALIDATION RESULTS

| Command                                                       | Result                   |
| ------------------------------------------------------------- | ------------------------ |
| `npm run test -- --run src/tests/architect/phase53_*.test.js` | ✅ 17/17 tests passing   |
| `npm run test -- --run src/tests/architect/`                  | ✅ 270/270 tests passing |
| `npm run build`                                               | ✅ Build successful      |

---

## ACCEPTANCE CRITERIA

| Criterion                                                                                    | Status |
| -------------------------------------------------------------------------------------------- | ------ |
| Season advance logs `TPE_EXPIRED` entries into `team.exceptionHistory[]`                     | ✅     |
| Entries are idempotent and deduped by deterministic `historyKey`                             | ✅     |
| Exact-boundary semantics unchanged (`expiresOn == boundary` stays ACTIVE, no expiry history) | ✅     |
| Dual-source merge produces no ghost expiry logs                                              | ✅     |
| All tests + build pass                                                                       | ✅     |
| Master Doc updated with Phase 53 entry                                                       | ✅     |
| Return package written                                                                       | ✅     |

---

## STOP CONDITIONS

None encountered. `worldId` was accessible via `advanceSeasonInWorld()` and threaded through `resolutionContext` to `processTeamSeasonTransitionWithOptions()`.

---

## NOTES

1. **Boundary Semantics Preserved**: The existing Phase 51 boundary semantics (`expiresOn < boundary` = expired; `expiresOn >= boundary` = active) are unchanged. TPE expiry history entries are only created for actually expired TPEs.

2. **History Entry Persistence**: History entries are written as part of the same Firestore batch that updates `tradeExceptions[]`, ensuring atomicity.

3. **Dual-Source Compatibility**: The dedupe logic in `appendExceptionHistory()` (from Phase 49) prevents duplicate entries even if the same TPE appears in both `tradeExceptions[]` and `exceptions.tpe[]` sources.

4. **Amount Fields**: The history entry captures both `amountExpired` (remainingAmount at expiry, what was "lost") and `totalAmount` (original TPE value, for context).
