# ARCHITECT_CORE_LOGIC_BLOCKER_TRIO_MASTER

## 1. Objective

Apply stronger existing shared, schema-backed, canonical, and producer-consumer contracts in the current core-logic blocker trio, eliminating weaker local placeholder typing where those stronger contracts genuinely fit and reducing or isolating the remaining loose typing where the runtime surface is still mixed or legacy-shaped.

## 2. Definition Of Done

This pass is successful when important live flows in the three scoped files are materially less dependent on `LooseRecord`, `Record<string, unknown>`, open index signatures, vague local `...Like` bags, and bridge casts because stronger existing contracts are now used where appropriate, and any remaining looseness is small, localized, and intentional.

## 3. Scoped Blocker Files

- `src/features/architect/utils/mutationPipeline.ts`
- `src/features/architect/utils/seasonManager.ts`
- `src/features/architect/utils/capLegalityValidation.ts`

## 4. Existing Stronger Contract Targets

- `ArchitectMutationTeamRecord`, `ArchitectMutationPlayerRecord`, `ArchitectMutationContract`, `ArchitectMutationSalaryRow`, and indexed-access subsets from `src/features/architect/utils/mutationPipeline.ts`
- `PostStateCapValidationInput` from `src/features/architect/utils/capLegality/postStateCapValidator.ts`
- `OffseasonOptionDecisionMap`, `OffseasonTransitionContext`, `OffseasonTransitionResult`, and `OffseasonAppliedChangesSummary` from `src/features/architect/utils/offseason/resolveOffseasonTransition.ts`
- `CapHold` from `src/features/architect/utils/capHolds.ts`
- `TradeTeamResult`, `TradeSummaryByTeamIndexRow`, `TradeValidationResult`, `TradeValidatorContext`, `TradeValidatorCapSettings`, and `TradeValidatorCapProjections` from `src/features/architect/utils/tradeMachine/constants/types.ts`
- `TeamResult`, `ValidationTeam`, `PostTradeSnapshot`, and `ValidatedTradeContext` from `src/features/architect/utils/tradeContext/types.ts` as the narrowed live trade-path surface consumed by `mutationPipeline.ts`

## 5. Pass Status Ledger

- Core-logic blocker trio pass — COMPLETE
- Summary:
  - `mutationPipeline.ts` now consumes the narrowed trade-context contracts directly on the live trade path and uses `PostStateCapValidationInput` slices for post-state totals and rules-context wiring.
  - `seasonManager.ts` now uses `Offseason*` transition handoff/result contracts and `PostStateCapValidationInput` totals-context contracts at the live season-advance boundary without widening into unrelated offseason helper refactors.
  - `capLegalityValidation.ts` now applies `ArchitectMutation*` contracts to mutation-shaped validator entrypoints and immediate helpers while keeping malformed or mixed validation boundaries intentionally broad.
  - No second support edit was required.

## 6. Current Risks / Open Questions

- `mutationPipeline.ts` still carries intentionally broad metadata, `source`, and event/audit pockets where the runtime payload remains heterogeneous and there is no truthful stronger shared contract yet.
- `seasonManager.ts` still has legacy helper zones built on `LooseRecord`; this pass stopped at the truthful `resolveOffseasonTransition` handoff/result and post-state validation boundary instead of widening into those helper internals.
- `capLegalityValidation.ts` still keeps schema-checking, dead-cap, exception, Salary Engine, and cap-rules-adapter boundaries broad where the runtime surface is intentionally mixed, malformed, or pre-normalized.
- `tradeContext/types.ts` still localizes `AnyRecord` around raw validator receipts and pass-through trade blobs because the underlying validator output remains partially mixed.

## 7. Validation Ledger

- `npm run typecheck` — PASS
- `npm run test:node -- --reporter=dot src/tests/architect/architectCoreLogicBlockerTrio.test.ts` — PASS
- `npm run build` — PASS
  - Warnings:
    - Browserslist data is stale (`caniuse-lite` warning)
    - Existing Vite dynamic-import/chunk-size warnings for `firebaseConfig.js`, `entitlementResolver.ts`, `leagueInvariants.ts`, and the large main bundle
- `npm run validate:project` — PASS

## 8. Re-evaluation Gate

After this pass, run one fresh re-evaluation audit. Do not assume this is the final implementation pass unless the re-evaluation justifies that.
