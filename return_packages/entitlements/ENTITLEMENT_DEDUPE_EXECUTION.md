# ENTITLEMENT DEDUPE EXECUTION RETURN PACKAGE

**Ticket:** TM-ENTITLEMENT-DEDUPE  
**Status:** ✅ EXECUTION COMPLETE  
**Date:** 2026-02-20

---

## Executive Summary

Successfully implemented entitlement duplicate prevention across both world (Firestore) and vacuum (localStorage overlay) contexts. The implementation ensures:

1. **Deterministic Identity (R1)**: Same logical entitlement always produces the same identity key and ID
2. **Idempotent Save (R2)**: Second create with same identity overwrites (upserts), not duplicates
3. **Double-Submit Protection (R4)**: UI prevents rapid Apply clicks from triggering multiple writes
4. **Clear Feedback (R3 implied)**: Normal "Saved" toast on successful upsert

---

## What Changed

### New Files Created

| File                                                               | Purpose                             |
| ------------------------------------------------------------------ | ----------------------------------- |
| `src/features/architect/utils/entitlements/entitlementIdentity.ts` | Core identity computation utilities |
| `src/tests/architect/entitlementDedupe.test.ts`                    | Test suite (18 tests)               |

### Files Modified

| File                                                                         | Changes                                                                                                       |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `src/features/architect/admin/saveEntitlementFromFormState.ts`               | Now uses `getEntitlementDeterministicId()` and `getVacuumDeterministicId()` for creates instead of random IDs |
| `src/features/architect/admin/useEntitlementEditorSession.ts`                | Added double-submit guard in `handleApply()`                                                                  |
| `src/features/architect/utils/entitlements/vacuumEntitlementOverlayStore.ts` | Deprecated `makeVacuumEntitlementId()`, updated `applyVacuumCreate()` comment                                 |

---

## Deterministic Identity Rules

### Identity Key Format

The identity key uniquely identifies the "logical" entitlement based on identity fields. Format varies by kind:

| Kind               | Identity Key Format                                                           | Example                                                       |
| ------------------ | ----------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `pick_ownership`   | `own\|{TEAM}\|{YEAR}\|{ROUND}\|{underlyingPickId}`                            | `own\|LAL\|2026\|1\|lal_2026_1st`                             |
| `swap_right`       | `swap\|{TEAM}\|{YEAR}\|{ROUND}\|{swapControllerPickId}\|{target_normalized}`  | `swap\|BOS\|2027\|1\|bos_2027_1st\|boston_own_1st_round_pick` |
| `conveyance_right` | `conv\|{TEAM}\|{YEAR}\|{ROUND}\|{sortedPoolIds}\|{comparator}\|{sortedRanks}` | `conv\|MIA\|2028\|1\|a+b+c\|more_favorable\|1+2`              |

### Identity Fields by Kind

| Kind               | Identity Fields                                                                              | Non-Identity Fields (ignored)                   |
| ------------------ | -------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| `pick_ownership`   | holderTeam, seasonYear, round, kind, underlyingPickId                                        | description, underlyingStatus, protectionLadder |
| `swap_right`       | holderTeam, seasonYear, round, kind, swapControllerPickId, swapTargetDefinition              | swapType, description                           |
| `conveyance_right` | holderTeam, seasonYear, round, kind, poolUnderlyingPickIds, receivesComparator, receivesRank | description, protectionLadder                   |

### Normalization Rules

- **Team codes**: Uppercase, trimmed (e.g., `lal` → `LAL`)
- **Numbers**: Parsed to integers, 0 on failure
- **String fields**: Lowercase, trimmed, spaces replaced with underscores
- **Arrays**: Sorted before joining (ensures order-independent identity)

### Deterministic ID Format

```
World:  ent:{TEAM}:{YEAR}:{ROUND}:{kindShort}:{hash8}
Vacuum: vacuum:{TEAM}:{YEAR}:{ROUND}:{kindShort}:{hash8}
```

Where `{hash8}` is an 8-character hex deterministic hash (djb2) of the identity key.

**Examples:**

```
ent:LAL:2026:1:own:1a2b3c4d
vacuum:BOS:2027:1:swap:5e6f7a8b
```

---

## World vs Vacuum Behavior

### World Mode (Firestore)

| Scenario                         | Behavior                                                |
| -------------------------------- | ------------------------------------------------------- |
| Create new entitlement           | Deterministic ID computed, `setDoc()` called            |
| Create duplicate (same identity) | Same deterministic ID → Firestore `setDoc()` overwrites |
| Edit existing entitlement        | Uses existing ID (no change)                            |

### Vacuum Mode (localStorage overlay)

| Scenario                         | Behavior                                                  |
| -------------------------------- | --------------------------------------------------------- |
| Create new entitlement           | Deterministic vacuum ID computed, stored in `creates[id]` |
| Create duplicate (same identity) | Same deterministic ID → `creates[id]` overwritten         |
| Edit existing base entitlement   | Stored in `edits[baseId]`                                 |
| Re-edit vacuum create            | Stored in `creates[vacuumId]` (overwrites)                |

---

## Double-Submit Protection

The `handleApply()` function in `useEntitlementEditorSession.ts` now includes:

