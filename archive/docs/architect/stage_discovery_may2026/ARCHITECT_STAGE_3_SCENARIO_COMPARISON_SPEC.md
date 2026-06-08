# Architect Stage 3 — Scenario Comparison and Branching Spec

**Stage:** 3A (Spec Pass)
**Branch:** `feature/architect-operating-experience-stage-3-scenario-comparison`
**Base:** Stage 2E verified on `main` (commit `be12ca98`)
**Date:** 2026-05-21
**Author:** Claude Code (spec pass)

---

## Executive Summary

Stage 3 adds scenario comparison and branching to the Architect operating
experience. Stage 1 made the workspace visually continuous. Stage 2 made action
lifecycles operationally continuous. Stage 3 now answers the franchise
question the previous stages deliberately deferred: **what changed between the
world's baseline state and its current committed state, and how does this world
compare to another?**

This spec defines the comparison targets, authoritative input map, proposed
comparison view model, branching model, UI placement, safety constraints,
sub-stage implementation plan, and test plan for Stage 3. No product code is
added in this pass.

---

## Stage 3 Objective

Give the operator a read-only comparison surface that answers:

- What has changed in the active world since its baseline?
- What changed from one committed event to the next?
- What is safe to show as a committed delta vs. what must be labeled deferred?
- Which team/player/cap changes has this world accumulated?

Stage 3 must not invent deltas, must not blend local preview with committed
truth, and must not create any Firestore write path.

---

## Supported Comparison Targets

### Stage 3 Supported

| Target | Description | Authority Source | Notes |
|--------|-------------|-----------------|-------|
| **Baseline → active world (current team)** | Committed delta between the team's state at world creation and its current committed state | First `beforeTotalsByTeam` entry in world event stream (or base team snapshot at world creation) vs latest `afterTotalsByTeam` in world event stream | Primary Stage 3 target. Safe only for the active team. See authority risks. |
| **Previous committed event → current committed event** | What changed in the most recent committed mutation for the active team | `beforeTotalsByTeam` / `afterTotalsByTeam` on the most recent `useWorldTeamEvents` entry | Already partially surfaced in `HistoryDetailModal`; Stage 3 makes it a persistent comparison view. |
| **Accumulated committed event delta (multi-event, single team)** | All committed events for the active team in this world, accumulated | All `useWorldTeamEvents` entries' `playerIds`, `teamsInvolved`, `afterTotalsByTeam` | Safe. Does not require snapshot reads; derives from event stream only. |
| **Active world — changed teams summary** | Which teams have been touched in this world | `WorldMetadata.modifiedTeams` | Conservative list. `modifiedTeams` is best-effort on the world metadata doc; label as "according to world metadata." |

### Stage 3 Deferred

| Target | Description | Why Deferred |
|--------|-------------|-------------|
| **World A vs World B comparison** | Cross-world diff of two parallel scenarios | Requires loading two separate world states simultaneously. No cross-world fetch seam exists. Safe to design but not implement in Stage 3. |
| **Selected viewing season comparison** | Comparing the active world's committed state at one season to another | Multi-year committed state comparison requires per-year cap totals snapshots. Not reliably derivable from current event stream alone. |
| **Multi-season comparison** | Cross-year deltas spanning more than one season advance | Season advance changes cap holds, contracts, options, and entitlements simultaneously. Multi-season comparison requires dedicated snapshots. |
| **Full roster diff (additions + removals across all teams)** | League-wide roster change accounting | No league-wide committed event feed exists; only active-team feed is available. |
| **Draft asset / pick delta** | Changes to pick inventory | Draft positions are in `WorldMetadata.draftPositionsByYear` but not a Firestore-authoritative entitlement ledger. Entitlements sub-collection is separate and not currently surfaced for comparison. |
| **Exception / TPE delta (future years)** | Exception availability delta across seasons | Only current-season exception data from `teamCapSheet` is reliable. Future-year exception tracking is not canonical. |

### Unsafe Until Later Authority Seam Exists

