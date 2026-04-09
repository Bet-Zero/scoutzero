# Architect Feature

This folder contains the **code implementation** of HoopZero Architect.  
For full design and agent guidance, see the reference docs in `/docs/`:

- [ARCHITECT_REVIEW.md](../../docs/ARCHITECT_REVIEW.md) – Full design & review document  
- [ARCHITECT_AGENTS.md](../../docs/ARCHITECT_AGENTS.md) – Rules and instructions for AI agents  

> ⚠️ Note: Architect operates in a **worlds-only** mode.  
> All GM moves are saved to user-owned worlds (`architect_worlds` collection).  
> This ensures full scenario isolation and branching support.  

## Architect Ownership Map

Architect is intentionally layered. The fastest way to route work is:

- **Composition shell:** `GMDashboard.tsx` composes the dashboard surface only.
- **Dashboard adapters:** `useArchitectState.ts` and `useArchitectActions.ts` coordinate dashboard state and UI actions, but they are not the final read or write authorities.
- **World lifecycle authority:** `worldManager.ts` owns world metadata, world lifecycle operations, and world-level metadata writes.
- **World-aware read authority:** `teamLoader.ts` owns the explicit `world -> parent world -> base` fallback contract for team and player reads.
- **Base hydration authority:** `firebaseTeamPlanHelpers.ts` owns base-only hydration for teams, players, and free agents.
- **Dashboard read adapter:** `worldTeamData.ts` adapts the lower read layers into dashboard-friendly team loads.
- **Canonical committed-write authority:** `mutationPipeline.ts` owns general committed world mutations.
- **Season-transition authority:** `seasonManager.ts` owns committed season/world advancement.
- **Shared SSOT authorities:** `computeTeamCapTotals.ts` owns canonical cap totals and `contractUtils.ts` owns shared contract shaping/lookups.

## Quick Answers

- **Where does world truth live?** World metadata lives in `worldManager.ts`; general committed mutation truth lives in `mutationPipeline.ts`; season/world advancement truth lives in `seasonManager.ts`.
- **Where do world-aware reads live?** `teamLoader.ts` is the world-aware fallback authority.
- **Where do committed writes live?** `mutationPipeline.ts` for general mutations, `worldManager.ts` for world metadata/lifecycle writes, and `seasonManager.ts` for season advancement writes.
- **What files are orchestration/adapters?** `GMDashboard.tsx`, `useArchitectState.ts`, `useArchitectActions.ts`, and `worldTeamData.ts`.

## Architect Read Stack Contract

The team read stack is three distinct layers and they are not interchangeable:

1. **Layer 1: base hydration truth**  
   `firebaseTeamPlanHelpers.ts` loads and hydrates base team/player data only.
2. **Layer 2: world-aware fallback truth**  
   `teamLoader.ts` resolves team/player reads through `world -> parent world -> base`.
3. **Layer 3: dashboard-facing consumer adapter**  
   `worldTeamData.ts` adapts those lower layers into dashboard-friendly loads for `useArchitectState.ts`, `useArchitectActions.ts`, and the dashboard shell.

If a caller needs dashboard team data, use `loadWorldTeamData(...)`. If a caller needs raw world-aware authority behavior, use `teamLoader.ts`. Do not bypass the layer that matches the job.
