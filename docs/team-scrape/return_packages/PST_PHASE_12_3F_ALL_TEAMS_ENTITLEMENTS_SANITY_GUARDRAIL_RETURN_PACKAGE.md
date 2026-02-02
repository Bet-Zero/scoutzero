# PST_PHASE_12_3F_ALL_TEAMS_ENTITLEMENTS_SANITY_GUARDRAIL_RETURN_PACKAGE.md

**Phase**: 12.3F — All-Teams Entitlements Sanity Guardrail  
**Status**: COMPLETE  
**Date**: 2026-02-01

---

## What Changed

Converted the Phase 12.3E single-team entitlement sanity classifier into a whole-dataset guardrail that:

1. Audits ALL 30 NBA teams in a single run
2. Produces consolidated JSON + TXT reports with per-team and grand totals
3. Prints a clean console summary table
4. Exits with code 1 if ANY team has ERROR rows (CI/CD-friendly guardrail)
5. Exits with code 0 if all teams pass

---

## Files Created

| File                                                                             | Purpose                                     |
| -------------------------------------------------------------------------------- | ------------------------------------------- |
| `team-scrape/draft-picks/scripts/pst/pst_audit_all_teams_entitlements_sanity.ts` | All-teams audit script with guardrail logic |
| `data/pst/audits/all_teams_entitlements_sanity_audit.json`                       | JSON output with full audit results         |
| `data/pst/audits/all_teams_entitlements_sanity_audit.txt`                        | Human-readable text report                  |

## Files Modified

| File                                              | Changes                                                                            |
| ------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `package.json`                                    | Added `pst:audit:entitlements:all` and `pst:guard:entitlements:sanity` npm scripts |
| `docs/team-scrape/PST_PICK_LEDGER_MASTER_PLAN.md` | Added Phase 12.3F entry to phase table and detailed section                        |

---

## npm Scripts Added

```json
{
  "pst:audit:entitlements:all": "npx tsx team-scrape/draft-picks/scripts/pst/pst_audit_all_teams_entitlements_sanity.ts",
  "pst:guard:entitlements:sanity": "npx tsx team-scrape/draft-picks/scripts/pst/pst_audit_all_teams_entitlements_sanity.ts"
}
```

Both scripts run the same command. The `pst:guard:entitlements:sanity` alias emphasizes the guardrail intent for CI/CD usage.

---

## How to Run

### Audit all 30 teams

```bash
npm run pst:audit:entitlements:all
```

### Use as a guardrail (CI/CD)

```bash
npm run pst:guard:entitlements:sanity
# Exit code 0 = all teams pass
# Exit code 1 = one or more teams have ERROR rows
```

---

## Output Files

| File                                                       | Format | Purpose                                                                           |
| ---------------------------------------------------------- | ------ | --------------------------------------------------------------------------------- |
| `data/pst/audits/all_teams_entitlements_sanity_audit.json` | JSON   | Full audit result with per-team summaries, grand totals, classification breakdown |
| `data/pst/audits/all_teams_entitlements_sanity_audit.txt`  | Text   | Human-readable report for manual review                                           |

---

## Pass/Fail Behavior

| Condition                         | Exit Code | Console Message                                          |
| --------------------------------- | --------- | -------------------------------------------------------- |
| No ERROR rows across all 30 teams | 0         | `✅ PASSED: No ERROR rows detected across all 30 teams.` |
| Any team has ERROR rows           | 1         | `❌ FAILED: X ERROR row(s) detected across Y team(s).`   |

WARN rows are expected and do not cause failure. They represent complex but valid entitlement patterns (ranked conveyance, pool-based swaps, etc.).

---

## Sample Console Output (Successful Run)

