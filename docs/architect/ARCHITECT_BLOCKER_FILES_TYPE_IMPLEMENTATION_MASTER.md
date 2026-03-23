# ARCHITECT_BLOCKER_FILES_TYPE_IMPLEMENTATION_MASTER

## 1. Objective

Apply stronger existing shared, schema-backed, and canonical contracts in the current remaining Architect blocker files, eliminating weaker local placeholder typing where those stronger contracts genuinely fit and reducing or isolating the rest where the runtime is still mixed or legacy-shaped.

## 2. Definition Of Done

This pass is successful when important live flows in the five scoped files are materially less dependent on `LooseRecord`, `Record<string, unknown>`, open index signatures, vague local `...Like` bags, and bridge casts because stronger existing contracts are now used where appropriate, and any remaining looseness is small and intentional.

## 3. Scoped Blocker Files

- `src/features/architect/GMDashboard/hooks/useArchitectActions.ts`
- `src/shared/components/EditContractModal.tsx`
- `src/features/architect/GMDashboard/hooks/useArchitectState.ts`
- `src/features/architect/tradeMachine/TradeTeamCard.tsx`
- `src/features/architect/GMDashboard/components/SeasonAdvanceModal.tsx`

## 4. Existing Stronger Contract Targets

- `ArchitectDashboardPlayer` and `ArchitectDashboardCapSheet` from `src/features/architect/GMDashboard/hooks/useArchitectState.ts`
  Reused in `useArchitectActions.ts` so the live dashboard action flows stop rebuilding weaker local player and cap-sheet mirrors.
- `PlayerRulesProfileInput`, `PlayerRulesProfileTeamCapSheet`, `CapHoldItem`, `DeadCapItem`, `Exceptions`, `TeamTotals`, `OfferSheetLike`, `TeamHistoryCapSheetLike`, and `Awaited<ReturnType<typeof getLeague>>[number]`
  Reused to back the exported `useArchitectState.ts` dashboard aliases instead of broader local bag shapes.
- `ArchitectMutationPayload`, `ArchitectMutationResult`, `ArchitectMutationTeamUpdate`, `ArchitectMutationContract`, `ArchitectMutationDeadCapEntry`, and `ArchitectMutationExceptions` from `src/features/architect/utils/mutationPipeline.ts`
  Reused in `useArchitectActions.ts` for mutation payload and result boundaries.
- `Parameters<typeof useCapValidation>[0]`, `ReturnType<typeof buildSigningGuardrails>`, `ArchitectMutationResult['writesSummary']`, and `PlayerRulesProfileLeagueContext`
  Reused in `EditContractModal.tsx` for modal validation inputs, guardrails, league context, and normalized action-result write summaries.
- Narrow indexed-access slices from `ReturnType<typeof useTradeMachine>`, plus `Parameters<typeof OutgoingPlayersList>[0]`, `Parameters<typeof EntitlementPicksList>[0]`, `Parameters<typeof getTeamSnapshot>[1]`, `TeamTpeLike`, and `TradeExceptionLike`
  Reused in `TradeTeamCard.tsx` for the live team, player, entitlement, validation, and TPE flows without carrying the full hook return shape into local props.
- `OffseasonOptionDecision` and the `advanceSeasonInWorld` return signature from `src/features/architect/utils/seasonManager.ts`
  Reused in `SeasonAdvanceModal.tsx` for option decisions and advance-result alignment.
- `OffseasonAppliedChangesSummary` and `Partial<OffseasonTeamCapSheet>`
  Evaluated for `SeasonAdvanceModal.tsx`, but not retained for the full modal result and incoming team-cap-sheet prop because the current runtime summary and legacy cap-hold/player inputs are still broader than those contracts.

## 5. Pass Status Ledger

- Blocker-files type implementation pass — COMPLETE
  Stronger existing contracts were applied across all five scoped blocker files, weak local mirrors were removed or reduced in the important live flows, and the remaining broad compatibility typing is now localized to the legacy or mixed-shape boundaries that still do not truthfully fit the stronger shared contracts.

## 6. Current Risks / Open Questions

- `useArchitectActions.ts` now fits the stronger contracts only partially.
  The live mutation boundaries now use the stronger dashboard aliases and canonical mutation result contracts, but legacy salary-array normalization and a few mixed player lookup paths still require localized compatibility handling.
- `EditContractModal.tsx` still needs legacy callback payload compatibility after stronger contract application.
  The validation input and write-summary/result handling now align to stronger shared contracts, but the modal still carries additive local compatibility fields for legacy callback payload shape and mixed display metadata.
- `useArchitectState.ts` can likely drop more broad state bags later, but not cleanly in this pass.
  The exported dashboard player and cap-sheet aliases now sit on stronger shared contracts, while mixed offseason summary and world-roster merge inputs still remain broader than a single truthful canonical type.
- `TradeTeamCard.tsx` and `SeasonAdvanceModal.tsx` still carry targeted local compatibility layers.
  `TradeTeamCard.tsx` now uses narrow `useTradeMachine` slices and shared child/snapshot contracts for the live card flows, but it still keeps explicit local player and entitlement UI fields where the hook return stays `unknown`-heavy. `SeasonAdvanceModal.tsx` now uses stronger option-decision and TPE contracts, but its incoming team-cap-sheet prop and returned summary remain mixed because the current runtime inputs and `advanceSeasonInWorld` summary are broader than `OffseasonTeamCapSheet` and `OffseasonAppliedChangesSummary`.
- No support edit was required to expose an existing authoritative type cleanly.

## 7. Validation Ledger

- `npm run typecheck` — PASS
- `npm run test:node -- --reporter=dot src/tests/architect/architectBlockerFilesTypeImplementation.test.ts` — PASS
  `3` tests passed in `1` file.
- `npm run build` — PASS
  Warnings observed:
  `Browserslist` data is stale, `fs` was externalized from `src/features/architect/utils/tradeMachine/engine/tradeDebug.ts`, Vite reported existing dynamic-plus-static import chunking warnings for `firebaseConfig.js`, `entitlementResolver.ts`, and `leagueInvariants.ts`, and the main production chunk still exceeds the default `500 kB` warning threshold.
- `npm run validate:project` — PASS

## 8. Re-evaluation Gate

After this pass, run one fresh re-evaluation audit. Do not assume this is the final implementation pass unless that re-evaluation justifies it.
