# Phase 21 Return Package: World Time Controls & Timing Warnings

**Date:** 2026-01-20
**Feature:** Cap Sheet Contract Rules - Phase 21
**Status:** COMPLETE

## 1. Executive Summary

Phase 21 introduces practical, user-controlled world timing and non-blocking warnings for timing-sensitive CBA rules.

* **UI:** Added "Advance Day" and date picker controls to the GM Dashboard header (`WorldTimeControls.jsx`).
* **Logic:** Added simple 48-hour window check for Offer Sheets and season-boundary check for Stretch Provision.
* **Philosophy:** All timing rules successfully implemented as **WARNINGS**. No hard blocks were introduced, preserving user agency for retroactive data entry.

## 2. Changes Implemented

### 2.1 World Time Controls (UI)

* **Component:** `src/features/architect/GMDashboard/components/WorldTimeControls.jsx`
  * Displays current `asOfDate`.
  * Allows manual date selection via picker.
  * One-click "Advance Day" button.
  * Persists to `architect_worlds/{worldId}.asOfDate`.
* **Integration:** Added to `GMDashboard.jsx` header.
* **State:** Threaded through `useArchitectState.ts` (read/write).

### 2.2 Warning Rules (Soft Enforcement)

| Rule ID | Type | Condition | Trigger |
|---------|------|-----------|---------|
| `offer_sheet_window_expired` | WARNING | `asOfDate` > `offerSheet.createdAt` + 48 hours | Matching an offer sheet |
| `stretch_timing_suspicious` | WARNING | `asOfDate` > `getSeasonStartDate(seasonCode)` | Waiving with stretch |
| `stretch_timing_not_enforced_missing_season_boundary` | WARNING | Season start date unknown | Waiving with stretch |

### 2.3 Logic Updates

* **Validator:** `validateOfferSheetResolution` now accepts `asOfDate` and checks match window.
* **Validator:** `validateWaive` now accepts `asOfDate` and checks stretch timing.
* **Pipeline:** `mutationPipeline.js` passes `asOfDate` (SSOT) to these validators.
* **Helper:** Added `getSeasonStartDate()` placeholder with MVP boundaries (2024-26).

## 3. Verification

### 3.1 Automated Tests

**New Test File:** `src/features/architect/utils/validatePhase21.test.js` (10 tests)

* **Offer Sheet Window (6 tests):**
  * ✅ Match on Day 1/2/3 -> Valid, No Warning
  * ✅ Match on Day 4 -> Valid, **HAS WARNING** (`offer_sheet_window_expired`)
  * ✅ Decline on Day 10 -> Valid, No Warning (Deadline applies to matches only)
* **Stretch Timing (4 tests):**
  * ✅ Stretch before Oct 22 -> Valid, No Warning
  * ✅ Stretch after Oct 22 -> Valid, **HAS WARNING** (`stretch_timing_suspicious`)
  * ✅ Stretch in unknown season (2031) -> Valid, **HAS WARNING** (`missing_boundary`)

**Command:**

```bash
npm test src/features/architect/utils/validatePhase21.test.js
```

### 3.2 Manual Verification Steps (For User)

1. **Dashboard:** Verify "World Time" control appears in header.
2. **Date Change:** Change date to `2024-11-01` (mid-season).
3. **Stretch:** Try to waive & stretch a player.
    * *Expectation:* Warning "Stretch provision used after season start". Action allowed.
4. **Offer Sheet:**
    * Create offer sheet (will have today's `createdAt`).
    * Advance world date by 3 days.
    * Try to Match.
    * *Expectation:* Warning "48-hour match window expired". Action allowed.

## 4. Documentation

* Updated `docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md` with:
  * New Phase 21 section.
  * Validation Map updates (new rules).
  * Detailed Change Log.

## 5. Next Steps

* **Phase 22:** Trade Deadline Warning (similar pattern, using `asOfDate`).
* **Refinement:** Move `getSeasonStartDate` to a robust configuration file (`seasonConfig.ts`).
