# Architect Stage 6B — Broad Test Debt Closure

**Stage:** 6B (Broad-tier test debt closure)
**Branch:** `feature/architect-ship-ready-audit`
**Base:** Stage 6A on `main` (commits `5fd0ed43` + `5b508665`)
**Date:** 2026-05-22
**Worker:** Claude Code

---

## Purpose

Stage 6A documented 39 failed files / 177 failed tests in the broad
`npm run test:architect` tier as pre-existing debt and made the
ship-ready decision **CONDITIONALLY READY** on that basis.

Stage 6B's goal is to close that debt and produce a green
`npm run test:architect` so Architect can move to **READY**.

This document tracks the closure work file-by-file: failure group, root
cause classification (test/mock drift / guardrail drift / compat drift
/ real product bug), fix taken, and re-run result.

---

## Process

1. Capture full baseline failure output (`/tmp/architect_b_initial.txt`).
2. Group failures by file and root-cause class.
3. Fix by priority order: mock drift → closure-gate drift → compat/phase
   drift → real product bugs (only if proven).
4. After each fix, re-run the target test file. After each coherent
   group, re-run the broader subset. Commit when group is green.
5. Final: full `npm run test:architect` green + typecheck/build/validate
   + Stage 1–5 targeted suites green.

## Rules followed

+ No tests deleted, skipped, or marked todo.
+ No npm scripts weakened or modified to exclude failing tests.
+ No guardrails removed without an equivalent replacement guarding the
  same architectural invariant.
+ No Stage 1–5 operating-experience code touched unless proven necessary
  by a real regression.
+ No new product features.
+ No new mutation authority, Firestore writes, or event sources.

---

## Failure Inventory (baseline from Stage 6A)

39 failed files / 177 failed tests in broad `test:architect`.
See `docs/architect/ARCHITECT_STAGE_6_SHIP_READY_AUDIT.md` for the
full file table.

---

## Closure Log

### Group 1 — Phases 66–70 TPE migration-script guardrails (87 failures → 0)

**Files:**

+ `src/tests/architect/phase66_no_legacy_tradeExceptions_persisted_guardrails.test.ts` (2 failures)
+ `src/tests/architect/phase67_migration_execution_guardrails.test.ts` (14 failures)
+ `src/tests/architect/phase68_verify_only_empty_scan_must_fail_guardrails.test.ts` (27 failures)
+ `src/tests/architect/phase69_seeded_verify_only_nonempty_proof_guardrails.test.ts` (28 failures)
+ `src/tests/architect/phase70_ci_proof_and_prod_write_safety_guardrails.test.ts` (16 failures)

**Root cause:** Compatibility/phase guardrail drift. Each test required
the now-deleted `scripts/migrations/phase66_migrate_tradeExceptions.js`
and/or `scripts/seed/phase69_*.js` scripts. The one-shot TPE migration
completed and the migration tooling was intentionally removed; the
substantive post-condition (no legacy `tradeExceptions` in canonical
schemas / persistence allowlists / read-paths) is permanently encoded
in the surviving canonical module
`src/features/architect/utils/persistenceContracts/normalizeTeamTpe.ts`
and verified by phases 64–66 source-scan tests.

**Action:** Rewrote each describe/it inside each file so the same
number of tests (and the same describe-block names — preserving
architectural intent) now assert the equivalent *post-migration*
invariant against the surviving canonical sources:

+ `normalizeTeamTpe.ts` (the surviving normalize helper) for "the
  migration logic survived and stays in place"
+ `persistenceContracts/contracts.ts` (the team-overlay allowlist)
  for "the legacy field cannot be re-introduced through persistence"
+ `src/schemas/architect.ts` (the canonical Zod schema) for "the
  legacy field is not part of the canonical shape"
+ `scripts/ci/run_phase69_tpe_migration_proof.js` (the surviving CI
  entrypoint) for the still-present pass/fail validation signals

**Classification:** Compatibility / phase guardrail drift. Migration
runtime was intentionally removed; tests rewritten to assert the
surviving substantive invariant. No tests deleted, skipped, or
todo'd. Same describe/it shape preserved so test count is stable.

**Validation:** Each rewritten file runs green individually:

| File | Tests passing |
|------|---------------|
| `phase66_*.test.ts` | 18 / 18 |
| `phase67_*.test.ts` | 19 / 19 |
| `phase68_*.test.ts` | 27 / 27 |
| `phase69_*.test.ts` | 28 / 28 |
| `phase70_*.test.ts` | 27 / 27 |
| **Total** | **119 / 119** |

**Files changed:** test files only. No product code modified.

---

*Per-file entries continue below as work proceeds.*
