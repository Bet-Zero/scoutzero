# Return Package: Phase 16 - Offer Sheet Persistence & Workflow MVP

**Date:** 2026-01-19  
**Feature:** Architect / Cap Sheet Contract Rules  
**Phase:** 16 (Offer Sheet Persistence & Workflow MVP)  
**Status:** COMPLETE

## 1. Summary of Changes

Phase 16 implements the MVP workflows for Restricted Free Agent (RFA) Offer Sheets, establishing the full lifecycle of Store (Offering Team) → Match/Decline (Home Team) → Finalize (Offering Team).

### Key Features

* **Store-Only Offer Sheets:** New "Offer Sheet" toggle in `EditContractModal` creates persisting `OfferSheet` objects without finalizing the signing immediately.
* **Mirroring:** Offer sheets are instantly mirrored to the Home Team's `incomingOfferSheets` array for immediate visibility.
* **Match/Decline Workflow:** New UI in `FreeAgencySection` allows the Home Team to `MATCH` (retain player) or `DECLINE` (allow offering team to finalize).
* **Finalization:** Offering Team can finalize `DECLINED` offer sheets, executing the actual signing logic (add to roster, remove cap hold).

### Policy Updates

* **Declined Offers:** Updated `capLegalityValidation` to explicitly allow finalizing an offer sheet with `DECLINED` status (previously blocked).
* **Store-Only Invariants:** Enforced invariant that `rfaOfferSheetOnly` requires `PENDING_MATCH` status.

## 2. Files Changed

### UI Components

* `src/features/architect/GMDashboard/components/OfferSheetList.jsx` (New)
  * Displays "My Pending Offers" and "Incoming Offer Sheets".
  * Handles Match, Decline, and Finalize actions.
* `src/features/architect/GMDashboard/sections/FreeAgencySection.jsx`
  * Integrated `OfferSheetList`.
* `src/features/architect/GMDashboard/GMDashboard.jsx`
  * Wired new action handlers to `FreeAgencySection`.
* `src/shared/components/EditContractModal.jsx`
  * Added "Offer Sheet" checkbox/toggle logic.
  * Added `onStoreOfferSheet` prop and handler.

### Logic & Validation

* `src/features/architect/utils/mutationPipeline.js`
  * Extended `loadStateForMutation` to support multi-team loading (Offering + Home).
  * Implemented `computeStoreOfferSheetResult`, `computeMatchOfferSheetResult`, `computeDeclineOfferSheetResult`.
  * Updated `computeSigningResult` cleanup logic.
* `src/features/architect/utils/capLegalityValidation.js`
  * Updated `validateSigning` to allow finalizing `DECLINED` offers.
  * Verified store-only invariants.
* `src/features/architect/GMDashboard/hooks/useArchitectActions.ts`
  * Exposed new handlers: `handleStoreOfferSheet`, `handleMatchOfferSheet`, `handleDeclineOfferSheet`, `handleFinalizeOfferSheet`.

### Documentation

* `docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md`
  * Added Phase 16 section detailing new mutations and invariants.

## 3. Verification

### Automated Tests

* **Test Suite:** `tests/architect/capLegalityValidation.test.js`
* **Command:** `npm test -- --run tests/architect/capLegalityValidation.test.js`
* **Result:** 204 Tests Passed.
  * Confirmed `DECLINED` status no longer blocks finalization.
  * Confirmed `PENDING_MATCH` blocks finalization (resolution required).
  * Confirmed store-only invariants.

### Build Verification

* **Command:** `npm run build`
* **Result:** SUCCESS (Exit code 0)

## 4. Next Steps

* Phase 17: Offer Sheet Matching Logic (Handling `MATCHED` state retention and contract updates).