```typescript
const handleApply = useCallback(async () => {
  // Guard: If already saving, ignore the call
  if (saving) {
    return;
  }
  setSaving(true);
  try {
    // ... save logic
  } finally {
    setSaving(false);
  }
}, [saving, ...])
```

This ensures:

- Rapid double-clicks are ignored
- Only one save in flight at a time
- `saving` state resets on success or error

---

## Validation Results

### Build

```
✓ built in 31.73s (3040 modules transformed)
```

### New Tests (entitlementDedupe.test.ts)

```
✓ Identity Key Stability (R1) (4 tests)
✓ Deterministic ID Generation (R1) (4 tests)
✓ isSameEntitlementIdentity Helper (2 tests)
✓ extractIdentityFields Helper (3 tests)
✓ Array Sorting in Identity (2 tests)
✓ Edge Cases (3 tests)
──────────────────────────────────
18 passed (18)
```

### Existing Tests (no regression)

```
entitlementEditorUnification.test.ts: 9 passed
vacuumEntitlementOverlayStore.test.ts: 29 passed
```

---

## Known Limitations

### Legacy Duplicates (Not Addressed)

Entitlements created before this fix may have random IDs that don't match the new deterministic pattern. If duplicates exist under different IDs:

- They are NOT automatically detected or merged
- A separate migration/cleanup pass would be needed
- **Recommendation**: Create a follow-up ticket for legacy duplicate detection and cleanup

### Complex Entitlement Kinds

For rare/complex entitlements that don't fit the standard identity model:

- The system still generates deterministic IDs based on available fields
- If identity cannot be uniquely determined, duplicates are still possible
- **Future enhancement**: Add explicit `userConfirmedDuplicate` flag for intentional duplicates

### swapTargetDefinition Variance

The `swapTargetDefinition` field is free-text. If users describe the same swap differently:

- `"Boston own 1st round pick"` vs `"BOS 2027 1st"`
- These will produce different identity keys
- **Future enhancement**: Structured swap target definition instead of free text

---

## R1-R4 Checklist

| Requirement                      | Status  | Notes                                                                           |
| -------------------------------- | ------- | ------------------------------------------------------------------------------- |
| **R1**: Deterministic Identity   | ✅ PASS | `getEntitlementIdentityKey()` and `getEntitlementDeterministicId()` implemented |
| **R2**: Idempotent Save          | ✅ PASS | World uses `setDoc()` with deterministic ID; Vacuum uses keyed `creates[id]`    |
| **R3**: Double-Submit Protection | ✅ PASS | `handleApply()` guards on `saving` state                                        |
| **R4**: Clear Feedback           | ✅ PASS | Normal "Saved" toast on upsert; no confusing errors                             |

---

## Files Summary

### New Identity Module

```
src/features/architect/utils/entitlements/entitlementIdentity.ts
├── getEntitlementIdentityKey(doc)      → stable identity string
├── getEntitlementDeterministicId(doc)  → `ent:...` format ID
├── getVacuumDeterministicId(doc)       → `vacuum:...` format ID
├── isSameEntitlementIdentity(a, b)     → boolean comparison
└── extractIdentityFields(doc)          → identity-only subset
```

### Updated Save Pipeline

```
saveEntitlementFromFormState.ts
├── Uses getEntitlementDeterministicId() for world creates
└── Uses getVacuumDeterministicId() for vacuum creates

useEntitlementEditorSession.ts
└── handleApply() guards on `saving` state
```

---

## Usage Examples

### Computing Identity for Comparison

```typescript
import {
  getEntitlementIdentityKey,
  isSameEntitlementIdentity,
} from './entitlementIdentity';

const doc1 = {
  holderTeam: 'LAL',
  seasonYear: 2026,
  round: 1,
  kind: 'pick_ownership',
  underlyingPickId: 'LAL_2026_1st',
};
const doc2 = {
  holderTeam: 'lal',
  seasonYear: '2026',
  round: 1,
  kind: 'pick_ownership',
  underlyingPickId: 'LAL_2026_1st',
};

// These are the same identity:
isSameEntitlementIdentity(doc1, doc2); // true
getEntitlementIdentityKey(doc1) === getEntitlementIdentityKey(doc2); // true
```

### Getting Deterministic ID for Creates

```typescript
import {
  getEntitlementDeterministicId,
  getVacuumDeterministicId,
} from './entitlementIdentity';

const doc = {
  holderTeam: 'BOS',
  seasonYear: 2027,
  round: 1,
  kind: 'swap_right',
  swapControllerPickId: 'BOS_2027_1st',
  swapTargetDefinition: 'Target',
};

// For world creates:
const worldId = getEntitlementDeterministicId(doc); // "ent:BOS:2027:1:swap:a1b2c3d4"

// For vacuum creates:
const vacuumId = getVacuumDeterministicId(doc); // "vacuum:BOS:2027:1:swap:a1b2c3d4"
```

---

## Next Steps (Recommendations)

1. **Legacy Cleanup Ticket**: Create ticket for detecting and merging duplicate entitlements created before this fix
2. **Structured Swap Target**: Consider replacing free-text `swapTargetDefinition` with structured fields
3. **Admin Duplicate Report**: Add admin view to surface potential duplicate entitlements by identity key
