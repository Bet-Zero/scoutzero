# D2 Workflow Walkthroughs (Code-Trace)

## Workflow 1: World Trade Apply -> Persist -> History
1. Trigger from trade tab action wiring:
   - `src/features/architect/GMDashboard/GMDashboard.jsx:L337-L349`
   - `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:L1343-L1352`
2. Authoritative mutation execution:
   - `src/features/architect/utils/mutationPipeline.js:L1128-L1152`
   - `src/features/architect/utils/mutationPipeline.js:L1420-L1444`
3. Persist world writes + event:
   - `src/features/architect/utils/mutationPipeline.js:L3564-L3668`
4. History UI reads and normalizes event:
   - `src/features/architect/history/hooks/useWorldTeamEvents.ts:L78-L95`
   - `src/features/architect/history/utils/normalizeWorldEventsForTeamHistory.ts:L123-L153`

## Workflow 2: Free Agency Offer Sheet Store/Finalize
1. Offer sheet initiation path:
   - `src/features/architect/freeAgency/FreeAgentPool/FreeAgentPool.jsx:L187-L203`
2. Store action requires world and canonical payload:
   - `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:L1846-L1913`
3. Match/decline/finalize guarded by status/team checks:
   - `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:L1927-L2085`
4. World mutation persistence:
   - `src/features/architect/utils/mutationPipeline.js:L3526-L3690`

## Workflow 3: Offseason Preview vs World Season Advance
1. DEV preview gate:
   - `src/features/architect/GMDashboard/sections/OffseasonSection.jsx:L50-L55`
2. Preview copy (non-persisting):
   - `src/features/architect/GMDashboard/sections/OffseasonSection.jsx:L191-L195`
   - `src/features/architect/offseason/OffseasonTab/OffseasonTab.jsx:L95-L101`
3. World advance modal path and callback:
   - `src/features/architect/GMDashboard/sections/OffseasonSection.jsx:L213-L221`
4. Season advance persistence:
   - `src/features/architect/utils/seasonManager.js:L241-L260`

## Workflow 4: Entitlement Authoring -> Atomic Attach
1. Editor save intent and state:
   - `src/features/architect/admin/EntitlementEditorModal.tsx:L203-L217`
2. Unified save routing:
   - `src/features/architect/admin/saveEntitlementFromFormState.ts:L142-L174`
3. Atomic write + attach:
   - `src/features/architect/utils/entitlements/entitlementWriter.ts:L518-L598`
4. Collision fail-closed proof:
   - `src/tests/architect/entitlementWriter.collision.test.ts:L54-L86`
