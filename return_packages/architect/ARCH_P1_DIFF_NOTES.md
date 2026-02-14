# ARCH P1 Diff Notes

## Key Diffs

1. **Trade apply gate hardened**
   - `TradeEditor` now derives a single `canApplyTrade` guard from `hasCurrentValidation && result?.legal === true`.
   - Defense-in-depth added in click handler with explicit re-validation toast.

2. **World-mode trade apply is now authoritative-first**
   - `applyTradeToCapSheet` now builds and validates mutation payload first.
   - In world mode it `await`s authoritative mutation path and returns before any local optimistic cap-sheet mutation.
   - Vacuum mode local behavior preserved.

3. **World overlay player merge seam added in dashboard state hook**
   - Added lightweight `worldPlayerOverrides` map captured from world league snapshots.
   - Added `worldAwarePlayers` merge used by `playersMap` and free-agent derivation.
   - This keeps FA/trade lookups aligned with world contracts/team assignments.

4. **Contract modal callback API made explicit for sign/re-sign intent**
   - New explicit props: `onSignFreeAgent`, `onResign`, `onSaveContract`.
   - Dashboard wiring updated to route sign/re-sign through `actions.handleSign`.
   - Legacy `onSave` fallback retained to avoid regressions in existing non-dashboard callers.

5. **Mutation validation switch cleanup**
   - Removed duplicate `storeOfferSheet` branch and redundant offer-sheet fallthrough no-op.
   - Switch now has one branch per offer-sheet mutation type.

6. **Tuple typing fix in entitlement resolver**
   - Added tuple-typed collection path before spread to satisfy Firestore `collection()` overload typing.

## Tradeoffs / Design Decisions
- Kept world-overlay merge localized to `useArchitectState` to avoid broad data-layer rewrite.
- Kept backward compatibility in `EditContractModal` to minimize impact radius while enabling authoritative sign/resign routing.
- Did not attempt broad repo type-error cleanup beyond G-06 target to keep scope surgical and aligned to requested must-ship set.
