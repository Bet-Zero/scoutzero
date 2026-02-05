# PHASE TM-4 — Entitlement Authoring (Execution)

**Date:** 2026-02-05

## Summary of Changes
- Replaced JSON-only entitlement editor with a tabbed form (Basics, Protection Ladder, Swap, Conveyance, Advanced JSON).
- Added Trade Machine row edit entry point and local state refresh on save.
- Extended entitlement validation for kind-specific fields and protection ladders.
- Updated entitlement display to reflect protection ladder and swap/conveyance details.

## Entitlement Model + Persistence Map

| Item | Location / Entry Point |
|---|---|
| Entitlement location | `architect_baseEntitlements` (base) + `architect_worlds/{worldId}/entitlements/{entitlementId}` (world overrides) |
| Read points | `resolveEntitlementsForTeam()` in `src/features/architect/utils/entitlements/entitlementResolver.ts`; `useTradeMachine.js` (entitlements load) |
| Write points | `writeWorldEntitlement()`, `attachEntitlementToTeam()`, `detachEntitlementFromTeam()` in `src/features/architect/utils/entitlements/entitlementWriter.ts` |
| Validation entrypoints | `validateEntitlementDocument()` in `src/features/architect/utils/entitlements/entitlementWriter.ts` |

## Files Changed
- `src/features/architect/admin/EntitlementEditorModal.tsx`
- `src/features/architect/admin/EntitlementEditorFormTabs.tsx`
- `src/features/architect/admin/EntitlementEditorBasicsTab.tsx`
- `src/features/architect/admin/EntitlementEditorProtectionTab.tsx`
- `src/features/architect/admin/EntitlementEditorSwapTab.tsx`
- `src/features/architect/admin/EntitlementEditorConveyanceTab.tsx`
- `src/features/architect/admin/EntitlementEditorAdvancedTab.tsx`
- `src/features/architect/admin/EntitlementEditorTeamInventorySection.tsx`
- `src/features/architect/admin/entitlementEditorFormState.ts`
- `src/features/architect/admin/useEntitlementEditorState.ts`
- `src/features/architect/tradeMachine/TradeEditor.jsx`
- `src/features/architect/tradeMachine/TradeTeamCard.jsx`
- `src/features/architect/tradeMachine/EntitlementPicksList.jsx`
- `src/features/architect/tradeMachine/EntitlementPickRow.jsx`
- `src/features/architect/hooks/useTradeMachine.js`
- `src/features/architect/utils/entitlements/entitlementWriter.ts`
- `src/features/architect/utils/entitlements/entitlementPickRowProjection.js`
- `src/features/architect/utils/entitlements/dare/protectionLadderFactory.ts`
- `src/schemas/architect.ts`
- `src/tests/architect/entitlementEditorModal.test.tsx`
- `src/tests/architect/entitlementPickRowDisplay.test.jsx`
- `docs/architect/TRADE_MACHINE_MASTER_AUDIT.md`
- `docs/architect/ENTITLEMENT_AUTHORING_SCHEMA_NOTES.md`
- `docs/schema/architect.md`
- `docs/schema/players_v2.md`
- `docs/components/ArchitectHierarchy.md`
- `docs/components/RosterHierarchy.md`

## How To Use (UI)
1. Enable `VITE_FEATURE_ENTITLEMENT_AUTHORING=true`.
2. Open Trade Machine and click the pencil icon on a draft entitlement row.
3. Edit fields in tabs (Protection Ladder / Swap / Conveyance) and save.
4. The entitlement row updates immediately; reload persists via world override.

## Tests Added
- `src/tests/architect/entitlementEditorModal.test.tsx`
- `src/tests/architect/entitlementPickRowDisplay.test.jsx`

**Results:** 3/3 tests passed.

## Commands Run
- `npm run schema:generate`
- `npm run validate:project` (fails: missing directories `player-scrape/contracts/output`, `player-scrape/contracts/working`, `team-scrape/shared/firestore_staging/output/merged`)
- `npm run docs`
- `npm run test -- --run src/tests/architect/entitlementEditorModal.test.tsx src/tests/architect/entitlementPickRowDisplay.test.jsx`

## Limitations / Not Yet Simulated
- Protection ladders, swaps, and conveyance terms are **not simulated** in Trade Machine validation.
- Edits are stored in world overrides only; base entitlements remain immutable.
