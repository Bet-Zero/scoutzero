# Return Package: HOU 2026 R2 Owner Overlay Fix (Phase 8.3)

**Date**: 2026-01-29  
**Status**: COMPLETE  
**Phase**: 8.3 — Ranked Conveyance Gate

---

## Problem Statement

User reported HOU appearing to own 7 different 2026 R2 physical pick slots. Initial audit (see `PST_HOU_2026_R2_AUDIT_RETURN_PACKAGE.md`) confirmed all 7 matched the owner overlay, indicating the upstream overlay was setting incorrect ownership.

**Pre-fix HOU 2026 R2 entitlements (7 picks)**:

| pickId       | Status                         |
| ------------ | ------------------------------ |
| CHI_2026_2nd | ✅ Legitimate (explicit trade) |
| DAL_2026_2nd | ❌ Should be DAL               |
| HOU_2026_2nd | ✅ Legitimate (original owner) |
| IND_2026_2nd | ❌ Should be IND               |
| LAC_2026_2nd | ❌ Should be LAC               |
| MIA_2026_2nd | ❌ Should be MIA               |
| PHI_2026_2nd | ❌ Should be PHI               |

---

## Root Cause Analysis

### Trace Method

Created `pst_trace_owner_overlay_anomalies.ts` to trace overlay claims back to normalized rows with flags.

### Findings

All 6 problematic picks (excluding CHI which is legitimate) had overlay claims from the Rockets page with `rowKind: "transaction"` (wins precedence), but the normalized rows showed `flags.mentionsLeastMostFavorable = true`.

**Example from trace output**:

```json
{
  "pickId": "DAL_2026_2nd",
  "ledgerOwner": "HOU",
  "problemType": "EXTRACTION_BUG",
  "overlayClaims": [
    {
      "sourceTeamPage": "Rockets",
      "rowRef": "r15",
      "displayOwner": "HOU",
      "rowKind": "transaction",
      "normalizedRowFlags": {
        "mentionsLeastMostFavorable": true
      }
    }
  ]
}
```

### Classification

All 6 picks were classified as `EXTRACTION_BUG`:

- The extraction sets `displayOwner=HOU` for all rows on the Rockets page
- But the actual PST text describes **ranked conveyances** ("least favorable of PHI/DAL/OKC picks")
- These conditional picks don't have a deterministic owner until standings resolve

---

## Solution: Ranked Conveyance Gate

### Approach

Added a filter in `pst_apply_display_owner_overlay.ts` that removes overlay claims where the source row has `mentionsLeastMostFavorable = true` before determining the winner.

### Code Changes

**pst_apply_display_owner_overlay.ts**:

```typescript
// New interface for normalized rows with flags
interface NormalizedRowWithFlags {
  provenance?: { sourceTeamPage?: string; rowRef?: string };
  flags?: {
    mentionsLeastMostFavorable?: boolean;
    // ... other flags
  };
}

// Helper to check if an overlay claim is a ranked conveyance
function isRankedConveyanceClaim(overlay: OwnerOverlayItem): boolean {
  const key = `${overlay.sourceTeamPage}|${overlay.rowRef}`;
  const normalizedRow = normalizedRowsMap.get(key);
  if (!normalizedRow?.flags) return false;
  return normalizedRow.flags.mentionsLeastMostFavorable === true;
}

// RANKED CONVEYANCE GATE: Filter before precedence sorting
const overlays = allOverlays.filter((o) => !isRankedConveyanceClaim(o));
```

**pst_validate_owner_overlay_regressions.ts**:

Added negative assertions to prevent regression:

```typescript
const NEGATIVE_ASSERTIONS: NegativeAssertion[] = [
  { pickId: 'DAL_2026_2nd', notOwner: 'HOU', description: '...' },
  { pickId: 'IND_2026_2nd', notOwner: 'HOU', description: '...' },
  { pickId: 'LAC_2026_2nd', notOwner: 'HOU', description: '...' },
  { pickId: 'MIA_2026_2nd', notOwner: 'HOU', description: '...' },
  { pickId: 'PHI_2026_2nd', notOwner: 'HOU', description: '...' },
];
```

---

## Files Modified

