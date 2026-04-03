# ARCHITECT WORLD TIME REVIEW TRACKER

## STEP 1 — League / World Time / As-Of Ownership and Source of Truth

| ID    | Title                                                             | Status | Notes |
|-------|-------------------------------------------------------------------|--------|-------|
| WT-1A | Centralize Active World Ownership More Explicitly                 | DONE   | Active-world restore, persist, and invalidation now flow through `useArchitectState.ts` owner seams. |
| WT-1B | Centralize World Date / As-Of Mutation Ownership More Explicitly  | DONE   | World-date metadata mutation now flows through `useArchitectState.ts` via `worldTimeOwner`. |
| WT-1C | Make the World vs No-World Policy Boundary More Explicit          | DONE   | `useArchitectState.ts` now publishes a named `worldModeBoundary` seam that distinguishes sandbox vs world-backed mode. |
| WT-1D | Add Focused Guardrails for World/Time Ownership Cleanliness       | DONE   | Focused hook, dashboard, and compatibility tests now pin the shared world-vs-no-world boundary contract. |

**STEP 1 STATUS: DONE**

---

## STEP 2 — World Selection Lifecycle and Persistence Truth

| ID    | Title                                                                                                      | Status | Notes |
|-------|------------------------------------------------------------------------------------------------------------|--------|-------|
| WT-2A | Tighten Archive and Delete Action Ownership So Each Lifecycle Action Routes Through One Explicit Persistence Owner | TODO |       |
| WT-2B | Tighten Selection Lifecycle Durability Around Restore / Persist / Invalidate / Switch Flows               | TODO   |       |
| WT-2C | Add Focused Guardrails for World Selection Lifecycle Truth                                                 | TODO   |       |

**STEP 2 STATUS: TODO**
