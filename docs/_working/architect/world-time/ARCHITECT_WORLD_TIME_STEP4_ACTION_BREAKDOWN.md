# STEP 4 — ACTION BREAKDOWN

## World-Aware Loading, Reload, and Downstream State Application

---

## WT-4A — Centralize Post-Mutation World Reload / Reapply Ownership Through One Explicit Hook-Owned Reload Path

### Problem

The feature has a real full reload owner in `useArchitectState.ts`, but post-mutation world reapplication is still split across more than one seam:

- `useArchitectState.ts` owns `reloadActiveWorldTeamData()` as the clearest full reload path
- `useArchitectActions.ts` also contains lighter mutation-side sync / reload paths such as `syncTeamFromMutationResult(...)`
- several mutation flows reapply changed-team snapshots or call `loadWorldTeamData(...)` directly, then separately refresh the roster index, instead of clearly routing through one central reload owner

That means the system has a strong reload seam, but not yet one singular reload / reapply owner story.

### Why It Matters

- world-backed Architect behavior depends on team snapshot, metadata, roster index, and player overrides staying in sync after mutations
- if mutation aftermath uses multiple reload paths, long-term drift becomes easier even when no immediate bug is visible
- downstream surfaces can become partially fresh rather than fully fresh if some flows reapply only part of the world-aware state bundle

### Goal

Make post-mutation world reload / reapply behavior route through one clearer owner seam so world-backed downstream state is easier to trust after saves.

### Success Criteria

- world mutation aftermath is more clearly routed through one explicit reload / reapply owner path
- changed-team optimization, if retained, does not leave the overall world-aware reload story split or ambiguous
- team snapshot, metadata refresh, roster-index refresh, and override reapplication tell one more coherent post-mutation story
- future contributors can more easily tell where authoritative world reapply behavior lives

---

## WT-4B — Centralize World Metadata Application So Downstream Sections Do Not Maintain Parallel World Truth

### Problem

World metadata truth is not fully centralized.

- `useArchitectState.ts` owns `worldAsOfDate` loading
- `OffseasonSection.tsx` independently calls `getWorldMetadata(worldId)` and keeps a local `worldSeason` state for season-advance UI

This is understandable locally, but it means downstream metadata truth is not fully flowing through one central world-aware owner surface.

### Why It Matters

- world-backed UI should ideally read world metadata from one coherent owner contract rather than section-local side paths
- parallel metadata reads increase the chance of partial refreshes, stale section-local state, or inconsistent downstream assumptions after reload/mutation
- once multiple world metadata fields accumulate, section-local reads become a slow-drift risk

### Goal

Make world metadata application more centralized so downstream Architect sections consume a clearer shared world metadata truth rather than maintaining their own parallel owner seams.

### Success Criteria

- downstream world metadata usage is more clearly tied to the main world-aware state owner
- section-local world metadata reads are reduced or made structurally subordinate to the main owner contract
- world season / as-of / related world metadata tells a more coherent downstream truth story
- reload after mutation is less likely to leave section-local metadata behind

---

## WT-4C — Tighten the Coordinated Load / Reapply Contract So Team Snapshot, Roster Index, and Player Overrides Stay in One Clear Truth Bundle

### Problem

The feature depends on multiple coordinated read/apply seams:

- main team snapshot loading through `loadWorldTeamData(...)`
- world metadata loading
- league-backed roster-index refresh through `getLeague(...)`
- player override merge through `worldPlayerOverrides` → `worldAwarePlayers`

These seams currently work together, but they are not yet framed as one explicit coordinated reload contract. Base-mode and world-mode team loading also differ structurally, which is not proven wrong but does increase long-term drift risk.

### Why It Matters

- world-aware downstream correctness depends on all of these pieces reapplying together coherently
- if the coordination remains implicit, future changes can preserve one part of the system while leaving another stale or under-refreshed
- this is the seam where “mostly correct” systems gradually become hard to reason about

### Goal

Make the coordinated load / reapply contract clearer and more durable so the team snapshot, metadata, roster index, and overrides are easier to audit as one connected world-aware truth system.

### Success Criteria

- the relationship between team snapshot load, metadata load, roster-index refresh, and override merge is more explicit and easier to trace
- weaker or partial reapply paths are reduced or better guarded
- downstream state is more obviously tied to the same coordinated world-aware truth bundle
- base-mode vs world-mode structural differences do not quietly weaken the reload / reapply contract

---

## Step 4 Summary

This step focuses on:

- centralizing post-mutation world reload / reapply ownership
- centralizing downstream world metadata application
- tightening the coordinated load / reapply contract across team snapshot, metadata, roster index, and player overrides

This is a **world-aware loading / reload / downstream application** step, not a broad Architect data-layer rewrite.

---

## Efficiency Note

Execution may batch naturally where the live code shows one shared seam:

- **WT-4A + WT-4B** may be executed together if central reload ownership and metadata-centralization both concentrate in `useArchitectState.ts`, `useArchitectActions.ts`, `GMDashboard.tsx`, and `OffseasonSection.tsx`
- **WT-4C** can then tighten the coordinated load / reapply contract and add focused guardrails if needed

Validation can stay tiered:

- use targeted world-aware loading / reload / downstream-state tests plus `typecheck` for intermediate seam work
- reserve broader step-closeout validation for the final batch if the changed surface justifies it

---

## Status

- Substeps defined
- Ready for bootstrap + execution
