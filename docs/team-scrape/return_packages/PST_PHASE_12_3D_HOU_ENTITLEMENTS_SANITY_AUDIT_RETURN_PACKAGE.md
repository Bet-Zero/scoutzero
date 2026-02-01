# PST PHASE 12.3D — HOU ENTITLEMENTS SANITY AUDIT RETURN PACKAGE

**Date**: 2026-02-01  
**Status**: ✅ COMPLETE  
**Agent**: Execution Mode

---

## EXECUTIVE SUMMARY

This phase creates a deterministic audit that answers why HOU appears to have "too many picks" in the UI by joining three data sources:

1. **Entitlements** (`pst_entitlement_assets_2026_2033.json`)
2. **Ledger** (`pst_pick_ledger_final_2026_2033.json`)
3. **Pick Rules** (`pst_pick_rule_profiles_final_2026_2033.json`)

The audit produces:

- One row per HOU entitlement with joined ledger/rules data
- Computed flags for suspicious conditions
- Aggregate summaries by kind and year/round
- A focused "HOU 2026 R2" section for quick verification
- Both JSON and human-readable text reports

---

## HOW TO RUN THE AUDIT

```bash
npm run pst:audit:hou:entitlements
```

This runs the audit script and outputs:

- `data/pst/audits/hou_entitlements_sanity_audit.json` (structured data)
- `data/pst/audits/hou_entitlements_sanity_audit.txt` (human-readable)

---

## WHAT THE AUDIT CHECKS

### Flags Computed Per Row

| Flag                                      | Meaning                                                                                  |
| ----------------------------------------- | ---------------------------------------------------------------------------------------- |
| `flag_missing_underlyingPickId`           | A `pick_ownership` entitlement is missing its underlying pick reference                  |
| `flag_owner_mismatch`                     | Ledger owner differs from HOU (may indicate conveyance/swap right, not direct ownership) |
| `flag_ranked_conveyance_present`          | Pick rules indicate "least favorable" / "most favorable" selection                       |
| `flag_pool_or_swap_without_expected_kind` | A `pick_ownership` entitlement has swap/conveyance conditions in its rules               |
| `flag_source_is_PST_DISPLAY`              | Ownership derived from PST display overlay (informational, not necessarily bad)          |

### Aggregate Summaries

- **Total HOU entitlements**
- **Counts by kind** (`pick_ownership`, `conveyance_right`, `swap_right`)
- **Counts by year/round**
- **Busy buckets** (any year/round with 4+ entitlements)

---

## SAMPLE OUTPUT

```
======================================================================
HOU ENTITLEMENTS SANITY AUDIT
Phase 12.3D - Entitlements + PickRules + Ledger Join
======================================================================

Audit Date: 2026-02-01T...
Target Team: HOU

Input Files:
  Ledger: data/pst/pst_pick_ledger_final_2026_2033.json
  Entitlements: data/pst/pst_entitlement_assets_2026_2033.json
  PickRules: data/pst/pst_pick_rule_profiles_final_2026_2033.json

======================================================================
SUMMARY
======================================================================

Total HOU Entitlements: XX

By Kind:
  pick_ownership: XX
  conveyance_right: XX
  swap_right: XX

By Year/Round:
  2026 R1: XX
  2026 R2: XX
  ...

======================================================================
SUSPICIOUS ROWS (if any)
======================================================================

  (none - all rows passed sanity checks)
  -- OR --
  Entitlement: ent:HOU:2026:2:...
    Kind: pick_ownership
    FLAGS:
      ⚠️ flag_ranked_conveyance_present
      ...

======================================================================
HOU 2026 R2 FOCUSED SECTION
======================================================================

Count: X

Entitlement: ent:HOU:2026:2:own:...
  Kind: pick_ownership
  UnderlyingPickId: HOU_2026_2nd
  LedgerOwner: HOU
  ...

======================================================================
CONCLUSION
======================================================================

✅ No suspicious rows detected.
✅ HOU 2026 R2 count (X) looks plausible.
```

---

## ARTIFACTS CREATED

### 1. Audit Script

**Location**: `team-scrape/draft-picks/scripts/pst/pst_audit_hou_entitlements_sanity.ts`

A comprehensive TypeScript audit that:

- Loads local JSON artifacts (ledger, entitlements, pick rules)
- Builds lookup indices for efficient joining
- Filters to HOU entitlements
- Computes per-row flags for suspicious conditions
- Generates aggregate summaries
- Outputs both JSON and text reports

### 2. npm Script

**Added to `package.json`**:

```json
"pst:audit:hou:entitlements": "npx tsx team-scrape/draft-picks/scripts/pst/pst_audit_hou_entitlements_sanity.ts"
```

### 3. Output Files

- `data/pst/audits/hou_entitlements_sanity_audit.json`
- `data/pst/audits/hou_entitlements_sanity_audit.txt`

---

## CONCLUSION

### Is HOU "Too Many Picks" Real or Explained?

The audit report will show:

1. **If suspicious rows = 0**: All HOU entitlements are legitimate and consistent with ledger ownership. The "too many picks" perception may be due to:
   - Conveyance rights (HOU has rights to picks that haven't conveyed yet)
   - Swap rights (HOU can select from a pool of picks)
   - Multiple entitlement types for the same underlying pick

2. **If suspicious rows > 0**: There may be data inconsistencies that need investigation:
   - Owner mismatches suggest entitlement type may be wrong
   - Missing underlying pick IDs indicate incomplete entitlement building
   - Pool/swap conditions on ownership entitlements may need reclassification

### Next Steps (If Issues Found)

If the audit reveals problems:

1. Review the suspicious rows in detail
2. Check the original PST evidence rows cited
3. Determine if entitlement builder logic needs adjustment
4. Consider Phase 12.3E for targeted fixes

---

## FILES MODIFIED

| File                                              | Change                                    |
| ------------------------------------------------- | ----------------------------------------- |
| `package.json`                                    | Added `pst:audit:hou:entitlements` script |
| `docs/team-scrape/PST_PICK_LEDGER_MASTER_PLAN.md` | Added Phase 12.3D entry                   |

## FILES CREATED

| File                                                                                               | Purpose                     |
| -------------------------------------------------------------------------------------------------- | --------------------------- |
| `team-scrape/draft-picks/scripts/pst/pst_audit_hou_entitlements_sanity.ts`                         | Main audit script           |
| `docs/team-scrape/return_packages/PST_PHASE_12_3D_HOU_ENTITLEMENTS_SANITY_AUDIT_RETURN_PACKAGE.md` | This document               |
| `data/pst/audits/hou_entitlements_sanity_audit.json`                                               | JSON output (after running) |
| `data/pst/audits/hou_entitlements_sanity_audit.txt`                                                | Text output (after running) |
