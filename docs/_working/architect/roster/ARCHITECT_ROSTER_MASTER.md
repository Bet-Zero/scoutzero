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

**Status:** bootstrapped, ready for execution prompt.

Substeps:

- `AR-1A` - Tighten roster display adapter truth and legacy boundary clarity.
- `AR-1B` - Add focused guardrails for roster world/base truth dependencies and display-only legacy rendering.

After Step 1 execution, run a small whole-feature closeout review because this is a one-step feature.

## Current Verdict

**Step 1 Review Verdict:** `RISK`

The roster surface is coherent and display-only, but it is not a `PASS` because the world/base player-truth dependency, legacy utility boundary, and test coverage are too implicit.

## Working Docs

- `docs/_working/architect/roster/ARCHITECT_ROSTER_REVIEW_TRACKER.md`
- `docs/_working/architect/roster/ARCHITECT_ROSTER_ISSUE_LOG.md`
- `docs/_working/architect/roster/ARCHITECT_ROSTER_STEP1_REVIEW_RECORD.md`
- `docs/_working/architect/roster/ARCHITECT_ROSTER_STEP1_ACTION_BREAKDOWN.md`

## Return Packages

- `return_packages/architect/ARCHITECT_ROSTER_STEP1_BOOTSTRAP_RETURN_PACKAGE.md`

## Validation Policy

Bootstrap is discovery-only. No project validation was run.

Future Step 1 execution should use targeted validation only. Likely surfaces:

- a focused roster/RosterVisual UI test
- `npm run typecheck` after TS/TSX edits
- `npm run test:diff -- --reporter=dot` only if the execution changes enough surface area to justify milestone validation
