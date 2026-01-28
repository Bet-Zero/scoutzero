# PST HOU 2026 R2 AUDIT RETURN PACKAGE

**Date**: 2026-01-28  
**Status**: ✅ COMPLETE  
**Agent**: Execution Mode

---

## EXECUTIVE SUMMARY

**FINDING**: All 7 HOU 2026 R2 pick_ownership entitlements **perfectly match** the ledger ownership records. This is **NOT** an entitlement mapping bug.

**ROOT CAUSE**: The issue originates upstream in the **PST ledger data** (Phase 6/7 overlay or PST scrape). The ledger incorrectly shows HOU as the owner for all 7 picks, and the entitlement builder correctly follows that ledger data.

**PICKS AFFECTED**:

1. CHI_2026_2nd → Ledger says HOU owns (PST_DISPLAY)
2. DAL_2026_2nd → Ledger says HOU owns (PST_DISPLAY)
3. HOU_2026_2nd → Ledger says HOU owns (BASE)
4. IND_2026_2nd → Ledger says HOU owns (PST_DISPLAY)
5. LAC_2026_2nd → Ledger says HOU owns (PST_DISPLAY)
6. MIA_2026_2nd → Ledger says HOU owns (PST_DISPLAY)
7. PHI_2026_2nd → Ledger says HOU owns (PST_DISPLAY)

---

## HOW TO RUN THE AUDIT

```bash
npm run pst:audit:hou:2026:r2
```

This command:

1. Loads `data/pst/pst_pick_ledger_final_2026_2033.json` (ledger)
2. Loads `data/pst/pst_entitlement_assets_2026_2033.json` (entitlements)
3. Filters for HOU 2026 R2 pick_ownership entitlements
4. Cross-references each entitlement's underlyingPickId with the ledger
5. Compares entitlement holderTeam vs ledger owner
6. Outputs results to:
   - Console (detailed row-by-row report)
   - `data/pst/audits/hou_2026_r2_audit.txt` (human-readable)
   - `data/pst/audits/hou_2026_r2_audit.json` (structured data)

---

## AUDIT RESULTS

### Summary Statistics

| Metric                                        | Value |
| --------------------------------------------- | ----- |
| Total HOU 2026 R2 pick_ownership entitlements | 7     |
| Matches (entitlement holder == ledger owner)  | 7     |
| Mismatches                                    | 0     |

### Detailed Breakdown

All 7 entitlements have:

- **Entitlement Holder**: HOU
- **Ledger Owner**: HOU
- **Match Status**: YES ✅

Key observation: 6 out of 7 picks have `ownershipSource: "PST_DISPLAY"`, meaning they come from the PST scrape/overlay. Only HOU_2026_2nd has `ownershipSource: "BASE"`.

---

## ROOT CAUSE ANALYSIS

### Phase 8 (Entitlement Builder) is Correct

The entitlement builder (`pst_phase_8_build_entitlement_assets.ts`) reads the ledger and creates pick_ownership entitlements based on the `owner` field. It's working as designed.

### Phase 6/7 (Ledger Overlay) is the Problem

The ledger overlay process (`pst_build_owner_overlay.ts` → `pst_apply_display_owner_overlay.ts`) applies PST scrape data to set the `owner` field. This is where HOU incorrectly appears as the owner for 6 picks.

**Evidence from Ledger**:

- All 6 non-HOU picks have `ownershipSource: "PST_DISPLAY"`
- This means the overlay explicitly set HOU as the owner
- Evidence row refs (r2, r3, r4, r5, r6, r7, r8, r9, r10, r11, r12) point back to specific PST table rows

### Next Investigation Target

**To identify the exact source of the bad data**:

1. **Check PST overlay data** (`data/pst/pst_owner_display_overlay.json` or similar)
   - Does it have HOU mapped to these 6 picks?
   - If yes, the overlay logic is wrong or the PST scrape misread the data

2. **Check PST raw rows** (`data/pst/pst_phase_2_raw_rows.json` or similar)
   - What does evidence row r2, r3, r4, etc. say about these picks?
   - Were they scraped from the wrong team's page?

