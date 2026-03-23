# Architect Offer Sheet Finalization Truth E4

## Summary

E4 removes the remaining persisted-player-truth gap in the offer-sheet lifecycle. `finalizeMatchedOfferSheet` now persists a same-team canonical player override replacement from the final home-team snapshot, and `finalizeDeclinedOfferSheet` now persists canonical destination truth plus explicit source-team override cleanup from the final resolved team snapshots. The authoritative batch now keeps team snapshots, player override docs, and downstream `getPlayer` reads aligned for both offer-sheet finalization outcomes.

## Files changed

- `src/features/architect/utils/mutationPipeline.ts`
- `tests/architect/mutationPipeline.tradePersistenceTruth.test.ts`
- `tests/architect/offerSheetPersistence.test.js`
- `src/tests/architect/offerSheets_closure.gate.test.ts`
- `docs/architect/ARCHITECT_CONTRACT_FLOW_REVIEW.md`
- `return_packages/architect/ARCHITECT_OFFER_SHEET_FINALIZATION_TRUTH_E4.md`

## Root cause

Before E4, both offer-sheet finalize paths mutated team snapshots directly but never emitted canonical player persistence outputs. Matched finalization rebuilt a partial contract on the home-team player and stopped there. Declined finalization created destination-side player truth from offer-sheet fragments and removed the player from the home team, but it still emitted no `playerUpdates`, no `playerDeletes`, and no canonical old-team cleanup. That let saved team truth diverge from authoritative `getPlayer` reads.

## Before vs after behavior

- Before: matched finalization updated only the home-team snapshot, manually rebuilt contract rows, and left authoritative player reads dependent on stale base or prior override state.
- After: matched finalization normalizes the contract once, updates the final home-team snapshot, removes the matching cap hold, and emits one canonical same-team `playerUpdate` with no delete path.
- Before: declined finalization could synthesize destination player truth from offer-sheet fragments and never deleted the superseded home-team override.
- After: declined finalization resolves the canonical source player from the home-team snapshot, applies the normalized offer-sheet contract to that player shape, emits a destination `playerUpdate`, and deletes the old home-team override in the same batch.

## Matched flow proof

- Code path: `computeFinalizeMatchedOfferSheetResult` now calls `buildNormalizedOfferSheetFinalContract`, updates the final home-team player snapshot, removes the player cap hold, then calls `buildCanonicalPlayerPersistenceManifest` with `mode: 'replace'`.
- Proof file: `tests/architect/mutationPipeline.tradePersistenceTruth.test.ts`
- Verified behavior:
- `applyWorldMutation('finalizeMatchedOfferSheet')` writes one player override under `architect_worlds/{worldId}/teams/BOS/players/{playerId}`.
- No `playerDelete` path is emitted.
- `getPlayer(worldId, 'BOS', playerId)` returns the matched player with `teamCode === 'BOS'`, `signedUsing === 'Match'`, and the normalized matched salary rows.
- Home-team `capHolds` no longer contain the player, and both mirrored offer-sheet arrays are empty after finalize.

## Declined flow proof

- Code path: `computeFinalizeDeclinedOfferSheetResult` now resolves `sourcePlayer` from the home-team snapshot, builds the normalized declined-offer contract once, writes the destination player from that canonical player snapshot, removes the player and stale cap holds from the home team, then calls `buildCanonicalPlayerPersistenceManifest` with `mode: 'move'`.
- Proof file: `tests/architect/mutationPipeline.tradePersistenceTruth.test.ts`
- Verified behavior:
- `applyWorldMutation('finalizeDeclinedOfferSheet')` writes the destination override under `architect_worlds/{worldId}/teams/LAL/players/{playerId}` and deletes the old `BOS` override in the same batch.
- `getPlayer(worldId, 'LAL', playerId)` returns the moved player with `teamCode === 'LAL'`, `signingTeam === 'LAL'`, `signedUsing === 'Offer Sheet'`, and the normalized declined-offer salary rows.
- The destination player keeps the canonical source player identity. The test intentionally sets `offerSheet.playerName` to a fragment-only wrong name and confirms the persisted player still uses the canonical source display name.

## Player persistence proof

- Shared helper extraction:
- `buildCanonicalPlayerPersistenceManifest` now handles both canonical replacement (`replace`) and canonical movement (`move`) from final team snapshots.
- Trade/SAT adapter:
- `buildTradePlayerPersistenceManifest` now delegates to the shared helper without changing trade routing logic.
- E3 no-regression proof:
- Existing standard trade and sign-and-trade tests in `tests/architect/mutationPipeline.tradePersistenceTruth.test.ts` still pass unchanged after the helper extraction.
- Standard trade still persists destination override truth and deletes the superseded source override.
- Sign-and-trade still persists the newly signed destination contract and deletes the superseded source override.

