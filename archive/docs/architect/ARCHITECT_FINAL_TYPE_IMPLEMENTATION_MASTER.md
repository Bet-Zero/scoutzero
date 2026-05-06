# ARCHITECT_FINAL_TYPE_IMPLEMENTATION_MASTER

## 1. Objective

Apply stronger existing shared/schema-backed/canonical contracts in the current remaining Architect blocker files, replacing weaker local placeholder typing where they genuinely fit the live runtime flow.

## 2. Definition Of Done

This pass is successful when important live flows in the three scoped files are materially less dependent on:

- `LooseRecord`
- `Record<string, unknown>`
- open index signatures
- vague local `...Like` bags
- bridge casts

because stronger existing contracts are now being used where appropriate.

## 3. Scoped Blocker Files

- `src/features/architect/GMDashboard/hooks/useArchitectActions.ts`
- `src/features/architect/utils/capHoldTransitionHelpers.ts`
- `src/features/architect/hooks/useCapValidation.ts`

## 4. Existing Stronger Contract Targets

- `ArchitectMutationPayload['teams']` indexed-access payload slices for trade team and entitlement persistence boundaries in `useArchitectActions.ts`.
- `ArchitectMutationDeadCapEntry` for dead-cap mutation payload/state alignment in `useArchitectActions.ts`.
- `ArchitectMutationExceptions` and `ArchitectMutationExceptionEntry` for exception mutation payload/state alignment in `useArchitectActions.ts`.
- `Parameters<typeof computeWorldMutation>[0]['currentState']` exact sign/trade compute-path subsets in `useArchitectActions.ts`.
- Shared `CapHold` contract from `src/features/architect/utils/capHolds.ts`, with only the minimal action-boundary relaxation still needed in `useArchitectActions.ts`.
- `PlayerRulesProfileFreeAgency` for canonical free-agency validation input in `capHoldTransitionHelpers.ts`.
- `CapHoldPlayerInput` as the canonical contract root evaluated and partially reused in `capHoldTransitionHelpers.ts`; live helper inputs still require local widening around contract rows to remain compatible with mutation-pipeline callers.
- `PlayerRulesProfileInput` and `PlayerRulesProfileTeamCapSheet` as the canonical roots for validation player/team inputs in `useCapValidation.ts`.
- Field-accurate `PlayerRulesProfile` slices for `minimumSalary`, `extensionEligibility`, `extensionTerms`, `birdRights`, `maxSalary`, and `restrictedFreeAgency` in `useCapValidation.ts`.

## 5. Pass Status Ledger

- Current blocker-hardening pass — COMPLETE
- Summary: stronger existing mutation-pipeline, cap-hold, free-agency, and player/rules-profile contracts were applied in all three scoped files without widening into support edits; runtime-facing weak typing was reduced, but mixed UI/editor compatibility surfaces still remain in `useArchitectActions.ts` and `useCapValidation.ts`.

## 6. Current Risks / Open Questions

- `useArchitectActions.ts` still carries local `ArchitectPlayer` / `LocalContract` compatibility because the dashboard/editor flows mix canonical player slices with looser modal/pipeline payloads.
- `capHoldTransitionHelpers.ts` still needs widened local contract-row compatibility around `salariesByYear` because mutation-pipeline callers do not fully satisfy `CapHoldPlayerInput` on their own.
- `useCapValidation.ts` still keeps local `contractData` and a `calculateTeamCapHit` bridge cast because the shared helper player contract is narrower than the hook’s mixed runtime inputs.
- No support edit was required to expose any authoritative type cleanly in this pass.

## 7. Validation Ledger

- `npm run typecheck` — PASS
- `npm run test:node -- --reporter=dot src/tests/architect/architectFinalTypeImplementation.test.ts` — PASS
- `npm run build` — PASS
  - Warning: existing Browserslist data is stale (`caniuse-lite` 7 months old).
  - Warning: existing Vite/Rollup warnings remain for `fs` browser externalization, mixed static/dynamic imports, and large chunk size.
- `npm run validate:project` — PASS

## 8. Re-evaluation Gate

- After this pass, run one fresh re-evaluation audit.
- Do not assume this is the final implementation pass unless the re-evaluation justifies that.
