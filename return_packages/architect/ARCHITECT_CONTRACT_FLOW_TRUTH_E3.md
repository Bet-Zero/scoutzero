# Architect Contract Flow Truth E3

## Summary

E3 fixes the highest-priority persisted-world-truth blocker in the Architect contract flow. Trade-based mutations now persist canonical destination-team player overrides and explicit superseded source-team override cleanup in the authoritative mutation batch, so successful `executeTrade` and `signAndTrade` commits leave team snapshots, player override docs, and downstream `getPlayer` reads aligned.

## Exact files changed

- `src/features/architect/utils/mutationPipeline.ts`
- `src/features/architect/utils/tradeContext/tradeContext.ts`
- `src/features/architect/utils/tradeContext/index.ts`
- `tests/architect/mutationPipeline.tradePersistenceTruth.test.ts`
- `src/tests/architect/signAndTrade.test.js`
- `src/tests/architect/executeTrade_signAndTrade_apply.guardrail.test.ts`
- `src/tests/architect/tmCapIntegration.executeTrade_writePaths.guardrail.test.ts`
- `src/tests/architect/tradeApply_timingWarnings.behavior.test.ts`
- `src/tests/architect/tmCapIntegration.tradeApply_updatesCapAndHistory.integration.test.tsx`
- `src/tests/architect/tmCapIntegration.ui.tradeApply_updatesCapSheet.integration.test.tsx`
- `docs/architect/ARCHITECT_CONTRACT_FLOW_REVIEW.md`
- `return_packages/architect/ARCHITECT_CONTRACT_FLOW_TRUTH_E3.md`

## Root cause

Before E3, trade compute produced updated team snapshots but no canonical player persistence manifest. `persistWorldMutation` only writes player override docs from `computeResult.playerUpdates`, so a successful trade or sign-and-trade could persist roster/team truth while leaving authoritative player reads stale or contradictory. The routing logic needed to decide where each outgoing player ended up was also duplicated, which made persistence drift-prone.

## What was wrong before

- `computeTradeResult` returned `playerUpdates: []` for normal trades and SAT-derived trade legs.
- `persistWorldMutation` therefore wrote team snapshots but no canonical moved-player override docs.
- Old-team override docs for moved players were left behind, so `getPlayer(worldId, oldTeamCode, playerId)` could still resolve superseded truth.
- SAT specifically signed the player in compute-only state, but the saved destination-side player truth could still fall back to the stale pre-signing world/base document.

## What is correct now

- Trade/SAT compute now builds a pure player persistence manifest from the final post-trade `teamUpdates`.
- Destination-side upserts use the already-normalized final player object from the final destination team snapshot. Contract truth is not rebuilt from raw payload fragments.
- Source-team cleanup is explicit via `playerDeletes`, limited to the superseded current-truth override path for the moved player.
- Same-team routes emit no move ops.
- Duplicate move candidates for one player fail closed if they resolve to conflicting destinations.
- `persistWorldMutation` now writes destination upserts and source deletes in the same batch as team snapshots, event writes, and world metadata patches.
- `computeSignAndTradeResult` inherits the same manifest logic, so the persisted destination player keeps the newly signed SAT contract.

## Standard trade truth proof

- Code path: `buildTradePlayerPersistenceManifest` resolves source/destination, uses the final destination snapshot player, and emits both `playerUpdates` and `playerDeletes`.
- Evidence: `src/features/architect/utils/mutationPipeline.ts:2369-2511`
- Evidence: `src/features/architect/utils/mutationPipeline.ts:3193-3230`
- Evidence: `src/features/architect/utils/mutationPipeline.ts:4521-4534`
- Test proof: `tests/architect/mutationPipeline.tradePersistenceTruth.test.ts:194-264`
- Verified behavior: destination override doc is written under the destination team path, source override doc is deleted, team snapshots move the player, and `getPlayer(worldId, 'BOS', 'lal_out_18m')` returns the moved player with `teamCode === 'BOS'`.

## Sign-and-Trade truth proof

