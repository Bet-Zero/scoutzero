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
| WT-2A | Tighten Archive and Delete Action Ownership So Each Lifecycle Action Routes Through One Explicit Persistence Owner | DONE | `WorldSelector.tsx` now routes archive through `archiveWorld(...)`, and the misleading legacy `deleteWorld(...)` helper was removed so `purgeWorld(...)` remains the only permanent-delete owner. |
| WT-2B | Tighten Selection Lifecycle Durability Around Restore / Persist / Invalidate / Switch Flows               | DONE   | `useArchitectState.ts` now owns restore/persist/invalidate/switch/clear through shared active-world lifecycle helpers that also clear world-derived transient state on selection changes. |
| WT-2C | Add Focused Guardrails for World Selection Lifecycle Truth                                                 | DONE   | Focused hook, selector, and persistence guardrails now pin Step 2 lifecycle truth across behavior tests and compatibility/source checks. |

**STEP 2 STATUS: DONE**

---

## STEP 3 — World Date / As-Of Control and Persistence Truth

| ID    | Title                                                                                                      | Status | Notes |
|-------|------------------------------------------------------------------------------------------------------------|--------|-------|
| WT-3A | Replace Synthetic Date Fallback Behavior With One Explicit As-Of Truth Policy                               | DONE   | `WorldTimeControls.tsx` now shows authoritative world truth only, and `useArchitectState.ts` blocks `+1 Day` until a persisted world `asOfDate` exists instead of fabricating a system-date fallback. |
| WT-3B | Tighten User-Facing Mutation Durability for Direct Date Edits and +1 Day                                    | DONE   | The control now surfaces inline save/advance failures, keeps owner-driven saving state visible, and snaps failed direct edits back to the last saved world date instead of acting like a soft no-op. |
| WT-3C | Tighten the Persistence Contract for As-Of Writes So the Owner Path Is Narrower and More Explicit           | DONE   | `worldManager.ts` now routes world-date persistence through explicit `updateWorldAsOfDate(...)` validation, while generic `updateWorldMetadata(...)` rejects `asOfDate` writes so the hook-owned path is narrower and easier to identify. |

**STEP 3 STATUS: DONE**