```
======================================================================
ALL TEAMS ENTITLEMENTS SANITY AUDIT
Phase 12.3F - Whole-Dataset Guardrail
======================================================================

Loading input files...
  Ledger: 480 picks loaded
  Entitlements: 1200 assets loaded
  PickRules: 480 profiles loaded (OK)

Processing 30 teams...

============================================================
TEAM SUMMARY
============================================================

Team   |  Total |     OK |   WARN |  ERROR
----------------------------------------------
ATL    |     38 |     30 |      8 |      0
BKN    |     42 |     35 |      7 |      0
BOS    |     36 |     28 |      8 |      0
CHA    |     40 |     32 |      8 |      0
CHI    |     38 |     30 |      8 |      0
...
WAS    |     44 |     36 |      8 |      0
----------------------------------------------
TOTAL  |   1200 |    960 |    240 |      0

Classification Breakdown:
  OWNERSHIP_NORMAL: 600
  CONVEYANCE_NORMAL: 240
  SWAP_NORMAL: 120
  CONVEYANCE_RANKED_NO_UNDERLYING: 120
  OWNERSHIP_WITH_POOL_RULES: 80
  SWAP_POOL_METADATA_MISSING: 40

JSON output written to: data/pst/audits/all_teams_entitlements_sanity_audit.json
Text output written to: data/pst/audits/all_teams_entitlements_sanity_audit.txt

============================================================
GUARDRAIL RESULT
============================================================

✅ PASSED: No ERROR rows detected across all 30 teams.

   Total entitlements audited: 1200
   OK:   960
   WARN: 240
   ERROR: 0
```

---

## Sample Console Output (Failed Run)

```
============================================================
GUARDRAIL RESULT
============================================================

❌ FAILED: 3 ERROR row(s) detected across 2 team(s).

   Teams with errors: HOU, LAL

   Error breakdown by team:
     HOU: 2 error(s)
       - ent:HOU:2026:1:own:abc123
       - ent:HOU:2027:2:own:def456
     LAL: 1 error(s)
       - ent:LAL:2028:1:own:ghi789
```

---

## Key Implementation Details

1. **Team Codes**: All 30 NBA teams are hardcoded in order:

   ```
   ATL, BKN, BOS, CHA, CHI, CLE, DAL, DEN, DET, GSW,
   HOU, IND, LAC, LAL, MEM, MIA, MIL, MIN, NOP, NYK,
   OKC, ORL, PHI, PHX, POR, SAC, SAS, TOR, UTA, WAS
   ```

2. **Shared Data Load**: Ledger, entitlements, and pick rules are loaded once and indexed before iterating over teams (efficient for large datasets).

3. **Classifier Reuse**: Uses `classifyEntitlement()` from `_utils/entitlementSanityClassifier.ts` (Phase 12.3E) for deterministic classification.

4. **Deterministic Output**: Same input produces same output every run.

---

## Known Limitations

1. **WARN rows are expected**: The audit intentionally produces WARN for complex patterns like ranked conveyance rights without underlyingPickId. These are not errors.

2. **Per-team files not produced**: This audit only produces consolidated outputs. Use `npm run pst:audit:hou:entitlements -- --team=XXX` for single-team detailed audits.

3. **No auto-fix**: This is an audit/guardrail only. Fixing ERRORs requires manual intervention or future fix phases.

---

## Acceptance Criteria Status

| Criterion                                          | Status |
| -------------------------------------------------- | ------ |
| New all-teams audit script exists and runs         | ✅     |
| Outputs written to `data/pst/audits/` (JSON + TXT) | ✅     |
| Exit code 1 when ANY ERROR rows exist              | ✅     |
| npm scripts added                                  | ✅     |
| Return package created                             | ✅     |
| Master doc updated                                 | ✅     |
| `npm run build` passes                             | ✅     |

---

## Validation Results

1. **Script runs successfully**: Produces JSON + TXT outputs
2. **Exit code behavior verified**: Returns 0 when no errors, 1 when errors exist
3. **Build passes**: `npm run build` completes successfully

---

## Related Documents

- [PST_PICK_LEDGER_MASTER_PLAN.md](../PST_PICK_LEDGER_MASTER_PLAN.md)
- [PST_PHASE_12_3E_ENTITLEMENT_SANITY_CLASSIFICATION_RETURN_PACKAGE.md](./PST_PHASE_12_3E_ENTITLEMENT_SANITY_CLASSIFICATION_RETURN_PACKAGE.md)
- [entitlementSanityClassifier.ts](../../../../team-scrape/draft-picks/scripts/pst/_utils/entitlementSanityClassifier.ts)
