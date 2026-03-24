# Architect Store Offer Sheet Truth E5

## Summary

E5 fixes the last authoritative offer-sheet creation truth gap. `storeOfferSheet` no longer infers player ownership from `getPlayer(worldId, offeringTeamCode, playerId)`. It now resolves the real home team from authoritative world snapshot membership only, loads canonical player truth from the resolved home-team path, and fails closed when ownership or source truth is ambiguous.

## Files changed

- `src/features/architect/utils/mutationPipeline.ts`
- `tests/architect/mutationPipeline.tradePersistenceTruth.test.ts`
- `tests/architect/offerSheetPersistence.test.js`
- `src/tests/architect/offerSheets_closure.gate.test.ts`
- `docs/architect/ARCHITECT_CONTRACT_FLOW_REVIEW.md`
- `return_packages/architect/ARCHITECT_STORE_OFFER_SHEET_TRUTH_E5.md`

## Root cause

Before E5, the authoritative store path asked the offering-team path for player truth first, then derived `homeTeamCode` from that response. If a world contained stale offering-team-path data or a home-team override, offer-sheet validation and mirroring could be built from the wrong team/player truth.

## What was wrong before

- `loadStateForMutation('storeOfferSheet')` loaded `getPlayer(worldId, offeringTeamCode, playerId)`.
- The loader inferred `homeTeamCode` from that player object and only then loaded the home team.
- The store path could therefore validate and mirror against stale offering-team assumptions, stale base truth, or mismatched team ownership.
- There was no strict fail-closed rule for snapshot membership ambiguity.

## What is correct now

- Ownership is resolved only from explicit world team snapshots in the active world lineage.
- Ownership precedence is strict:
- `1.` unique world snapshot `roster` membership
- `2.` otherwise unique world snapshot `players[]` membership
- Snapshot `roster` vs `players[]` disagreement fails closed immediately.
- Base fallback is not used to resolve ownership or source truth.
- Canonical player truth is built only from the resolved home-team snapshot player plus the first home-team override found in lineage.
- `computeStoreOfferSheetResult` now requires resolved `offeringTeam`, `homeTeam`, and canonical `player`, and derives `homeTeamCode` from `homeTeam.teamCode`.

## Current read path vs corrected read path

Before E5:

- offering team loaded first
- player loaded from `getPlayer(worldId, offeringTeamCode, playerId)`
- `homeTeamCode` inferred from that player
- home team loaded after the fact

After E5:

- world lineage resolved first
- explicit world snapshots scanned team-by-team
- ownership selected from strict `roster` then `players[]` precedence
- resolved home team loaded as source of truth
- canonical player built from home-team snapshot player plus home-team override lineage
- offering team remains only the actor, never the ownership source

## Home-team truth proof

- Added persisted-world proof in `tests/architect/mutationPipeline.tradePersistenceTruth.test.ts` that a stray offering-team-path override is ignored.
- The stored outgoing and mirrored incoming offer sheets now use `homeTeamCode === 'BOS'` and `playerName === 'Canonical Home Override Name'` even when the offering-team path contains contradictory player truth.

## World override precedence proof

- Added proof that a home-team override wins over stale base/offering data during `storeOfferSheet`.
- The stored offer sheet uses the home-team override display name instead of both the base player name and the stale offering-team-path override name.

## Failure-path safety result

- Added fail-closed persisted-world proofs for:
- no authoritative owner in world snapshots
- multiple snapshot roster owners
- candidate owner where snapshot `roster` and `players[]` disagree
- In all three cases, `applyWorldMutation('storeOfferSheet')` returns failure and persists no outgoing or mirrored offer sheets.

## E4 compatibility proof

- Added store-to-match-to-finalize proof: `storeOfferSheet -> matchOfferSheet -> finalizeMatchedOfferSheet`.
- Added store-to-decline-to-finalize proof: `storeOfferSheet -> declineOfferSheet -> finalizeDeclinedOfferSheet`.
- Both chains still preserve E4 behavior:
- matched finalization persists a same-team canonical player upsert
- declined finalization persists canonical destination truth plus source cleanup

## Tests added/updated

- Updated `tests/architect/mutationPipeline.tradePersistenceTruth.test.ts`
- Added authoritative home-team ownership proof.
- Added home-team override precedence proof.
- Added fail-closed proofs for no owner, multiple owners, and membership disagreement.
- Added store-to-finalize compatibility proofs for matched and declined flows.
- Updated `tests/architect/offerSheetPersistence.test.js`
- Added direct compute guardrails requiring resolved home-team truth.
- Added compute fail-closed coverage for missing home team, same-team home/offering identity, and missing home-team snapshot player truth.
- Updated `src/tests/architect/offerSheets_closure.gate.test.ts`
- Added gates that `storeOfferSheet` routes through strict authority resolution, does not use offering-team-path `getPlayer`, checks `roster` before `players[]`, fails on disagreement, and derives `homeTeamCode` from resolved home-team authority.

## Validation results

- `npm run typecheck` — passed.
- `npm run test:node -- --reporter=dot tests/architect/offerSheetPersistence.test.js tests/architect/mutationPipeline.tradePersistenceTruth.test.ts src/tests/architect/offerSheets_closure.gate.test.ts` — passed.
- `npm run test:node -- --reporter=dot` — failed outside the E5 change set with these standing failures:
- `tests/contractParser.test.js` import resolution failure for `@/shared/utils/contracts/contractParser.js`
- `src/tests/security/firestoreRules.integration.test.ts` missing `FIRESTORE_EMULATOR_HOST`
- `src/tests/security/firestoreRules.integration.test.ts` teardown follow-on because `testEnv` was never initialized
- `tests/validators/roster.test.js` 2 assertion failures
- `src/tests/architect/architectTsTopologyCleanup.behavior.test.ts` 1 timeout
- `src/tests/architect/editContractModal_closure.gate.test.ts` 1 stale gate failure
- `src/tests/architect/freeAgency_closure.gate.test.ts` 2 stale gate failures
- `src/tests/architect/tradeApply_baseState_authoritativeGate.guardrail.test.ts` 1 stale gate failure
- `npm run build` — passed with existing Vite warnings about `fs` browser externalization, mixed static/dynamic imports, stale `caniuse-lite` data, and large chunk sizes.

Commands intentionally skipped:

- `npm run test:full` was not run because the prompt did not include `RUN FULL SUITE`.
- `npm run validate:project` was not run because this ticket did not add new folders or export structure.
- `npm run lint` and `npm run lint:md` were not run because repo policy does not require them for this mutation-layer ticket.

## Remaining follow-up tickets

1. Replace modal-side SAT apron logic with shared authoritative preflight based on receiving-team post-trade context.
2. Pass canonical offer-sheet flags/status plus authoritative home-team context into modal validation or expose a shared authoritative offer-sheet preflight helper.
3. Decide whether the 48-hour offer-sheet match window should become a blocking authoritative rule.
4. Remove or rewrite `rfa_offer_sheet_stub_active` so validator messaging matches the live workflow.
5. Hide or disable SAT consistently in all no-world modal entry surfaces.
