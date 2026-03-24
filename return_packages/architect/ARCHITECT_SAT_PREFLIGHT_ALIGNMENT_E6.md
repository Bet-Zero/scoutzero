# Architect SAT Preflight Alignment E6

## Summary

E6 replaces the modal’s local SAT legality guesswork with one shared authoritative SAT preflight. The modal now requests a UI-safe `SignAndTradePreflightResult` from the same mutation-layer stack that validates real SAT applies, using the receiving team’s actual post-trade context. Apply-time validation remains the final authority.

## Files changed

- `src/features/architect/utils/mutationPipeline.ts`
- `src/features/architect/GMDashboard/hooks/useArchitectActions.ts`
- `src/shared/components/EditContractModal.tsx`
- `src/features/architect/hooks/useCapValidation.ts`
- `src/features/architect/GMDashboard/GMDashboard.tsx`
- `src/features/architect/GMDashboard/offerSheetTypes.ts`
- `src/features/architect/GMDashboard/sections/FreeAgencySection.tsx`
- `src/features/architect/freeAgency/FreeAgentPool/FreeAgentPool.tsx`
- `src/features/architect/freeAgency/FreeAgentPool/types.ts`
- `src/tests/architect/signAndTrade.test.js`
- `src/tests/architect/useCapValidation.behavior.test.ts`
- `src/tests/architect/useArchitectActions.freeAgency.test.tsx`
- `src/tests/architect/editContractModal.signAndTradePreflight.behavior.test.tsx`
- `src/tests/architect/sharedContractPocket.e111.behavior.test.tsx`
- `tests/architect/EditContractModal.rules.test.jsx`
- `src/tests/architect/mutationPipeline.boundary.e107.test.ts`
- `src/tests/architect/mutationPipeline.compatibility.guardrail.test.ts`
- `src/tests/architect/editContractModal_closure.gate.test.ts`
- `src/tests/architect/freeAgency_closure.gate.test.ts`
- `src/tests/architect/tradeApply_baseState_authoritativeGate.guardrail.test.ts`
- `src/tests/architect/offerSheets_closure.gate.test.ts`
- `docs/architect/ARCHITECT_CONTRACT_FLOW_REVIEW.md`
- `return_packages/architect/ARCHITECT_SAT_PREFLIGHT_ALIGNMENT_E6.md`

## Root cause

The modal was deciding SAT legality from a weaker local model. It warned about the receiving team hard cap, but the actual blocking branch was driven by current/source-team apron state instead of the receiving team’s post-trade state. That let the UI misclassify SAT before the authoritative mutation path re-checked it.

## What was wrong before

- `useCapValidation` had a local SAT branch that compared local/current team totals to first apron thresholds.
- `EditContractModal` could leave SAT looking selectable based on stale local state instead of authoritative post-trade legality.
- Base-mode dashboard surfaces could still present SAT even though authoritative commit required world context.
- The modal had no authoritative SAT request lifecycle, so it could not represent loading, incomplete, or stale-result invalidation correctly.

## What is correct now

- SAT preflight is exposed from `mutationPipeline.ts` as `preflightSignAndTradeMutation`.
- That preflight runs the real signing validation, builds the post-sign/post-trade snapshot, and evaluates the receiving team through the authoritative SAT/trade validator path.
- The result is returned as a UI-safe contract:
- `status: 'legal' | 'blocked' | 'incomplete'`
- `reasons: string[]`
- `warnings: string[]`
- `source: 'authoritative-preflight'`
- `EditContractModal` owns the async lifecycle and only enables confirm when the latest authoritative preflight returns `legal`.
- `useCapValidation` stays synchronous and only interprets already-available SAT preflight data.
- Apply-time `validateMutation('signAndTrade')` is unchanged as the final authority.

## Current SAT modal path vs authoritative SAT path

Before E6:

- modal selected SAT
- `useCapValidation` ran local SAT logic
- source/current-team apron guesses shaped UI state
- authoritative mutation path revalidated later and could disagree

After E6:

- modal selected SAT
- `EditContractModal` requests `getSignAndTradePreflight`
- `useArchitectActions` canonicalizes destination and contract, derives signing mechanism, and calls `preflightSignAndTradeMutation`
- `preflightSignAndTradeMutation` reuses the authoritative signing plus post-trade validation stack
- modal renders the returned legal/blocked/incomplete result
- real SAT apply still goes through authoritative mutation validation, which remains final

## Shared preflight design

- `mutationPipeline.ts` now exports `SignAndTradePreflightResult` and `preflightSignAndTradeMutation`.
- The preflight reuses the same legality summary mapper used by apply-time SAT validation, so the modal does not decode raw trade-validator internals.
- `useArchitectActions.getSignAndTradePreflight` is a read-only adapter that:
- resolves canonical destination team code
- canonicalizes contract structure
- derives `signedUsing`
- fails closed on missing world, invalid payload, or runtime failure
- `useCapValidation` accepts `signAndTradePreflight` as input and interprets it synchronously.

## UI alignment proof

- `src/tests/architect/editContractModal.signAndTradePreflight.behavior.test.tsx` proves SAT stays disabled while preflight is pending and only enables after an authoritative `legal` result.
- The same test file proves authoritative blocked/warning state is rendered from the UI-safe preflight result rather than local SAT heuristics.
- `tests/architect/EditContractModal.rules.test.jsx` and `src/tests/architect/sharedContractPocket.e111.behavior.test.tsx` stayed green with the new modal wiring.