| Target | Why Unsafe |
|--------|------------|
| **Parent world vs child world comparison** | `WorldMetadata.parentWorldId` and `branchedFrom` exist in data model, but no parent-world snapshot or child-divergence seam is read. Comparing a world to its parent requires reading both worlds' committed states and reconciling season/date offsets. |
| **Baseline roster vs world roster (via base collection read)** | Reading the base/source team collection directly and diffing against the world team document is unsafe in Stage 3 because the base collection schema and world team schema have diverged after mutations. A dedicated base-to-world reconciliation layer is needed first. |
| **Trade Machine draft state vs committed world state** | Local trade drafts are not committed truth. Blending draft state into a comparison surface would violate the authority model. |

---

## Authoritative Input Map

The following sources are safe for Stage 3 comparison purposes:

### Tier 1 — Committed World Truth (Safe to compare)

| Source | What It Provides | Location |
|--------|-----------------|----------|
| `useWorldTeamEvents` | All committed world events for the active team and world, ordered by `occurredAt`. Each event carries `beforeTotalsByTeam`, `afterTotalsByTeam`, `playerIds`, `teamsInvolved`, `mutationType`. | `src/features/architect/history/hooks/useWorldTeamEvents.ts` |
| `normalizeWorldEventsForTeamHistory` | Normalized event rows with `capDelta`, `capDeltaLines`, `playerIds`, `teamsInvolved`, `id`, `eventId`, `occurredAt`, `displayType`. | `src/features/architect/history/utils/normalizeWorldEventsForTeamHistory.ts` |
| `teamCapSheet` (world state) | Current committed world team state: cap totals, players, exceptions, contracts, salary summary for the active team and selected viewing season. | Dashboard state via `useArchitectState` |
| `WorldMetadata.modifiedTeams` | Best-effort list of team codes touched by committed mutations in this world. | `src/features/architect/utils/worldManager.readUtils.ts` (`WorldMetadata`) |
| `WorldMetadata.parentWorldId` | The world this world was branched from, if any. Metadata only; not a team snapshot. | Same |
| `WorldMetadata.currentSeason` / `baselineSeason` | The world's current committed season and the season at which the world was created. | Same |
| `ArchitectPostActionReceipt` | Most recent committed mutation receipt: `changedTeamCodes`, `primaryPlayerIds`, `eventId`, `occurredAt`. Session-scoped. | `src/features/architect/GMDashboard/postActionHandoff/types.ts` |

### Tier 2 — Derived View Data (Safe to present, label as derived)

| Source | What It Provides | Authority Label |
|--------|-----------------|----------------|
| Cap totals from `teamCapSheet` | `totalSalary`, `capSpace`, `taxSpace`, `isAtOrAboveFirstApron`, `isAboveSecondApron`, `hardCapActive`, `exceptionsSummary` for current viewing season | `committed-world / current-season` |
| `useArchitectWorkspaceContext` | Roster count, cap summary, exceptions summary, season context, mode presentation | Derived from `teamCapSheet` + world metadata |
| `computeTeamCapTotals` | Pure cap total computation from a team snapshot; can be called on historical `afterTotalsByTeam` snapshots | `committed-world` when fed committed event data |

### Tier 3 — Deferred / Unreliable for Comparison

| Source | Why Deferred |
|--------|-------------|
| Base/source team collection (Firestore) | Base collection is read-only but diffing against world state requires reconciling schema evolution. Deferred until a base-to-world reconciliation seam exists. |
| `draftPositionsByYear` | Best-effort tracking; not a canonical entitlement ledger. Draft asset delta is not reliably comparable without the entitlements sub-collection as SSOT. |
| Exception/TPE for future years | Only current-season exception data is canonical on `teamCapSheet`. Future-year exception authority does not exist yet. |
| Local/pending/DEV preview state | Never part of any comparison surface. All comparisons must be committed-truth only. |

---

## Proposed Comparison View Model

Each field is authority-labeled. No field may appear without an authority label.

