# ARCHITECT WORLD TIME ISSUE LOG

## STEP 1 — League / World Time / As-Of Ownership and Source of Truth

| Issue ID | Related Step(s) | Severity | Description | Status |
|----------|-----------------|----------|-------------|--------|
| WT-1-1 | WT-1A | MEDIUM | Active world lifecycle ownership is split: `WorldSelector.tsx` owns localStorage restore/persist of `worldId` and invalid-world cleanup internally, rather than this being fully driven through `useArchitectState.ts`. The state hook is the real owner of `worldId`, but the full active-world lifecycle (restore, persist, invalidate) does not yet flow entirely through the central state layer. | RESOLVED — restore, persist, and invalid-world cleanup now live in `useArchitectState.ts` and flow through `activeWorldOwner`. |
| WT-1-2 | WT-1B | MEDIUM | World date / as-of mutation ownership is widget-owned: `WorldTimeControls.tsx` calls `updateWorldMetadata(...)` directly and pushes the result back into state via `setAsOfDate(...)`. The state hook owns the stored date value, but the mutation path bypasses it entirely. Mutation ownership does not match state ownership, creating a split seam that mirrors the world selection problem. | RESOLVED — world-date metadata mutation now lives in `useArchitectState.ts` and flows through `worldTimeOwner`. |
| WT-1-3 | WT-1C, WT-1D | LOW | The world-vs-no-world policy boundary is coherent but distributed across at least four separate layers (`WorldSelector.tsx`, `WorldTimeControls.tsx`, `useArchitectState.ts`, `GMDashboard.tsx`), with no single named policy seam and no focused guardrails protecting it. The ownership seams for world/time state are currently readable but depend on informal convention rather than structural enforcement, making slow drift plausible as downstream features accrete. | RESOLVED — the hook now publishes a named `worldModeBoundary` contract and focused tests/guardrails pin sandbox vs world-backed behavior across the hook, dashboard, and selector seam. |

---

## STEP 2 — World Selection Lifecycle and Persistence Truth

| Issue ID | Related Step(s) | Severity | Description | Status |
|----------|------------------|----------|-------------|--------|
| WT-2-1 | WT-2A | MEDIUM | Archive and delete lifecycle actions do not each route through one explicit persistence owner. The UI archives by calling `updateWorldMetadata(..., { isArchived: true })` directly instead of routing through the dedicated `archiveWorld(...)` helper that includes a permission check. The persistence module still exposes a deprecated `deleteWorld(...)` path alongside the real full-delete path `purgeWorld(...)`, creating a duplicate lifecycle surface even though the UI currently uses the correct path. | OPEN |
| WT-2-2 | WT-2B | MEDIUM | The active-world selection lifecycle (restore, persist, invalidate, switch, clear after archive/delete) is centered in `useArchitectState.ts` after Step 1 but still lacks explicit durability as one coherent lifecycle model. The seam connecting widget flow, state ownership, and persistence outcomes across all transition cases has not been fully hardened, leaving restore/switch/clear edge cases without structural enforcement. | OPEN |
| WT-2-3 | WT-2A, WT-2B, WT-2C | LOW | World selection lifecycle truth depends on informal convention rather than focused structural guardrails. Core lifecycle assumptions — the selector remaining a control surface, archive/delete routing through intended persistence paths, restore/persist/invalidate/switch flowing through the state owner, deprecated helpers not quietly becoming active again — have no focused protection. Drift in any of these seams can silently distort downstream Architect behavior without immediately appearing broken. | OPEN |
