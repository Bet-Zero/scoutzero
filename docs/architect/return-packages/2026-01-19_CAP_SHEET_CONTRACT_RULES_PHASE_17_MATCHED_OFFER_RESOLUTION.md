
# Phase 17 Return Package: Matched Offer Resolution

## Summary of Changes

Implemented the resolution workflow for `MATCHED` offer sheets, enabling the Home Team to finalize matched offers and retain the player, while preventing the Offering Team from finalizing or poaching the player.

### Key Features

1. **`finalizeMatchedOfferSheet` Mutation:**
    * Applies contract terms from the offer sheet to the player on the Home Team roster.
    * Removes the offer sheet from both Home Team (`incomingOfferSheets`) and Offering Team (`offerSheets`).
    * Supports atomic updates and deduplication (update-in-place) to handle retries safely.

2. **Validation Guardrails (`rfa_offer_sheet_matched_offering_team_cannot_finalize`):**
    * **HARD BLOCK:** Prevents the Offering Team from calling `finalize` (forcing `signFreeAgent`) on an offer sheet that has been `MATCHED` by the Home Team.
    * Ensures 100% contract security for the Home Team once they match.

3. **UI Updates:**
    * **Home Team:** Sees "Finalize Match" button when status is `MATCHED`.
    * **Offering Team:** Sees "Matched by Home Team" (read-only) when status is `MATCHED`.
    * **Offering Team:** Sees "Finalize Signing" only when status is `DECLINED`.

## Files Changed

* `src/features/architect/utils/mutationPipeline.js`: Added `finalizeMatchedOfferSheet` mutation, `computeFinalizeMatchedOfferSheetResult` logic, and persistence deduplication.
* `src/features/architect/utils/capLegalityValidation.js`: Added `validateOfferSheetResolution` function and new rule ID.
* `src/features/architect/GMDashboard/hooks/useArchitectActions.ts`: Updated `handleFinalizeOfferSheet` to route `MATCHED` offers to the new mutation.
* `src/features/architect/GMDashboard/components/OfferSheetList.jsx`: Updated button logic for `MATCHED` state.
* `docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md`: Updated with Phase 17 rules.

## Verification

### Automated Tests

Run the new resolution tests:

```bash
npm test -- --run tests/architect/offerSheetResolution.test.js
```

Expected output: **6 passed**

### Manual Verification Steps

1. **Scenario A: Match & Finalize (Home Team)**
    * Log in as Home Team.
    * View "Incoming Offer Sheets".
    * Click "Match". Status -> `MATCHED`.
    * Click "Finalize Match".
    * **Result:** Player contract updates to match terms. Offer sheet disappears.

2. **Scenario B: Offering Team Blocked**
    * Log in as Offering Team.
    * View "My Pending Offer Sheets".
    * If Home Team has matched, verify status shows "Matched by Home Team" and NO "Finalize" button exists.

## Stop Conditions / Known Limitations

* Phase 17 assumes "Matched" means "Standard Contract with Offer Sheet Terms". It does not currently create a specific "Match" exception type in the cap sheet, defaulting to "Standard" or whatever the offer sheet implied. Future phases can refine the `signedUsing` tag if needed.
