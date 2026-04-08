# ARCHITECT ROSTER MASTER

## Purpose

This is the canonical working doc for the Architect Roster targeted feature review.

The active process source is:

- `docs/_working/architect/ARCHITECT_CHAT_WORKFLOW_CONTINUATION_GUIDE_V3.md`
- `docs/_working/architect/ARCHITECT_REMAINING_REVIEW_ROADMAP.md`

This review area was started from live repo evidence on 2026-04-08. The roadmap did not list roster as the next major item, but the live Architect roster surface is small, isolated, and directly reviewable.

## Feature Shape

**Decision:** one-step feature.

Reason:

- the live Architect roster surface is one display seam
- the roster tab does not own Firestore writes or user-created roster persistence
- the authoritative team/player truth is upstream of the roster view
- the remaining local risks are adapter clarity, legacy display-boundary clarity, and focused guardrails

This should not be expanded into the old standalone roster feature unless future live repo evidence proves Architect uses that broader surface.

## Live Scope

Primary Architect surface:

- `src/features/architect/GMDashboard/GMDashboard.tsx`
- `src/features/architect/GMDashboard/hooks/useArchitectState.ts`
- `src/features/architect/GMDashboard/sections/RosterSection.tsx`
- `src/features/architect/shared/RosterVisual/RosterVisual.tsx`

Legacy/shared files directly exercised by Architect:

- `src/features/roster/RosterSection/index.jsx`
- `src/features/roster/RosterSection/StarterCard.jsx`
- `src/features/roster/RosterSection/RotationCard.jsx`
- `src/features/roster/RosterSection/BenchCard.jsx`
- `src/features/roster/utils/index.js`
- `src/features/roster/utils/rosterUtils.js`
- `src/features/roster/utils/contractUtils.js`

Upstream truth dependencies inspected only as needed:

- `src/features/architect/utils/worldTeamData.ts`
- `src/features/architect/utils/teamLoader.ts`
- `src/features/architect/utils/firebaseTeamPlanHelpers.ts`
- `src/features/architect/hooks/useArchitectPlayerData.ts`
- `src/features/architect/utils/subscribeArchitectPlayerData.ts`
- `src/features/architect/utils/architectFirestorePaths.ts`

Relevant tests / guardrails:

- `src/tests/architect/GMDashboard.smoke.test.tsx`
- `src/tests/architect/internalWrapperBatch.e125.guardrail.test.tsx`
- `src/tests/architect/grouped33FileScope.ui.behavior.test.tsx`

## Non-Scope

- old standalone roster manager workflows
- `AddPlayerDrawer` and manual roster editing UX
- broad base-team or world-team loader redesign
- cap sheet, trade, free agency, offseason, or team history behavior changes
- product/UI behavior changes during bootstrap

## System Map

1. `GMDashboard` reads `teamId` from the route, calls `useArchitectState`, and defaults `activeTab` to `roster`.
2. `useArchitectState` loads `teamCapSheet` through `loadWorldTeamData(worldId, teamId)`.
3. In base mode, `loadWorldTeamData` delegates to `loadTeamCapSheet`, which hydrates base-team roster IDs from `architect_basePlayers`.
4. In world mode, `loadWorldTeamData` delegates to `getTeam`, which resolves world snapshot, parent world, then base team fallback.
5. `useArchitectState` also builds `playersMap` from `worldAwarePlayers`, which merges base player data from `useArchitectPlayerData` with world player overrides gathered from `getLeague(worldId)`.
6. The roster tab renders `GMDashboard/sections/RosterSection`, a thin pass-through wrapper.
7. `RosterSection` renders `RosterVisual` with `teamCapSheet`, `playersMap`, and `teamId`.
8. `RosterVisual` reads `teamCapSheet.players`, enriches each player with `playersMap` detail fallbacks, separates standard and two-way contracts with legacy roster utilities, builds starters / rotation / bench, and renders the legacy roster section component in export/display mode.
9. The legacy roster section renders starter, rotation, and bench cards with remove/add controls hidden because Architect passes `isExport`.

## Step Plan

### Step 1 - Roster Display Adapter, World/Base Truth Dependency, and Legacy Boundary

**Status:** executed, ready for whole-feature closeout review.

Substeps:

- `AR-1A` - Tighten roster display adapter truth and legacy boundary clarity. **Complete.**
- `AR-1B` - Add focused guardrails for roster world/base truth dependencies and display-only legacy rendering. **Complete.**

After Step 1 execution, run a small whole-feature closeout review because this is a one-step feature.

## Step 1 Execution Summary

Execution completed on 2026-04-08.

Code changes stayed inside the live roster seam:

- `RosterVisual` now exposes explicit cap-sheet and details-map input types for the local adapter contract.
- `teamCapSheet.players` is documented and implemented as the roster membership source.
- `playersMap` is used only as enrichment/detail truth, with lookup candidates aligned to the keys built by `useArchitectState` (`name`, normalized name, `displayName`, `id`, `player_id`, `playerId`, and bio IDs/display names).
- Hydrated team player data still wins over detail-map data when both provide the same local field.
- The legacy roster renderer is called through an explicit display/export-mode prop bundle.
- The legacy roster section only shows remove/add controls when export mode is off and mutation handlers are present.
- `RosterVisual` now normalizes the legacy roster shape before filling bench slots with two-way players, fixing the local case where `buildInitialRoster` returns a short bench instead of null slots.

Guardrail changes:

- Added `src/tests/architect/rosterVisual.adapterBoundary.test.tsx`.
- The new test uses real `RosterVisual`, real legacy roster utilities, and real legacy roster cards.
- It proves `teamCapSheet.players` membership, `playersMap` enrichment, standard vs two-way handling, starter/rotation/bench shape, and display-only add/remove control suppression.

No stop condition triggered. No Step 2 was created.

## Current Verdict

**Step 1 Execution Verdict:** `READY FOR CLOSEOUT`

The Step 1 risks identified during bootstrap were addressed inside the live roster display seam. The feature still requires the standard whole-feature closeout review before being marked closed.

## Working Docs

- `docs/_working/architect/roster/ARCHITECT_ROSTER_REVIEW_TRACKER.md`
- `docs/_working/architect/roster/ARCHITECT_ROSTER_ISSUE_LOG.md`
- `docs/_working/architect/roster/ARCHITECT_ROSTER_STEP1_REVIEW_RECORD.md`
- `docs/_working/architect/roster/ARCHITECT_ROSTER_STEP1_ACTION_BREAKDOWN.md`

## Return Packages

- `return_packages/architect/ARCHITECT_ROSTER_STEP1_BOOTSTRAP_RETURN_PACKAGE.md`
- `return_packages/architect/ARCHITECT_ROSTER_STEP1_EXECUTION_RETURN_PACKAGE.md`

## Validation Policy

Step 1 execution validation:

- `npm run test:ui -- src/tests/architect/rosterVisual.adapterBoundary.test.tsx --reporter=dot` - passed
- `npm run typecheck` - passed
- `npm run validate:project` - passed
- `npm run build` - passed with existing-style Vite warnings about stale Browserslist data, browser externalization for `fs` in `tradeDebug.ts`, mixed dynamic/static imports, and large chunks
