# PST_PHASE_12_3A_PUSH_BASE_PICK_RULES_RETURN_PACKAGE.md

**Phase**: 12.3A — Push Base Pick Rules to Firestore (SSOT)
**Status**: COMPLETE
**Date**: 2026-01-31
**Master Doc**: docs/team-scrape/PST_PICK_LEDGER_MASTER_PLAN.md

---

## 1. Summary

Phase 12.3A creates infrastructure to make structured pick rule data runtime-accessible. This allows the PickRow projection layer (Phase 12.3C) to derive protection/condition information from structured Firestore documents instead of parsing from `entitlement.description`.

### What Was Built

1. **New Firestore Collection**: `architect_basePickRules/{pickId}` stores structured protection and condition rules per base pick
2. **Push Script**: Transforms PST ledger data into Firestore-ready documents
3. **Resolver Utility**: Fetches pick rules from Firestore with batch query support
4. **Projection Enhancement**: Optional `pickRulesById` parameter that prefers structured rules over description parsing

---

## 2. Files Changed/Created

| File                                                                          | Action       | Purpose                                                 |
| ----------------------------------------------------------------------------- | ------------ | ------------------------------------------------------- |
| `src/constants/collections.ts`                                                | **MODIFIED** | Added `ARCHITECT_BASE_PICK_RULES_PATH` constant         |
| `team-scrape/draft-picks/scripts/pst/pst_phase_12_3a_push_base_pick_rules.ts` | **CREATED**  | Push script to load ledger and write rules to Firestore |
| `package.json`                                                                | **MODIFIED** | Added `pst:push:base-pick-rules` npm script             |
| `src/features/architect/utils/entitlements/pickRulesResolver.ts`              | **CREATED**  | Resolver utility for fetching pick rules                |
| `src/features/architect/utils/entitlements/entitlementPickRowProjection.js`   | **MODIFIED** | Added `pickRulesById` option with rule-aware derivation |
| `docs/team-scrape/PST_PICK_LEDGER_MASTER_PLAN.md`                             | **MODIFIED** | Added Phase 12.3A entry                                 |

---

## 3. Data Shape

### BasePickRuleDoc (Firestore Document)

```typescript
type BasePickRuleDoc = {
  pickId: string; // Document ID, e.g., "LAL_2027_1st"
  seasonYear: number; // Draft year
  round: 1 | 2; // Draft round
  protections?: Array<{
    type?: 'top_n' | 'range' | 'lottery';
    protectedRange?: string; // "1-4" format for display
    appliesToYears?: number[];
    description?: string;
  }>;
  conditions?: Array<{
    kind: 'swap' | 'swap_right' | 'conveys' | 'did_not_convey';
    description: string;
    relatedPickIds?: string[];
    appliesToYears?: number[];
    controller?: string;
  }>;
  ownershipSource?: string; // "BASE" or "PST_DISPLAY"
  evidenceRowRefs?: string[];
  updatedAtISO: string;
  source: 'PST_LEDGER_FINAL';
};
```

### Transformation Logic

| Ledger Source                   | Target Field                                                |
| ------------------------------- | ----------------------------------------------------------- |
| `encumbrances.protections[]`    | `protections[]` with `protectedRange` as "start-end" string |
| `encumbrances.selectionSpecs[]` | `conditions[]` with related pickIds from pool               |
| `encumbrances.swaps[]`          | `conditions[]` (fallback if no selectionSpecs)              |
| `encumbrances.didNotConvey[]`   | `conditions[]` with `kind: 'did_not_convey'`                |

---

## 4. Resolver API

### Exports from `pickRulesResolver.ts`

```typescript
// Single pick lookup
resolvePickRuleWithDb(db, pickId): Promise<PickRuleDoc | null>
resolvePickRule(pickId): Promise<PickRuleDoc | null>

// Batch lookup (handles 30-item Firestore chunking)
resolvePickRulesByIdsWithDb(db, pickIds): Promise<PickRulesMap>
resolvePickRulesByIds(pickIds): Promise<PickRulesMap>

// Map to object converter for projection layer
pickRulesMapToObject(map): Record<string, PickRuleDoc>
```

---

## 5. Projection Layer Changes

### New Options Parameter

```javascript
projectEntitlementToPickRow(entitlement, {
  teamCode: 'HOU',           // Optional: for via calculation
  pickRulesById: { ... }     // Optional: pre-fetched pick rules
})
```

### Rule-Aware Derivation

When `pickRulesById` is provided:

1. `lookupPickRule()` finds the rule by `entitlement.underlyingPickId`
2. `deriveProtectionDetailsWithRules()` prefers structured rules over description parsing
3. `deriveConditionsTextWithRules()` uses rule conditions for swap/conveyance text
4. Falls back to existing description parsing when no rule exists

### Debug Output Enhancement

When `VITE_DEBUG_ENTITLEMENT_PICKROWS=true`:

```javascript
_debug: {
  sourceHints: {
    // ...existing fields...
    usedPickRule: true,        // NEW: whether rule was used
    pickRuleId: 'LAL_2027_1st' // NEW: which rule was used
  }
}
```

---

## 6. Commands

### Push to Emulator

```bash
# Terminal 1 - Start emulator
npm run emu

# Terminal 2 - Push rules
FIRESTORE_EMULATOR_HOST=127.0.0.1:8082 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 npm run pst:push:base-pick-rules
```

### Expected Output

```
[push] Emulator mode: projectId=scoutzero-bf1ae

=== Push Base Pick Rules ===
Input: /path/to/data/pst/pst_pick_ledger_final_2026_2033.json
Total picks in ledger: 480
Picks with rules: ~100-150

Sample doc IDs: ATL_2026_1st, BOS_2027_1st, ...

✅ Batch 1/1 committed (X docs)

🎉 Base pick rules push complete. X docs written.
```

---

## 7. Verification Steps

### Emulator Verification

1. Start emulator: `npm run emu`
2. Push rules with emulator env vars
3. Open Emulator UI: <http://127.0.0.1:4000>
4. Navigate to Firestore → `architect_basePickRules`
5. Verify:
   - Collection exists
   - Documents have expected structure
   - Protections/conditions arrays populated for encumbered picks

### Build Verification

```bash
npm run build
```

Must pass without errors.

---

## 8. Acceptance Criteria

- [x] `architect_basePickRules` collection can be populated from ledger
- [x] Push script writes docs for picks with protections/conditions
- [x] Resolver file exists and compiles
- [x] Projection supports `pickRulesById` parameter with backward compatibility
- [x] Master doc updated with Phase 12.3A entry
- [x] Return package written

---

## 9. What's NOT in This Phase

Phase 12.3A is infrastructure only. The following are deferred to Phase 12.3B:

1. **Runtime fetching**: Consuming code must call resolver before projection
2. **UI wiring**: Components don't automatically load pick rules yet
3. **Production push**: Only emulator testing covered here

---

## 10. Next Steps (Phase 12.3B)

1. Add pick rules fetching to team entitlement loading hooks
2. Pass `pickRulesById` to projection calls in UI components
3. Push to production Firestore
4. Add integration tests