```ts
interface Stage3ComparisonViewModel {
  /**
   * Which team and world this comparison covers.
   * authority: 'committed-world'
   */
  scope: {
    teamCode: string;
    worldId: string;
    worldName: string | null;
    baselineSeason: string | null;
    currentSeason: string | null;
    authority: 'committed-world';
  };

  /**
   * Players that appear in committed event playerIds for signing/trade events
   * and are present in current teamCapSheet but not in baseline.
   * authority: 'committed-world / event-derived'
   * Note: derived from event stream playerIds; not guaranteed to be exhaustive
   * for all possible roster changes across all edge cases.
   */
  rosterAdditions: {
    playerId: string;
    displayName: string | null;
    authority: 'committed-world / event-derived';
  }[];

  /**
   * Players that appear in committed event playerIds for trade/waive events
   * and are absent from current teamCapSheet.
   * authority: 'committed-world / event-derived'
   */
  rosterRemovals: {
    playerId: string;
    displayName: string | null;
    authority: 'committed-world / event-derived';
  }[];

  /**
   * Players touched by committed events (contract action, extend, option, etc.)
   * who are still on the current roster.
   * authority: 'committed-world / event-derived'
   */
  rosterChangedPlayers: {
    playerId: string;
    displayName: string | null;
    authority: 'committed-world / event-derived';
  }[];

  /**
   * Cap total delta: current committed cap allocation minus baseline
   * cap allocation. Derived from first event's beforeTotalsByTeam vs
   * latest event's afterTotalsByTeam.
   * authority: 'committed-world / event-derived'
   * null if fewer than one committed event exists.
   */
  capTotalDelta: {
    totalSalaryDelta: number | null;
    capSpaceDelta: number | null;
    taxSpaceDelta: number | null;
    authority: 'committed-world / event-derived';
  } | null;

  /**
   * Tax/apron posture delta: whether the world crossed an apron line
   * relative to baseline.
   * Derived from first event's beforeTotalsByTeam vs latest event's
   * afterTotalsByTeam using isAtOrAboveFirstApron / isAboveSecondApron.
   * authority: 'committed-world / event-derived'
   * null if not derivable.
   */
  taxApronPostureDelta: {
    crossedFirstApron: boolean | null;
    crossedSecondApron: boolean | null;
    hardCapActivated: boolean | null;
    authority: 'committed-world / event-derived';
  } | null;

  /**
   * Exception/TPE delta: deferred. Not reliably derivable across
   * multi-mutation sequences in Stage 3.
   */
  exceptionDelta: {
    status: 'deferred';
    reason: 'Exception delta across multiple mutations is not reliably derivable from the current event stream.';
  };

  /**
   * Team codes that appear in teamsInvolved across all committed events
   * in this world for the active team.
   * authority: 'committed-world / event-derived'
   */
  changedTeams: {
    teamCodes: string[];
    authority: 'committed-world / event-derived';
  };

  /**
   * Player ids that appear across all committed event playerIds in this
   * world for the active team.
   * authority: 'committed-world / event-derived'
   */
  changedPlayers: {
    playerIds: string[];
    authority: 'committed-world / event-derived';
  };

  /**
   * Total number of committed events in this world for the active team.
   * authority: 'committed-world'
   */
  committedEventCount: number;

  /**
   * References to committed events relevant to this comparison.
   * Used to link comparison fields back to specific History entries.
   * authority: 'committed-world'
   */
  committedEventReferences: {
    eventId: string;
    mutationType: string;
    occurredAt: string | null;
    authority: 'committed-world';
  }[];

  /**
   * Fields that cannot be shown because the authority source is
   * unavailable, deferred, or mixed. Must be shown to the user
   * rather than omitted silently.
   */
  unavailableSummary: {
    field: string;
    reason: string;
  }[];
}
```

---

## Branching Model and Boundaries

### What a World Is

A world is a named, durable scenario container in Firestore. It holds:

- A metadata document (`WorldMetadata`) with identity, lineage, season, date, and stats fields.
- Team snapshots that are modified copies of the base team documents. Only teams touched by committed mutations have world-team documents.
- A world events sub-collection recording all committed mutations in order.
- An entitlements sub-collection for pick and asset tracking.

