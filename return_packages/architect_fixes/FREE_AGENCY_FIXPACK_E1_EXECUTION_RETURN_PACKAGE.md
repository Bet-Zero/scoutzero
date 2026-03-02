# FREE_AGENCY_FIXPACK_E1 — EXECUTION RETURN PACKAGE

**Date:** 2026-03-01  
**Status:** COMPLETE

## Summary

- Implemented fail-closed Free Agency mutation truth contracts so world-mode success is only surfaced when the mutation both applies state and persists canonical world writes.
- Canonicalized sign-and-trade destination identity to `teamCode` end-to-end (UI selection -> modal submit -> action dispatch -> pipeline payload).
- Hardened renounce and exception-consumption paths so cap holds/totals and exception used/remaining values mutate deterministically and persist in world mode.
- Added deterministic regression tests for world signing closure, S&T canonicalization, renounce closure, and exception consumption.

## Root Cause(s)

- Success feedback was keyed to coarse `result.success` instead of explicit apply/persist truth.
- Sign-and-trade destination identifiers were mixed (`team.id` slug vs canonical team code) across UI and mutation boundaries.
- Renounce matching used brittle identity checks, allowing semantic no-op paths.
- Exception usage consumption logic handled only narrow mechanism strings and could miss canonical exception structures.
- Modal success normalization did not enforce authoritative persistence truth.

## What Changed (by symptom)

- **Saved-on-no-op in world mode**
  - Added explicit `appliedToLocalState`, `persistedToWorld`, and `writesSummary` to mutation results in `mutationPipeline`.
  - Added fail-closed checks for FA mutation no-op outcomes and incomplete canonical world writes.
  - Updated `useArchitectActions` authoritative/persist paths to gate success toasts on mutation truth.
- **S&T destination `"celtics"` mismatch**
  - Added canonical/team-code output mode to `TeamSelectDropdown`.
  - Normalized destination in `EditContractModal` and `useArchitectActions.handleSignAndTrade`.
  - Preserved Trade Machine behavior while normalizing to canonical code for S&T contract payload routing.
- **Renounce Absolve no visible impact**
  - Hardened renounce identity resolution (`playerId` + normalized name fallbacks).
  - Added semantic no-op guard before mutation apply.
  - Ensured hold removal + rights updates are reflected in local state and world persistence paths.
- **Exception selection cosmetic only**
  - Preserved `signedUsing` from modal -> free agent pool -> action dispatch.
  - Canonicalized signing mechanism mapping in pipeline and consumed usage into canonical exception records.
- **Legality gating consistency**
  - Updated modal confirm gating/result normalization to reject authoritative no-persist outcomes (no silent close).

## Files Changed

- `src/features/architect/utils/mutationPipeline.js`
- `src/features/architect/GMDashboard/hooks/useArchitectActions.ts`
- `src/shared/components/TeamSelectDropdown.jsx`
- `src/shared/components/EditContractModal.jsx`
- `src/features/architect/freeAgency/FreeAgentPool/FreeAgentPool.jsx`
- `src/features/architect/tradeMachine/TradeEditor.jsx`
- `src/tests/architect/useArchitectActions.freeAgency.test.tsx`
- `src/tests/architect/freeAgency_fixpack_e1.pipeline.behavior.test.js`

## Tests Added/Updated

- **Updated:** `src/tests/architect/useArchitectActions.freeAgency.test.tsx`
  - Added world sign closure assertions for truth-gated success/failure behavior.
  - Added canonical S&T destination assertion (`celtics` -> `BOS`).
  - Added renounce closure assertion (hold removal + totals + persistence invocation).
- **Added:** `src/tests/architect/freeAgency_fixpack_e1.pipeline.behavior.test.js`
  - Group A/D deterministic pipeline proof for sign persistence + exception consumption.
  - Group C deterministic pipeline proof for renounce hold removal + event-backed writes.
- **Existing guardrails preserved:** `freeAgency_closure.gate`, `phase74/phase75 room exception source scans.

## Validation Commands + Output

- `npm run validate:project` -> **PASS**
  - `All validations passed`
- `npm run build` -> **PASS**
  - `✓ built in 1m 2s` (non-blocking Vite chunk warnings)
- `npm run test:architect -- --reporter=dot` -> **PASS**
  - `Test Files 159 passed (159)`
  - `Tests 2410 passed | 1 skipped | 3 todo (2414)`
- `npm run test:trade -- --reporter=dot` -> **PASS**
  - `Test Files 58 passed (58)`
  - `Tests 532 passed | 1 skipped | 3 todo (536)`

Commands intentionally skipped:

- None. All required commands were executed in the requested order.

## Proof of Closure

- World-mode signing closure proof (state + totals + persist evidence)
  - `useArchitectActions` now requires `appliedToLocalState` + `persistedToWorld` truth before success toast.
  - New/updated tests assert local cap sheet changes, FA removal/sync paths, and world persistence writes + event evidence.
  - Pipeline now returns write counters (`writesSummary`) and fail-closes no-op/incomplete world-write outcomes.
- S&T destination proof (canonical team code)
  - `TeamSelectDropdown` now supports canonical value output.
  - `EditContractModal` and `handleSignAndTrade` normalize legacy IDs and dispatch canonical `destinationTeamCode`.
  - Deterministic test asserts slug passthrough is rejected (`celtics` not dispatched, `BOS` dispatched).
- Renounce proof (hold removed + totals + persist)
  - Renounce now resolves identity robustly and blocks no-match/no-op outcomes.
  - Deterministic tests assert cap hold removal, totals delta, and authoritative world mutation invocation.
- Exception consumption proof
  - Signing mechanism is carried end-to-end via `signedUsing`.
  - Pipeline consumes usage into canonical exception state and updates `usedAmount` / `remainingAmount`.
  - Deterministic tests assert TPMLE/room-consumption deltas after successful signing.

## Known Gaps (if any)

- None identified for ticket scope. Remaining output warnings in build/test logs are non-blocking and pre-existing (chunk-size and cap-settings projection warnings).
