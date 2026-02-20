# TM-ENTITLEMENT-DUPE-PREVENT-SWAP — Execution Return Package

**Ticket:** TM-ENTITLEMENT-DUPE-PREVENT-SWAP  
**Status:** COMPLETE  
**Date:** 2026-02-20

---

## Root Cause Analysis

**Primary: A — Non-deterministic ID generation in legacy code path**

The `EntitlementEditorModal.tsx` (Advanced-only legacy editor) uses `useEntitlementEditorState` which calls `generateEntitlementId()` — a function that produces **random IDs** via `Math.random().toString(36)`. When this path is used, the same logical swap produces different IDs on each create, bypassing the deterministic dedupe that `saveEntitlementFromFormState` provides.

**Secondary: B — Swap target normalization was incomplete**

The `normalizeIdentityString()` function in `entitlementIdentity.ts` only lowercased and replaced whitespace. It did not strip punctuation. This meant `"LAL's own 1st round pick"` and `"LALs own 1st round pick"` could produce different identity keys even though they represent the same logical swap.

**Not present: C** — The resolver was not double-surfacing via base/world/vacuum merge, but lacked a defensive dedupe layer for edge cases.

---

## Files Changed

| File                                                               | Change Summary                                                                                             |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| `src/features/architect/admin/useEntitlementEditorState.ts`        | **R1:** Replaced `generateEntitlementId()` (random) with `getEntitlementDeterministicId()` (deterministic) |
| `src/features/architect/utils/entitlements/entitlementIdentity.ts` | **R4:** Strengthened `normalizeIdentityString()` to strip punctuation, collapse whitespace aggressively    |
| `src/features/architect/admin/entitlementEditorFormState.ts`       | **R2:** `buildEntitlementDocument()` now computes and persists `identityKey` field on every document       |
| `src/features/architect/admin/saveEntitlementFromFormState.ts`     | **R3:** Added identityKey dedupe check before vacuum create; added dev-only debug logging                  |
| `src/features/architect/utils/entitlements/entitlementResolver.ts` | **R5:** Added post-resolution dedupe by `identityKey` (prefers vacuum-edited > vacuum-create > base)       |
| `src/features/architect/tradeMachine/EntitlementPicksList.jsx`     | **R5:** Added defensive UI-level dedupe by `identityKey` in sorted entitlement list                        |
| `src/tests/architect/entitlementIdentityDedupeByKey.test.ts`       | **NEW:** 17 test cases covering R1–R5                                                                      |

---

## Before/After Behavior

### Before

- User creates a swap entitlement via "New Entitlement" button
- User converts a pick to the same swap (or clicks "New Entitlement" again with same fields)
- **Result:** Two identical-looking swap entries appear in the entitlement list
- Legacy `EntitlementEditorModal` used random IDs → no dedupe possible
- No `identityKey` persisted on documents
- Resolver had no dedupe layer

### After

- Same swap fields always produce the **same deterministic ID** (all code paths)
- `identityKey` is computed and **persisted** on every saved document (world + vacuum)
- At vacuum create time, if an existing entry has the same `identityKey`, the save **upserts** into it (rekeys legacy random IDs to deterministic IDs)
- Resolver deduplicates resolved list by `identityKey` (defensive layer)
- UI list deduplicates by `identityKey` (secondary defensive layer)
- Aggressive normalization ensures `"LAL's own 1st round pick"` = `"LALs own 1st round pick"` = `"  lal  own  1st  round  pick  "`

---

## Dedupe Defense Layers

| Layer                      | Location                                       | Mechanism                                                     |
| -------------------------- | ---------------------------------------------- | ------------------------------------------------------------- |
| **L1: Deterministic ID**   | All save paths                                 | Same identity → same ID → `setDoc(merge)` overwrites          |
| **L2: identityKey dedupe** | `saveEntitlementFromFormState` (vacuum create) | Pre-write check via `findVacuumCreateByIdentityKey()` → rekey |
| **L3: Resolver dedupe**    | `entitlementResolver.ts`                       | Post-merge dedupe by `identityKey`, prefers vacuum-edited     |
| **L4: UI list dedupe**     | `EntitlementPicksList.jsx`                     | `sortedEntitlements` memo filters by `identityKey`            |

---

## Debug Logging

Dev-only logs (guarded by `import.meta.env.DEV`) at save time:

- `[entitlement-dedupe] save` — identityKey, deterministic ID, isCreate, storageMode
- `[entitlement-dedupe] vacuum create: identityKey match found` — when L2 dedupe fires
- `[entitlement-dedupe] world save` — identityKey, deterministic ID, identity change detection

These logs are stripped in production builds by Vite's dead-code elimination.

---

## Test Results

### New tests: `src/tests/architect/entitlementIdentityDedupeByKey.test.ts`

```
 ✓ R2 — swap document includes identityKey field
 ✓ R2 — pick_ownership document includes identityKey field
 ✓ R2 — identityKey matches computed value from getEntitlementIdentityKey
 ✓ R4 — produces same identityKey regardless of whitespace differences
 ✓ R4 — produces same identityKey regardless of casing differences
 ✓ R4 — produces same identityKey regardless of punctuation differences
 ✓ R4 — produces same identityKey for swapControllerPickId with casing diffs
 ✓ R1 — same swap form state produces same deterministic world ID
 ✓ R1 — same swap form state produces same deterministic vacuum ID
 ✓ R1 — different swaps produce different IDs
 ✓ R1 — isSameEntitlementIdentity returns true for normalized-equivalent swaps
 ✓ R3 — deterministic vacuum IDs are identical for same swap → natural upsert
 ✓ R3 — legacy random ID differs from deterministic ID for same logical swap
 ✓ R5 — deduplicates entries with same identityKey, preferring vacuum-edited
 ✓ R5 — does not dedupe entries with different identityKeys
 ✓ R4 — pool pick IDs are sorted for stable identity
 ✓ R4 — receivesRank numbers are sorted for stable identity

Tests: 17 passed (17)
```

### Existing identity-related tests: zero regressions

```
entitlementIdentityLock.test.tsx:  24 passed
entitlementIdentityMove.test.ts:   7 passed
entitlementIdentityDedupeByKey.test.ts: 17 passed
Total: 41 passed (0 failed)

```

### Build: PASS

```
✓ 3041 modules transformed
✓ built in 37.92s
```

### Full test suite: 229 test files passed, 12 failed (all pre-existing failures unrelated to this change)