## Cap-hold cleanup behavior

- Matched finalization removes the finalized player’s home-team cap hold before recomputing totals.
- Declined finalization removes stale cap holds for that player on both teams before recomputing totals.
- Mirrored offer-sheet arrays are removed from both teams in both finalize paths.
- No base collections are touched; cleanup is limited to authoritative world snapshots and world player override docs.

## Failure-path safety

- Matched finalization fails closed if:
- the offer sheet cannot be found on the home team
- the offer sheet does not contain a stable `playerId`
- the player cannot be resolved on the home-team snapshot
- the normalized final contract cannot be built
- the final snapshot cannot provide a canonical persisted player object
- Declined finalization fails closed if:
- the offer sheet cannot be found on the offering team
- the source player cannot be resolved on the home-team snapshot
- the normalized final contract cannot be built
- the final destination snapshot cannot provide a canonical persisted player object
- the canonical manifest detects conflicting persistence candidates
- No partial persistence is possible because team snapshots, player upserts, player deletes, event writes, and world metadata writes stay inside the existing single Firestore batch.

## Tests added/updated

- Updated `tests/architect/mutationPipeline.tradePersistenceTruth.test.ts`
- Added persisted-world proof for matched finalize canonical replacement.
- Added persisted-world proof for declined finalize canonical movement.
- Preserved and reran the E3 standard trade and sign-and-trade proofs.
- Updated `tests/architect/offerSheetPersistence.test.js`
- Added direct compute assertions for matched `playerUpdates` with no `playerDeletes`.
- Added direct compute assertions for declined `playerUpdates` plus `playerDeletes`.
- Added fail-closed proof for declined finalization when the canonical source player cannot be resolved.
- Updated `src/tests/architect/offerSheets_closure.gate.test.ts`
- Repointed closure guards at normalized contract building, canonical manifest usage, and current authoritative sync helpers.

## Validation results

- `npm run typecheck` — passed.
- `npm run test:node -- tests/architect/mutationPipeline.tradePersistenceTruth.test.ts tests/architect/offerSheetPersistence.test.js src/tests/architect/offerSheets_closure.gate.test.ts src/tests/architect/offerSheetFinalizeValidatorMapping.guardrail.test.ts src/tests/architect/teamHistory.eventPayloadEnrichment.matrix.guardrail.test.ts --reporter=dot` — passed.
- `npm run test:node -- --reporter=dot` — failed outside the E4 change set with these standing failures:
- `tests/contractParser.test.js` import resolution failure for `@/shared/utils/contracts/contractParser.js`
- `src/tests/security/firestoreRules.integration.test.ts` missing `FIRESTORE_EMULATOR_HOST` and follow-on teardown failure
- `tests/validators/roster.test.js` 2 failures
- `src/tests/architect/architectTsTopologyCleanup.behavior.test.ts` 1 timeout
- `src/tests/architect/editContractModal_closure.gate.test.ts` 1 stale gate failure
- `src/tests/architect/freeAgency_closure.gate.test.ts` 2 stale gate failures
- `src/tests/architect/tradeApply_baseState_authoritativeGate.guardrail.test.ts` 1 stale gate failure
- `npm run build` — passed with existing Vite warnings about `fs` browser externalization, mixed static/dynamic imports, stale `caniuse-lite` data, and large chunk sizes.

Commands intentionally skipped:

- `npm run test:full` was not run because the prompt did not include `RUN FULL SUITE`.
- `npm run validate:project` was not run because this ticket did not add new folders, files, or export structure.
- `npm run lint` and `npm run lint:md` were not run because repo policy does not require them for this mutation-layer ticket.

## Remaining follow-up tickets

1. Fix `storeOfferSheet` player loading so authoritative offer-sheet creation resolves canonical world player truth from the actual home team instead of the offering-team path.
2. Replace modal-side SAT apron logic with shared authoritative preflight based on receiving-team post-trade context.
3. Pass canonical offer-sheet flags and status into modal preflight so UI validation matches authoritative offer-sheet logic.
4. Decide whether the 48-hour offer-sheet match window should be a blocking authoritative rule rather than warning-only behavior.
5. Remove or rewrite `rfa_offer_sheet_stub_active` so validator messaging matches the live workflow.
