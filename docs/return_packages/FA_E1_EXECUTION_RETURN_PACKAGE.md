# FA_E1 Execution Return Package

## Executive Summary

FA_E1 is implemented for the Architect Free Agency tab with SSOT-consistent mutation wiring and explicit world/vacuum behavior. The offer-sheet finalize no-op bug is fixed, world-required actions are gated in vacuum mode (no silent no-ops), signing now follows canonical mutation outcomes instead of partial optimistic cap patches, the FA pool is world-aware, and the legacy `loadFreeAgents()` live-path read has been removed.

## Fix List (P1 Issues: Before -> After)

### 1) Offer-sheet finalize no-op bug

- Before: `OfferSheetList` called `onFinalize(os)` while handler expected `(playerObj, offerSheet)` and could early-return silently.
- After: `handleFinalizeOfferSheet` now accepts one `offerSheet` arg, both incoming and outgoing lists pass `offerSheet`, and invalid input/status-role mismatch now surfaces explicit error toast/log.

### 2) Vacuum mode silent no-ops (worldId null)

- Before: persist-only FA actions could appear clickable but do nothing due to early-return persistence path.
- After: all world-required FA actions are explicitly gated in both UI and handler:
  - `signAndTrade`
  - `storeOfferSheet`
  - `matchOfferSheet`
  - `declineOfferSheet`
  - `finalizeMatchedOfferSheet`
  - `finalizeDeclinedOfferSheet`
- Vacuum mode retains local `signFreeAgent` only.

### 3) Sign flow divergence from canonical pipeline mechanics

- Before: local optimistic sign patch could drift from pipeline cap outcomes (cap holds, exception usage, hard-cap flags).
- After:
  - World mode sign runs through authoritative mutation runner (`applyWorldMutation`) and syncs `changedTeams` snapshot (with world reload fallback).
  - Vacuum sign uses `validateSigning` + `computeWorldMutation('signFreeAgent')` and applies computed snapshot.
- Result: local SSOT follows canonical compute/validate outcomes, not hand-built partial patches.

### 4) FA pool not world-aware

- Before: FA list derived from base players/contracts only; world roster reality not applied.
- After: world roster index is built from `getLeague(worldId)` and used to derive FA list in world mode:
  - rostered in world -> excluded from FA pool
  - unrostered in world -> eligible to appear
- Refresh occurs on initial load, world switch, and successful FA world mutations.

### 5) Unused legacy `loadFreeAgents()` runtime path

- Before: dead read existed in live `useArchitectState` load flow.
- After: `loadFreeAgents()` runtime call removed from live Free Agency path.

## Files Changed (Path + Purpose)

- `src/features/architect/GMDashboard/hooks/useArchitectActions.ts`
  - Added authoritative FA mutation runner and canonical snapshot sync.
  - Updated finalize signature and explicit error surfacing.
  - Implemented world-required guards for persist-only FA actions.
  - Added vacuum-mode canonical compute path for `signFreeAgent`.
- `src/features/architect/GMDashboard/components/OfferSheetList.jsx`
  - Added action gating props (`actionsDisabled`, `actionsDisabledReason`) and disabled states.
  - Finalize actions call with offer sheet object.
- `src/features/architect/GMDashboard/sections/FreeAgencySection.jsx`
  - Wired `onFinalize` for incoming list.
  - Added world/vacuum gating messaging and props for both offer-sheet lists.
  - Passed `worldId` into FA pool.
- `src/features/architect/GMDashboard/hooks/useArchitectState.ts`
  - Removed `loadFreeAgents()` live read.
  - Added world roster index state + `refreshWorldRosterIndex()`.
  - Updated FA derivation to use world roster index in world mode.
- `src/features/architect/freeAgency/FreeAgentPool/FreeAgentPool.jsx`
  - Hides Sign & Trade option in vacuum mode (`actionsOverride` based on `worldId`).
- `src/features/architect/GMDashboard/GMDashboard.jsx`
  - Passes `worldId` into Free Agency section.
  - Gates `onStoreOfferSheet` in modal wiring when no world.
- `src/tests/architect/OfferSheetList.freeAgency.test.jsx`
  - Finalize wiring regression tests + vacuum action-disabled assertion.
- `src/tests/architect/useArchitectActions.freeAgency.test.tsx`
  - Canonical post-sign cap-sheet sync assertion.
  - Vacuum no-silent-no-op guard assertion.
  - Missing finalize args error assertion.
- `src/tests/architect/useArchitectState.worldFreeAgency.test.tsx`
  - World-aware FA pool derivation + refresh behavior assertion.

## Vacuum-Mode Behavior (Explicit)

- Allowed locally in vacuum mode:
  - `signFreeAgent`
- Disabled/gated (UI + handler error) in vacuum mode:
  - `signAndTrade`
  - offer-sheet store/match/decline/finalize actions
- User-facing reason text: `Requires an active world to commit.`

## World-Aware Pool Approach (Explicit)

- Build a `Set` of rostered player IDs from `getLeague(worldId)` across `team.roster` and `team.players`.
- In world mode, FA pool is derived from base players filtered by that world roster index.
- This keeps FA pool aligned with world team snapshots on reload and after FA mutations.

## Validation Commands + Results

### Required gates

1. `npm run test -- --run`

- Result: failed (`22` failed files, `76` failed tests, `189` passed files, `2772` passed tests).
- FA_E1 tests passed within this full run:
  - `src/tests/architect/OfferSheetList.freeAgency.test.jsx`
  - `src/tests/architect/useArchitectActions.freeAgency.test.tsx`
  - `src/tests/architect/useArchitectState.worldFreeAgency.test.tsx`

1. `npm run build`

- Result: pass (production build completed).

1. `npm run validate:project`

- Result: failed (`3` pre-existing directory schema errors):
  - `player-scrape/contracts/output`
  - `player-scrape/contracts/working`
  - `team-scrape/shared/firestore_staging/output/merged`

### Additional targeted verification

- `npm run test -- --run src/tests/architect/OfferSheetList.freeAgency.test.jsx src/tests/architect/useArchitectActions.freeAgency.test.tsx src/tests/architect/useArchitectState.worldFreeAgency.test.tsx`
- Result: pass (`3` files, `7` tests).

## Baseline Failures vs New Regressions

- Baseline/pre-existing: full-suite failures are concentrated in unrelated trade/entitlement/season-manager and schema-validation suites.
- New regressions from FA_E1 scope: none identified in the added/updated FA_E1 tests.

## Manual Sanity Checklist

- [x] Incoming `MATCHED` offer sheet Finalize button calls finalize handler and executes/errs explicitly.
- [x] Outgoing `DECLINED` offer sheet Finalize button calls finalize handler and executes/errs explicitly.
- [x] Vacuum mode shows clear gating text and disables world-required offer-sheet actions.
- [x] Vacuum mode hides Sign & Trade option from FA signing modal.
- [x] World-mode sign updates cap sheet from canonical mutation result without manual reload.
- [x] World-mode FA pool excludes rostered players and refreshes after FA mutations.

## Remaining Known Issues / Follow-ups

- Repository-wide test baseline currently has unrelated failing suites; FA_E1 did not attempt to remediate those out-of-scope failures.
- `validate:project` currently fails due missing required directories unrelated to Free Agency.