- Code path: `computeSignAndTradeResult` still signs first, then calls `computeTradeResult`, and now forwards both `playerUpdates` and `playerDeletes`.
- Evidence: `src/features/architect/utils/mutationPipeline.ts:5292-5423`
- Evidence: `src/features/architect/utils/mutationPipeline.ts:2369-2511`
- Evidence: `src/features/architect/utils/mutationPipeline.ts:4521-4534`
- Test proof: `tests/architect/mutationPipeline.tradePersistenceTruth.test.ts:266-364`
- Verified behavior: the destination override contains the signed SAT contract, the source override is deleted, and `getPlayer(worldId, 'BOS', 'sat_player')` returns the destination-team player with `contractType === 'Sign & Trade'`, the new salary, and `signingTeam === 'LAL'`.

## Old-team cleanup strategy

- Cleanup is represented explicitly as `playerDeletes`, separate from `playerUpdates`.
- Delete targets are limited to `architect_worlds/{worldId}/teams/{sourceTeamCode}/players/{playerId}`.
- Deletes are emitted only when source and destination both resolve conclusively and differ.
- A missing old-team override is a safe no-op because Firestore batch deletes do not require the document to exist.
- No base data, no destination override, and no unrelated override path is touched.

## Failure-path safety result

- a moved player lacks a stable `playerId`
- any source/destination team code cannot be resolved conclusively
- source and destination resolve to the same team
- the final destination snapshot does not contain the moved player
- the final destination snapshot player has a mismatched `teamCode`
- duplicate move candidates for one player resolve to conflicting destinations
- Persistence remains atomic because `playerUpdates`, `playerDeletes`, team snapshots, event writes, and metadata patches all stay in one Firestore batch.
- Validation failure still blocks batch creation, and persistence failure still commits nothing partially.
- No-regression proof: `computeWorldMutation('extendPlayer')` now explicitly returns `playerDeletes: []`, covered by `tests/architect/mutationPipeline.tradePersistenceTruth.test.ts`.

## Tests added/updated

- Added `tests/architect/mutationPipeline.tradePersistenceTruth.test.ts`
- Updated batch mocks to include `delete` support in:
- `src/tests/architect/signAndTrade.test.js`
- `src/tests/architect/executeTrade_signAndTrade_apply.guardrail.test.ts`
- `src/tests/architect/tmCapIntegration.executeTrade_writePaths.guardrail.test.ts`
- `src/tests/architect/tradeApply_timingWarnings.behavior.test.ts`
- `src/tests/architect/tmCapIntegration.tradeApply_updatesCapAndHistory.integration.test.tsx`
- `src/tests/architect/tmCapIntegration.ui.tradeApply_updatesCapSheet.integration.test.tsx`

Targeted proof covered:

- standard trade destination override persistence
- SAT signed-contract destination persistence
- source override cleanup
- conflicting duplicate move-candidate fail-closed behavior
- non-trade `playerDeletes` no-regression behavior

## Validation command results

- `npm run typecheck` — passed
- `npm run test:node -- tests/architect/mutationPipeline.tradePersistenceTruth.test.ts src/tests/architect/signAndTrade.test.js src/tests/architect/tmCapIntegration.executeTrade_writePaths.guardrail.test.ts src/tests/architect/tradeApply_timingWarnings.behavior.test.ts --reporter=dot` — passed
- `npm run test:node -- --reporter=dot` — failed with unrelated existing failures and environment-dependent suites:
- `tests/contractParser.test.js` import resolution failure
- `src/tests/security/firestoreRules.integration.test.ts` requires `FIRESTORE_EMULATOR_HOST`
- `tests/validators/roster.test.js`
- `src/tests/architect/editContractModal_closure.gate.test.ts`
- `src/tests/architect/freeAgency_closure.gate.test.ts`
- `src/tests/architect/offerSheets_closure.gate.test.ts`
- `src/tests/architect/tradeApply_baseState_authoritativeGate.guardrail.test.ts`
- `npm run build` — passed with existing Vite warnings about `fs` browser externalization, mixed static/dynamic imports, and chunk size

## Remaining follow-up tickets

1. Refactor offer-sheet finalization onto the same canonical player-movement persistence path so matched/declined finalization emits player upserts, old-team cleanup, normalized contracts, and cap-hold cleanup.
2. Fix `storeOfferSheet` player loading so world-specific player truth resolves from the actual home team, not the offering team path.
3. Replace modal-side SAT apron logic with shared authoritative preflight based on receiving-team post-trade context.
4. Decide whether the 48-hour offer-sheet match window should be a blocking authoritative rule instead of warning-only behavior.
