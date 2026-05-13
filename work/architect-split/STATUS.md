# Wave 4 — Execution Status

**Read first when resuming.** Find the first row marked `🟡 In progress` or `⬜ Not started`
and continue from there.

Update one row per commit. Keep this file in sync with reality — if it disagrees with the
git log, the git log wins.

---

## Legend

- ⬜ Not started
- 🟡 In progress
- ✅ Done
- ⏭️ Skipped (record reason in DECISIONS.md)
- ❌ Blocked (record blocker in DECISIONS.md)

---

## Steps

| Step | Description | Status | Commit | Date | Notes |
|------|-------------|--------|--------|------|-------|
| 0 | Fix architect compatibility guardrail tests | ✅ | 18e91e5b | 2026-05-12 | 11 .ts/.tsx test files + 1 source file (capTotals/index.ts) fixed; 5 pre-existing phase66-70 failures documented in DECISIONS.md |
| 0.5 | Split `SeasonAdvanceModal.tsx` | ✅ | 1684e611 | 2026-05-12 | 1,174→580 lines; .types.ts + .helpers.ts extracted; offseason.devGate + phase65 tests updated |
| 1 | Split `seasonManager.ts` (extract draft resolution) | ✅ | ae3e272b | 2026-05-12 | 2,295→1,440 lines; draftResolution.ts extracted (~870 lines); 26 test files unaffected; 1 guardrail test updated |
| 2a | `capLegalityValidation/constants.ts` | ✅ | 6e9a64e2 | 2026-05-13 | 9 exported constants moved; orchestrator re-exports + imports from submodule |
| 2b | `capLegalityValidation/schema.ts` | ✅ | 247b2fcd | 2026-05-13 | 19 internal types moved; orchestrator imports + re-exports |
| 2c | `capLegalityValidation/signing.ts` | ✅ | ac1faba0 | 2026-05-13 | ~3,020 lines (see DECISIONS.md); 4 guardrail tests updated for submodule move |
| 2d | `capLegalityValidation/extension.ts` | ✅ | 130c5633 | 2026-05-13 | ~595 lines; orphaned validateExceptionEligibility JSDoc cleaned up |
| 2e | `capLegalityValidation/actionValidators.ts` | ✅ | b9f05a7c | 2026-05-13 | ~849 lines; KnownCapHold type added to imports; orphaned validateOfferSheetResolution JSDoc cleaned |
| 3 | Split `useArchitectActions.ts` (**optional — decide A or B first**) | ⏭️ | — | 2026-05-13 | Path B chosen: Step 2 took longer than expected; low-value cosmetic split (see DECISIONS.md) |
| 4a | Map + verify `mutationPipeline.ts` phase boundaries | ✅ | 6289a5c1 | 2026-05-13 | STEP4_LINE_MAP.md produced; stop condition triggered — 30+ cross-phase deps block COMPUTE/READ split |
| 4b | `mutationPipeline.types.ts` | ✅ | cc5d7f90 | 2026-05-13 | Re-export barrel only (not code move); see DECISIONS.md for reasoning |
| 4a.5 | `mutationPipeline.helpers.ts` (NEW — Option A) | ✅ | 602173d3 | 2026-05-13 | ~2,300 lines; 39 types exported from orchestrator; player snapshot normalizer chain + persistence helpers; full test suite green |
| 4c | `mutationPipeline.read.ts` | ✅ | 5d35f786 | 2026-05-13 | ~5,141 lines; 144 functions exported; 34 helpers.ts ranges skipped; 9 guardrail tests updated; only pre-existing phase66-70 failures remain |
| 4d | `mutationPipeline.compute.ts` | ✅ | TBD | 2026-05-13 | ~2,458 lines; 23 compute functions exported; 14 types exported from main; 12 guardrail tests updated; only pre-existing phase66-70 failures remain |
| 4e | Verify imports + circular check + `npm run build` | ⬜ | — | — | Final gate |

---

## Required artifacts

| Artifact | Path | Required by | Status |
|----------|------|-------------|--------|
| Line map | `work/architect-split/STEP4_LINE_MAP.md` | Step 4a | ✅ Created |
| Decisions log | `work/architect-split/DECISIONS.md` | Any plan deviation | ✅ Exists |

---

## Validation snapshot

Record the date + result of the most recent run of each gate. Helps confirm the baseline
is still green when picking up after a long break.

| Gate | Last run | Result |
|------|----------|--------|
| `npm run typecheck` | 2026-05-13 | ✅ Clean (post step 4a.5) |
| `npm run validate:project` | 2026-05-13 | ✅ All validations passed |
| `npm run test:fast -- --reporter=dot` | 2026-05-13 | ✅ 57/57 |
| `npm run test:architect -- --reporter=dot` | 2026-05-13 | ⚠️ 5 pre-existing files fail (phase66-70 migration script tests — see DECISIONS.md); all other tests pass (post step 4c) |
| `npm run test:cap-sheet-boundary -- --reporter=dot` | 2026-05-13 | ✅ 75/75 |
| `npm run build` | 2026-05-13 | ✅ Built (1 existing dynamic import warning, not new) |

---

## Last session checkpoint

Update this section at the end of every session.

- **Date:** 2026-05-13
- **Stopped after:** Step 4d complete — compute.ts extracted, 12 guardrail tests updated, suite green
- **Last commit:** TBD (step 4d)
- **Next action:** Step 4e — Verify imports + circular check + `npm run build`
- **Open blockers:** 5 pre-existing phase66-70 test failures only (not Wave 4 scope)
