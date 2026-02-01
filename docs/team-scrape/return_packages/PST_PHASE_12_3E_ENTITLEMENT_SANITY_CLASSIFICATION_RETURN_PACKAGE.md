# PST_PHASE_12_3E_ENTITLEMENT_SANITY_CLASSIFICATION_RETURN_PACKAGE.md

**Phase**: 12.3E — Entitlement Sanity Classification Matrix + Deterministic Verdicts  
**Status**: COMPLETE  
**Date**: 2026-02-01

---

## What Changed

Phase 12.3D introduced a sanity audit that joined entitlements, ledger picks, and pick rule profiles to flag "suspicious rows." However, the audit required manual interpretation to determine if a flagged row was:

- Correct but complex (e.g., ranked conveyance intentionally lacks underlyingPickId)
- Incorrect (e.g., ownership entitlement with mismatched ledger owner)
- Informational only (e.g., PST_DISPLAY source)

**Phase 12.3E upgrades the audit to be self-verifying:**

1. Every entitlement row now receives a **deterministic classification**
2. Each row gets a **verdict**: `OK`, `WARN`, or `ERROR`
3. **Reasons** explain why the verdict was assigned
4. Optional **suggestedNextAction** provides remediation guidance
5. Output clearly separates OK, WARN, and ERROR rows
6. Summary includes counts by verdict AND by classification

---

## Files Created

| File                                                                        | Purpose                                         |
| --------------------------------------------------------------------------- | ----------------------------------------------- |
| `team-scrape/draft-picks/scripts/pst/_utils/entitlementSanityClassifier.ts` | Pure logic classifier with no filesystem access |

## Files Modified

| File                                                                       | Changes                                                                       |
| -------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `team-scrape/draft-picks/scripts/pst/pst_audit_hou_entitlements_sanity.ts` | Refactored to use classifier; removed old flags; added verdict-based sections |

---

## Classification Matrix

### A) `pick_ownership` Entitlements

| Condition                        | Verdict | Classification                 | Reason                                |
| -------------------------------- | ------- | ------------------------------ | ------------------------------------- |
| Missing `underlyingPickId`       | ERROR   | `OWNERSHIP_MISSING_UNDERLYING` | Cannot determine which pick is owned  |
| Ledger owner ≠ target team       | ERROR   | `OWNERSHIP_OWNER_MISMATCH`     | Ownership claim conflicts with ledger |
| Has ranked conveyance/pool rules | WARN    | `OWNERSHIP_WITH_POOL_RULES`    | Current holder until resolution       |
| Otherwise                        | OK      | `OWNERSHIP_NORMAL`             | Valid ownership structure             |

### B) `conveyance_right` Entitlements

| Condition                                 | Verdict | Classification                    | Reason                              |
| ----------------------------------------- | ------- | --------------------------------- | ----------------------------------- |
| Ranked conveyance + no `underlyingPickId` | WARN    | `CONVEYANCE_RANKED_NO_UNDERLYING` | Pool-based selection is intentional |
| Not ranked + no `underlyingPickId`        | ERROR   | `CONVEYANCE_MISSING_UNDERLYING`   | Must specify target pick(s)         |
| Otherwise                                 | OK      | `CONVEYANCE_NORMAL`               | Valid conveyance structure          |

### C) `swap_right` Entitlements

| Condition                               | Verdict | Classification               | Reason                         |
| --------------------------------------- | ------- | ---------------------------- | ------------------------------ |
| Pool indicators + missing pool metadata | WARN    | `SWAP_POOL_METADATA_MISSING` | Pool picks not fully specified |
| Otherwise                               | OK      | `SWAP_NORMAL`                | Valid swap structure           |

### D) Protection Metadata

| Condition                                             | Verdict | Classification             | Reason                                   |
| ----------------------------------------------------- | ------- | -------------------------- | ---------------------------------------- |
| Description mentions protection + no pick rule exists | WARN    | `PROTECTION_RULES_MISSING` | May need architect_basePickRules seeding |

### Global Fallback

| Condition          | Verdict | Classification                            |
| ------------------ | ------- | ----------------------------------------- |
| Unable to classify | WARN    | `INSUFFICIENT_CONTEXT_FOR_CLASSIFICATION` |

---

## Before / After Example

### Before (Phase 12.3D)

```json
{
  "suspiciousRows": [
    {
      "entitlementId": "ent:HOU:2027:1:conv:xxxx",
      "flag_missing_underlyingPickId": true,
      "flag_ranked_conveyance_present": true
    }
  ]
}
```

**Problem**: User must manually decide if this is an error or expected behavior.

### After (Phase 12.3E)

