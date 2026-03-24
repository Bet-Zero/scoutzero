# ARCHITECT_CORE_TRIO_PASS_R2_MASTER

## 1. Objective

Continue hardening the current core-logic blocker trio by applying stronger existing contracts where they genuinely fit and eliminating weak placeholder typing in the trio's important live boundaries.

## 2. Definition Of Done

This pass succeeds when the trio's important live flows are materially less dependent on `LooseRecord`, `AnyRecord`, `Record<string, unknown>`, open index signatures, vague local `...Like` bags, and bridge casts because stronger existing contracts are now used where truthful, and any remaining looseness is small and intentional.

## 3. Scoped Blocker Files

- `src/features/architect/utils/mutationPipeline.ts`
- `src/features/architect/utils/seasonManager.ts`
- `src/features/architect/utils/capLegalityValidation.ts`

## 4. Existing Stronger Contract Targets

- `TradeExceptionRecord` from `src/features/architect/utils/tradeMachine/constants/types` reused in `mutationPipeline.ts` for `ArchitectMutationExceptions['tpe']`, `ArchitectMutationTeamRecord['tradeExceptions']`, and the live exception-consumption path.
- `ReturnType<typeof validateSigning>` from `src/features/architect/utils/capLegalityValidation.ts` reused in `mutationPipeline.ts` for `ArchitectMutationResult['_signingValidation']` and the prevalidated sign-and-trade verdict path.
- `ArchitectMutationOfferSheet` and `ArchitectMutationPlayerRecord` from `src/features/architect/utils/mutationPipeline.ts` reused across the live offer-sheet helpers and the cap-legality offer-sheet resolution boundary; the canonical offer-sheet contract was expanded only for `seasonKey`, `year`, `matchedAt`, and `declinedAt`.
- `OffseasonOptionDecisionMap`, `OffseasonTransitionContext`, `OffseasonTransitionResult`, and `OffseasonAppliedChangesSummary` from `src/features/architect/utils/offseason/resolveOffseasonTransition.ts` reused in `seasonManager.ts` for the live season/offseason handoff.
- `SeasonManagerProjectedDraftPickView` exported from `src/features/architect/utils/entitlements/seasonManagerProjection.ts` and consumed in `seasonManager.ts` as the single authoritative projected-pick view used in this pass.
- `BuildRuleContextInput` from `src/features/architect/utils/buildRuleContext.ts` reused in `capLegalityValidation.ts` to construct the live signing rule-context input without the previous bridge cast.
- `CapRulesProfile` from `src/features/architect/utils/capRulesProfile.ts`, `SalaryProfile` and `RuleContext['cap']` from `src/features/architect/utils/salaryEngine.ts`, and the produced extension-terms slice from `computePlayerRulesProfile` were reused in `capLegalityValidation.ts` helper IO.

## 5. Pass Status Ledger

- Core trio pass R2 — PARTIAL: strengthened live trade-context, offer-sheet, signing-validation, season-advance option, projected-pick, and cap rule-context boundaries without widening into orchestration or adapter rewrites. Remaining loose typing is smaller and more localized, but the trio is not cleared yet.

## 6. Current Risks / Open Questions

- `mutationPipeline.ts` still has broader legacy state carriers outside the targeted signing / offer-sheet / prevalidated-trade verdict paths; pushing further likely means orchestration-adjacent cleanup.
- `seasonManager.ts` now consumes the exported projected-pick view type, but a fuller removal of the remaining local draft-pick compatibility layer would widen into helper rewrites across resolution utilities.
- `capLegalityValidation.ts` now builds a real signing `BuildRuleContextInput`, but malformed-input, dead-cap, and exception raw-input paths intentionally remain broad.
- No support edit beyond exporting `SeasonManagerProjectedDraftPickView` was required in this run.

## 7. Validation Ledger

- `npm run typecheck` — PASS
- `npm run test:node -- --reporter=dot src/tests/architect/architectCoreTrioPassR2.test.ts` — PASS (`3` tests)
- `npm run build` — PASS
  Build warnings observed: stale `caniuse-lite` / Browserslist data notice, existing Vite browser-externalized `fs` warning for `tradeDebug.ts`, existing dynamic/static import chunking warnings, and existing large chunk size warning.
- `npm run validate:project` — PASS

## 8. Re-evaluation Gate

After this pass, run one fresh re-evaluation audit with a scoped progression gate. Do not assume the trio is cleared unless the next audit says so from fresh code evidence.
