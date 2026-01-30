# PST_PHASE_12_3C_ENTITLEMENT_PICKROW_PROJECTION_RETURN_PACKAGE.md

**Phase**: 12.3C — Entitlements → PickRow Projection Layer  
**Status**: COMPLETE  
**Date**: 2026-01-30  
**Master Doc**: docs/team-scrape/PST_PICK_LEDGER_MASTER_PLAN.md

---

## 1. Discovery Findings — Where Rule Data Exists Today

| File Path                                                          | Fields Available                                                               | Structured vs Text         | Runtime Accessible?      | Notes                                                                        |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------ | -------------------------- | ------------------------ | ---------------------------------------------------------------------------- | ------------ | --------- |
| `data/team-scrape/pst_pick_ledger_final.json`                      | `protections[]` with `type`, `protectedRange`, `appliesToYears`, `description` | ✅ Structured (JSON)       | ❌ Not loaded at runtime | Canonical ledger with 480 picks. Rich protection data exists but not in app. |
| `data/team-scrape/entitlements.json`                               | `kind`, `description`, `underlyingStatus`, `evidenceRowRefs`                   | ✅ Structured (JSON)       | ✅ Via Firestore         | 540 entitlements. `underlyingStatus` = 'clean'                               | 'encumbered' | 'pooled'. |
| `src/schemas/draftPicks.schema.ts`                                 | Protection schema                                                              | ✅ Structured (Zod)        | ⚠️ Schema exists         | Marked "EXISTING_SCHEMA_BUT_UNUSED" in test fixtures.                        |
| `src/features/architect/utils/entitlements/entitlementResolver.ts` | EffectiveEntitlement type                                                      | ✅ Structured (TypeScript) | ✅ Available             | Core resolver for fetching entitlements.                                     |
| Phase 4 ledger proposals                                           | `protectionLadder[]`, `conveyanceChain[]`                                      | ✅ Structured (JSON)       | ❌ Never implemented     | Multi-year ladders designed but not built.                                   |
| team-scrape raw PST data                                           | Protection text in descriptions                                                | ⚠️ Text (string)           | ✅ Via description field | Best source currently available at runtime.                                  |

### Key Finding

**Protection details exist in PST artifacts (`pst_pick_ledger_final.json`) with structured `protectedRange` and `appliesToYears` but are NOT currently loaded at app runtime.** The projection layer must parse protection info from the `description` field on entitlements, with fallback text when parsing fails.

---

## 2. Files Changed/Created

| File                                                                        | Action       | Purpose                                                                                                                                                |
| --------------------------------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/features/architect/utils/entitlements/entitlementPickRowProjection.js` | **CREATED**  | Core projection utility with `projectEntitlementToPickRow()`, `getPickRowDisplayLabel()`, `getPickRowSecondaryText()`                                  |
| `src/features/architect/tradeMachine/EntitlementPickRow.jsx`                | **MODIFIED** | 2-line layout: Line 1 = year/round/label, Line 2 = protectionText/conditionsText (muted). Debug tooltip behind `VITE_DEBUG_ENTITLEMENT_PICKROWS=true`. |
| `src/features/architect/tradeMachine/TradeSummaryPanel.jsx`                 | **MODIFIED** | "Entitlements Traded" section now shows protection/conditions text using projection.                                                                   |
| `src/features/architect/tradeMachine/TradeReceiptPanel.jsx`                 | **MODIFIED** | Entitlements In/Out sections now show protection/conditions text.                                                                                      |
| `tests/entitlements/entitlementPickRowProjection.test.js`                   | **CREATED**  | 28 unit tests covering all entitlement kinds and edge cases.                                                                                           |
| `docs/team-scrape/PST_PICK_LEDGER_MASTER_PLAN.md`                           | **MODIFIED** | Added Phase 12.3C entry in status table and detailed section.                                                                                          |

---

## 3. Test/Build Outputs

### Build Output

```
✓ 2965 modules transformed.
dist/index.html                   0.60 kB │ gzip:   0.37 kB
dist/assets/index-5bb86e62.css   75.84 kB │ gzip:  13.24 kB
dist/assets/index-007db1a8.js 2,012.58 kB │ gzip: 585.25 kB
✓ built in 35.56s
```

### Test Output

```
 ✓ tests/entitlements/entitlementPickRowProjection.test.js (28)
   ✓ entitlementPickRowProjection (28)
     ✓ projectEntitlementToPickRow (15)
       ✓ pick_ownership entitlements (4)
       ✓ swap_right entitlements (2)
       ✓ conveyance_right entitlements (2)
       ✓ protectionText fallback behavior (4)
       ✓ edge cases (3)
     ✓ getPickRowDisplayLabel (7)
     ✓ getPickRowSecondaryText (6)

 Test Files  1 passed (1)
      Tests  28 passed (28)
   Duration  3.02s