| File                                                                            | Change                                                            |
| ------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `team-scrape/draft-picks/scripts/pst/pst_apply_display_owner_overlay.ts`        | Added ranked conveyance gate                                      |
| `team-scrape/draft-picks/scripts/pst/pst_validate_owner_overlay_regressions.ts` | Added negative assertions, removed incorrect Phase 2.1 assertions |
| `team-scrape/draft-picks/scripts/pst/pst_trace_owner_overlay_anomalies.ts`      | NEW - trace script                                                |
| `team-scrape/draft-picks/scripts/pst/pst_audit_hou_2026_r2.ts`                  | NEW - audit script                                                |
| `docs/team-scrape/PST_PICK_LEDGER_MASTER_PLAN.md`                               | Added Phase 8.3 documentation                                     |

---

## Pipeline Rebuild

```bash
npm run pst:apply:overlay     # Apply overlay with ranked conveyance gate
npm run pst:phase-4           # Rebuild profile rows
npm run pst:phase-5           # Rebuild final ledger
npm run pst:entitlements      # Rebuild entitlement assets
npm run pst:validate:overlay:regressions  # Verify fix
```

---

## Verification

### Before Fix

```
HOU 2026 R2 pick_ownership entitlements: 7
- CHI_2026_2nd, DAL_2026_2nd, HOU_2026_2nd, IND_2026_2nd, LAC_2026_2nd, MIA_2026_2nd, PHI_2026_2nd
```

### After Fix

```
HOU 2026 R2 pick_ownership entitlements: 2
- CHI_2026_2nd (legitimate - explicit trade)
- HOU_2026_2nd (legitimate - original owner)
```

### Regression Validator Output

```
Positive Assertions (expected owner):
--------------------------------------
✅ PASS: CHI_2026_2nd
   owner=HOU, source=PST_DISPLAY

Negative Assertions (must NOT be this owner):
----------------------------------------------
✅ PASS: DAL_2026_2nd
   owner=DAL (correctly NOT HOU)
✅ PASS: IND_2026_2nd
   owner=IND (correctly NOT HOU)
✅ PASS: LAC_2026_2nd
   owner=LAC (correctly NOT HOU)
✅ PASS: MIA_2026_2nd
   owner=MIA (correctly NOT HOU)
✅ PASS: PHI_2026_2nd
   owner=PHI (correctly NOT HOU)

--------------------------------------
Total: 6 passed, 0 failed

✅ All regression checks passed!
```

### Overlay Apply Stats

```
rankedConveyanceSkipped: 127  # Overlay claims filtered by ranked conveyance gate
```

---

## New npm Scripts

| Script                  | Command                                                        | Description                                    |
| ----------------------- | -------------------------------------------------------------- | ---------------------------------------------- |
| `pst:trace:hou:2026:r2` | `npx tsx team-scrape/.../pst_trace_owner_overlay_anomalies.ts` | Trace overlay claims for HOU 2026 R2 anomalies |
| `pst:audit:hou:2026:r2` | `npx tsx team-scrape/.../pst_audit_hou_2026_r2.ts`             | Audit HOU 2026 R2 ledger vs entitlements       |

---

## Audit Outputs

- `data/pst/audits/hou_2026_r2_owner_overlay_trace.json` - Structured trace data
- `data/pst/audits/hou_2026_r2_owner_overlay_trace.txt` - Human-readable summary

---

## Emulator Push (Manual Step)

To push the corrected entitlements to the Firebase emulator:

```bash
# 1. Start emulator (wait for it to be ready)
npm run emu

# 2. Push base entitlements to architect_baseEntitlements collection
npm run pst:push:base-entitlements

# 3. Patch base teams with entitlementIds
npm run pst:patch:base-teams-entitlements
```

**Verification after push**:

In emulator Firestore UI (<http://localhost:4000/firestore>e>):

1. `architect_baseEntitlements`: HOU should NOT have pick_ownership entitlements for:
   - DAL_2026_2nd
   - IND_2026_2nd
   - LAC_2026_2nd
   - MIA_2026_2nd
   - PHI_2026_2nd

2. `architect_baseTeams/HOU.entitlementIds`: Should NOT include those `ent:HOU:2026:2:own:*` entries for the problematic picks

---

## Related Phases

- **Phase 8.2**: Encumbered status swap-backing (fixed IND/LAC/MIA encumbered status)
- **Phase 8.3**: This fix (ranked conveyance gate for overlay ownership)

---

## Summary

The ranked conveyance gate successfully filters out overlay claims that describe conditional ownership mechanisms (like "least/most favorable of X picks") before determining the display owner. This ensures picks with indeterminate ownership remain with their original team until standings resolve the ranked selection.
