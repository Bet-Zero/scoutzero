# ARCHITECT_CONTRACT_APPLICATION_MASTER

## 1. Objective

Apply stronger existing shared, schema-backed, and canonical contracts in the current Architect blocker files, replacing weaker local placeholder typing where those stronger contracts genuinely fit.

## 2. Definition Of Done

This pass is successful when important live flows in the four scoped files are materially less dependent on:

- `LooseRecord`
- `Record<string, unknown>`
- open index signatures
- vague local `...Like` bags
- bridge casts

because stronger existing contracts are now being used where appropriate.

## 3. Scoped Blocker Files

- `src/features/architect/contract/ContractEditor/ContractEditor.tsx`
- `src/features/architect/contract/ContractEditorModal/ContractEditorModal.tsx`
- `src/features/architect/GMDashboard/hooks/useArchitectActions.ts`
- `src/features/architect/hooks/useCapValidation.ts`

## 4. Existing Stronger Contract Targets

- Reused `PlayerRulesProfileInput` from `src/features/architect/types/playerRulesProfiles.ts` for the `ContractEditor` and `ContractEditorModal` player boundary.
- Reused `PlayerRulesProfileTeamCapSheet` from `src/features/architect/types/playerRulesProfiles.ts` for the editor/modal team-cap-sheet prop boundary.
- Reused `PlayerRulesProfile` from `src/features/architect/types/playerRulesProfiles.ts` as the stronger source for `useCapValidation` rules-profile slices.
- Reused `CapProjectionOverrides` from `src/features/architect/utils/capRulesProfile/capRulesProfile.ts` for the editor/modal cap-projection boundary.
- Reused `BasePlayerContract` and `BasePlayerContractYear` slices from `src/schemas/architect.ts` via `@/features/architect/types` for contract-row and contract-field reuse in `useCapValidation` and `useArchitectActions.ts`.
- Reused `CapHoldItem`, `DeadCapItem`, `Exceptions`, and `TeamTotals` from `src/schemas/architect.ts` via `@/features/architect/types` to keep the `useArchitectActions.ts` local cap-sheet contracts grounded in the schema-backed domain types.
- Reused `ArchitectMutationContract`, `ArchitectMutationPayload`, `ArchitectMutationResult`, and `ArchitectMutationTeamUpdate` from `src/features/architect/utils/mutationPipeline.ts` only on the action paths in `useArchitectActions.ts` that directly consume pipeline contracts.
- Reused `UseArchitectStateReturn['teamCapSheet']`, `UseArchitectStateReturn['playersMap']`, and `UseArchitectStateReturn['selectedPlayer']` from `src/features/architect/GMDashboard/hooks/useArchitectState.ts` as the source authorities for narrower local state aliases in `useArchitectActions.ts`.
- Evaluated but did not force full canonical persisted-contract payload typing onto `ContractEditor` / `ContractEditorModal` sign callbacks, because that would have altered or misrepresented the current observable callback payload shape.

## 5. Pass Status Ledger

- `Contract Application Pass — COMPLETE`
  Summary: stronger existing contracts were materially applied across the four scoped files, local placeholder typing was reduced in the important editor, action, and validation flows, no support edit was required, and runtime behavior remained unchanged in the focused validation proof.

## 6. Current Risks / Open Questions

- `ContractEditor.tsx` and `ContractEditorModal.tsx` still intentionally keep the legacy sign callback payload contract. A full canonical persisted-contract type would not fit that observable callback shape cleanly.
- `useArchitectActions.ts` still keeps localized adapters and a few bridge casts around world snapshots, dev-fixture helpers, and local-only mutation branches that are not directly governed by the mutation-pipeline contract.
- `useCapValidation.ts` intentionally keeps `contractData` local and keeps broader compatibility at the hook boundary for player IDs and partial salary rows so existing modal/state callers still fit.
- No support edit was required in this pass.

## 7. Validation Ledger

- `npm run typecheck` — PASS
- `npm run test:node -- --reporter=dot src/tests/architect/architectContractApplication.test.ts` — PASS
  Notes: 3/3 tests passed. The new proof covers the editor/modal sign payload path, `ensureContractStructure`, and a `useCapValidation` path with canonical-compatible fixtures.
- `npm run build` — PASS
  Warnings: pre-existing Browserslist staleness notice; pre-existing Vite browser externalization warning for `fs`; pre-existing mixed static/dynamic import warnings for `firebaseConfig.js`, `entitlementResolver.ts`, and `leagueInvariants.ts`; pre-existing large chunk size warning for the main bundle.
- `npm run validate:project` — PASS

## 8. Next-Step Gate

After this pass, the next step should be a fresh closeout audit unless that audit finds a new blocker that justifies another narrow implementation pass.
