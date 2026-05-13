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
| 0 | Fix architect compatibility guardrail tests | ⬜ | — | — | — |
| 0.5 | Split `SeasonAdvanceModal.tsx` | ⬜ | — | — | — |
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
| `npm run typecheck` | — | — |
| `npm run validate:project` | — | — |
| `npm run test:fast -- --reporter=dot` | — | — |
| `npm run test:architect -- --reporter=dot` | — | — |
| `npm run test:cap-sheet-boundary -- --reporter=dot` | — | — |
| `npm run build` | — | — |

---

## Last session checkpoint

Update this section at the end of every session.

- **Date:** —
- **Stopped after:** (step ID, e.g. "Step 2c")
- **Last commit:** —
- **Next action:** —
- **Open blockers:** —
