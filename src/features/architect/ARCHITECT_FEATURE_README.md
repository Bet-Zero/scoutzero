# Architect Feature

This folder contains the **code implementation** of HoopZero Architect.  
For full design and agent guidance, see the reference docs in `/docs/`:

- [ARCHITECT_REVIEW.md](../../docs/ARCHITECT_REVIEW.md) – Full design & review document  
- [ARCHITECT_AGENTS.md](../../docs/ARCHITECT_AGENTS.md) – Rules and instructions for AI agents  

> ⚠️ Note: Architect supports both **active-world committed flows** and
> **sandbox/base/vacuum local-validated flows**.  
> Active-world GM moves save to user-owned worlds (`architect_worlds`
> collection). Sandbox/base/vacuum flows stay local-only, and preview seams
> remain distinct from committed world truth.  

## Architect Ownership Map

Architect is intentionally layered. The fastest way to route work is:

- **Composition shell:** `GMDashboard.tsx` composes the dashboard surface only.
- **Dashboard adapters:** `useArchitectState.ts` and `useArchitectActions.ts` coordinate dashboard state and UI actions, but they are not the final read or write authorities.
- **World operating presentation seams:** `useArchitectModePresentation.ts` and
  `useArchitectWorkspaceContext.ts` derive read-only labels and workspace view
  models from dashboard-owned state for future cockpit/status UI.
- **World lifecycle authority:** `worldManager.ts` owns world metadata, world lifecycle operations, and world-level metadata writes.
- **World-aware read authority:** `teamLoader.ts` owns the explicit `world -> parent world -> base` fallback contract for team and player reads.
- **Base hydration authority:** `firebaseTeamPlanHelpers.ts` owns base-only hydration for teams, players, and free agents.
- **Dashboard read adapter:** `worldTeamData.ts` adapts the lower read layers into dashboard-friendly team loads.
- **Canonical committed-write authority:** `mutationPipeline.ts` owns general committed world mutations.
- **Season-transition authority:** `seasonManager.ts` owns committed season/world advancement.
- **Sibling write-authority contract:** `mutationPipeline.ts` and `seasonManager.ts` are sibling committed-write authorities with different scopes; they share lower-level persistence hygiene but neither one is the other's orchestration owner.
- **Shared SSOT authorities:** `computeTeamCapTotals.ts` owns canonical cap totals and `contractUtils.ts` owns shared contract shaping/lookups consumed by cap sheets, trade surfaces, league views, and contract-action UI.

## Quick Answers

- **Where does world truth live?** World metadata lives in `worldManager.ts`; general committed mutation truth lives in `mutationPipeline.ts`; season/world advancement truth lives in `seasonManager.ts`.
- **Where do world-aware reads live?** `teamLoader.ts` is the world-aware fallback authority.
- **Where do committed writes live?** `mutationPipeline.ts` for general mutations, `worldManager.ts` for world metadata/lifecycle writes, and `seasonManager.ts` for season advancement writes.
- **What happens without an active world?** `useArchitectState.ts` publishes the dashboard `sandbox` boundary, while `useArchitectActions.ts` may apply `local-validated` local state or preview/local-only seams without creating committed world truth.
- **Where does Stage 1A operating context live?** The dashboard hook helpers
  compose existing state into presentation-only mode labels and workspace
  summaries. They do not read Firestore, write Firestore, or authorize actions.
- **How do `mutationPipeline.ts` and `seasonManager.ts` relate?** They are sibling committed-write authorities: point-in-time world mutations go through `mutationPipeline.ts`, while whole-world season transitions go through `seasonManager.ts`.
- **What files are orchestration/adapters?** `GMDashboard.tsx`, `useArchitectState.ts`, `useArchitectActions.ts`, and `worldTeamData.ts`.
- **Where should cap totals and contract-year truth come from?** Use `computeTeamCapTotals.ts` for canonical team totals and `contractUtils.ts` for shared contract shaping/year lookups instead of rebuilding those calculations in downstream surfaces.

## Architect Read Stack Contract

The team read stack is three distinct layers and they are not interchangeable:

1. **Layer 1: base hydration truth**  
   `firebaseTeamPlanHelpers.ts` loads and hydrates base team/player data only.
2. **Layer 2: world-aware fallback truth**  
   `teamLoader.ts` resolves team/player reads through `world -> parent world -> base`.
3. **Layer 3: dashboard-facing consumer adapter**  
   `worldTeamData.ts` adapts those lower layers into dashboard-friendly loads for `useArchitectState.ts`, `useArchitectActions.ts`, and the dashboard shell.

If a caller needs dashboard team data, use `loadWorldTeamData(...)`. If a caller needs raw world-aware authority behavior, use `teamLoader.ts`. Do not bypass the layer that matches the job.
