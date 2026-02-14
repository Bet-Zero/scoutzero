# ARCH P1 Execution Return Package

## Executive Summary
P1 must-ship fixes (G-01 through G-06) were implemented with targeted, minimal code changes across Trade apply gating, authoritative world persistence behavior, world-overlay player sourcing, contract modal callback wiring, mutation validation switch de-duplication, and the entitlement resolver tuple typing issue. Build and full test suite pass after the changes. Typecheck still fails, but the specific Architect blocker at `entitlementResolver.ts:97` is resolved; remaining failures are pre-existing test/script typing errors outside the modified runtime paths.

## Changes by Task

### G-01 — Enforce trade validation freshness before apply
- Updated `src/features/architect/tradeMachine/TradeEditor.jsx`:
  - Added `canApplyTrade = hasCurrentValidation && result?.legal === true`.
  - `Apply Trade` button now disables unless validation is both legal and current.
  - Click handler now hard-checks freshness and legal state before applying.
  - Added defensive toast message: **"Re-validate trade before applying."**

### G-02 — Authoritative world-mode trade apply (await + no optimistic drift)
- Updated `src/features/architect/GMDashboard/hooks/useArchitectActions.ts` (`applyTradeToCapSheet`):
  - Built trade mutation payload/guards first.
  - In `worldId` mode: now `await runAuthoritativeFAMutation('executeTrade', { teams })` and return.
  - Removed world-mode optimistic `setTeamCapSheet(updated)` path.
  - Vacuum mode local apply behavior remains intact and separated.

### G-03 — World-aware player overlay for FA/trade display maps
- Updated `src/features/architect/GMDashboard/hooks/useArchitectState.ts`:
  - Added world override capture during `refreshWorldRosterIndex()` using `getLeague(worldId)` team player snapshots.
  - Added `worldAwarePlayers` merge seam (`base players + worldPlayerOverrides`).
  - Switched `playersMap` derivation and FA derivation to use world-aware merged players.
  - Returned merged players in hook output to keep downstream lookups world-consistent.

### G-04 — Contract modal sign/re-sign authoritative callback wiring
- Updated `src/shared/components/EditContractModal.jsx`:
  - Added explicit callbacks: `onSignFreeAgent`, `onResign`, `onSaveContract`.
  - `signNew` now routes to `(onSignFreeAgent || onSaveContract || onSave)`.
  - `resign` now routes to `(onResign || onSaveContract || onSave)`.
  - Backward compatibility preserved via legacy `onSave` fallback.
- Updated `src/features/architect/GMDashboard/GMDashboard.jsx`:
  - Removed dead `onSign` prop usage for modal.
  - Wired modal to `onSignFreeAgent={actions.handleSign}` and `onResign={actions.handleSign}`.
  - Wired `onSaveContract={actions.handleSaveContract}` for non-FA edit path.

### G-05 — De-duplicate offer-sheet validation switch
- Updated `src/features/architect/utils/mutationPipeline.js` (`validateMutation`):
  - Removed duplicate `case 'storeOfferSheet'` branch.
  - Removed redundant `matchOfferSheet/declineOfferSheet` fallthrough `{ valid: true }` no-op branch.
  - Kept single authoritative branch per offer-sheet mutation type.

### G-06 — Fix entitlement resolver TS2556 tuple spread issue
- Updated `src/features/architect/utils/entitlements/entitlementResolver.ts`:
  - Replaced untyped spread with tuple-cast path:
    - `const collectionPath = pathSegments as [string, ...string[]]`
    - `collection(db, ...collectionPath)`
  - This removes the `entitlementResolver.ts:97` spread-argument type error.

## File-by-File Change Log
- `src/features/architect/tradeMachine/TradeEditor.jsx`
- `src/features/architect/GMDashboard/hooks/useArchitectActions.ts`
- `src/features/architect/GMDashboard/hooks/useArchitectState.ts`
- `src/shared/components/EditContractModal.jsx`
- `src/features/architect/GMDashboard/GMDashboard.jsx`
- `src/features/architect/utils/mutationPipeline.js`
- `src/features/architect/utils/entitlements/entitlementResolver.ts`
- `tests/architect/EditContractModal.rules.test.jsx` (focused callback routing regression test)

## Acceptance Test Results

### G-01 (fresh validation gate)
- **Code-path verified:** apply handler + disabled state now both require `hasCurrentValidation && result.legal === true`.
- **Manual UI check:** **Blocked in sandbox** due missing Firebase env (`auth/invalid-api-key`) when loading app, but defensive checks are implemented in both UI state and handler.

### G-02 (authoritative world apply)
- **Code-path verified:** world-mode path now awaits authoritative mutation and does not optimistic-set local team before persist.
- **Failure-path manual simulation:** not executed against live world backend in sandbox (missing Firebase config).

### G-03 (world overlay display consistency)
- **Code-path verified:** world player overrides now merged into `playersMap` and FA derivation via `worldAwarePlayers`.
- **Manual world override verification:** blocked by sandbox Firebase configuration.

### G-04 (modal sign/re-sign wiring)
- **Automated check added/passed:** resign action uses explicit `onResign` over generic save fallback.
- **World persistence reload verification:** blocked by sandbox Firebase configuration.

### G-05 (switch dedupe)
- Existing offer-sheet test suite run and passing (`tests/architect/offerSheetResolution.test.js`).

### G-06 (typecheck blocker)
- Confirmed: previous TS2556 in `entitlementResolver.ts:97` is no longer present in `npm run typecheck` output.

## Validation Commands and Outcomes
- `npm run build` → **PASS**
  - Log: `return_packages/architect/_logs/ARCH_P1_build.log`
- `npm run test -- --run` → **PASS**
  - Log: `return_packages/architect/_logs/ARCH_P1_test.log`
- `npm run typecheck` → **FAIL (pre-existing non-target typed errors remain)**
  - Targeted blocker resolved: `entitlementResolver.ts:97` no longer appears.
  - Log: `return_packages/architect/_logs/ARCH_P1_typecheck.log`

## Manual UI Evidence
- Screenshot captured (app load in sandbox):
  - `/tmp/playwright-logs/page-2026-02-14T00-41-04-517Z.png`

## Remaining Blockers
- `SEV-2` Typecheck is still red due pre-existing typed test/script failures outside this P1 runtime fix set.
- `SEV-2` Manual world-mode persistence acceptance remains environment-blocked in this sandbox without valid Firebase credentials.