## Receiving-team post-trade context proof

- `src/tests/architect/signAndTrade.test.js` adds authoritative preflight coverage that blocks SAT when the receiving team is over first apron in post-trade context.
- The same file proves the preflight result matches authoritative apply-time SAT legality on the same facts.
- This closes the exact gap where local UI logic could not see the real receiving-team post-trade snapshot.

## Drift-closure proof

- `src/tests/architect/signAndTrade.test.js` includes a direct drift-closure scenario where the old local SAT logic would have blocked because the source/current team was already over the first apron.
- The new authoritative preflight classifies that same scenario as `legal` because the receiving team’s post-trade context is the real rule input.
- The test also verifies that the new preflight classification matches apply-time authoritative SAT validation.

## Conservative/incomplete handling behavior

- `EditContractModal` immediately invalidates prior SAT legality when destination, salary, year, action, or modal-open state changes.
- Each request gets a monotonically increasing request id. Only the newest response can update modal SAT state.
- While a request is pending, the modal stores an `incomplete` preflight result and disables confirm.
- Missing world, missing destination, invalid contract, or runtime/preflight failure returns blocked or incomplete state instead of leaving SAT selectable.
- `src/tests/architect/editContractModal.signAndTradePreflight.behavior.test.tsx` proves stale legal responses cannot re-enable SAT after newer input invalidates them.

## Tests added/updated

- `src/tests/architect/signAndTrade.test.js`
- Added authoritative preflight classification coverage.
- Added receiving-team post-trade proof.
- Added drift-closure proof.
- Added apply-time parity proof.

- `src/tests/architect/useCapValidation.behavior.test.ts`
- Replaced old local SAT-branch expectations with synchronous interpretation of provided authoritative preflight data.

- `src/tests/architect/useArchitectActions.freeAgency.test.tsx`
- Added SAT preflight callback coverage for world and base-mode behavior.

- `src/tests/architect/editContractModal.signAndTradePreflight.behavior.test.tsx`
- Added pending-state, stale-response, and immediate-invalidation coverage.

- Guardrail updates:
- `src/tests/architect/mutationPipeline.boundary.e107.test.ts`
- `src/tests/architect/mutationPipeline.compatibility.guardrail.test.ts`
- `src/tests/architect/editContractModal_closure.gate.test.ts`
- `src/tests/architect/freeAgency_closure.gate.test.ts`
- `src/tests/architect/tradeApply_baseState_authoritativeGate.guardrail.test.ts`
- `src/tests/architect/offerSheets_closure.gate.test.ts`

## Validation results

- `npm run typecheck` — passed.
- `npm run test:node -- --reporter=dot src/tests/architect/useCapValidation.behavior.test.ts src/tests/architect/signAndTrade.test.js` — passed.
- `npm run test:ui -- --reporter=dot src/tests/architect/editContractModal.signAndTradePreflight.behavior.test.tsx src/tests/architect/sharedContractPocket.e111.behavior.test.tsx tests/architect/EditContractModal.rules.test.jsx` — passed.
- `npm run test:node -- --reporter=dot src/tests/architect/mutationPipeline.boundary.e107.test.ts src/tests/architect/mutationPipeline.compatibility.guardrail.test.ts src/tests/architect/editContractModal_closure.gate.test.ts src/tests/architect/freeAgency_closure.gate.test.ts src/tests/architect/tradeApply_baseState_authoritativeGate.guardrail.test.ts src/tests/architect/offerSheets_closure.gate.test.ts` — passed.
- `npm run test:node -- --reporter=dot` — failed outside the E6 SAT alignment change set with these standing failures:
- `tests/contractParser.test.js` import resolution failure for `@/shared/utils/contracts/contractParser.js`
- `src/tests/security/firestoreRules.integration.test.ts` missing `FIRESTORE_EMULATOR_HOST`
- `src/tests/security/firestoreRules.integration.test.ts` teardown follow-on because `testEnv` never initialized
- `tests/validators/roster.test.js` 2 failures expecting `warningsOnly: null` while runtime returns `warningsOnly: false`
- `src/tests/architect/architectTsTopologyCleanup.behavior.test.ts` timeout
- `src/tests/architect/phase65_forbid_direct_tradeExceptions_reads_guardrail.test.js` direct `.tradeExceptions` guardrail failure in `src/features/architect/utils/capLegalityValidation.ts`
- `src/tests/architect/phase83_live_pipeline_mutations_and_season_advance_emulator_e2e.test.js` stale string-scan failure expecting `advanceSeasonInWorld(worldId`
- `npm run build` — passed with existing Vite warnings about `fs` browser externalization, mixed static/dynamic imports, stale `caniuse-lite` data, and large chunk sizes.

Commands intentionally skipped:

- `npm run test:full` was not run because the prompt did not include `RUN FULL SUITE`.
- `npm run validate:project` was not run because this ticket did not add folders or export structure.
- `npm run lint` and `npm run lint:md` were not run because repo policy does not require them here.

## Remaining follow-up tickets

1. Replace offer-sheet modal preflight with shared authoritative offer-sheet preflight or pass authoritative home-team/offer-sheet flags into modal validation.
2. Decide whether the 48-hour offer-sheet match window should become a blocking authoritative rule.
3. Remove or rewrite `rfa_offer_sheet_stub_active` so offer-sheet validator messaging matches live behavior.
