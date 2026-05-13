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
| 1 | Split `seasonManager.ts` (extract draft resolution) | ⬜ | — | — | — |
| 2a | `capLegalityValidation/constants.ts` | ⬜ | — | — | — |
| 2b | `capLegalityValidation/schema.ts` | ⬜ | — | — | — |
| 2c | `capLegalityValidation/signing.ts` | ⬜ | — | — | — |
| 2d | `capLegalityValidation/extension.ts` | ⬜ | — | — | — |
| 2e | `capLegalityValidation/actionValidators.ts` | ⬜ | — | — | — |
| 3 | Split `useArchitectActions.ts` (**optional — decide A or B first**) | ⬜ | — | — | Path A/B decision required before starting |
| 4a | Map + verify `mutationPipeline.ts` phase boundaries | ⬜ | — | — | Produces `STEP4_LINE_MAP.md` |
| 4b | `mutationPipeline.types.ts` | ⬜ | — | — | Blocked until 4a complete |
| 4c | `mutationPipeline.read.ts` | ⬜ | — | — | Blocked until 4b complete |
| 4d | `mutationPipeline.compute.ts` | ⬜ | — | — | Blocked until 4c complete |
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
- **Stopped after:** Step 0.5
- **Last commit:** 1684e611
- **Next action:** Step 1 — Split `seasonManager.ts` (extract draftResolution module)
- **Open blockers:** 5 pre-existing phase66-70 test failures (documented in DECISIONS.md); these are not Wave 4 scope