Each world is a full, independent committed state. There is no "live diff" against the base collection — worlds are discrete snapshots.

### What a Sandbox / No-World State Is

When no world is active, the dashboard reads from the base/source team collection. This is a read-only view of the league's baseline state. It is:

- Not a world. There is no `worldId`, no committed events, no world mutations.
- Not comparable using the comparison view model (no events to derive from).
- Labeled "Sandbox" in the workspace header per Stage 1.

Stage 3 comparison is only available when a world is active.

### What an Active Scenario Branch Means

A world may be created with a `parentWorldId`. When it is:

- `WorldMetadata.parentWorldId` stores the parent world's id.
- `WorldMetadata.branchedFrom` stores the timestamp of branching.
- The parent world's `childWorlds` array is updated with the child world id.

This is the existing branching concept. It is a data-model relationship only: no team snapshot is copied at branch time. The child world starts with the same base data as any other world and records its own committed events from that point.

**Stage 3 does not add branch creation UI.** Branch creation already exists via `createWorld` with `parentWorldId` in `worldManager.core.ts`. The `WorldSelector` component already allows creating worlds. Stage 3 adds **comparison UI only**, not branching UI.

**Parent-world comparison is deferred.** Comparing a child world to its parent world would require loading the parent world's team state, which introduces a second world read. This is safe to design but is deferred from Stage 3 implementation. The parent world id will be surfaced in the comparison UI as a metadata field.

### What Remains Deferred

- Parent-world vs child-world team state comparison.
- World A vs World B cross-world comparison (requires dual-world state loading).
- Branch creation commands or UI.
- World merge or reconciliation.
- "What if I branch here?" guided workflow.

---

## UI Placement Recommendation

### Recommended: New "Comparison" Tab in GMDashboard

**Rationale:** The existing tab pattern in `GMDashboard` (`roster`, `cap`, `cap-table`, `trade`, `free-agency`, `offseason`, `history`) is the primary navigation model. Adding a `comparison` tab:

- Follows established navigation conventions.
- Keeps the comparison surface separate from operational surfaces.
- Allows the comparison tab to be empty/unavailable in sandbox mode without affecting other tabs.
- Makes the feature discoverable without disrupting the workspace header or activity rail.

**Placement in the tab order:** After `history`, before any future Stage 4+ tabs.

**Tab behavior:**
- Only renderable when a world is active.
- In sandbox/no-world mode: renders a conservative empty state explaining that comparison requires an active world.
- In world mode: renders the `Stage3ComparisonViewModel` derived from the active world's committed event stream.

### Rejected Alternatives

| Alternative | Why Rejected |
|-------------|-------------|
| Panel under workspace header | Would clutter the persistent cockpit layer. The header is the orientation surface; adding comparison data there competes with world/team/mode identity signals. |
| Section within History | History owns the committed event timeline. Comparison is a different question (what changed in aggregate) vs History (what happened in sequence). Merging them would confuse both surfaces. |
| Collapsible panel in the activity rail | The rail is a recent-activity surface, not a full comparison surface. A comparison panel would outgrow the rail's compact design quickly. |

---

## Stage 3B Implementation Scope

**Goal:** Create the comparison foundation — pure helpers and data derivation — without UI.

### Deliverables

1. **`src/features/architect/comparison/deriveComparisonViewModel.ts`**
   Pure function: takes the normalized event rows from `useWorldTeamEvents` (already available via `normalizeWorldEventsForTeamHistory`) and `WorldMetadata`, and returns a `Stage3ComparisonViewModel`. No Firestore reads. No React. No state.

2. **`src/features/architect/comparison/types.ts`**
   TypeScript types for `Stage3ComparisonViewModel` and its sub-types, exactly as specified in the view model section above. Authority labels as string literals on each field.

3. **`src/features/architect/comparison/rosterDelta.ts`**
   Pure helper: derives `rosterAdditions`, `rosterRemovals`, `rosterChangedPlayers` from a list of normalized event rows and an optional current `teamCapSheet.players` array. Returns authority-labeled arrays or empty arrays; never throws on missing data.