```json
{
  "summary": {
    "total": 21,
    "ok": 15,
    "warn": 6,
    "error": 0,
    "byClassification": {
      "OWNERSHIP_NORMAL": 13,
      "OWNERSHIP_WITH_POOL_RULES": 3,
      "SWAP_NORMAL": 2,
      "CONVEYANCE_RANKED_NO_UNDERLYING": 3
    }
  },
  "rows": [
    {
      "entitlementId": "ent:HOU:2027:1:conv:xxxx",
      "kind": "conveyance_right",
      "sanity": {
        "verdict": "WARN",
        "classification": "CONVEYANCE_RANKED_NO_UNDERLYING",
        "reasons": [
          "Ranked conveyance (least/most favorable) intentionally lacks underlyingPickId",
          "The specific pick is determined at resolution time from a pool"
        ],
        "suggestedNextAction": "No action needed - this is expected behavior for ranked conveyance rights"
      }
    }
  ],
  "errorRows": [],
  "warnRows": [
    /* 6 rows */
  ],
  "okRows": [
    /* 15 rows */
  ]
}
```

**Improvement**: Self-explanatory verdicts with reasons and suggested actions.

---

## How to Run

```bash
# Default: audit HOU entitlements
npm run pst:audit:hou:entitlements

# With team flag (optional generalization)
npx tsx team-scrape/draft-picks/scripts/pst/pst_audit_hou_entitlements_sanity.ts --team=LAL
```

---

## Sample Output

```
=== Entitlements Sanity Audit ===
Phase 12.3E - Deterministic Classification with OK/WARN/ERROR Verdicts

Target Team: HOU

Loading input files...
  Ledger: 480 picks loaded
  Entitlements: 540 assets loaded
  PickRules: 480 profiles loaded (OK)

Filtered to 21 HOU entitlements.

Building audit rows with classifications...
Computing summaries...

=== AUDIT SUMMARY ===
Target Team: HOU
Total Entitlements: 21

Verdicts:
  ✅ OK:    15
  ⚠️  WARN:  6
  ❌ ERROR: 0

By Kind:
  pick_ownership: 16
  swap_right: 2
  conveyance_right: 3

By Classification:
  OWNERSHIP_NORMAL: 13
  OWNERSHIP_WITH_POOL_RULES: 3
  SWAP_NORMAL: 2
  CONVEYANCE_RANKED_NO_UNDERLYING: 3

Top Year/Round Buckets (count >= 4):
  (none)

HOU 2026 R2 Section: 2 entitlements

=== AUDIT CONCLUSION ===
✅ No ERROR rows detected - all entitlements pass sanity checks.
⚠️  6 WARN row(s) detected - expected but complex (no action required).
✅ HOU 2026 R2 count (2) looks plausible.

Done.
```

---

## Output Files

| File                                                 | Format | Purpose                     |
| ---------------------------------------------------- | ------ | --------------------------- |
| `data/pst/audits/hou_entitlements_sanity_audit.json` | JSON   | Machine-readable full audit |
| `data/pst/audits/hou_entitlements_sanity_audit.txt`  | Text   | Human-readable report       |

---

## Key Implementation Details

### Classifier Design

- **Pure function**: No filesystem access, no logging, no side effects
- **Deterministic**: Same input always produces same output
- **Debug info**: Optional `debug` field shows detection results

### Verdict Semantics

| Verdict | Meaning                    | Action Required        |
| ------- | -------------------------- | ---------------------- |
| `OK`    | Valid structure, no issues | None                   |
| `WARN`  | Expected but complex       | None (informational)   |
| `ERROR` | Invalid data               | Investigation required |

### CLI Generalization

The audit now accepts `--team=XXX` flag for any team:

```bash
npx tsx team-scrape/draft-picks/scripts/pst/pst_audit_hou_entitlements_sanity.ts --team=BOS
```

Output files are named by team (e.g., `bos_entitlements_sanity_audit.json`).

---

## Known Limitations

1. **Protection detection is heuristic**: Uses string matching on `description` to detect protection mentions. May miss unusual phrasings.

2. **Pool metadata detection**: For `swap_right`, checks for `poolUnderlyingPickIds` or `swapControllerPickId`. Some swap structures may have pool info in pick rules only.

3. **Cross-team validation not included**: The audit only validates within a single team's entitlements. Cross-team ownership consistency (e.g., if HOU claims ownership, no other team should claim the same pick) is not checked.

---

## Acceptance Criteria Status

| Criterion                                          | Status |
| -------------------------------------------------- | ------ |
| Every row has verdict and classification           | ✅     |
| WARN rows are not treated as failures              | ✅     |
| Ranked conveyance without underlyingPickId is WARN | ✅     |
| Ownership owner mismatch is ERROR                  | ✅     |
| Summary clearly separates OK / WARN / ERROR        | ✅     |
| No manual review required to interpret audit       | ✅     |

---

## Validation Results

```bash
npm run pst:audit:hou:entitlements
```

**Results**:

- Total: 21 entitlements
- OK: 15 (71%)
- WARN: 6 (29%)
- ERROR: 0 (0%)

All previously "suspicious" rows are now correctly classified as WARN with explanatory reasons.
