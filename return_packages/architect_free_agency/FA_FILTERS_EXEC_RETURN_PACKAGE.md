# Architect Free Agency Filters + Search — Execution Return Package

## Executive Summary

Implemented a compact, local Free Agency filter bar with search, position/age/salary filters, sorting, and clear/reset controls in Architect. The list now filters and sorts client-side via a shared helper module with defensive defaults for missing data, plus utility-level tests to reduce regression risk.

This execution intentionally stays in UI/local filtering scope only.

## Files Changed

- `src/shared/utils/filtering/freeAgencyFilterUtils.ts`
  - New shared Free Agency filtering/search/sort helper.
  - Includes defaults, bucket option constants, and `applyFreeAgencyFilters`.
- `src/features/architect/freeAgency/FreeAgentPool/FreeAgencyFilterBar.tsx`
  - New compact filter/search/sort control row.
- `src/features/architect/freeAgency/FreeAgentPool/FreeAgentPoolHeader.tsx`
  - Extracted static list header row to keep pool component lean.
- `src/features/architect/freeAgency/FreeAgentPool/SelectedFreeAgentCards.tsx`
  - Extracted selected-player card strip to keep pool component under 200 lines.
- `src/features/architect/freeAgency/FreeAgentPool/FreeAgentPool.jsx`
  - Wired memoized local filtering/sorting.
  - Added clear/reset behavior and `No matches` empty state.
  - Preserved sign/sign-and-trade workflows and player lookup fallbacks.
- `src/tests/architect/utils/freeAgencyFilterUtils.test.ts`
  - New utility tests covering search, filters, and sort behavior.
- `docs/architect/free_agency_MASTER.md`
  - Added `Filters + Search (Execution)` section with scope, decisions, found files, and validation evidence.

## Filter Behaviors (Exact)

- Search:
  - Case-insensitive.
  - Accent-insensitive normalization.
  - Tokenized matching across player name, team text, and position text.
- Position filter:
  - Buckets: `Guard`, `Wing`, `Big`.
- Age filter (Balanced buckets):
  - `<=24`, `25-29`, `30+`.
  - Missing age excluded only when age filter is active.
- Salary filter (Balanced buckets using previous salary):
  - `<$5M`, `$5M-$10M`, `$10M-$20M`, `$20M+`.
  - Missing salary excluded only when salary filter is active.
- Sort options:
  - `Name A-Z`
  - `Salary high->low` (default)
  - `Age low->high`
- Clear button:
  - Resets all controls and restores default sort/list.
- Empty state:
  - Displays `No matches` when current filter state yields zero items.

## Deliberate Simplifications

- No cap-legality filter in this phase.
- No changes to world overlay pool correctness in this phase.
- No Firestore read/write path changes.

## Validation Commands + Results

- Targeted FA tests:
  - `npm run test -- --run src/tests/architect/utils/freeAgencyFilterUtils.test.ts src/tests/architect/OfferSheetList.freeAgency.test.jsx src/tests/architect/useArchitectActions.freeAgency.test.tsx src/tests/architect/useArchitectState.worldFreeAgency.test.tsx`
  - Result: pass (`4 files`, `14 tests`).
- Full test gate:
  - `npm run test -- --run`
  - Result: pass (`222 files`, `2946 passed`, `1 skipped`, `3 todo`).
- Build:
  - `npm run build`
  - Result: pass (non-blocking Vite warnings only).
- Lint:
  - `npm run lint`
  - Result: fails with pre-existing repo baseline (`2976 problems`), including generated/profile files and unrelated suites.
- Dev server smoke:
  - `npm run dev -- --host 127.0.0.1 --port 5173`
  - `curl -I http://127.0.0.1:5173`
  - Result: dev server started and served `HTTP/1.1 200 OK`.

## Test Coverage Added

- `src/tests/architect/utils/freeAgencyFilterUtils.test.ts`
  - default sort behavior
  - case-insensitive tokenized search
  - accent normalization in search
  - position bucket filtering
  - age bucket filtering
  - salary bucket filtering
  - age sort ordering with missing-age fallback