4. **`src/features/architect/comparison/capDelta.ts`**
   Pure helper: derives `capTotalDelta` and `taxApronPostureDelta` from the first and last committed events' `beforeTotalsByTeam` / `afterTotalsByTeam` snapshots. Returns null if fewer than one event exists; never invents deltas from empty data.

5. **`src/features/architect/comparison/seasonMismatch.ts`**
   Pure helper: checks whether the comparison covers events that span a season advance. Returns a `seasonMismatch` flag and the seasons involved. Prevents multi-season comparisons from being silently presented as single-season deltas.

### Acceptance Criteria for Stage 3B

- `deriveComparisonViewModel` returns a valid `Stage3ComparisonViewModel` from any non-empty event stream.
- `deriveComparisonViewModel` returns a safe empty view model (zero deltas, unavailable summaries populated) when the event stream is empty.
- `rosterDelta.ts` returns empty arrays when no roster-affecting events exist.
- `capDelta.ts` returns null when fewer than one event with cap totals exists.
- `seasonMismatch.ts` correctly identifies events spanning a season advance.
- No Firestore reads, React imports, or state mutations in any Stage 3B file.
- All Stage 3B helpers are pure functions: same inputs produce same outputs.
- `npm run typecheck` passes.
- `npm run validate:project` passes.
- Stage 3B tests (defined in the test plan below) pass.

### Acceptance Criteria — Non-Goals

- No comparison UI.
- No new tab in GMDashboard.
- No changes to `mutationPipeline`, `seasonManager`, `worldManager`.
- No Firestore writes.
- No new event source.

---

## Stage 3C Implementation Scope

**Goal:** Add the read-only Comparison tab to GMDashboard, wired to the Stage 3B helpers.

### Deliverables

1. **`src/features/architect/GMDashboard/sections/ComparisonSection.tsx`**
   New tab section. Consumes `Stage3ComparisonViewModel` as a prop. Renders:
   - Scope header: team, world, baseline season, current season.
   - Roster delta list: additions, removals, changed players with authority labels.
   - Cap/tax/apron posture delta summary with authority labels.
   - Changed teams and changed players counts.
   - Committed event count with a link to History.
   - Unavailable summary items with explanations.
   - Sandbox/no-world empty state.

2. **`src/features/architect/GMDashboard/hooks/useComparisonViewModel.ts`**
   Thin hook: feeds world events from `useWorldTeamEvents` and `WorldMetadata` from `useArchitectWorkspaceContext` into `deriveComparisonViewModel`. Returns the view model and a loading/unavailable state. No new Firestore reads beyond what these hooks already do.

3. **`GMDashboard.tsx` wiring:**
   - Add `'comparison'` to the tab set.
   - Add `ComparisonSection` to the tab panel switch.
   - Pass `useComparisonViewModel` output to `ComparisonSection`.
   - Comparison tab is only active when a world is active (`worldId` non-null).

### Acceptance Criteria for Stage 3C

- Comparison tab renders when a world is active.
- Comparison tab shows sandbox empty state when no world is active.
- All displayed deltas are labeled with their authority string.
- No local preview, pending, or DEV state is shown in the comparison tab.
- No inline mutations or action callbacks exist in `ComparisonSection`.
- Clicking committed event references opens History detail (reuses Stage 2D `requestHistoryEventDetail` seam).
- The comparison tab does not affect any other tab's behavior.
- `npm run typecheck` passes.
- `npm run validate:project` passes.
- `npm run build` passes.
- Stage 3C UI tests pass.

### Acceptance Criteria — Non-Goals

- No Firestore writes.
- No new event source.
- No scenario branching UI.
- No parent-world comparison.
- No cross-world comparison.
- No multi-season comparison.

---

## Stage 3D Verification Scope

**Goal:** Confirm Stage 3 is complete and safe before opening the PR.

### Verification Checklist