```

---

## 4. New Entitlement UI Row Formatting (Screenshot Description)

### EntitlementPickRow (Before)

```
┌────────────────────────────────────────────────────────────┐
│ ☑ Dallas' 2027 1st top 4 protected                   [Own] │
└────────────────────────────────────────────────────────────┘
```

### EntitlementPickRow (After — Phase 12.3C)

```
┌────────────────────────────────────────────────────────────┐
│ ☑ 2027 R1 — 2027 1st via DAL (Cond.)                 [Own] │
│   Top 4 protected                                          │
└────────────────────────────────────────────────────────────┘
```

**Changes**:

- **Line 1**: Standardized format "{year} R{round} — {label}" with "(Cond.)" or "(Swap)" suffix
- **Line 2**: Muted protection/conditions text (e.g., "Top 4 protected", "Swap from pool of 3 picks")
- **Debug tooltip**: When `VITE_DEBUG_ENTITLEMENT_PICKROWS=true`, shows `_debug.sourceHints` on hover

### TradeSummaryPanel "Entitlements Traded"

```
Entitlements Traded
┌────────────────────────────────────────────────────────────┐
│ 2027 R1                [Own]           Dallas' 2027 1st... │
│ Top 4 protected                                            │
└────────────────────────────────────────────────────────────┘
```

### TradeReceiptPanel (Debug Mode)

```
Entitlements Out:
├─ 2027 R1 — pick_ownership (DAL_pick_ownership_2027_R1)
│  Top 4 protected

Entitlements In:
├─ 2026 R1 — swap_right (ATL_swap_right_2026_R1) from ATL
│  Swap option · Can swap for SAS_2026_1st
```

---

## 5. What's Still Missing for Full Replacement

### Immediate Gaps (Blockers for Legacy Removal)

| Gap                         | Description                                                                                               | Recommended Phase |
| --------------------------- | --------------------------------------------------------------------------------------------------------- | ----------------- |
| **entitlementIds transfer** | Trade execution builds `entitlementsTraded` but does NOT transfer `entitlementIds` between team snapshots | Phase 13          |
| **Legacy fallback removal** | `OutgoingPicksList`, `TradePickRow`, `draftPicksObligations` fallbacks still exist                        | Phase 14          |
| **Schema deprecation**      | `picksOut`, `picksIn`, `draftPicksObligations` fields still in team schemas                               | Phase 15          |

### Data Quality Gaps (Not Blockers)

| Gap                                         | Description                                                 | Potential Solution                                            |
| ------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------- |
| **Structured protections not in Firestore** | Protection details parsed from description text at runtime  | Future phase: push `protectionMeta` to Firestore entitlements |
| **Multi-year conveyance ladders**           | Phase 4 proposed `protectionLadder[]` but never implemented | Future phase: implement ladder structures                     |
| **Lottery resolution**                      | Projection layer is display-only, not deterministic outcome | Out of scope for entitlements — separate lottery engine       |

---

## 6. Acceptance Criteria Verification

| AC  | Requirement                                                                                | Status          |
| --- | ------------------------------------------------------------------------------------------ | --------------- |
| AC1 | Projection utility exists and returns stable PickRow objects for all entitlement kinds     | ✅ PASS         |
| AC2 | EntitlementPickRow UI shows year/round and protection text (or deterministic fallback)     | ✅ PASS         |
| AC3 | TradeSummaryPanel "Entitlements Traded" shows protectionText/conditionsText when available | ✅ PASS         |
| AC4 | TradeReceiptPanel shows same (incoming/outgoing)                                           | ✅ PASS         |
| AC5 | Tests added and pass                                                                       | ✅ PASS (28/28) |
| AC6 | npm run build passes                                                                       | ✅ PASS         |

---

## 7. PickRow Schema Reference

```javascript
/**
 * @typedef {object} PickRow
 * @property {string} id - Entitlement ID
 * @property {number} year - Draft year (seasonYear)
 * @property {number} round - Draft round (1 or 2)
 * @property {string} kind - 'pick_ownership' | 'conveyance_right' | 'swap_right'
 * @property {'outright_pick' | 'conditional_right' | 'swap_right'} assetType
 * @property {string} originalTeam - Original team code (best-effort)
 * @property {string|null} via - Via team code if different from holder
 * @property {string} protectionText - Human-readable protection details (never blank)
 * @property {PickRowProtectionMeta|null} protectionMeta - Structured protection data if available
 * @property {string|null} conditionsText - Conditions/conveyance text if applicable
 * @property {string|null} note - Additional notes
 * @property {object|null} _debug - Debug info (when VITE_DEBUG_ENTITLEMENT_PICKROWS=true)
 */
```

---

## 8. Next Recommended Phases

1. **Phase 13**: Wire `entitlementIds` transfer in mutation pipeline (`mutationPipeline.js`)
2. **Phase 14**: Remove legacy fallbacks (`OutgoingPicksList`, `TradePickRow`, `draftPicksObligations` reads)
3. **Phase 15**: Schema deprecation and data cleanup
4. **Future**: Push structured `protectionMeta` to Firestore entitlements for richer display
