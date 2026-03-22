# ARCHITECT_CONTRACT_APPLICATION — EXECUTION RETURN PACKAGE

## 1. Summary

This pass completed fully.

Runtime behavior remained unchanged in the focused proof coverage and the required validation commands.

Stronger existing contracts were materially applied in all four scoped files.

The work still appears on track, and this lane now looks ready for a fresh closeout audit rather than another immediate contract-application pass.

## 2. Files Changed

- `src/features/architect/contract/ContractEditor/ContractEditor.tsx`
- `src/features/architect/contract/ContractEditorModal/ContractEditorModal.tsx`
- `src/features/architect/GMDashboard/hooks/useArchitectActions.ts`
- `src/features/architect/hooks/useCapValidation.ts`
- `src/tests/architect/architectContractApplication.test.ts`
- `docs/architect/ARCHITECT_CONTRACT_APPLICATION_MASTER.md`
- `return_packages/trade_machine/ARCHITECT_CONTRACT_APPLICATION_RETURN_PACKAGE.md`

## 3. Stronger Contracts Applied

- `PlayerRulesProfileInput` from `src/features/architect/types/playerRulesProfiles.ts`
  Applied in `ContractEditor.tsx` and forwarded through `ContractEditorModal.tsx`.
  Replaced the local `LooseRecord` / `Record<string, unknown>` player bag.
- `PlayerRulesProfileTeamCapSheet` from `src/features/architect/types/playerRulesProfiles.ts`
  Applied to the editor/modal team-cap-sheet prop boundary.
  Replaced the local `Record<string, unknown>` team-cap-sheet bag.
- `CapProjectionOverrides` from `src/features/architect/utils/capRulesProfile/capRulesProfile.ts`
  Applied to the editor/modal cap-projection boundary.
  Replaced the local `Record<string, unknown>` cap-projection bag.
- `BasePlayerContract` and `BasePlayerContractYear` from `src/schemas/architect.ts` via `@/features/architect/types`
  Applied as narrower contract and salary-row slices in `useCapValidation.ts` and `useArchitectActions.ts`.
  Reduced local contract-row duplication and the old standalone salary-row shape.
- `CapHoldItem`, `DeadCapItem`, `Exceptions`, and `TeamTotals` from `src/schemas/architect.ts` via `@/features/architect/types`
  Applied in `useArchitectActions.ts` to keep the local cap-sheet shape grounded in the schema-backed domain contracts.
  Reduced weaker local cap-hold, dead-cap, exception, and totals mirrors.
- `ArchitectMutationContract`, `ArchitectMutationPayload`, `ArchitectMutationResult`, and `ArchitectMutationTeamUpdate` from `src/features/architect/utils/mutationPipeline.ts`
  Applied only to the pipeline-governed action paths in `useArchitectActions.ts`.
  Reduced local payload/result duplication without forcing pipeline types into unrelated local-only branches.
- `UseArchitectStateReturn['teamCapSheet']`, `['playersMap']`, and `['selectedPlayer']` from `src/features/architect/GMDashboard/hooks/useArchitectState.ts`
  Applied as the source authority for narrower state aliases in `useArchitectActions.ts`.
  Reduced ad hoc local state shape duplication.
- Evaluated but not forced: full canonical persisted-contract payload typing for the `ContractEditor` / `ContractEditorModal` sign callback.
  Kept the legacy callback payload contract because forcing the canonical type would have changed or misrepresented the current observable callback shape.

## 4. Types Improved

- reduced `LooseRecord` usage in `ContractEditor.tsx`
- reduced `Record<string, unknown>` bags on the editor and modal prop boundaries
- replaced `any` preview typing in `ContractEditor.tsx` with the existing generated-contract return contract
- reduced local contract-row duplication in `useArchitectActions.ts`
- reduced `useCapValidation.ts` compatibility bags by moving to canonical player, team, rules-profile, and contract-row slices
- narrowed mutation-pipeline contract reuse to the actual pipeline-governed action paths
- narrowed state-hook contract reuse to the state properties that were actually the right authority for the scoped file

## 5. Validation / Regression Coverage Run

- `npm run typecheck` — PASS
- `npm run test:node -- --reporter=dot src/tests/architect/architectContractApplication.test.ts` — PASS
  Notes: 3/3 tests passed.
- `npm run build` — PASS
  Build warnings: Browserslist data is stale; Vite reported the pre-existing `fs` browser externalization from `tradeDebug.ts`; Vite reported the same pre-existing mixed static/dynamic import warnings for `firebaseConfig.js`, `entitlementResolver.ts`, and `leagueInvariants.ts`; Vite reported the same pre-existing large chunk size warning for the main bundle.
- `npm run validate:project` — PASS
- Intentionally skipped: `npm run test:diff`, `npm run test:fast`, `npm run test:architect`, `npm run test:trade`, `npm run test:full`
  Reason: the prompt required the exact narrower validation sequence for this pass.
- Test stabilization required: the new editor/modal proof uses payload-shape assertions instead of a date-sensitive `totalValue` constant, because the editor preview intentionally derives its start year from the current calendar year.

## 6. Remaining Weak Areas

- `ContractEditor.tsx` and `ContractEditorModal.tsx` still keep the legacy sign callback payload contract. A full canonical persisted-contract type does not fit that surface cleanly without changing observable behavior.
- `useArchitectActions.ts` still keeps localized adapters and bridge casts around world snapshot refreshes, dev-fixture helpers, and some local-only mutation branches.
- `useCapValidation.ts` still keeps `contractData` local and allows broader compatibility at the hook boundary for partial salary rows and player IDs so existing callers still fit.

## 7. Pass Status

This pass is complete.

The remaining work in these files is now smaller and clearer.

The next move should be a fresh closeout audit rather than another immediate implementation pass.

## 8. Recommended Next Actions

- Run a fresh Architect closeout audit with this pass in place.
- If that audit finds another issue in these four files, treat it as a new narrow follow-up pass instead of widening this contract-application lane.
