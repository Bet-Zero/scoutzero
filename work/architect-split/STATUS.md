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
| 4a | Map + verify `mutationPipeline.ts` phase boundaries | ✅ | — | 2026-05-13 | STEP4_LINE_MAP.md produced; stop condition triggered — 30+ cross-phase deps block COMPUTE/READ split |
| 4b | `mutationPipeline.types.ts` | ✅ | — | 2026-05-13 | Re-export barrel only (not code move); see DECISIONS.md for reasoning |
| 4c | `mutationPipeline.read.ts` | ❌ | — | — | Blocked: 30+ cross-phase helpers need resolution first (see STEP4_LINE_MAP.md) |
| 4d | `mutationPipeline.compute.ts` | ❌ | — | — | Blocked by same cross-phase issue as 4c |
| 4e | Verify imports + circular check + `npm run build` | ⬜ | — | — | Final gate |

---

## Required artifacts

| Artifact | Path | Required by | Status |
|----------|------|-------------|--------|
| Line map | `work/architect-split/STEP4_LINE_MAP.md` | Step 4a | ⬜ Not created |
| Decisions log | `work/architect-split/DECISIONS.md` | Any plan deviation | ✅ Exists (empty) |

---

## Validation snapshot

Record the date + result of the most recent run of each gate. Helps confirm the baseline
is still green when picking up after a long break.

| Gate | Last run | Result |
|------|----------|--------|
| `npm run typecheck` | 2026-05-12 | ✅ Clean |
| `npm run validate:project` | — | — |
| `npm run test:fast -- --reporter=dot` | 2026-05-12 | ✅ 57/57 |
| `npm run test:architect -- --reporter=dot` | 2026-05-12 | ⚠️ 5 pre-existing files fail (phase66-70 migration script tests — see DECISIONS.md); all Wave 3 + Step 0.5-induced failures fixed |
| `npm run test:cap-sheet-boundary -- --reporter=dot` | — | — |
| `npm run build` | — | — |

---

## Last session checkpoint

Update this section at the end of every session.

- **Date:** 2026-05-12
- **Stopped after:** Step 1
- **Last commit:** ae3e272b
- **Next action:** Step 2a — Extract `capLegalityValidation/constants.ts`
- **Open blockers:** 5 pre-existing phase66-70 test failures (documented in DECISIONS.md); these are not Wave 4 scope
