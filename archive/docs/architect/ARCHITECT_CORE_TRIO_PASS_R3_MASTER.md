# ARCHITECT_CORE_TRIO_PASS_R3_MASTER

## 1. Objective

Continue hardening the current core-logic blocker trio by applying stronger existing contracts where they genuinely fit and eliminating weak placeholder typing in the trio's exact remaining live boundaries.

## 2. Definition Of Done

This pass succeeds when the trio's important live flows are materially less dependent on `LooseRecord`, `AnyRecord`, `Record<string, unknown>`, open index signatures, vague local `...Like` bags, branch-level `any`, and bridge casts because stronger existing contracts are now used where truthful, and any remaining looseness is small and intentional.

## 3. Scoped Blocker Files

- `src/features/architect/utils/mutationPipeline.ts`
- `src/features/architect/utils/capLegalityValidation.ts`
- `src/features/architect/utils/seasonManager.ts`

## 4. Existing Stronger Contract Targets

- `Awaited<ReturnType<typeof getTeam>>` and `Awaited<ReturnType<typeof getPlayer>>` from `teamLoader.ts` were reused at the `loadStateForMutation` boundary in `mutationPipeline.ts`, then narrowed back to canonical mutation-state carriers through local boundary helpers instead of leaking full loader shapes into compute/apply branches.
- `ArchitectMutationTeamRecord`, `ArchitectMutationPlayerRecord`, `ArchitectMutationContract`, `ArchitectMutationSalaryRow`, and `ArchitectMutationOfferSheet` from `mutationPipeline.ts` were reused to tighten live compute/apply and validator-facing mutation flows.
- `BuildRuleContextInput` from `buildRuleContext.ts` was reused to narrow rule-context assembly in `capLegalityValidation.ts`.
- `CapHold` from `capHolds.ts` was reused through narrowed `MutationCapHold` / `KnownCapHold` handling in live signing and option-validation paths.
- `OffseasonTeamCapSheet`, `OffseasonOptionDecisionMap`, `OffseasonTransitionContext`, `OffseasonTransitionResult`, and `OffseasonAppliedChangesSummary` from `offseason/resolveOffseasonTransition.ts` were reused to tighten the live `advanceSeasonInWorld` transition handoff.
- `SeasonManagerProjectedDraftPickView` from `entitlements/seasonManagerProjection.ts` was reused as the canonical source for the live season-manager draft carrier fields, with only the writable status/resolution slots widened locally where this file actually mutates them.

## 5. Pass Status Ledger

- Core trio pass R3 — PARTIAL: materially reduced live loader/state/source bridges in `mutationPipeline.ts`, narrowed live mutation-validator contracts in `capLegalityValidation.ts`, and retyped the live offseason/draft carrier handoff in `seasonManager.ts` without any support edit. Remaining looseness is now smaller and concentrated in orchestration-wide current-state carriers, intentionally tolerant raw validator boundaries, and local season-manager helper bridges.

## 6. Current Risks / Open Questions

- `mutationPipeline.ts` still carries orchestration-wide `CurrentStateLike` / `TeamLike` / `PlayerLike` compatibility layers; this pass only tightened the live loader entrypoints and verdict-driving compute/apply reads where stronger contracts already fit.
- `capLegalityValidation.ts` still keeps `AnyRecord` and broad bags at intentionally tolerant malformed-input and warning/violation boundaries; those should not be force-narrowed unless the runtime contract changes.
- `seasonManager.ts` still needs one local draft-pick bridge because the conveyance/swap helper return types remain looser than the live `advanceSeasonInWorld` carrier shape.
- No support edit was required in this run. If a future pass considers exporting a type from `conveyanceResolution.ts`, prove first that the missing export is the direct blocker to removing a live loose boundary in the scoped path.

## 7. Validation Ledger

- `npm run typecheck` — PASS
- `npm run test:node -- --reporter=dot src/tests/architect/architectCoreTrioPassR3.test.ts` — PASS
- `npm run build` — PASS
  Build warnings observed: stale `caniuse-lite` / Browserslist data; Vite browser-externalization warning for `fs` in `tradeDebug.ts`; existing dynamic-import chunking warnings for `firebaseConfig.js`, `entitlementResolver.ts`, and `leagueInvariants.ts`; existing large chunk-size warning for `dist/assets/index-1af902e5.js`.
- `npm run validate:project` — PASS

## 8. Re-evaluation Gate

After this pass, run one fresh re-evaluation audit with a scoped progression gate. Do not assume the trio is cleared unless the next audit says so from fresh code evidence.