1. All Stage 3B pure helpers pass their targeted tests.
2. All Stage 3C UI components pass their targeted tests.
3. `npm run typecheck` is clean.
4. `npm run validate:project` passes.
5. `npm run build` is clean (no new warnings or errors).
6. Stage 1 and Stage 2 test suites pass with no new failures.
7. Manual verification: Comparison tab renders correctly for an active world with committed events.
8. Manual verification: Comparison tab renders sandbox empty state when no world is active.
9. Manual verification: No local/pending/DEV state appears in the comparison view.
10. Manual verification: Authority labels are visible on every comparison field.
11. Guardrail confirmations:
    - No Firestore writes added.
    - No new event source added.
    - No mutation pipeline changes.
    - No seasonManager changes.
    - No worldManager changes.
    - No baseline delta invention.
    - No cross-world comparison.
    - No branch creation UI.
    - No parent-world comparison implemented (only metadata surfaced).

---

## Explicit Non-Goals for Stage 3

The following items are out of scope for all of Stage 3A–3D:

- **No Firestore writes.** The comparison surface is read-only.
- **No new event source.** All comparison data derives from `useWorldTeamEvents` and `WorldMetadata`.
- **No mutation pipeline authority changes.** `mutationPipeline.ts` is not modified.
- **No seasonManager authority changes.** `seasonManager.ts` is not modified.
- **No worldManager authority changes.** `worldManager.ts` / `worldManager.core.ts` are not modified.
- **No baseline delta invention.** Deltas must derive from the committed event stream's own `beforeTotalsByTeam` / `afterTotalsByTeam`. No synthetic or computed deltas.
- **No local/pending state in comparison.** Local preview, trade drafts, DEV preview, and optimistic state are never part of the comparison view model.
- **No cross-world comparison UI.** World A vs World B requires a second world load seam that does not exist yet.
- **No branch creation UI.** Branch creation already exists via `createWorld`; Stage 3 does not add new creation commands.
- **No parent-world team-state comparison.** Parent world id will be surfaced as metadata only; no parent-world team state is loaded.
- **No guided franchise questions.** That is Stage 4 scope.
- **No draft asset ledger.** Draft pick comparison is deferred; the entitlements sub-collection is not the comparison source in Stage 3.
- **No exception/TPE future-year comparison.** Only current-season data from `teamCapSheet` is reliable.
- **No multi-season comparison.** Single-world, single-season committed event delta only.
- **No changes to History, Cap Sheet, Roster, Trade Machine, Free Agency, or Offseason sections.** Stage 3 adds one new section.
- **No changes to Stage 1 or Stage 2 surfaces.** The workspace header, post-action handoff, and activity rail are unchanged.

---

