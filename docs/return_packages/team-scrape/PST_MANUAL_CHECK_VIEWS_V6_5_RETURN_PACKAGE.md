# PST_MANUAL_CHECK_VIEWS_V6_5_RETURN_PACKAGE.md

## 1. Summary

Updated the manual check views to a swap-focused 5-column format ("v6.5") to assist with manual verification against Fanspo and Spotrac.
This presentation-only update separates swap information, favorable pool logic, and conditions into distinct columns for easier reading.

## 2. Files Modified

- `team-scrape/draft-picks/scripts/pst/pst_phase_6_manual_check_views.ts`: Added v6.5 logic (swaps/favorable/conditions columns) and isolated v6.5 execution mode.
- `package.json`: Added `pst:manual-views:v6-5` script.
- `docs/team-scrape/PST_PICK_LEDGER_MASTER_PLAN.md`: Updated with Phase 6.5 details.

## 3. How to Run

To generate ONLY the v6.5 views (without overwriting existing legacy views):

```bash
npm run pst:manual-views:v6-5
```

> [!NOTE]
> This command is now integrated into the main build pipeline: `npm run pst:build-final`

## 4. Output Paths

- **Combined Report**: `data/pst/manual_check_views_v6_5.txt`
- **Per-Team Files**: `data/pst/manual_check_views_v6_5/*.txt`
- **Summary JSON**: `data/pst/manual_check_views_v6_5_summary.json`

## 5. BOS Block Excerpt (v6.5)

```
════════════════════════════════════════════════════════════════════════════════
# BOS — BOSTON CELTICS (13 picks)
────────────────────────────────────────────────────────────────────────────────
2026 | 1 | own
2026 | 2 | via MIL | conditional
2026 | 2 | via MIN | conditional
2026 | 2 | via NOP | conditional
2027 | 1 | own
2028 | 1 | swap SAS | least favorable (BOS,SAS) | Top 1; protected #46-60
2030 | 1 | own
2031 | 1 | own
2031 | 2 | via HOU | Top 55
2032 | 1 | own
2032 | 2 | own
2033 | 1 | own
2033 | 2 | own
```

## 6. Confirmation

- Existing v6.3/6.4 files (`data/pst/manual_check_views.txt`) were **NOT** modified by this run.
- New v6.5 files were created successfully.

## 7. Status

**COMPLETE**