3. **Check PST source pages** (`team-scrape/draft-picks/_artifacts/pst/pages/`)
   - Review the HTML for HOU's page
   - Are these picks actually listed there? (They shouldn't be)

---

## RECOMMENDED FIXES

### Option A: Manual Overlay Correction

If these picks were miscategorized during PST scrape:

1. Create a manual correction file (e.g., `data/pst/manual_owner_corrections.json`)
2. Update `pst_apply_display_owner_overlay.ts` to apply corrections after PST overlay
3. Re-run: `npm run pst:apply:overlay && npm run pst:phase-4 && npm run pst:phase-5 && npm run pst:entitlements`

### Option B: PST Re-scrape

If the PST data itself is corrupt:

1. Re-fetch HOU's PST page: `npm run pst:fetch:session`
2. Re-extract rows: `npm run pst:extract`
3. Rebuild overlay: `npm run pst:build:overlay`
4. Re-apply and regenerate: `npm run pst:build-final`

### Option C: Base Ledger Override

If these picks should never show HOU ownership:

1. Edit `data/pst/pst_base_ledger_2026_2033.json` directly (if appropriate)
2. Or add logic to `pst_build_base_ledger.ts` to handle these special cases

---

## ARTIFACTS CREATED

### 1. Audit Script

**Location**: `team-scrape/draft-picks/scripts/pst/pst_audit_hou_2026_r2.ts`

**Type**: TypeScript executable  
**Purpose**: Deterministic audit comparing ledger vs entitlements  
**Key Features**:

- Loads both JSON data sources
- Filters HOU 2026 R2 pick_ownership entitlements
- Cross-references with ledger
- Outputs detailed comparison reports

### 2. Text Report

**Location**: `data/pst/audits/hou_2026_r2_audit.txt`

**Contents**:

- Summary statistics
- Row-by-row audit details
- Match status for each pick
- Conclusion with root cause determination

### 3. JSON Report

**Location**: `data/pst/audits/hou_2026_r2_audit.json`

**Schema**:

```json
{
  "meta": {
    "auditDate": "ISO timestamp",
    "targetTeam": "HOU",
    "targetYear": 2026,
    "targetRound": 2
  },
  "summary": {
    "totalEntitlements": 7,
    "matchCount": 7,
    "mismatchCount": 0
  },
  "rows": [
    {
      "entitlementId": "string",
      "underlyingPickId": "string",
      "entitlementHolderTeam": "string",
      "entitlementUnderlyingStatus": "string",
      "ledgerOwner": "string",
      "ledgerOwnershipSource": "string",
      "ledgerEvidenceRowRefs": ["array"],
      "match": boolean
    }
  ],
  "mismatches": ["array of pickIds"]
}
```

### 4. npm Script

**Command**: `pst:audit:hou:2026:r2`

**Location**: `package.json` line 103  
**Full Command**: `npx tsx team-scrape/draft-picks/scripts/pst/pst_audit_hou_2026_r2.ts`

---

## NEXT STEPS

### Immediate Action Required

1. **Investigate PST overlay source**: Check what evidence rows r2-r12 contain
2. **Verify PST scrape accuracy**: Review HOU's PST HTML page
3. **Determine correction strategy**: Choose between manual fix, re-scrape, or base ledger override

### Follow-up Audits

Consider creating similar audit scripts for other anomalies:

- Teams showing unexpectedly high pick counts
- Picks showing "unknown" conveyance reasons
- Mismatches between BASE and PST_DISPLAY ownership

### Code Reusability

The audit script pattern can be generalized:

```typescript
// Template for future audits
function auditPickOwnership(
  team: string,
  year: number,
  round: number
): AuditResult {
  // Same logic as pst_audit_hou_2026_r2.ts
}
```

---

## VALIDATION

✅ Audit script runs without errors  
✅ Outputs generated in `data/pst/audits/`  
✅ npm script registered in package.json  
✅ Clear findings documented  
✅ Root cause identified  
✅ Next steps defined

---

## CONCLUSION

**The Phase 8 entitlement builder is not at fault.** It correctly creates pick_ownership entitlements based on the ledger's `owner` field. The problem lies upstream in the PST overlay process (Phase 6/7), which incorrectly assigns HOU as the owner for 6 non-HOU picks.

**Fix priority**: HIGH  
**Fix target**: Phase 6/7 overlay logic or PST scrape data  
**Verification**: Re-run this audit after applying fixes to confirm corrections

---

**Document**: PST_HOU_2026_R2_AUDIT_RETURN_PACKAGE.md  
**Author**: AI Agent (Execution Mode)  
**Date**: 2026-01-28  
**Status**: Ready for Review