## Authority Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Baseline cap snapshot is stale or absent | If the first event's `beforeTotalsByTeam` for the active team is empty or null, return `capTotalDelta: null` and add an entry to `unavailableSummary`. Never invent a cap baseline. |
| Roster delta is overclaimed (event-derived player ids don't match current roster truth) | Label all roster delta fields `'committed-world / event-derived'`. Display them as "players that appeared in committed events," not "current roster members." Always derive current roster membership from `teamCapSheet.players`, not from event player ids. |
| Season mismatch causes wrong cap-delta sign | Use `seasonMismatch.ts` helper to detect season advances in the event stream. If season advance events are present, label the cap delta as "multi-season / accumulated" and note the seasons covered. |
| Local preview state sneaks into comparison | Never read from `TradeReceiptPanel`, `CapAuditDebugPanel`, local audit events, or DEV preview state in Stage 3B/3C code. All inputs must come from `useWorldTeamEvents` (committed-only) or `WorldMetadata`. |
| Parent world id displayed as a navigation target | Surface `parentWorldId` as metadata only ("branched from world: [id]"). No link that loads the parent world's team state. |
| Draft asset comparison presented as authoritative | Draft pick delta is in `unavailableSummary` by default. No draft comparison field in the view model until a canonical entitlement ledger comparison seam exists. |
| Comparison tab visible in sandbox mode with no data | The `ComparisonSection` renders a dedicated sandbox empty state when `worldId` is null; it does not attempt to derive a comparison view model in that case. |
| `changedTeams` from `WorldMetadata.modifiedTeams` is incomplete | Label `changedTeams` from world metadata as "according to world metadata (best-effort)." The event-derived `teamsInvolved` accumulation provides the more authoritative list. |
| Multi-mutation exception pool drift | Exception delta field is statically `deferred` with an explanation. It will never silently show a wrong value. |

---

## Test Plan

All tests must be targeted to Stage 3 logic. Do not run the full test suite unless
authorized with `RUN FULL SUITE`.

### Stage 3B Tests — Pure Helpers

**File:** `src/features/architect/comparison/__tests__/deriveComparisonViewModel.test.ts`

| Test | Description |
|------|-------------|
| Empty event stream → safe empty view model | No events → all delta fields null or empty, `committedEventCount: 0`, `unavailableSummary` populated |
| Single event → cap delta derived from before/after totals | One event with `beforeTotalsByTeam` and `afterTotalsByTeam` → `capTotalDelta` has correct sign and magnitude |
| Multiple events → accumulated player ids | Three events with overlapping `playerIds` → `changedPlayers` deduplicates correctly |
| Season advance event present → `seasonMismatch` flagged | Event stream includes a `seasonAdvanced` mutation type → comparison view model notes multi-season coverage |
| Missing `beforeTotalsByTeam` on first event → cap delta null | First event has no `beforeTotalsByTeam` for active team → `capTotalDelta` is null, `unavailableSummary` has entry |
| Authority labels present on all fields | View model has `authority` strings on scope, capTotalDelta, taxApronPostureDelta, changedTeams, changedPlayers, rosterAdditions, rosterRemovals |

**File:** `src/features/architect/comparison/__tests__/rosterDelta.test.ts`

| Test | Description |
|------|-------------|
| No signing/trade events → empty additions and removals | No roster-affecting events → all three arrays empty |
| Signing event with player id → addition if player is in current roster | Player id in event + player in `teamCapSheet.players` → appears in `rosterAdditions` |
| Trade event with player id → removal if player absent from current roster | Player id in event + player absent from `teamCapSheet.players` → appears in `rosterRemovals` |
| Multiple events with same player id → deduplication | Same player id in two events → appears once in `changedPlayers` |
| Contract action event with player in roster → changedPlayers | `contractAction`-type event with player still on roster → appears in `rosterChangedPlayers` |

**File:** `src/features/architect/comparison/__tests__/capDelta.test.ts`

| Test | Description |
|------|-------------|
| No events → null delta | Empty event array → returns null |
| One event, both totals present → correct delta | Single event → `totalSalaryDelta` = after − before |
| One event, missing active-team entry in totals → null delta | Active team code absent from `afterTotalsByTeam` → returns null |
| First apron crossed in latest event → `crossedFirstApron: true` | Before: below apron; after: above apron → `taxApronPostureDelta.crossedFirstApron === true` |
| Authority label present | Return value has `authority: 'committed-world / event-derived'` |

**File:** `src/features/architect/comparison/__tests__/seasonMismatch.test.ts`

| Test | Description |
|------|-------------|
| No season advance events → `seasonMismatch: false` | Event stream with no `seasonAdvanced` type → clean single-season |
| Season advance event present → `seasonMismatch: true` with seasons | Stream includes `seasonAdvanced` → seasons array identifies before/after seasons |
| Season mismatch returned in view model `unavailableSummary` | View model notes multi-season coverage when mismatch detected |

**File:** `src/features/architect/comparison/__tests__/authorityLabels.test.ts`

| Test | Description |
|------|-------------|
| No local/pending state accepted as input | `deriveComparisonViewModel` with a mock event that has `localPendingDeferred: true` — does not use the event |
| Exception delta always deferred | `exceptionDelta.status` is always `'deferred'` regardless of input |
| Unavailable summary never empty when data is missing | When cap totals are absent, `unavailableSummary` has at least one entry explaining the gap |

### Stage 3C Tests — UI Rendering

**File:** `src/features/architect/GMDashboard/sections/__tests__/ComparisonSection.test.tsx`

| Test | Description |
|------|-------------|
| Renders sandbox empty state when worldId is null | No world active → sandbox explanation rendered; no comparison data shown |
| Renders comparison data when view model has entries | View model with roster additions and cap delta → both rendered with authority labels |
| Authority label visible on cap delta | Cap delta section contains `'committed-world / event-derived'` label text |
| Deferred fields show deferred explanation | Exception delta renders deferred explanation, not a numeric value |
| Unavailable summary items rendered | `unavailableSummary` array items displayed with their reason strings |
| No mutation callbacks in component | `ComparisonSection` renders without any action or mutation props |
| History link calls `onOpenHistoryEntry` | Committed event references render a button that calls `onOpenHistoryEntry` |

---

## Files Inspected

| File | Purpose |
|------|---------|
| `docs/architect/ARCHITECT_NEXT_ERA_MASTER_PLAN.md` | Stage 3 roadmap framing, non-goals, implementation principles |
| `docs/architect/ARCHITECT_STAGE_2_FINAL_VERIFICATION.md` | Stage 2 verification, deferred items list |
| `docs/architect/ARCHITECT_WORLD_OPERATING_EXPERIENCE_SPEC.md` | Stage 1 scope, truth-boundary rules, recommended UI seams |
| `docs/architect/ARCHITECT_STAGE_2B_POST_ACTION_HANDOFF_DISCOVERY.md` | Receipt model, rail refresh seam, authority risks |
| `docs/architect/ARCHITECT_STAGE_2C_PLAYER_ROSTER_CONTINUITY_DISCOVERY.md` | Player focus seam, roster authority, Stage 2D coupling |
| `docs/architect/ARCHITECT_STAGE_2D_HISTORY_ACTIVITY_DEEPLINK_DISCOVERY.md` | History deep-link seam, before/after totals in normalized events |
| `src/features/architect/GMDashboard/GMDashboard.tsx` | Composition shell, tab pattern, seam wiring |
| `src/features/architect/GMDashboard/components/ArchitectWorkspaceHeader.tsx` | Stage 1 persistent cockpit; orientation layer anchor |
| `src/features/architect/GMDashboard/components/ArchitectPostActionHandoff.tsx` | Stage 2B receipt strip; navigation-only |
| `src/features/architect/GMDashboard/components/ScenarioMoveRail.tsx` | Stage 2B/2D activity rail; committed-only event display |
| `src/features/architect/GMDashboard/hooks/useArchitectWorkspaceContext.ts` | Read-only workspace view model; cap summary, roster summary, world metadata |
| `src/features/architect/GMDashboard/hooks/useArchitectPostActionReceipt.ts` | Stage 2B receipt store; session-scoped, no Firestore |
| `src/features/architect/GMDashboard/postActionHandoff/types.ts` | Receipt model; `changedTeamCodes`, `primaryPlayerIds`, `eventId` derivation |
| `src/features/architect/GMDashboard/postActionHandoff/playerFocus.ts` | Stage 2C player identity matching helpers |
| `src/features/architect/history/hooks/useWorldTeamEvents.ts` | Authoritative committed-event fetch; pagination; `refreshKey` |
| `src/features/architect/history/utils/normalizeWorldEventsForTeamHistory.ts` | Normalized event rows: `playerIds`, `teamsInvolved`, `beforeTotalsByTeam`, `afterTotalsByTeam`, `capDelta` |
| `src/features/architect/utils/mutationPipeline.ts` | Committed mutation authority; `changedTeams`, `changedPlayers`, `event`, `writesSummary` |
| `src/features/architect/utils/worldManager.ts` | World lifecycle authority |
| `src/features/architect/utils/worldManager.core.ts` | `createWorld` with `parentWorldId`; branching data model already exists |
| `src/features/architect/utils/worldManager.readUtils.ts` | `WorldMetadata` type: `parentWorldId`, `branchedFrom`, `childWorlds`, `modifiedTeams`, `currentSeason`, `baselineSeason` |
| `src/features/architect/utils/seasonManager.ts` | Season-transition authority; sibling to mutationPipeline |
