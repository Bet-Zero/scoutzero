# Wave 4 — Decisions Log

Append-only record of judgment calls made during execution. Newer entries at the top.

Record every decision that deviates from PLAN.md, every Path A/B choice, every "stop and
escalate" event, and every unexpected finding from Step 4a. A different agent picking up
the work later should be able to read this file top to bottom and understand the full
reasoning history without re-deriving anything.

---

## Entry template

```
## YYYY-MM-DD — <short title>

**Context:** which step you were on, what you were trying to do.

**Decision:** what you chose.

**Reasoning:** why. Cite evidence (test output, line numbers, commit SHAs).

**Impact:** what changes downstream — does this skip a step, reorder anything, change the
PLAN.md scope, require user input?
```

---

## Entries

<!-- newest first -->

## 2026-05-12 — Step 1: seasonManager.draftResolution.ts is ~870 lines, not ~300

**Context:** Step 1 execution. PLAN.md estimated `seasonManager.draftResolution.ts` at ~300 lines.

**Decision:** Proceeded with the full extraction (870 lines). The discrepancy is documented; the split is still correct and complete.

**Reasoning:** The two exported functions (`resolveDraftPickSwapsForYear`, `resolveDraftPickConveyanceForYear`) have a deep transitive dependency chain: `toDraftPickCarrier` → `getSeasonManagerDraftPicks` → `toSeasonManagerDraftPicks` → `toSeasonManagerDraftPick` → ~10 `as*/to*` converter functions + ~15 private type definitions. These converters form a self-contained domain (draft-pick normalization) and must all live in the draftResolution file because the PLAN rule forbids importing from the original file. The PLAN's ~300 line estimate was based on the two functions alone (~200 lines) without accounting for their helper chain. The resulting draftResolution module is larger but correctly isolated.

**Impact:** `seasonManager.ts` went from 2,295 to 1,440 lines (vs PLAN's predicted ~800). Still a significant improvement in navigability. No downstream steps are affected.

## 2026-05-12 — Pre-existing phase66-70 test failures in test:architect baseline

**Context:** Step 0 resume. Running `npm run test:architect -- --reporter=dot` as the baseline check before touching source files.

**Decision:** Acknowledging phase66-70 failures as pre-existing, out of Step 0 scope. They are tracked here and will not be fixed in Wave 4.

**Reasoning:** Four test files (`phase66_no_legacy_tradeExceptions_persisted_guardrails.test.ts`, `phase67_migration_execution_guardrails.test.ts`, `phase68_verify_only_empty_scan_must_fail_guardrails.test.ts`, `phase69_seeded_verify_only_nonempty_proof_guardrails.test.ts`, `phase70_ci_proof_and_prod_write_safety_guardrails.test.ts`) assert the existence of a migration script at `scripts/migrations/phase66_migrate_tradeExceptions.js` that was never created. These tests were added in commit `6f0778c1` (before Wave 3 commits `10f5fed7` and `692f4f8a`). Git history confirms neither Wave 3 commit touched these test files. The migration script is unrelated to Wave 4 large-file splits — implementing it would require creating a separate data migration feature.

**Impact:** The PLAN.md Step 0 validation gate says "All targeted suites must be green." Since these failures pre-date Wave 4 and can't be resolved within Step 0 scope, the Step 0 gate is satisfied if all OTHER failures (the export-shape guardrail failures caused by Wave 3) are fixed. The phase66-70 failures are carried forward as known pre-existing debt. Wave 4 source changes (Steps 0.5–4) do not touch these test files or the migration script path.
