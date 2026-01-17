# PST_BUILD_FINAL_RETURN_PACKAGE.md

**DATE**: 2026-01-17  
**TASK**: Add one-command final build (`pst:build-final`)

---

## Summary

Added a single convenience command `pst:build-final` that orchestrates the complete "final truth" pipeline. This command runs Phase 4 (deterministic parser), Phase 5 (ledger builder + finalize), and Phase 5 validation in sequence, eliminating the need to remember multiple commands for day-to-day usage.

**No parsing, extraction, or data schema logic was modified** — this is pure orchestration.

---

## Files Changed

1. **`package.json`**
   - Added script: `pst:build-final`
   - Implementation: Chains `pst:phase-4 && pst:phase-5 && pst:phase-5:validate`

2. **`docs/team-scrape/PST_PICK_LEDGER_MASTER_PLAN.md`**
   - Added "Quick Commands" section after Phase Status table
   - Documents `pst:build-final` as recommended day-to-day command
   - Clarifies when to use individual commands vs. the orchestrated command

3. **`docs/team-scrape/PST_BUILD_FINAL_RETURN_PACKAGE.md`** (this file)
   - Return package documentation

---

## How to Run

**Single command** (recommended):

```bash
npm run pst:build-final
```

This runs the complete pipeline:

1. Phase 4: Deterministic parser (builds pick rule profiles from normalized rows)
2. Phase 5: Ledger builder + finalize (generates final artifacts with encumbrances)
3. Phase 5 validation: Confirms all invariants pass (needs_review == 0, etc.)

**Individual commands** (when needed):

```bash
npm run pst:phase-4          # Parser only
npm run pst:phase-5          # Finalize only
npm run pst:phase-5:validate # Validation only
```

---

## Notes

### What It Runs Under the Hood

The `pst:build-final` command executes three scripts in sequence:

1. **`pst:phase-4`** → `npx tsx team-scrape/draft-picks/scripts/pst/pst_phase_4_build_profiles.ts`
   - Parses normalized rows into structured PickRuleProfiles
   - Extracts protections, swaps, conveyance chains
   - Flags ambiguous items with review reason codes
   - Outputs: `pst_pick_rule_profiles_2026_2033.json`, `pst_needs_review_queue.json`, `pst_phase_4_report.json`

2. **`pst:phase-5`** → `npx tsx team-scrape/draft-picks/scripts/pst/pst_phase_5_finalize.ts`
   - Validates needs_review_count == 0
   - Generates final profiles with `_final` suffix
   - Creates final ledger with encumbrances attached
   - Outputs: `pst_pick_rule_profiles_final_2026_2033.json`, `pst_pick_ledger_final_2026_2033.json`

3. **`pst:phase-5:validate`** → `npx tsx team-scrape/draft-picks/scripts/pst/pst_phase_5_finalize.ts`
   - Runs validation checks (invariants, completeness)
   - Outputs: `pst_phase_5_final_validation_report.json`

### Error Handling

The command uses standard shell chaining (`&&`), so:

- If any step fails (non-zero exit), the pipeline stops immediately
- No subsequent steps execute after a failure
- Exit code reflects the first failing command

### When to Use Individual Commands

Use individual commands only when:

- **HTML/extractor changes**: Run `pst:extract` / `pst:validate` first
- **Parser rule adjustments**: Run `pst:phase-4` to test parser changes
- **Finalization logic changes**: Run `pst:phase-5` to test finalization

For normal day-to-day usage after initial setup, `pst:build-final` is sufficient.

---

## Confirmation: No Logic Changed

✅ **No parsing logic modified**  
✅ **No extraction logic modified**  
✅ **No data schemas modified**  
✅ **No validation logic modified**

This change is **pure orchestration** — it only chains existing commands in the correct order. All underlying scripts remain unchanged.

---

## Acceptance Criteria Met

- ✅ `npm run pst:build-final` exists in `package.json`
- ✅ Runs Phase 4 → Phase 5 → Phase 5 validation in order
- ✅ Master Doc documents the new command clearly
- ✅ Return Package doc exists at specified path

---

**build-final COMPLETE**
